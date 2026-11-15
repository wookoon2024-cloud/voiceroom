"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {advanceCamp,newCampState,reduceCamp,validCampCommand,validCampState,type CampState,type CampCommand,type CampCommandKind,type CampPoint,type CampAction} from './camp-cooking';
export type CampPeer={identity:string;joinedAt:number};
export function campLeader(peers:CampPeer[]){return [...peers].sort((a,b)=>a.joinedAt-b.joinedAt||a.identity.localeCompare(b.identity))[0]?.identity??'';}
type Options={room:string;joined:boolean;active:boolean;identity:()=>string;peers:()=>CampPeer[];canSend:()=>boolean;publish:(packet:object,destination?:string)=>unknown;onAction:(action:CampAction,remaining:number)=>void};
export function useCampCooking(options:Options){
 const opts=useRef(options),memory=useRef<CampState|null>(null),lastLeader=useRef(''),promoteUntil=useRef(0),lastHeartbeat=useRef(0);
 const capable=useRef(new Set<string>()),authority=useRef(''),lastHello=useRef(0);
 const eligible=useCallback(()=>{const o=opts.current;return o.peers().filter(p=>p.identity===o.identity()||capable.current.has(p.identity));},[]);
 const pendingRef=useRef<{id:string;at:number}|null>(null),[pending,setPending]=useState(false),[state,setState]=useState<CampState|null>(null),[message,setMessage]=useState(''),[owner,setOwner]=useState('');
 useEffect(()=>{opts.current=options;},[options]);
 const publish=useCallback((packet:object,destination?:string)=>opts.current.publish({...packet,room:opts.current.room},destination),[]);
 const apply=useCallback((next:CampState)=>{
  const old=memory.current,leader=campLeader(eligible());if(old&&next.version<old.version&&authority.current===leader)return;
  authority.current=leader;
  memory.current=next;setState(next);
  if(pendingRef.current&&next.seen.includes(pendingRef.current.id)){pendingRef.current=null;setPending(false);}
  if(next.lastAction&&next.lastAction.id!==old?.lastAction?.id){const remaining=1300-(Date.now()-next.lastAction.at);if(remaining>0)opts.current.onAction(next.lastAction,remaining);if(next.lastAction.actor===opts.current.identity()&&next.lastAction.kind==='eat')setMessage('맛있게 먹었어요!');}
 },[eligible]);
 const process=useCallback((value:unknown,sender:string)=>{
  const o=opts.current,now=Date.now();if(!o.joined||!o.active||!o.canSend()||campLeader(eligible())!==o.identity()||!validCampCommand(value))return;
  const request=value;
  if(now<promoteUntil.current){const error='요리 자리를 준비하고 있어요. 잠시 후 다시 눌러 주세요.';publish({type:'CAMP_RESULT',requestId:request.id,actor:sender,error});if(sender===o.identity()){pendingRef.current=null;setPending(false);setMessage(error);}return;}
  const result=reduceCamp(memory.current??advanceCamp(newCampState(o.room,now),now),request,sender,now);
  apply(result.state);publish({type:'CAMP_STATE',state:result.state});
  const reply={type:'CAMP_RESULT',requestId:request.id,actor:sender,error:result.error??''};publish(reply);
  if(sender===o.identity()){pendingRef.current=null;setPending(false);setMessage(result.error??(request.kind==='eat'?'맛있게 먹었어요!':request.kind==='discard'?'손을 비웠어요.':''));}
 },[apply,publish,eligible]);
 const receive=useCallback((value:unknown,sender:string)=>{
  const o=opts.current,p=value as {type?:string;room?:string;state?:unknown;request?:unknown;requestId?:string;actor?:string;error?:unknown};
  if(!p||p.room!==o.room||!sender)return;
  const peers=o.peers();if(!peers.some(peer=>peer.identity===sender)||!['CAMP_HELLO','CAMP_COMMAND','CAMP_STATE','CAMP_PULL','CAMP_OFFER','CAMP_RESULT'].includes(p.type??''))return;
  const fresh=!capable.current.has(sender);capable.current.add(sender);const leader=campLeader(eligible());
  if(p.type==='CAMP_HELLO'){if(fresh)publish({type:'CAMP_HELLO'});return;}
  if(p.type==='CAMP_COMMAND'){if(leader===o.identity())process(p.request,sender);}
  else if(p.type==='CAMP_STATE'&&sender===leader&&validCampState(p.state,Date.now())){
   if(!memory.current||authority.current!==sender||p.state.version>memory.current.version)apply(p.state);
  }else if(p.type==='CAMP_PULL'){
   if(memory.current){if(o.identity()===leader)publish({type:'CAMP_STATE',state:memory.current});else if(sender===leader)publish({type:'CAMP_OFFER',state:memory.current});}
  }else if(p.type==='CAMP_OFFER'&&leader===o.identity()&&Date.now()<promoteUntil.current&&validCampState(p.state,Date.now())&&(!memory.current||p.state.version>memory.current.version))apply(p.state);
  else if(p.type==='CAMP_RESULT'&&sender===leader&&p.actor===o.identity()&&p.requestId===pendingRef.current?.id){pendingRef.current=null;setPending(false);setMessage(typeof p.error==='string'?p.error.slice(0,120):'');}
 },[apply,process,publish,eligible]);
 useEffect(()=>{
  const reset=setTimeout(()=>{memory.current=null;capable.current.clear();authority.current='';lastHello.current=0;lastLeader.current='';lastHeartbeat.current=0;promoteUntil.current=0;pendingRef.current=null;setPending(false);setState(null);setMessage('');},0);
  const timer=setInterval(()=>{
   const o=opts.current,now=Date.now();if(!o.joined||!o.active||!o.canSend())return;
   const me=o.identity(),leader=campLeader(eligible());setOwner(me);
   if(now-lastHello.current>=5000){publish({type:'CAMP_HELLO'});lastHello.current=now;}
   if(leader!==lastLeader.current){lastLeader.current=leader;promoteUntil.current=leader===me?now+900:0;publish({type:'CAMP_PULL'});}
   if(pendingRef.current&&now-pendingRef.current.at>6000){pendingRef.current=null;setPending(false);setMessage('연결을 확인한 뒤 다시 눌러 주세요.');}
   if(!me||leader!==me||now<promoteUntil.current)return;
   const old=memory.current,next=advanceCamp(old??newCampState(o.room,now),now);
   if(next!==old){apply(next);publish({type:'CAMP_STATE',state:next});lastHeartbeat.current=now;}
   else if(now-lastHeartbeat.current>=5000){publish({type:'CAMP_STATE',state:next});lastHeartbeat.current=now;}
  },500);
  return()=>{clearTimeout(reset);clearInterval(timer);};
 },[options.room,options.joined,apply,publish,eligible]);
 const request=(kind:CampCommandKind,itemId:string,point:CampPoint)=>{
  const o=opts.current,actor=o.identity();if(!o.active||!o.joined||!o.canSend()||!actor){setMessage('방 연결을 확인해 주세요.');return false;}
  if(pendingRef.current)return false;
  const id=`${actor}/${Date.now()}/${Math.random().toString(36).slice(2,8)}`,command:CampCommand={id,actor,kind,itemId,point};
  pendingRef.current={id,at:Date.now()};setPending(true);setMessage('');
  if(campLeader(eligible())===actor)process(command,actor);else publish({type:'CAMP_COMMAND',request:command});return true;
 };
 const sync=(destination?:string)=>{publish({type:'CAMP_HELLO'},destination);if(memory.current&&campLeader(eligible())===opts.current.identity())publish({type:'CAMP_STATE',state:memory.current},destination);};
 return {state,owner,pending,message,request,sync,receive};
}
