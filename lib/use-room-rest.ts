"use client";
import { useRef, useState } from "react";
import { PLAZA_THEMES } from "./plaza";
import { resolveBenchClaims, type BenchClaim, type BenchRequest } from "./bench-seating";

export type RestState = { pose: "sit" | "lie"; startedAt: number; benchId?: string };
export function useRoomRest(identity: ()=>string, theme: ()=>string, publish: (packet: object)=>unknown) {
  const [rests,setRests]=useState<Record<string,RestState>>({}), restRef=useRef<Record<string,RestState>>({});
  const [claims,setClaims]=useState<Record<string,BenchClaim>>({}), claimsRef=useRef<Record<string,BenchClaim>>({});
  const [request,setRequest]=useState<BenchRequest|null>(null), requestRef=useRef<BenchRequest|null>(null);
  const assignRequest=(next:BenchRequest|null)=>{requestRef.current=next;setRequest(next);};
  const assignRest=(nick:string,value:RestState|null)=>{
    if(!value&&!restRef.current[nick])return;
    const next={...restRef.current};if(value)next[nick]=value;else delete next[nick];restRef.current=next;setRests(next);
  };
  const applyClaim=(nick:string,claim:BenchClaim|null)=>{
    const previousMine=claimsRef.current[identity()];
    const next={...claimsRef.current};if(claim)next[nick]=claim;else delete next[nick];
    const resolved=resolveBenchClaims(Object.values(next));claimsRef.current=resolved;setClaims(resolved);
    for(const [who,rest] of Object.entries(restRef.current))if(rest.benchId&&!resolved[who])assignRest(who,null);
    const mine=resolved[identity()];
    if(mine&&previousMine&&mine.seat!==previousMine.seat&&restRef.current[identity()]?.benchId===mine.benchId){
      const bench=PLAZA_THEMES.find(t=>t.id===mine.theme)?.props?.find(p=>p.id===mine.benchId);
      if(bench?.seats){assignRest(identity(),null);assignRequest({id:`${mine.claimId}/${mine.seat}`,benchId:mine.benchId,target:bench.seats[mine.seat]});publish({type:"REST_STATE",identity:identity(),pose:null});}
    }
    if(requestRef.current){
      const bench=PLAZA_THEMES.find(t=>t.id===mine?.theme)?.props?.find(p=>p.id===mine?.benchId);
      assignRequest(mine&&bench?.seats?{id:`${mine.claimId}/${mine.seat}`,benchId:mine.benchId,target:bench.seats[mine.seat]}:null);
    }
    return resolved;
  };
  const stop=(nick=identity(),broadcast=true)=>{
    if(nick===identity())assignRequest(null);
    const hadRest=Boolean(restRef.current[nick]),hadClaim=Boolean(claimsRef.current[nick]);
    assignRest(nick,null);if(hadClaim)applyClaim(nick,null);
    if(broadcast&&nick===identity()){
      if(hadRest)publish({type:"REST_STATE",identity:nick,pose:null});
      if(hadClaim)publish({type:"BENCH_CLAIM",identity:nick,claim:null});
    }
  };
  const rest=(pose:"sit"|"lie")=>{
    const nick=identity();if(!nick)return;const same=restRef.current[nick]?.pose===pose&&!restRef.current[nick]?.benchId;
    stop();if(same)return;
    const state:RestState={pose,startedAt:Date.now()};assignRest(nick,state);publish({type:"REST_STATE",identity:nick,...state});
  };
  const sitOnBench=(benchId:string)=>{
    const nick=identity(),currentTheme=theme(),bench=PLAZA_THEMES.find(t=>t.id===currentTheme)?.props?.find(p=>p.id===benchId);
    if(!nick||!bench?.seats)return false;
    const occupied=Object.values(claimsRef.current).filter(c=>c.theme===currentTheme&&c.benchId===benchId&&c.identity!==nick);
    if(occupied.length>=2)return false;
    stop();const claimedAt=Date.now();const claim:BenchClaim={identity:nick,theme:currentTheme,benchId,claimId:`${claimedAt}/${nick}`,claimedAt,seat:occupied.some(c=>c.seat===0)?1:0};
    const resolved=applyClaim(nick,claim),mine=resolved[nick];if(!mine)return false;
    assignRequest({id:`${mine.claimId}/${mine.seat}`,benchId,target:bench.seats[mine.seat]});publish({type:"BENCH_CLAIM",identity:nick,claim});return true;
  };
  const arrive=(id:string)=>{
    if(requestRef.current?.id!==id)return;
    const nick=identity(),claim=claimsRef.current[nick];if(!claim)return;
    const state:RestState={pose:"sit",startedAt:Date.now(),benchId:claim.benchId};assignRest(nick,state);assignRequest(null);publish({type:"REST_STATE",identity:nick,...state});
  };
  const receive=(msg:Record<string,unknown>)=>{
    if(typeof msg.identity!=="string")return;
    const nick=msg.identity;
    if(msg.type==="BENCH_CLAIM"){
      if(msg.claim===null){applyClaim(nick,null);return;}
      const c=msg.claim as BenchClaim|undefined;
      if(c&&c.identity===nick&&typeof c.claimId==="string"&&typeof c.claimedAt==="number"&&Number.isFinite(c.claimedAt)&&(c.seat===0||c.seat===1)&&PLAZA_THEMES.find(t=>t.id===c.theme)?.props?.some(p=>p.id===c.benchId&&p.seats))applyClaim(nick,c);
    } else if(msg.type==="REST_STATE"){
      if(msg.pose===null){assignRest(nick,null);return;}
      if(msg.pose!=="sit"&&msg.pose!=="lie")return;
      const benchId=typeof msg.benchId==="string"?msg.benchId:undefined;
      if(benchId&&claimsRef.current[nick]?.benchId!==benchId)return;
      assignRest(nick,{pose:msg.pose,startedAt:Date.now(),benchId});
    }
  };
  const onMove=(nick=identity())=>{if(restRef.current[nick])stop(nick,nick===identity());};
  const syncOwn=()=>{const nick=identity();if(!nick)return;publish({type:"BENCH_CLAIM",identity:nick,claim:claimsRef.current[nick]??null});publish(restRef.current[nick]?{type:"REST_STATE",identity:nick,...restRef.current[nick]}:{type:"REST_STATE",identity:nick,pose:null});};
  return {rests,claims,request,rest,stop,onMove,sitOnBench,arrive,receive,syncOwn};
}
