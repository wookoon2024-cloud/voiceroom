"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {officeRanking,validOfficeRun,type OfficeRun,type OfficeScore} from './office-game';
export type OfficeGameControl={ranking:OfficeScore[];submit:(run:OfficeRun)=>void;identity:()=>string;nick:()=>string};
type Options={room:string;joined:boolean;identity:()=>string;nick:()=>string;publish:(packet:object,destination?:string)=>unknown};
export function useOfficeGame(options:Options){
 const optionsRef=useRef(options);useEffect(()=>{optionsRef.current=options;},[options]);
 const [ranking,setRanking]=useState<OfficeScore[]>([]),board=useRef<OfficeRun[]>([]),pulls=useRef(new Map<string,number>());
 const publish=useCallback((packet:object,destination?:string)=>{const o=optionsRef.current;if(o.joined)o.publish({...packet,room:o.room},destination);},[]);
 const merge=useCallback((runs:OfficeRun[])=>{const next=officeRanking([...board.current,...runs]);if(next.map(s=>s.run.id).join('|')===board.current.map(r=>r.id).join('|'))return;board.current=next.map(s=>s.run);setRanking(next);},[]);
 useEffect(()=>{const reset=setTimeout(()=>{board.current=[];pulls.current.clear();setRanking([]);},0),pull=setTimeout(()=>{if(options.joined)publish({type:'OG_PULL'});},1000);return()=>{clearTimeout(reset);clearTimeout(pull);};},[options.room,options.joined,publish]);
 const sync=useCallback((destination?:string)=>{publish({type:'OG_SYNC',runs:board.current},destination);},[publish]);
 const receive=useCallback((value:unknown,sender:string)=>{
  const p=value as {type?:string;room?:string;run?:unknown;runs?:unknown},o=optionsRef.current;if(!o.joined||!sender||p?.room!==o.room)return;
  if(p.type==='OG_RUN'){if(validOfficeRun(p.run)&&p.run.owner===sender)merge([p.run]);}
  else if(p.type==='OG_SYNC'&&Array.isArray(p.runs)&&p.runs.length<=20){merge(p.runs.filter(r=>validOfficeRun(r)));}
  else if(p.type==='OG_PULL'){const now=Date.now();if(now-(pulls.current.get(sender)??0)<3000)return;pulls.current.set(sender,now);if(pulls.current.size>50)pulls.current.delete(pulls.current.keys().next().value!);const own=board.current.find(r=>r.owner===o.identity());if(own)publish({type:'OG_SYNC',runs:[own]},sender);}
 },[merge,publish]);
 const submit=(run:OfficeRun)=>{const o=optionsRef.current;if(!o.joined||run.owner!==o.identity()||!validOfficeRun(run))return;const own={...run,nick:o.nick().slice(0,80)};merge([own]);publish({type:'OG_RUN',run:own});};
 return{ranking,submit,receive,sync,identity:options.identity,nick:options.nick};
}
