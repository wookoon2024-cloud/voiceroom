"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {applySnowPacket,snowExpires,SNOW_DURATION,type SnowKind,type SnowPlay,type SnowPoint} from './snow-play';
export function useSnowPlay(room:string,joined:boolean,identity:()=>string,publish:(packet:object,destination?:string)=>unknown,onPlay:(play:SnowPlay,remaining:number)=>void){
 const [plays,setPlays]=useState<SnowPlay[]>([]),memory=useRef<SnowPlay[]>([]),[busy,setBusy]=useState(false);
 const onPlayRef=useRef(onPlay),busyUntil=useRef(0);
 useEffect(()=>{onPlayRef.current=onPlay;},[onPlay]);
 const receive=useCallback((packet:unknown,sender:string)=>{
  const before=memory.current,next=applySnowPacket(before,packet,sender);memory.current=next;setPlays(next);
  if((packet as {type?:string})?.type==='SNOW_PLAY')for(const play of next)if(!before.some(p=>p.id===play.id)&&Date.now()-play.at<SNOW_DURATION[play.kind])onPlayRef.current(play,SNOW_DURATION[play.kind]-(Date.now()-play.at));
 },[]);
 useEffect(()=>{
  const reset=setTimeout(()=>{memory.current=[];busyUntil.current=0;setBusy(false);setPlays([]);},0);
  const timer=setInterval(()=>{const now=Date.now();setBusy(now<busyUntil.current);const next=memory.current.filter(p=>snowExpires(p)>now);if(next.length!==memory.current.length){memory.current=next;setPlays(next);}},300);
  return()=>{clearTimeout(reset);clearInterval(timer);};
 },[room,joined]);
 const play=(kind:SnowKind,from:SnowPoint,to:SnowPoint)=>{
  const actor=identity(),at=Date.now();if(!joined||!actor||at<busyUntil.current)return false;
  const value:SnowPlay={id:`${actor}/${at}/${Math.random().toString(36).slice(2,8)}`,actor,kind,from,to,at};
  const packet={type:'SNOW_PLAY',play:value};const next=applySnowPacket(memory.current,packet,actor,at);
  if(!next.some(p=>p.id===value.id))return false;
  busyUntil.current=at+SNOW_DURATION[kind];setBusy(true);receive(packet,actor);publish(packet);return true;
 };
 const sync=(destination?:string)=>publish({type:'SNOW_SYNC',plays:memory.current.filter(p=>p.kind==='build'&&snowExpires(p)>Date.now()).slice(-24)},destination);
 return {plays,busy,play,receive,sync};
}
