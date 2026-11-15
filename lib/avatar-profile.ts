type Store=Pick<Storage,'getItem'|'setItem'>;
const KEY='voiceroom_my_avatar_v2';
export const validAvatar=(value:unknown):value is string=>typeof value==='string'&&value.startsWith('data:image/')&&value.length<=8*1024*1024;
/** Old unscoped photos have no proven owner and must never be assigned to a new nickname. */
export function readAvatarProfile(store:Store,nick:string):string|null{
 try{const value=JSON.parse(store.getItem(KEY)??'null');return value?.nick===nick&&validAvatar(value.avatar)?value.avatar:null;}catch{return null;}
}
export function saveAvatarProfile(store:Store,nick:string,avatar:string){
 if(!nick||!validAvatar(avatar))return;try{store.setItem(KEY,JSON.stringify({nick,avatar}));}catch{}
}
export function ownsPeerAvatar(sender:string|undefined,nick:unknown,localNick:string,nickMap:Record<string,string>){
 return !!sender&&typeof nick==='string'&&nick!==localNick&&(sender===nick||nickMap[sender]===nick);
}
