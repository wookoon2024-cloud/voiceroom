"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {applyPostPacket,type MapPost,type PostPacket} from './map-posts';
import {loadMapPosts,saveMapPosts} from './map-post-cache';
import {createMapPostDelivery} from './map-post-delivery';
export function useMapPosts(room:string,joined:boolean,identity:()=>string,publish:(packet:object,destination?:string)=>Promise<void>,canShare:()=>boolean=()=>true){
  const [posts,setPosts]=useState<MapPost[]>([]),state=useRef<MapPost[]>([]),[pendingCount,setPendingCount]=useState(0);
  const waiting=useRef<{packet:unknown;sender:string;sync:boolean;at:number}[]>([]);
  const ready=useRef(false),publishRef=useRef(publish),[storageError,setStorageError]=useState('');
  const shareRef=useRef(canShare),delivery=useRef<ReturnType<typeof createMapPostDelivery>|null>(null);
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
    let cancelled=false;state.current=[];waiting.current=[];delivery.current!.reset();ready.current=false;
    const timer=setTimeout(()=>{setPosts(state.current);setPendingCount(0);setStorageError('');},0);
    if(joined)void (async()=>{
      try{const cached=await loadMapPosts(room);if(cancelled)return;for(const post of cached)receive({type:'MAP_POST_SYNC',post},post.author,true);}
      catch{if(!cancelled)setStorageError('이 브라우저에 게시물을 저장하지 못했어요. 방 안 공유는 계속 사용할 수 있어요.');}
      if(cancelled)return;ready.current=true;setPosts([...state.current]);
      // A returning browser may hold posts that no currently connected peer has.
      // Merge its restored snapshot into the room as well as requesting peers' state.
      for(const post of state.current)delivery.current!.enqueue({type:'MAP_POST_SYNC',post});
      void delivery.current!.drain();
    })();
    const retry=()=>{if(joined&&ready.current)void delivery.current!.drain();};
    const interval=joined?setInterval(retry,1500):undefined;
    window.addEventListener('online',retry);document.addEventListener('visibilitychange',retry);
    return()=>{cancelled=true;clearTimeout(timer);clearInterval(interval);delivery.current!.reset();window.removeEventListener('online',retry);document.removeEventListener('visibilitychange',retry);};
  },[room,joined,receive]);
  useEffect(()=>{if(!joined||!ready.current)return;let cancelled=false;void saveMapPosts(room,posts).catch(()=>{if(!cancelled)setStorageError('저장 공간을 확인해 주세요. 이번 변경은 이 기기에 보관되지 않았어요.');});return()=>{cancelled=true;};},[posts,room,joined]);
  const send=async(packet:PostPacket)=>{receive(packet,identity());delivery.current!.enqueue(packet);await delivery.current!.drain();};
  const retry=()=>delivery.current!.drain(true);
  // Public snapshots may be replayed room-wide; a departing destination cannot block delivery.
  const sync=async(destination?:string)=>{void destination;for(const post of state.current)delivery.current!.enqueue({type:'MAP_POST_SYNC',post});await delivery.current!.drain();};
  const flush=()=>saveMapPosts(room,state.current);
  return {posts,error:'',pendingCount,storageError,send,receive,sync,retry,flush};
}
