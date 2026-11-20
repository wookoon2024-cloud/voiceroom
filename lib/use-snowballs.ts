"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {advanceSnow,newSnowState,reduceSnow,snowDistance,snowPoint,validSnowCommand,validSnowState,type SnowState,type SnowPoint,type SnowPlayer,type SnowCommand,type SnowEnvironment} from './snowballs';
export class SnowballStore{
 current:SnowState|null=null;private listeners=new Set<()=>void>();
 getSnapshot=()=>this.current;getServerSnapshot=()=>null;
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 set(next:SnowState|null){if(next===this.current)return;this.current=next;for(const fn of this.listeners)fn();}
}
export type SnowWorld=SnowEnvironment&{me?:SnowPlayer;heading:SnowPoint};
export type SnowballControl={store:SnowballStore;world:{current:SnowWorld};aim:{current:SnowPoint|null};owner:string;pending:boolean;message:string;request:(kind:SnowCommand['kind'],ballId:string,point:SnowPoint,aim:SnowPoint)=>void;inform:(message:string)=>void;observe:(world:SnowWorld)=>void;active:boolean};
type Options={room:string;joined:boolean;active:boolean;identity:()=>string;peers:()=>{identity:string;joinedAt:number}[];canSend:()=>boolean;publish:(packet:object,destination?:string)=>unknown};
export function useSnowballs(options:Options){
 const opts=useRef(options);useEffect(()=>{opts.current=options;},[options]);
 const [store]=useState(()=>new SnowballStore()),world=useRef<SnowWorld>({players:[],blocked:()=>true,heading:{x:0,y:1}}),aim=useRef<SnowPoint|null>(null);
 const [owner,setOwner]=useState(''),ownerRef=useRef(''),[pending,setPending]=useState(false),[message,setMessage]=useState('');
 const caps=useRef(new Map<string,{active:boolean;at:number}>()),inputs=useRef(new Map<string,{point:SnowPoint;at:number}>()),lastLeader=useRef(''),authority=useRef(''),warm=useRef(0),lastHello=useRef(0),heartbeat=useRef(0),pendingRef=useRef<{id:string;at:number}|null>(null),lastInput=useRef<{point:SnowPoint;at:number}|null>(null);
 const publish=useCallback((packet:object,destination?:string)=>opts.current.publish({...packet,room:opts.current.room},destination),[]);
 const leader=useCallback(()=>{const o=opts.current,now=Date.now(),awake=o.active&&(typeof document==='undefined'||!document.hidden);return o.peers().filter(p=>p.identity===o.identity()?awake:caps.current.get(p.identity)?.active&&now-caps.current.get(p.identity)!.at<8500).sort((a,b)=>a.joinedAt-b.joinedAt||a.identity.localeCompare(b.identity))[0]?.identity??'';},[]);
 const apply=useCallback((next:SnowState)=>{if(store.current&&authority.current===leader()&&next.version<store.current.version)return;authority.current=leader();store.set(next);if(pendingRef.current&&next.seen.includes(pendingRef.current.id)){pendingRef.current=null;setPending(false);setMessage('');}},[store,leader]);
 const environment=useCallback(()=>{const peers=new Set(opts.current.peers().map(p=>p.identity)),now=Date.now();return{blocked:world.current.blocked,players:world.current.players.filter(p=>peers.has(p.id)).map(p=>{const input=inputs.current.get(p.id);return input&&now-input.at<1500&&snowDistance(input.point,p.point)<120?{...p,point:input.point}:p;})};},[]);
 const process=useCallback((value:unknown,sender:string)=>{
  const o=opts.current,now=Date.now();if(!o.active||leader()!==o.identity()||!validSnowCommand(value))return;
  const result=now<warm.current?{state:store.current,error:'눈 놀이를 준비하고 있어요. 잠시 후 다시 눌러 주세요.'}:reduceSnow(store.current??newSnowState(o.room,now),value,sender,now,environment());
  if(result.state){apply(result.state);publish({type:'SB_STATE',state:result.state});heartbeat.current=now;}
  publish({type:'SB_RESULT',id:value.id,actor:sender,error:result.error??''},sender);
  if(sender===o.identity()){pendingRef.current=null;setPending(false);setMessage(result.error??'');}
 },[store,leader,environment,apply,publish]);
 const receive=useCallback((value:unknown,sender:string)=>{
  const p=value as {type?:string;room?:string;active?:boolean;state?:unknown;command?:unknown;point?:unknown;id?:string;actor?:string;error?:string},o=opts.current,now=Date.now();
  if(!p||p.room!==o.room||!o.peers().some(peer=>peer.identity===sender))return;
  if(p.type==='SB_HELLO'){
   if(typeof p.active!=='boolean')return;const fresh=!caps.current.has(sender);caps.current.set(sender,{active:p.active,at:now});
   if(fresh)publish({type:'SB_HELLO',active:o.active&&(typeof document==='undefined'||!document.hidden)},sender);
   if(p.active&&leader()===o.identity()&&store.current)publish({type:'SB_STATE',state:store.current},sender);return;
  }
  const host=leader();
  if(p.type==='SB_STATE'&&sender===host&&validSnowState(p.state,now)){if(authority.current!==sender||!store.current||p.state.version>store.current.version)apply(p.state);}
  else if(p.type==='SB_COMMAND')process(p.command,sender);
  else if(p.type==='SB_INPUT'&&host===o.identity()&&snowPoint(p.point))inputs.current.set(sender,{point:p.point,at:now});
  else if(p.type==='SB_PULL'&&sender===host&&store.current)publish({type:'SB_OFFER',state:store.current},sender);
  else if(p.type==='SB_OFFER'&&host===o.identity()&&now<warm.current&&validSnowState(p.state,now)&&(!store.current||p.state.version>store.current.version))apply(p.state);
  else if(p.type==='SB_RESULT'&&sender===host&&p.actor===o.identity()&&p.id===pendingRef.current?.id){pendingRef.current=null;setPending(false);setMessage(typeof p.error==='string'?p.error.slice(0,100):'');}
 },[leader,store,apply,process,publish]);
 useEffect(()=>{
  let previousActive=false;
  const reset=setTimeout(()=>{store.set(null);caps.current.clear();inputs.current.clear();lastLeader.current='';authority.current='';warm.current=0;lastHello.current=0;heartbeat.current=0;pendingRef.current=null;lastInput.current=null;aim.current=null;setPending(false);setMessage('');},0);
  const timer=setInterval(()=>{
   const o=opts.current,now=Date.now();if(!o.joined||!o.canSend())return;
   const me=o.identity(),awake=o.active&&(typeof document==='undefined'||!document.hidden);if(ownerRef.current!==me){ownerRef.current=me;setOwner(me);}
   const members=new Set(o.peers().map(p=>p.identity));for(const id of caps.current.keys())if(!members.has(id)){caps.current.delete(id);inputs.current.delete(id);}
   if(now-lastHello.current>=2500||awake!==previousActive){publish({type:'SB_HELLO',active:awake});lastHello.current=now;previousActive=awake;}
   if(pendingRef.current&&now-pendingRef.current.at>4500){pendingRef.current=null;setPending(false);setMessage('연결을 확인하고 다시 눌러 주세요.');}
   if(!awake||!world.current.me)return;
   const host=leader();if(host!==lastLeader.current){lastLeader.current=host;warm.current=host===me?now+900:0;publish({type:'SB_PULL'});}
   const own=store.current?.balls.find(b=>b.owner===me),sample=world.current.me;
   if(own&&sample&&(!lastInput.current||now-lastInput.current.at>600||now-lastInput.current.at>=120&&snowDistance(sample.point,lastInput.current.point)>2)){
    inputs.current.set(me,{point:sample.point,at:now});if(host!==me)publish({type:'SB_INPUT',point:sample.point});lastInput.current={point:sample.point,at:now};
   }
   if(host!==me||now<warm.current)return;
   const before=store.current,next=advanceSnow(before??newSnowState(o.room,now),now,environment());
   if(next!==before){
    const urgentHit=next.hits.some(h=>!(before?.hits??[]).some(bh=>bh.id===h.id));
    apply(next);
    if(urgentHit||now-heartbeat.current>=160){publish({type:'SB_STATE',state:next});heartbeat.current=now;}
   }
   else if(now-heartbeat.current>4000){publish({type:'SB_STATE',state:next});heartbeat.current=now;}
  },100);
  return()=>{clearTimeout(reset);clearInterval(timer);};
 },[options.room,options.joined,store,leader,publish,apply,environment]);
 const request=(kind:SnowCommand['kind'],ballId:string,point:SnowPoint,target:SnowPoint)=>{
  const o=opts.current;if(!o.active||!o.joined||!o.canSend()||pendingRef.current)return;
  const command:SnowCommand={id:`${o.identity()}/${Date.now()}/${Math.random().toString(36).slice(2,7)}`,actor:o.identity(),kind,ballId,point,aim:target};
  pendingRef.current={id:command.id,at:Date.now()};setPending(true);setMessage('');if(leader()===command.actor)process(command,command.actor);else publish({type:'SB_COMMAND',command});
 };
 const sync=(destination?:string)=>{publish({type:'SB_HELLO',active:opts.current.active&&(typeof document==='undefined'||!document.hidden)},destination);if(store.current&&leader()===opts.current.identity())publish({type:'SB_STATE',state:store.current},destination);};
 const observe=(next:SnowWorld)=>{world.current=next;};
 return{store,world,aim,owner,pending,message,request,inform:setMessage,observe,active:options.active,receive,sync} satisfies SnowballControl&{receive:typeof receive;sync:typeof sync};
}
