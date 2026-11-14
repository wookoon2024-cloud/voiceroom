/** Replicated seat intentions. Assignments are derived, never re-claimed on a collision. */
export type SpeakerClaim={identity:string;slot:number|null;version:number;claimedAt:number};
export type SpeakerClaims=Record<string,SpeakerClaim>;
export type SpeakerSlots=Record<number,string>;
export const validSpeakerSlot=(v:unknown):v is number=>Number.isInteger(v)&&Number(v)>=0&&Number(v)<10;
const valid=(c:unknown):c is SpeakerClaim=>{const v=c as SpeakerClaim;return !!v&&typeof v.identity==='string'&&v.identity.length>0&&(v.slot===null||validSpeakerSlot(v.slot))&&Number.isSafeInteger(v.version)&&v.version>=0&&Number.isSafeInteger(v.claimedAt)&&v.claimedAt>=0;};
const tie=(c:SpeakerClaim)=>`${c.slot===null?'z':c.slot}/${String(c.claimedAt).padStart(16,'0')}`;
export function mergeSpeakerClaims(current:SpeakerClaims,incoming:unknown):SpeakerClaims{
 const next={...current};if(!incoming||typeof incoming!=='object')return next;
 for(const [key,value] of Object.entries(incoming)){if(!valid(value)||value.identity!==key)continue;const old=Object.hasOwn(next,key)?next[key]:undefined;if(!old||value.version>old.version||(value.version===old.version&&tie(value)>tie(old)))Object.defineProperty(next,key,{value:{...value},writable:true,enumerable:true,configurable:true});}
 return next;
}
export function changeSpeakerClaim(current:SpeakerClaims,identity:string,slot:number|null,now=Date.now()):SpeakerClaims{
 if(!identity||(slot!==null&&!validSpeakerSlot(slot)))return current;
 const old=current[identity];if(old?.slot===slot)return current;
 const version=Math.max(now,(old?.version??0)+1);
 return {...current,[identity]:{identity,slot,version,claimedAt:slot===null?0:version}};
}
/** Legacy snapshots only seed unknown occupants; they cannot resurrect a released seat. */
export function seedSpeakerSlots(current:SpeakerClaims,slots:unknown):SpeakerClaims{
 const next={...current};if(!slots||typeof slots!=='object')return next;
 for(const [key,identity] of Object.entries(slots)){const slot=Number(key);if(validSpeakerSlot(slot)&&typeof identity==='string'&&identity&&!Object.hasOwn(next,identity))Object.defineProperty(next,identity,{value:{identity,slot,version:0,claimedAt:0},writable:true,enumerable:true,configurable:true});}
 return next;
}
export function resolveSpeakerSlots(claims:SpeakerClaims):SpeakerSlots{
 const active=Object.values(claims).filter(c=>valid(c)&&c.slot!==null).sort((a,b)=>a.claimedAt-b.claimedAt||(a.identity<b.identity?-1:a.identity>b.identity?1:0));
 const slots:SpeakerSlots={},waiting:SpeakerClaim[]=[];
 for(const c of active){if(slots[c.slot!]===undefined)slots[c.slot!]=c.identity;else waiting.push(c);}
 for(const c of waiting){const free=Array.from({length:10},(_,i)=>i).find(i=>slots[i]===undefined);if(free===undefined)break;slots[free]=c.identity;}
 return slots;
}
