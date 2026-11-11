"use client";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { RoomEvent, type Room, type RemoteParticipant } from "livekit-client";
import { isNpcHold, type NpcHold } from "./npc-motion";
export type NpcMotionControl = { current: (() => { x: number; y: number; phase: number }) | null };
export function useNpcMotion(joined: boolean, room: string, roomRef: RefObject<Room | null>) {
  const [hold, setHold] = useState<NpcHold>(), holdRef=useRef<NpcHold | undefined>(undefined), control=useRef<NpcMotionControl["current"]>(null);
  const publish=useCallback((value:NpcHold)=>{void roomRef.current?.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({type:"NPC_HOLD",room,hold:value})),{reliable:true}).catch(()=>{});},[room,roomRef]);
  const pause=useCallback((milliseconds=30_000, point?:{x:number;y:number})=>{
    const position=control.current?.();if(!position)return;
    const now=Math.max(Date.now(),(holdRef.current?.issuedAt??0)+1);
    const next={phase:position.phase,x:point?.x??position.x,y:point?.y??position.y,issuedAt:now,until:now+milliseconds};
    holdRef.current=next;setHold(next);publish(next);
  },[publish]);
  useEffect(()=>{
    if(!joined)return;const live=roomRef.current;
    const receive=(packet:unknown)=>{const p=packet as {type?:string;room?:string;hold?:unknown};if(p?.type!=="NPC_HOLD"||p.room!==room||!isNpcHold(p.hold)||p.hold.issuedAt>(Date.now()+5000)||p.hold.issuedAt<=(holdRef.current?.issuedAt??0))return;holdRef.current=p.hold;setHold(p.hold);};
    const onData=(data:Uint8Array,participant?:RemoteParticipant)=>{if(!participant)return;try{receive(JSON.parse(new TextDecoder().decode(data)));}catch{}};
    const sync=()=>{if(holdRef.current)publish(holdRef.current);};
    const mock=process.env.NODE_ENV==="development"&&["localhost","127.0.0.1"].includes(location.hostname)&&new URLSearchParams(location.search).get("mock")==="plaza";
    const onMock=(e:Event)=>receive((e as CustomEvent).detail);
    live?.on(RoomEvent.DataReceived,onData);live?.on(RoomEvent.ParticipantConnected,sync);if(mock)window.addEventListener("voiceroom:mock-data",onMock);
    return()=>{live?.off(RoomEvent.DataReceived,onData);live?.off(RoomEvent.ParticipantConnected,sync);if(mock)window.removeEventListener("voiceroom:mock-data",onMock);holdRef.current=undefined;setHold(undefined);};
  },[joined,room,roomRef,publish]);
  return {hold,control,pause,release:()=>pause(0)};
}
