"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {applyPostPacket,type MapPost,type PostPacket} from './map-posts';
import {loadMapPosts,saveMapPosts} from './map-post-cache';
export function useMapPosts(room:string,joined:boolean,identity:()=>string,publish:(packet:object,destination?:string)=>Promise<void>){
  const [posts,setPosts]=useState<MapPost[]>([]),state=useRef<MapPost[]>([]),[error,setError]=useState('');
  const waiting=useRef<{packet:unknown;sender:string;sync:boolean;at:number}[]>([]);
  const outbox=useRef<PostPacket[]>([]),retrying=useRef(false);
  const ready=useRef(false),publishRef=useRef(publish),[storageError,setStorageError]=useState('');
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
  useEffect(()=>{
    let cancelled=false;state.current=[];waiting.current=[];outbox.current=[];ready.current=false;
    const timer=setTimeout(()=>{setPosts(state.current);setError('');setStorageError('');},0);
    if(joined)void (async()=>{
      try{const cached=await loadMapPosts(room);if(cancelled)return;for(const post of cached)receive({type:'MAP_POST_SYNC',post},post.author,true);}
      catch{if(!cancelled)setStorageError('이 브라우저에 게시물을 저장하지 못했어요. 방 안 공유는 계속 사용할 수 있어요.');}
      if(cancelled)return;ready.current=true;setPosts([...state.current]);
      // A returning browser may hold posts that no currently connected peer has.
      // Merge its restored snapshot into the room as well as requesting peers' state.
      for(const post of state.current){if(cancelled)return;try{await publishRef.current({type:'MAP_POST_SYNC',post});}catch{if(!cancelled){outbox.current=state.current.map(post=>({type:'MAP_POST_SYNC' as const,post}));setError('저장된 게시물 공유를 다시 시도해 주세요.');}break;}}
    })();
    return()=>{cancelled=true;clearTimeout(timer);};
  },[room,joined,receive]);
  useEffect(()=>{if(!joined||!ready.current)return;let cancelled=false;void saveMapPosts(room,posts).catch(()=>{if(!cancelled)setStorageError('저장 공간을 확인해 주세요. 이번 변경은 이 기기에 보관되지 않았어요.');});return()=>{cancelled=true;};},[posts,room,joined]);
  const send=async(packet:PostPacket)=>{receive(packet,identity());try{await publish(packet);if(!outbox.current.length)setError('');}catch{outbox.current=[...outbox.current,packet].slice(-100);setError('아직 공유되지 않은 게시물 변경이 있어요.');}};
  const retry=async()=>{if(retrying.current)return;retrying.current=true;try{while(outbox.current.length){await publish(outbox.current[0]);outbox.current.shift();}setError('');}catch{setError('연결을 확인한 뒤 다시 보내 주세요.');}finally{retrying.current=false;}};
  const sync=async(destination?:string)=>{try{for(const post of state.current)await publish({type:'MAP_POST_SYNC',post},destination);}catch{setError('게시물 동기화 연결을 확인해 주세요.');}};
  const flush=()=>saveMapPosts(room,state.current);
  return {posts,error,storageError,send,receive,sync,retry,flush};
}
