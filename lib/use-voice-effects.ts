"use client";
import {useCallback,useEffect,useRef,useState,type RefObject} from 'react';
import type {LocalAudioTrack,Room} from 'livekit-client';
import {VoiceEffectProcessor,type VoiceEffect} from './voice-effects';

export function useVoiceEffects(trackRef: RefObject<LocalAudioTrack|null>, roomRef: RefObject<Room|null>, joined: boolean, muted: boolean) {
  const [mode,setMode]=useState<VoiceEffect>('original'),[preview,setPreview]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const selected=useRef<VoiceEffect>('original'),monitor=useRef(false),processor=useRef<VoiceEffectProcessor|null>(null),ownedContext=useRef<AudioContext|null>(null),changing=useRef(false);
  const stopPreview=useCallback(()=>{monitor.current=false;processor.current?.setMonitor(false);setPreview(false);},[]);
  const prepare=useCallback(async(track:LocalAudioTrack)=>{
    if(selected.current==='original'&&!monitor.current){if(track.getProcessor() instanceof VoiceEffectProcessor)await track.stopProcessor();processor.current=null;return;}
    let context=(roomRef.current as unknown as {audioContext?:AudioContext}|null)?.audioContext;
    if(!context || context.state==='closed') {if(!ownedContext.current || ownedContext.current.state==='closed')ownedContext.current=new AudioContext();context=ownedContext.current;}
    if(context.state==='suspended')await context.resume();
    track.setAudioContext(context);
    const current=track.getProcessor();
    if(current instanceof VoiceEffectProcessor && current.processedTrack?.readyState==='live'){current.setMode(selected.current);current.setMonitor(monitor.current);processor.current=current;return;}
    const next=new VoiceEffectProcessor(selected.current,monitor.current);
    try {await track.setProcessor(next);processor.current=next;} catch(error){await next.destroy();throw error;}
  },[roomRef]);
  const select=async(next:VoiceEffect)=>{
    if(changing.current)return;changing.current=true;setBusy(true);setError('');const previous=selected.current;selected.current=next;
    try{if(trackRef.current)await prepare(trackRef.current);setMode(next);}catch(error){selected.current=previous;processor.current?.setMode(previous);setError(error instanceof Error?error.message:'음성 변조를 적용하지 못했어요.');}finally{changing.current=false;setBusy(false);}
  };
  const togglePreview=async()=>{
    if(changing.current)return;
    if(monitor.current){stopPreview();return;}
    const track=trackRef.current;if(!track||muted){setError('마이크를 켠 뒤 미리 듣기를 눌러 주세요.');return;}
    changing.current=true;setBusy(true);setError('');monitor.current=true;
    try{await prepare(track);setPreview(true);}catch(error){stopPreview();setError(error instanceof Error?error.message:'미리 듣기를 시작하지 못했어요.');}finally{changing.current=false;setBusy(false);}
  };
  useEffect(()=>{if(!joined||muted){monitor.current=false;processor.current?.setMonitor(false);const timer=setTimeout(()=>setPreview(false),0);return()=>clearTimeout(timer);}},[joined,muted]);
  useEffect(()=>()=>{monitor.current=false;processor.current?.setMonitor(false);void ownedContext.current?.close().catch(()=>{});},[]);
  return {mode,preview:preview&&joined&&!muted,busy,error,select,prepare,togglePreview,stopPreview};
}
