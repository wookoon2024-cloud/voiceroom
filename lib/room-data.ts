/** Stay below LiveKit's 15 KiB reliable payload limit, including JSON escaping. */
export const ROOM_PACKET_BYTES=12*1024;
const MAX_TEXT=8*1024*1024,CHUNK_CHARS=2000,MAX_PARTS=Math.ceil(MAX_TEXT/CHUNK_CHARS),TTL=15000;
const encoder=new TextEncoder(),decoder=new TextDecoder();
export function* roomDataPackets(value:unknown):Generator<Uint8Array<ArrayBuffer>>{
 const text=JSON.stringify(value);if(!text||text.length>MAX_TEXT)throw new Error('전송할 데이터가 너무 커요.');
 if(text.length<=ROOM_PACKET_BYTES){const bytes=encoder.encode(text);if(bytes.byteLength<=ROOM_PACKET_BYTES){yield bytes;return;}}
 const id=`${Date.now()}-${Math.random().toString(36).slice(2,10)}`,total=Math.ceil(text.length/CHUNK_CHARS);
 for(let idx=0;idx<total;idx++)yield encoder.encode(JSON.stringify({type:'__DATA_CHUNK__',id,idx,total,data:text.slice(idx*CHUNK_CHARS,(idx+1)*CHUNK_CHARS)}));
}
type Transfer={chunks:Map<number,string>;total:number;size:number;at:number;sender:string};
/** Bounded reassembly; a sender cannot mix another sender's transfer or reserve a huge array. */
export class RoomDataReceiver{
 private transfers=new Map<string,Transfer>();private size=0;
 clear(){this.transfers.clear();this.size=0;}
 sweep(now=Date.now()){for(const [key,t] of this.transfers)if(now-t.at>TTL)this.remove(key);}
 private remove(key:string){const t=this.transfers.get(key);if(t)this.size-=t.size;this.transfers.delete(key);}
 get bufferedCharacters(){return this.size;}
 receive(payload:Uint8Array,sender:string,now=Date.now()):unknown{
  this.sweep(now);
  // Accept previous clients' 28k-character packets during rollout, with a finite cap.
  if(payload.byteLength>192*1024)return null;
  let value;try{value=JSON.parse(decoder.decode(payload));}catch{return null;}
  if(!value||typeof value!=='object')return null;
  if(value.type!=='__DATA_CHUNK__')return value;
  const {id,idx,total,data}=value;
  if(!sender||typeof id!=='string'||id.length>100||!Number.isInteger(total)||total<1||total>MAX_PARTS||!Number.isInteger(idx)||idx<0||idx>=total||typeof data!=='string'||data.length>28000)return null;
  const key=JSON.stringify([sender,id]);let t=this.transfers.get(key);
  if(t&&t.total!==total){this.remove(key);return null;}
  if(!t){if(this.transfers.size>=16||[...this.transfers.values()].filter(t=>t.sender===sender).length>=2)return null;t={chunks:new Map(),total,size:0,at:now,sender};this.transfers.set(key,t);}
  if(!t.chunks.has(idx)){
   if(this.size+data.length>MAX_TEXT){this.remove(key);return null;}
   t.chunks.set(idx,data);t.size+=data.length;this.size+=data.length;
  }
  if(t.chunks.size!==total)return null;
  const parts=[];for(let i=0;i<total;i++)parts.push(t.chunks.get(i)!);this.remove(key);
  try{const result=JSON.parse(parts.join(''));return result&&typeof result==='object'&&result.type!=='__DATA_CHUNK__'?result:null;}catch{return null;}
 }
}

/** Only the requester receives snapshots; one existing peer supplies shared room state. */
export function joinSyncScope(local:string,members:string[],requester:string):'full'|'own'|null{
 if(!requester||requester===local||!members.includes(requester)||!members.includes(local))return null;
 return [...new Set(members)].filter(id=>id!==requester).sort()[0]===local?'full':'own';
}
export function ownJoinSnapshot(state:Record<string,unknown>,nick:string){
 const own=(key:string)=>{const map=state[key] as Record<string,unknown>|undefined;return map&&Object.prototype.hasOwnProperty.call(map,nick)?{[nick]:map[nick]}:{};};
 return {type:'SYNC_SLOTS',avatars:own('avatars'),mutes:own('mutes'),devices:own('devices'),characters:own('characters'),positions:own('positions'),statuses:own('statuses'),nickMap:own('nickMap')};
}
