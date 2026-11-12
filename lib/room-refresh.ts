export type RoomRefresh = {type:'ROOM_FORCE_REFRESH';id:string;room:string;sentAt:number;reloadAt:number};
export function isRoomRefresh(value:unknown,room:string,now=Date.now()):value is RoomRefresh {
  if(!value||typeof value!=='object')return false;const v=value as RoomRefresh;
  return v.type==='ROOM_FORCE_REFRESH'&&typeof v.id==='string'&&v.id.length>0&&v.id.length<=100&&v.room===room&&Number.isSafeInteger(v.sentAt)&&Number.isSafeInteger(v.reloadAt)&&Math.abs(now-v.sentAt)<30_000&&v.reloadAt>=v.sentAt&&v.reloadAt-v.sentAt<=10_000;
}
