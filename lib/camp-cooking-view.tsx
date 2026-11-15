"use client";
import {useEffect,useRef,useState} from 'react';
import {COOK_TIME,FOOD_NAMES,foodQuality,type CampState,type CampFood,type CampCommandKind} from './camp-cooking';
export const foodImage=(item:CampFood,now:number)=>`/plaza/camp-food-v1/${item.kind}_${foodQuality(item,now)}.png`;
function useCampTime(enabled:boolean){const [now,setNow]=useState(0);useEffect(()=>{if(!enabled)return;const frame=requestAnimationFrame(()=>setNow(Date.now()));const timer=setInterval(()=>setNow(Date.now()),400);return()=>{cancelAnimationFrame(frame);clearInterval(timer);};},[enabled]);return now;}
export type CampCookingControl={state:CampState|null;owner:string;pending:boolean;message:string;request:(kind:CampCommandKind,id:string,point:{x:number;y:number})=>boolean};
export function CampCookingPanel({camp,open,onOpen,onCommand,onFind}:{camp:CampCookingControl;open:boolean;onOpen:(v:boolean)=>void;onCommand:(kind:CampCommandKind)=>void;onFind:()=>void}){
 const panel=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!open)return;const root=panel.current,scene=root?.parentElement;if(!root||!scene)return;
  const place=()=>{
   if(innerWidth>=768)return;
   const box=scene.getBoundingClientRect(),hud=document.querySelector('.voice-room-hud')?.getBoundingClientRect(),fire=scene.querySelector('[data-camp-fire]')?.getBoundingClientRect();
   const bottom=Math.max(12,hud&&hud.height?box.bottom-hud.top+8:12),height=root.getBoundingClientRect().height;
   const lower=box.bottom-bottom-height,upper=box.top+56;
   const covers=(top:number)=>!!fire&&top<fire.bottom+18&&top+height>fire.top-18;
   root.style.setProperty('--camp-dock-bottom',`${bottom}px`);
   root.dataset.mobileDock=lower<upper||(covers(lower)&&!covers(upper))?'top':'bottom';
  };
  const frame=requestAnimationFrame(place),timer=setInterval(place,250),observer=new ResizeObserver(place);observer.observe(scene);
  const hud=document.querySelector('.voice-room-hud');if(hud)observer.observe(hud);
  window.addEventListener('resize',place);return()=>{cancelAnimationFrame(frame);clearInterval(timer);observer.disconnect();window.removeEventListener('resize',place);};
 },[open]);
 const item=camp.state?.items.find(i=>i.owner===camp.owner&&(i.phase==='held'||i.phase==='roasting')),now=useCampTime(item?.phase==='roasting'),quality=item?foodQuality(item,now||item.updatedAt):'raw';
 const elapsed=item?.roastAt?Math.max(0,(now||item.updatedAt)-item.roastAt):0;
 const status=!item?'모래밭에 떨어진 재료를 클릭해 보세요.':item.phase==='roasting'?quality==='golden'?'지금 꺼내면 딱 좋아요!':quality==='burnt'?'앗, 너무 오래 구웠어요.':'천천히 굽는 중…':quality==='golden'?'노릇노릇 잘 구웠어요.':quality==='burnt'?'타 버렸어요. 새 재료를 찾아볼까요?':'화로에서 구워 먹어 보세요.';
 return <div ref={panel} data-camp-cooking data-open={open} className="camp-cooking-ui absolute left-3 top-14 z-[2100] text-xs" onPointerDown={e=>e.stopPropagation()}>
  <button type="button" aria-expanded={open} aria-label="캠핑 요리" className="camp-cooking-toggle flex items-center gap-1.5 rounded-xl border border-stone-600 bg-stone-950/90 px-3 py-2 text-amber-100 shadow-lg" onClick={()=>onOpen(!open)}>🍢 캠핑 요리{item&&<span className="h-1.5 w-1.5 rounded-full bg-amber-300"/>}</button>
  {open&&<section aria-label="캠핑 요리 도구" className="camp-cooking-desktop mt-2 w-60 max-w-[calc(100vw-24px)] rounded-2xl border border-stone-700 bg-[#1b1a18] p-3 text-stone-100 shadow-xl">
   {item&&<div className="mb-1 flex items-center gap-2"><img src={foodImage(item,now||item.updatedAt)} alt="" className="h-10 w-10 object-contain"/><div><p className="font-semibold">{FOOD_NAMES[item.kind]}</p><p className="text-[10px] text-stone-400">{item.phase==='roasting'?'화로에 굽는 중':quality==='golden'?'노릇하게 구운 꼬치':quality==='burnt'?'타 버린 꼬치':'손에 든 재료'}</p></div></div>}
   <p role="status" className={`py-1 text-[11px] leading-relaxed ${quality==='golden'?'text-amber-200':quality==='burnt'?'text-rose-300':'text-stone-300'}`}>{status}</p>
   {item?.phase==='roasting'&&<div className="my-2"><div role="progressbar" aria-label="굽기 정도" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,Math.round(elapsed/COOK_TIME[item.kind].burnt*100))} className="h-2 overflow-hidden rounded-full bg-stone-800"><div className={`h-full transition-[width] duration-300 ${quality==='burnt'?'bg-rose-700':quality==='golden'?'bg-amber-400':'bg-orange-700'}`} style={{width:`${Math.min(100,elapsed/COOK_TIME[item.kind].burnt*100)}%`}}/></div><div className="mt-1 flex justify-between text-[9px] text-stone-500"><span>아직</span><span>노릇</span><span>타요</span></div></div>}
   {item&&<div className="mt-2 flex gap-2"><button type="button" disabled={camp.pending||item.phase==='held'&&quality==='burnt'} className="min-w-0 flex-1 rounded-xl bg-amber-500 px-3 py-2 font-semibold text-stone-950 disabled:opacity-40" onClick={()=>onCommand(item.phase==='roasting'?'take':quality==='golden'?'eat':'roast')}>{camp.pending?'확인 중…':item.phase==='roasting'?'꺼내기':quality==='golden'?'먹기':'굽기'}</button><button type="button" disabled={camp.pending} className="rounded-xl border border-stone-600 px-3 py-2 text-stone-300 disabled:opacity-40" onClick={()=>onCommand('discard')}>{quality==='burnt'?'버리기':'비우기'}</button></div>}
   {!item&&camp.state?.items.some(i=>i.phase==='ground')&&<button type="button" disabled={camp.pending} className="mt-2 w-full rounded-xl border border-stone-600 px-3 py-2 text-amber-100 disabled:opacity-40" onClick={onFind}>주변 재료 찾기</button>}
   {camp.message&&<p role="status" className="mt-2 text-[11px] leading-relaxed text-amber-200">{camp.message}</p>}
   {!camp.state&&<p className="mt-2 text-[10px] text-stone-500">캠핑 요리를 준비하고 있어요…</p>}
  </section>}
  {open&&<section aria-label="캠핑 요리 조작바" className="camp-cooking-mobile rounded-2xl border border-stone-700 bg-[#1b1a18]/95 p-2 text-stone-100 shadow-xl">
   <div className="flex items-center gap-2">
    {item?<img src={foodImage(item,now||item.updatedAt)} alt="" className="h-9 w-9 shrink-0 object-contain"/>:<span className="px-1 text-xl" aria-hidden="true">🍢</span>}
    <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{item?FOOD_NAMES[item.kind]:'캠핑 요리'}</p><p role="status" className={`truncate text-[10px] ${quality==='golden'?'text-amber-200':quality==='burnt'?'text-rose-300':'text-stone-400'}`}>{camp.message||(!item?'재료를 찾아 구워 보세요':item.phase==='roasting'?quality==='golden'?'지금 꺼내세요!':quality==='burnt'?'타 버렸어요':'굽는 중…':quality==='golden'?'맛있게 먹어 볼까요?':quality==='burnt'?'버리고 새로 구워요':'화로에서 구워 보세요')}</p></div>
    <button type="button" disabled={camp.pending||item?.phase==='held'&&quality==='burnt'} className="min-h-11 shrink-0 rounded-xl bg-amber-500 px-3 font-semibold text-stone-950 disabled:opacity-40" onClick={()=>item?onCommand(item.phase==='roasting'?'take':quality==='golden'?'eat':'roast'):onFind()}>{camp.pending?'확인 중':!item?'찾기':item.phase==='roasting'?'꺼내기':quality==='golden'?'먹기':'굽기'}</button>
    {item&&<button type="button" aria-label="재료 버리기" disabled={camp.pending} onClick={()=>onCommand('discard')} className="min-h-11 rounded-lg px-2 text-stone-400 disabled:opacity-40">비우기</button>}
    <button type="button" aria-label="캠핑 요리 접기" onClick={()=>onOpen(false)} className="min-h-11 min-w-9 rounded-lg text-stone-400">⌄</button>
   </div>
   {item?.phase==='roasting'&&<div role="progressbar" aria-label="굽기 정도" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,Math.round(elapsed/COOK_TIME[item.kind].burnt*100))} className="mt-1 h-1 overflow-hidden rounded-full bg-stone-700"><div className={`h-full transition-[width] duration-300 ${quality==='burnt'?'bg-rose-600':quality==='golden'?'bg-amber-300':'bg-orange-600'}`} style={{width:`${Math.min(100,elapsed/COOK_TIME[item.kind].burnt*100)}%`}}/></div>}
  </section>}
 </div>;
}
export function CampCookingWorld({items,onPick,onTake,owner,pending}:{items:CampFood[];onPick:(item:CampFood)=>void;onTake:(item:CampFood)=>void;owner:string;pending:boolean}){
 const roasting=items.filter(i=>i.phase==='roasting'),now=useCampTime(roasting.length>0);
 return <>
  {items.filter(i=>i.phase==='ground').map(item=><button type="button" key={item.id} data-camp-drop={item.id} aria-label={`${FOOD_NAMES[item.kind]} 줍기`} className="group absolute h-12 w-12 touch-manipulation rounded-full focus-visible:outline-2 focus-visible:outline-amber-200" style={{left:item.point.x*1672,top:item.point.y*941,transform:'translate(-50%,-85%)',zIndex:9+Math.round(item.point.y*1000)}} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onPick(item);}}>
   <span className="absolute inset-x-2 bottom-1 h-2 rounded-[50%] bg-stone-950/15 blur-[1px]"/><img src={foodImage(item,now||item.updatedAt)} alt="" draggable={false} className="relative h-full w-full object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,.5)]" style={{animation:'camp-food-drop 600ms both'}}/>
   <span className="absolute bottom-full left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-stone-950/90 px-2 py-1 text-[10px] text-amber-100 group-hover:block group-focus-visible:block">{FOOD_NAMES[item.kind]} · 줍기</span>
  </button>)}
  {roasting.map((item,i)=>{const mine=item.owner===owner;return <button type="button" key={item.id} data-camp-roasting={item.id} aria-label={mine?`${FOOD_NAMES[item.kind]} 꺼내기`:'다른 사람이 굽는 꼬치'} disabled={!mine||pending} className={`absolute h-14 w-14 rounded-full ${mine?'cursor-pointer hover:ring-2 hover:ring-amber-200 focus-visible:outline-2 focus-visible:outline-amber-200':'pointer-events-none'}`} style={{left:835+(i%5-2)*13,top:515+Math.floor(i/5)*13,transform:`translate(-50%,-75%) rotate(${(i%5-2)*9}deg)`,zIndex:mine?605:590}} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();if(mine)onTake(item);}}><img src={foodImage(item,now||item.updatedAt)} alt="" draggable={false} className="h-full w-full object-contain drop-shadow-sm"/>{mine&&<span className="pointer-events-none absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-stone-950/85 px-1.5 py-0.5 text-[9px] text-amber-100">{foodQuality(item,now||item.updatedAt)==='golden'?'노릇! · 꺼내기':foodQuality(item,now||item.updatedAt)==='burnt'?'탔어요 · 꺼내기':'굽는 중 · 꺼내기'}</span>}</button>;})}
 </>;
}
export function CampActorFood({item,onUse,pending}:{item:CampFood;onUse?:()=>void;pending?:boolean}){
 if(item.phase!=='held'&&item.phase!=='eaten')return null;
 if(item.phase==='held'&&onUse&&(item.quality==='golden'||item.quality==='burnt'))return <button type="button" data-camp-held={item.id} aria-label={`${FOOD_NAMES[item.kind]} ${item.quality==='golden'?'먹기':'버리기'}`} disabled={pending} className="pointer-events-auto absolute -right-3 top-[44%] z-[3] h-11 w-11 cursor-pointer rounded-full hover:ring-2 hover:ring-amber-200 focus-visible:outline-2 focus-visible:outline-amber-200 disabled:opacity-50" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onUse();}}><img src={foodImage(item,item.updatedAt)} alt="" draggable={false} className="h-full w-full object-contain drop-shadow-sm"/><span className="pointer-events-none absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-stone-950/85 px-1 py-0.5 text-[9px] text-amber-100">{item.quality==='golden'?'먹기':'버리기'}</span></button>;
 return <img data-camp-held={item.id} src={foodImage(item,item.updatedAt)} alt="" className="pointer-events-none absolute right-[-6px] top-[52%] z-[3] h-8 w-8 object-contain drop-shadow-sm" style={item.phase==='eaten'?{animation:'camp-food-eat 1300ms both'}:undefined}/>;
}
