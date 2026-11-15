export type FoodKind='marshmallow'|'skewer';
export type FoodQuality='raw'|'golden'|'burnt';
export type CampPoint={x:number;y:number};
export type CampCommandKind='pick'|'roast'|'take'|'eat'|'discard';
export type CampFood={id:string;kind:FoodKind;point:CampPoint;bornAt:number;updatedAt:number;phase:'ground'|'held'|'roasting'|'eaten'|'discarded';quality:FoodQuality;owner?:string;pickedAt?:number;roastAt?:number};
export type CampAction={id:string;actor:string;kind:CampCommandKind;at:number};
export type CampState={version:number;seed:string;cursor:number;items:CampFood[];seen:string[];lastAction?:CampAction};
export type CampCommand={id:string;actor:string;kind:CampCommandKind;itemId:string;point:CampPoint};
export const FOOD_NAMES:Record<FoodKind,string>={marshmallow:'마시멜로',skewer:'꼬치'};
export const COOK_TIME={marshmallow:{golden:6000,burnt:12000},skewer:{golden:9000,burnt:17000}} as const;
export const CAMP_FIRE_POINT={x:835/1672,y:515/941};
export const CAMP_FIRE_APPROACH={x:835/1672,y:625/941};
export const DROP_INTERVAL=12000;
const SPOTS=[[570,440],[1050,425],[600,660],[1100,620],[470,620],[1185,560],[620,745],[1050,745],[800,720],[915,700],[490,490],[1160,385]];
export const campDistance=(a:CampPoint,b:CampPoint)=>Math.hypot((a.x-b.x)*1672,(a.y-b.y)*941);
export const nearCampFire=(p:CampPoint)=>campDistance(p,CAMP_FIRE_POINT)<=170;
export const foodQuality=(item:CampFood,now:number):FoodQuality=>item.phase!=='roasting'?item.quality:now-(item.roastAt??now)>=COOK_TIME[item.kind].burnt?'burnt':now-(item.roastAt??now)>=COOK_TIME[item.kind].golden?'golden':'raw';
export const foodExpires=(item:CampFood)=>item.phase==='ground'?item.bornAt+90000:item.phase==='eaten'||item.phase==='discarded'?item.updatedAt+6000:(item.pickedAt??item.bornAt)+180000;
export const carriedCampFood=(state:CampState|null,owner:string)=>state?.items.find(i=>i.owner===owner&&i.phase==='held')??state?.items.filter(i=>i.owner===owner&&i.phase==='eaten').at(-1);
const hash=(s:string)=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
export function campDrop(seed:string,bucket:number,now:number):CampFood{
 const h=hash(seed+'/'+bucket),[x,y]=SPOTS[h%SPOTS.length];
 return {id:`${seed}/${bucket}`,kind:(h>>>6)%3===0?'skewer':'marshmallow',point:{x:(x+((h>>>10)%31)-15)/1672,y:(y+((h>>>18)%17)-8)/941},bornAt:now,updatedAt:now,phase:'ground',quality:'raw'};
}
export const newCampState=(room:string,now:number):CampState=>({version:0,seed:room+'/'+now,cursor:Math.floor(now/DROP_INTERVAL)-3,items:[],seen:[]});
export function advanceCamp(state:CampState,now:number):CampState{
 const items=state.items.filter(i=>foodExpires(i)>now);let changed=items.length!==state.items.length;
 const bucket=Math.floor(now/DROP_INTERVAL);
 for(let cursor=Math.max(state.cursor+1,bucket-2);cursor<=bucket;cursor++)if(items.length<48&&items.filter(i=>i.phase==='ground').length<6){items.push(campDrop(state.seed,cursor,now));changed=true;}
 if(state.cursor!==bucket)changed=true;
 return changed?{...state,version:state.version+1,cursor:bucket,items}:state;
}
export function reduceCamp(state:CampState,command:CampCommand,sender:string,now:number):{state:CampState;error?:string}{
 if(!validCampCommand(command)||command.actor!==sender)return{state,error:'요리 요청을 확인해 주세요.'};
 if(state.seen.includes(command.id))return{state};
 const current=advanceCamp(state,now),index=current.items.findIndex(i=>i.id===command.itemId),item=current.items[index];
 if(!item||foodExpires(item)<=now)return{state:current,error:'재료가 사라졌어요. 다른 재료를 찾아보세요.'};
 let next={...item};
 if(command.kind==='pick'){
  if(item.phase!=='ground')return{state:current,error:'다른 사람이 먼저 주웠어요.'};
  if(campDistance(command.point,item.point)>70)return{state:current,error:'재료 가까이로 가 주세요.'};
  if(current.items.some(i=>i.owner===sender&&(i.phase==='held'||i.phase==='roasting')))return{state:current,error:'손에 든 재료를 먹거나 비운 뒤 주워 주세요.'};
  next={...item,owner:sender,phase:'held',pickedAt:now,updatedAt:now};
 }else{
  if(item.owner!==sender)return{state:current,error:'내가 주운 재료만 사용할 수 있어요.'};
  if(command.kind==='roast'){
   if(item.phase!=='held'||item.quality!=='raw')return{state:current,error:'아직 굽지 않은 재료를 올려 주세요.'};
   if(!nearCampFire(command.point))return{state:current,error:'화로 가까이에서 구워 주세요.'};
   next={...item,phase:'roasting',roastAt:now,updatedAt:now};
  }else if(command.kind==='take'){
   if(item.phase!=='roasting')return{state:current,error:'화로에 올린 꼬치가 없어요.'};
   if(!nearCampFire(command.point))return{state:current,error:'화로 가까이에서 꺼내 주세요.'};
   next={...item,phase:'held',quality:foodQuality(item,now),roastAt:undefined,updatedAt:now};
  }else if(command.kind==='eat'){
   if(item.phase!=='held'||item.quality!=='golden')return{state:current,error:item.quality==='burnt'?'타 버렸어요. 비우고 새로 구워 볼까요?':'노릇하게 구운 뒤 꺼내서 먹어 주세요.'};
   next={...item,phase:'eaten',updatedAt:now};
  }else next={...item,phase:'discarded',updatedAt:now};
 }
 const items=[...current.items];items[index]=next;
 return{state:{...current,version:current.version+1,items,seen:[...current.seen,command.id].slice(-80),lastAction:{id:command.id,actor:sender,kind:command.kind,at:now}}};
}
const text=(v:unknown,n=120):v is string=>typeof v==='string'&&v.length>0&&v.length<=n;
const stamp=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0;
const point=(v:unknown):v is CampPoint=>{const p=v as CampPoint;return !!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=.02&&p.x<=.98&&p.y>=.06&&p.y<=.96;};
const action=(v:unknown):v is CampCommandKind=>['pick','roast','take','eat','discard'].includes(String(v));
export function validCampCommand(v:unknown):v is CampCommand{const c=v as CampCommand;return !!c&&text(c.id)&&text(c.actor,60)&&text(c.itemId)&&action(c.kind)&&point(c.point);}
export function validCampState(v:unknown,now:number):v is CampState{
 const s=v as CampState;if(!s||!stamp(s.version)||!text(s.seed,80)||!stamp(s.cursor)||s.cursor>Math.floor(now/DROP_INTERVAL)+3||!Array.isArray(s.items)||s.items.length>48||!Array.isArray(s.seen)||s.seen.length>80||!s.seen.every(id=>text(id)))return false;
 const ids=new Set<string>(),owners=new Set<string>();
 for(const i of s.items){if(!i||!text(i.id)||ids.has(i.id)||!['marshmallow','skewer'].includes(i.kind)||!['ground','held','roasting','eaten','discarded'].includes(i.phase)||!['raw','golden','burnt'].includes(i.quality)||!point(i.point)||!stamp(i.bornAt)||!stamp(i.updatedAt)||i.updatedAt>now+30000||i.pickedAt!==undefined&&!stamp(i.pickedAt)||i.roastAt!==undefined&&!stamp(i.roastAt))return false;
  ids.add(i.id);if(i.phase!=='ground'&&!text(i.owner,60))return false;if(i.phase==='roasting'&&!stamp(i.roastAt))return false;
  if(i.owner&&(i.phase==='held'||i.phase==='roasting')){if(owners.has(i.owner))return false;owners.add(i.owner);}
 }
 const a=s.lastAction;return !a||text(a.id)&&text(a.actor,60)&&action(a.kind)&&stamp(a.at)&&a.at<=now+30000;
}
