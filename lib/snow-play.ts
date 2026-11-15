export type SnowKind='roll'|'build'|'throw';
export type SnowPoint={x:number;y:number};
export type SnowPlay={id:string;actor:string;kind:SnowKind;from:SnowPoint;to:SnowPoint;at:number};
export const SNOW_DURATION={roll:2200,build:4500,throw:1200} as const;
export const isSnowKind=(v:unknown):v is SnowKind=>v==='roll'||v==='build'||v==='throw';
export const snowExpires=(p:SnowPlay)=>p.at+(p.kind==='build'?300_000:8000);
const point=(v:unknown):v is SnowPoint=>{const p=v as SnowPoint;return !!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=.02&&p.x<=.98&&p.y>=.06&&p.y<=.96;};
export function validSnowPlay(v:unknown,now=Date.now()):v is SnowPlay{
 const p=v as SnowPlay;
 return !!p&&typeof p.id==='string'&&p.id.length>0&&p.id.length<120&&typeof p.actor==='string'&&p.actor.length>0&&p.actor.length<=60&&isSnowKind(p.kind)&&point(p.from)&&point(p.to)&&Number.isSafeInteger(p.at)&&p.at<=now+5000&&snowExpires(p)>now&&Math.hypot((p.from.x-p.to.x)*1.6,p.from.y-p.to.y)<=.35;
}
/** Transient room memory only: authenticated plays, bounded late-join snowmen. */
export function applySnowPacket(current:SnowPlay[],value:unknown,sender:string,now=Date.now()):SnowPlay[]{
 const packet=value as {type?:string;play?:unknown;plays?:unknown[]};if(!sender||!packet)return current;
 const inputs=packet.type==='SNOW_PLAY'?[packet.play]:packet.type==='SNOW_SYNC'&&Array.isArray(packet.plays)&&packet.plays.length<=24?packet.plays:[];
 const next=current.filter(p=>snowExpires(p)>now);
 for(const item of inputs){
  if(!validSnowPlay(item,now)||next.some(p=>p.id===item.id))continue;
  if(packet.type==='SNOW_PLAY'){
   if(item.actor!==sender||now-item.at>15_000)continue;
   if(next.some(p=>p.actor===item.actor&&Math.abs(item.at-p.at)<Math.max(SNOW_DURATION[item.kind],SNOW_DURATION[p.kind])))continue;
  }else if(item.kind!=='build')continue;
  next.push(item);
 }
 next.sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
 return [...next.filter(p=>p.kind==='build').slice(-24),...next.filter(p=>p.kind!=='build').slice(-12)].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
}
