import {applyPostPacket,validPost,type MapPost} from './map-posts';

let connection:Promise<IDBDatabase>|undefined;
function database():Promise<IDBDatabase>{
  if(!connection)connection=new Promise<IDBDatabase>((resolve,reject)=>{
    if(typeof indexedDB==='undefined'){reject(new Error('브라우저 저장소를 사용할 수 없어요.'));return;}
    const request=indexedDB.open('voiceroom-map-posts',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('rooms');
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();connection=undefined;};resolve(db);};
    request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('게시물 저장소를 열지 못했어요.'));
  }).catch(error=>{connection=undefined;throw error;});
  return connection;
}
export async function loadMapPosts(room:string):Promise<MapPost[]>{
  const db=await database();
  return new Promise((resolve,reject)=>{const tx=db.transaction('rooms','readonly'),request=tx.objectStore('rooms').get(room);request.onsuccess=()=>{const stored=request.result;resolve(Array.isArray(stored?.posts)?stored.posts.filter(validPost).slice(0,1000):[]);};request.onerror=()=>reject(request.error);tx.onabort=()=>reject(tx.error);});
}
export async function saveMapPosts(room:string,posts:MapPost[]):Promise<void>{
  const db=await database();
  return new Promise((resolve,reject)=>{const tx=db.transaction('rooms','readwrite'),store=tx.objectStore('rooms'),request=store.get(room);request.onsuccess=()=>{
    let merged:MapPost[]=Array.isArray(request.result?.posts)?request.result.posts.filter(validPost).slice(0,1000):[];
    for(const post of posts)merged=applyPostPacket(merged,{type:'MAP_POST_SYNC',post},post.author,true);
    store.put({version:1,posts:merged,updatedAt:Date.now()},room);
  };tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
}
