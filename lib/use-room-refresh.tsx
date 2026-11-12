"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {isRoomRefresh} from './room-refresh';
export function useRoomRefresh(room:string,joined:boolean,flush:()=>Promise<void>){
  const flushRef=useRef(flush),pending=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const cancellation=useRef<AbortController|null>(null);
  const [reloadAt,setReloadAt]=useState(0),[seconds,setSeconds]=useState(3);
  useEffect(()=>{flushRef.current=flush;},[flush]);
  useEffect(()=>{const controller=new AbortController();cancellation.current=controller;const reset=setTimeout(()=>setReloadAt(0),0);return()=>{controller.abort();clearTimeout(reset);clearTimeout(timer.current);pending.current=false;};},[room,joined]);
  const receive=useCallback((value:unknown,server:boolean)=>{
    if(!server||!isRoomRefresh(value,room)||pending.current)return;
    try{if(sessionStorage.getItem('voiceroom-last-refresh')===value.id)return;sessionStorage.setItem('voiceroom-last-refresh',value.id);}catch{}
    pending.current=true;setReloadAt(value.reloadAt);setSeconds(Math.max(1,Math.ceil((value.reloadAt-Date.now())/1000)));
    const signal=cancellation.current?.signal;
    void flushRef.current().catch(()=>{});
    timer.current=setTimeout(async()=>{await Promise.race([flushRef.current().catch(()=>{}),new Promise(resolve=>setTimeout(resolve,1500))]);if(!signal?.aborted)window.location.reload();},Math.max(0,value.reloadAt-Date.now()));
  },[room]);
  useEffect(()=>{if(!reloadAt)return;const interval=setInterval(()=>setSeconds(Math.max(1,Math.ceil((reloadAt-Date.now())/1000))),200);return()=>clearInterval(interval);},[reloadAt]);
  const banner=reloadAt?<div role="alert" className="fixed left-1/2 top-4 z-[100] w-max max-w-[94vw] -translate-x-1/2 rounded-2xl border border-amber-300/30 bg-stone-950 px-5 py-3 text-center text-sm text-amber-100 shadow-2xl">관리자가 새로고침을 요청했어요 · {seconds}초 후<br/><span className="text-xs text-stone-400">게시물을 이 기기에 저장하고 다시 연결해요.</span></div>:null;
  return {receive,banner};
}
