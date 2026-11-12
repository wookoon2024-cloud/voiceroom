"use client";
import {useRef,useState,type PointerEvent} from 'react';
import {GripVertical,MessageCircle,Play} from 'lucide-react';
import type {MapPoint,MapPost} from './map-posts';

type Drag = {pointer:number;startX:number;startY:number;offsetX:number;offsetY:number;moved:boolean;position:MapPoint};
export function MapPostCard({post,mine,onOpen,onMove}:{post:MapPost;mine:boolean;onOpen:()=>void;onMove:(position:MapPoint)=>void}) {
  const drag=useRef<Drag|null>(null),suppressClick=useRef(false);
  const [preview,setPreview]=useState<MapPoint|null>(null);
  const position=preview??post.position;
  const sample=(event:PointerEvent<HTMLButtonElement>)=>{
    const current=drag.current,world=event.currentTarget.parentElement?.getBoundingClientRect();
    if(!current||current.pointer!==event.pointerId||!world?.width||!world.height)return null;
    if(!current.moved&&Math.hypot(event.clientX-current.startX,event.clientY-current.startY)<5)return null;
    current.moved=true;
    current.position={x:Math.max(.02,Math.min(.98,(event.clientX-world.left-current.offsetX)/world.width)),y:Math.max(.05,Math.min(.98,(event.clientY-world.top-current.offsetY)/world.height))};
    return current.position;
  };
  const cancel=()=>{if(drag.current?.moved)suppressClick.current=true;drag.current=null;setPreview(null);};
  const reactions=post.reactions.filter(r=>r.active).length;
  return <button type="button" data-map-post-ui data-map-post={post.id}
    aria-label={`${post.author}님의 ${post.kind==='youtube'?'유튜브':post.kind==='image'?'사진':'글'} 게시물`}
    title={mine?'클릭하여 열기 · 드래그하여 위치 이동':'클릭하여 게시물 열기'}
    className={`absolute w-40 -translate-x-1/2 -translate-y-full select-none overflow-hidden rounded-2xl border bg-[#1b1a18]/95 text-left text-stone-100 shadow-xl ${preview?'border-amber-300 shadow-amber-900/20':'border-white/15 hover:border-amber-300/60'} ${mine?'cursor-grab active:cursor-grabbing touch-none':'cursor-pointer'}`}
    style={{left:`${position.x*100}%`,top:`${position.y*100}%`,zIndex:preview?1900:1800}}
    onPointerDown={event=>{
      event.stopPropagation();
      if(!mine||!event.isPrimary||event.button!==0||drag.current)return;
      const world=event.currentTarget.parentElement?.getBoundingClientRect();if(!world?.width||!world.height)return;
      suppressClick.current=false;
      drag.current={pointer:event.pointerId,startX:event.clientX,startY:event.clientY,offsetX:event.clientX-world.left-post.position.x*world.width,offsetY:event.clientY-world.top-post.position.y*world.height,moved:false,position:post.position};
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event=>{if(sample(event)){event.preventDefault();setPreview(drag.current!.position);}}}
    onPointerUp={event=>{
      const current=drag.current;if(!current||current.pointer!==event.pointerId)return;
      // Commit the last drag sample. Some touch releases report reset coordinates.
      drag.current=null;
      if(current.moved){suppressClick.current=true;onMove(current.position);}
      setPreview(null);
      if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    }}
    onPointerCancel={cancel} onLostPointerCapture={cancel}
    onDragStart={event=>event.preventDefault()}
    onKeyDown={event=>{if(event.key==='Escape'&&drag.current){event.preventDefault();cancel();}}}
    onClick={event=>{event.stopPropagation();if(suppressClick.current&&event.detail!==0){suppressClick.current=false;return;}onOpen();}}>
    {mine&&<span aria-hidden="true" className="absolute right-1 top-1 z-10 rounded-md bg-stone-950/65 p-0.5 text-stone-300"><GripVertical size={13}/></span>}
    {post.kind==='text'?<p className="line-clamp-3 whitespace-pre-wrap break-words px-3 pt-3 pr-5 text-xs leading-relaxed">{post.content}</p>:<div className="relative h-20 bg-stone-950"><img draggable={false} loading="lazy" alt={post.kind==='image'?'공유 사진':'유튜브 영상 미리보기'} src={post.kind==='image'?post.content:`https://i.ytimg.com/vi/${post.content}/mqdefault.jpg`} className="h-full w-full object-cover"/>{post.kind==='youtube'&&<span className="absolute inset-0 flex items-center justify-center"><Play size={26} className="rounded-full bg-black/60 p-1 text-white"/></span>}</div>}
    {post.caption&&<p className="truncate px-3 pt-2 text-xs">{post.caption}</p>}
    <div className="flex items-center justify-between gap-2 px-3 py-2 text-[10px] text-stone-400"><span className="truncate">{post.author}</span><span className="flex shrink-0 items-center gap-1">{reactions>0&&`♡ ${reactions}`}<MessageCircle size={10}/>{post.comments.length}</span></div>
  </button>;
}
