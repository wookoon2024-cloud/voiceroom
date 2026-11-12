export const POST_REACTIONS = ['❤️','👍','😂','😮','😢','👏'] as const;
export type MapPoint = {x:number;y:number};
export type PostComment = {id:string;author:string;text:string;at:number};
export type PostReaction = {author:string;emoji:string;active:boolean;at:number};
export type PostView = {author:string;at:number};
export type MapPost = {id:string;author:string;theme:string;kind:'text'|'image'|'youtube';content:string;caption:string;at:number;position:MapPoint;positionAt:number;deletedAt?:number;comments:PostComment[];reactions:PostReaction[];views?:PostView[]};
export type PostPacket = {type:'MAP_POST';post:MapPost}|{type:'MAP_POST_MOVE';id:string;position:MapPoint;at:number}|{type:'MAP_POST_DELETE';id:string;at:number}|{type:'MAP_POST_COMMENT';id:string;comment:PostComment}|{type:'MAP_POST_REACT';id:string;reaction:PostReaction}|{type:'MAP_POST_VIEW';id:string;view:PostView}|{type:'MAP_POST_SYNC';post:MapPost};
const record=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const str=(x:unknown,n:number):x is string=>typeof x==='string'&&x.length>0&&x.length<=n;
const stamp=(x:unknown):x is number=>typeof x==='number'&&Number.isSafeInteger(x)&&x>0&&x<Date.now()+60_000;
export const validPoint=(x:unknown):x is MapPoint=>record(x)&&typeof x.x==='number'&&typeof x.y==='number'&&x.x>=.02&&x.x<=.98&&x.y>=.05&&x.y<=.98;
export function youtubeId(value:string):string|null {
  try{const url=new URL(value);if(url.protocol!=='https:'&&url.protocol!=='http:')return null;const host=url.hostname.toLowerCase();let id:string|null=null;
    if(host==='youtu.be')id=url.pathname.slice(1).split('/')[0];
    else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(host))id=url.pathname==='/watch'?url.searchParams.get('v'): /^\/(shorts|embed|live)\//.test(url.pathname)?url.pathname.split('/')[2]:null;
    return id&&/^[A-Za-z0-9_-]{11}$/.test(id)?id:null;
  }catch{return null;}
}
export function validContent(kind:unknown,content:unknown):boolean {
  if(typeof content!=='string')return false;
  if(kind==='text')return content.trim().length>0&&content.length<=1500;
  if(kind==='youtube')return /^[A-Za-z0-9_-]{11}$/.test(content);
  return kind==='image'&&content.length<=180_000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(content);
}
const validComment=(x:unknown):x is PostComment=>record(x)&&str(x.id,100)&&str(x.author,100)&&str(x.text,400)&&stamp(x.at);
const validReaction=(x:unknown):x is PostReaction=>record(x)&&str(x.author,100)&&(POST_REACTIONS as readonly unknown[]).includes(x.emoji)&&typeof x.active==='boolean'&&stamp(x.at);
const validView=(x:unknown):x is PostView=>record(x)&&str(x.author,100)&&stamp(x.at);
export function validPost(x:unknown):x is MapPost {
  return record(x)&&str(x.id,100)&&str(x.author,100)&&str(x.theme,60)&&['text','image','youtube'].includes(x.kind as string)&&((stamp(x.deletedAt)&&x.content==='')||validContent(x.kind,x.content))&&typeof x.caption==='string'&&x.caption.length<=120&&stamp(x.at)&&stamp(x.positionAt)&&validPoint(x.position)&&(x.deletedAt===undefined||stamp(x.deletedAt))&&Array.isArray(x.comments)&&x.comments.length<=50&&x.comments.every(validComment)&&Array.isArray(x.reactions)&&x.reactions.length<=600&&x.reactions.every(validReaction)&&(x.views===undefined||(Array.isArray(x.views)&&x.views.length<=200&&x.views.every(validView)));
}
const tombstone=(post:MapPost):MapPost=>post.deletedAt?{...post,content:'',caption:'',comments:[],reactions:[],views:[]}:post;
const unionViews=(a:PostView[]=[],b:PostView[]=[])=>{
  const map=new Map<string,PostView>();for(const v of [...a,...b])if(v.at>(map.get(v.author)?.at??0))map.set(v.author,v);return [...map.values()].sort((a,b)=>b.at-a.at||a.author.localeCompare(b.author)).slice(0,200);
};
const unionComments=(a:PostComment[],b:PostComment[])=>[...new Map([...a,...b].map(c=>[c.id,c])).values()].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id)).slice(0,50);
const unionReactions=(a:PostReaction[],b:PostReaction[])=>{
  const map=new Map<string,PostReaction>();for(const r of [...a,...b]){const key=r.author+'\0'+r.emoji,old=map.get(key);if(!old||r.at>old.at||(r.at===old.at&&!r.active))map.set(key,r);}return [...map.values()].sort((a,b)=>b.at-a.at||a.author.localeCompare(b.author)||a.emoji.localeCompare(b.emoji)).slice(0,600);
};
export function applyPostPacket(posts:MapPost[],value:unknown,sender:string,sync=false):MapPost[] {
  if(!record(value)||typeof value.type!=='string'||!sender)return posts;
  if(value.type==='MAP_POST'||value.type==='MAP_POST_SYNC'){
    if(!validPost(value.post)||(value.type==='MAP_POST'&&value.post.author!==sender)||(value.type==='MAP_POST_SYNC'&&!sync))return posts;
    const incoming=tombstone(value.post),index=posts.findIndex(p=>p.id===incoming.id);
    if(index<0){
      if(posts.length>=1000)return posts;
      const merged=[...posts,incoming],active=new Set(merged.filter(p=>!p.deletedAt).sort((a,b)=>b.at-a.at||a.id.localeCompare(b.id)).slice(0,30).map(p=>p.id));
      return merged.filter(p=>p.deletedAt||active.has(p.id));
    }
    const old=posts[index];if(old.author!==incoming.author||old.kind!==incoming.kind||(!old.deletedAt&&!incoming.deletedAt&&old.content!==incoming.content)||old.theme!==incoming.theme||old.at!==incoming.at)return posts;
    const newer=incoming.positionAt>old.positionAt;const merged={...old,...(newer?{position:incoming.position,positionAt:incoming.positionAt}:{}),deletedAt:Math.max(old.deletedAt??0,incoming.deletedAt??0)||undefined,comments:unionComments(old.comments,incoming.comments),reactions:unionReactions(old.reactions,incoming.reactions),views:unionViews(old.views,incoming.views)};
    return posts.map((p,i)=>i===index?tombstone(merged):p);
  }
  if(typeof value.id!=='string')return posts;
  return posts.map(p=>{
    if(p.id!==value.id||p.deletedAt)return p;
    if(value.type==='MAP_POST_MOVE'&&sender===p.author&&validPoint(value.position)&&stamp(value.at)&&value.at>p.positionAt)return {...p,position:value.position,positionAt:value.at};
    if(value.type==='MAP_POST_DELETE'&&sender===p.author&&stamp(value.at))return tombstone({...p,deletedAt:value.at});
    if(value.type==='MAP_POST_COMMENT'&&validComment(value.comment)&&value.comment.author===sender)return {...p,comments:unionComments(p.comments,[value.comment])};
    if(value.type==='MAP_POST_REACT'&&validReaction(value.reaction)&&value.reaction.author===sender)return {...p,reactions:unionReactions(p.reactions,[value.reaction])};
    if(value.type==='MAP_POST_VIEW'&&validView(value.view)&&value.view.author===sender)return {...p,views:unionViews(p.views,[value.view])};
    return p;
  });
}
