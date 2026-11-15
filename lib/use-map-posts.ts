"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {applyPostPacket,type MapPost,type PostPacket} from './map-posts';
import {clearLegacyMapPostCache} from './map-post-cache';
import {createMapPostDelivery} from './map-post-delivery';
export function useMapPosts(room:string,joined:boolean,identity:()=>string,publish:(packet:object,destination?:string)=>Promise<void>,canShare:()=>boolean=()=>true){
  const [posts,setPosts]=useState<MapPost[]>([]),state=useRef<MapPost[]>([]),[pendingCount,setPendingCount]=useState(0);
  const waiting=useRef<{packet:unknown;sender:string;sync:boolean;at:number}[]>([]);
  const publishRef=useRef(publish);
  const shareRef=useRef(canShare),delivery=useRef<ReturnType<typeof createMapPostDelivery>|null>(null);
  useEffect(()=>{clearLegacyMapPostCache();},[]);
  useEffect(()=>{delivery.current=createMapPostDelivery(packet=>publishRef.current(packet),()=>shareRef.current(),setPendingCount);return()=>delivery.current?.reset();},[]);
  const receive=useCallback((packet:unknown,sender:string,sync=false)=>{
    const value=packet as {type?:string;id?:string};
    if(typeof value?.id==='string'&&value.type?.startsWith('MAP_POST_')&&!state.current.some(p=>p.id===value.id)){
      waiting.current=[...waiting.current.filter(e=>Date.now()-e.at<30_000),{packet,sender,sync,at:Date.now()}].slice(-100);return;
    }
    let next=applyPostPacket(state.current,packet,sender,sync);
    if(next!==state.current){
      waiting.current=waiting.current.filter(e=>{const id=(e.packet as {id?:string}).id;if(!next.some(p=>p.id===id))return Date.now()-e.at<30_000;next=applyPostPacket(next,e.packet,e.sender,e.sync);return false;});
      state.current=next;setPosts(next);
    }
  },[]);
  useEffect(()=>{publishRef.current=publish;},[publish]);
  useEffect(()=>{shareRef.current=canShare;},[canShare]);
  useEffect(()=>{
    state.current=[];waiting.current=[];delivery.current!.reset();
    const timer=setTimeout(()=>{setPosts(state.current);setPendingCount(0);},0);
    const retry=()=>{if(joined)void delivery.current!.drain();};
    const interval=joined?setInterval(retry,1500):undefined;
    window.addEventListener('online',retry);document.addEventListener('visibilitychange',retry);
    return()=>{clearTimeout(timer);clearInterval(interval);delivery.current!.reset();window.removeEventListener('online',retry);document.removeEventListener('visibilitychange',retry);};
  },[room,joined,receive]);
  const send=async(packet:PostPacket)=>{receive(packet,identity());delivery.current!.enqueue(packet);await delivery.current!.drain();};
  const retry=()=>delivery.current!.drain(true);
  // Public snapshots may be replayed room-wide; a departing destination cannot block delivery.
  const sync=async(destination?:string)=>{void destination;for(const post of state.current)delivery.current!.enqueue({type:'MAP_POST_SYNC',post});await delivery.current!.drain();};
  const flush=async()=>{await delivery.current!.drain(true);};
  return {posts,error:'',pendingCount,send,receive,sync,retry,flush};
}
