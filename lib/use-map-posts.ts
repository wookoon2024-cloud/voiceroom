"use client";
import {useEffect,useRef,useState} from 'react';
import {applyPostPacket,type MapPost,type PostPacket} from './map-posts';
export function useMapPosts(room:string,joined:boolean,identity:()=>string,publish:(packet:object,destination?:string)=>Promise<void>){
  const [posts,setPosts]=useState<MapPost[]>([]),state=useRef<MapPost[]>([]),[error,setError]=useState('');
  const waiting=useRef<{packet:unknown;sender:string;sync:boolean;at:number}[]>([]);
  const outbox=useRef<PostPacket[]>([]),retrying=useRef(false);
  useEffect(()=>{state.current=[];waiting.current=[];outbox.current=[];const timer=setTimeout(()=>{setPosts(state.current);setError('');},0);return()=>clearTimeout(timer);},[room,joined]);
  const receive=(packet:unknown,sender:string,sync=false)=>{
    const value=packet as {type?:string;id?:string};
    if(typeof value?.id==='string'&&value.type?.startsWith('MAP_POST_')&&!state.current.some(p=>p.id===value.id)){
      waiting.current=[...waiting.current.filter(e=>Date.now()-e.at<30_000),{packet,sender,sync,at:Date.now()}].slice(-100);return;
    }
    let next=applyPostPacket(state.current,packet,sender,sync);
    if(next!==state.current){
      waiting.current=waiting.current.filter(e=>{const id=(e.packet as {id?:string}).id;if(!next.some(p=>p.id===id))return Date.now()-e.at<30_000;next=applyPostPacket(next,e.packet,e.sender,e.sync);return false;});
      state.current=next;setPosts(next);
    }
  };
  const send=async(packet:PostPacket)=>{receive(packet,identity());try{await publish(packet);if(!outbox.current.length)setError('');}catch{outbox.current=[...outbox.current,packet].slice(-100);setError('아직 공유되지 않은 게시물 변경이 있어요.');}};
  const retry=async()=>{if(retrying.current)return;retrying.current=true;try{while(outbox.current.length){await publish(outbox.current[0]);outbox.current.shift();}setError('');}catch{setError('연결을 확인한 뒤 다시 보내 주세요.');}finally{retrying.current=false;}};
  const sync=async(destination?:string)=>{try{for(const post of state.current)await publish({type:'MAP_POST_SYNC',post},destination);}catch{setError('게시물 동기화 연결을 확인해 주세요.');}};
  return {posts,error,send,receive,sync,retry};
}
