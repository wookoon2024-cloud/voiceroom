"use client";
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {ownedSnowball,snowDown,type SnowBall,type SnowCommand} from './snowballs';
import type {SnowballControl} from './use-snowballs';

export function SnowballMenu({control,onAction,onBuild,onDirection}:{control:SnowballControl;onAction:(kind:SnowCommand['kind'])=>void;onBuild:()=>void;onDirection:(key:string,down:boolean)=>void}){
 const state=useSyncExternalStore(control.store.subscribe,control.store.getSnapshot,control.store.getServerSnapshot),ball=ownedSnowball(state,control.owner),[open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null);
 const ownedBallId=ball?.id;
 useEffect(()=>{if(!ownedBallId)return;const frame=requestAnimationFrame(()=>setOpen(true));return()=>cancelAnimationFrame(frame);},[ownedBallId]);
 useEffect(()=>{
  if(!open)return;const place=()=>{const el=root.current,hud=document.querySelector('.voice-room-hud')?.getBoundingClientRect(),scene=el?.parentElement?.getBoundingClientRect();if(!el||!scene)return;const bottom=Math.max(12,hud?scene.bottom-hud.top+8:12);el.style.setProperty('--snow-bottom',`${bottom}px`);el.dataset.dock=scene.height-bottom<220?'top':'bottom';};
  const frame=requestAnimationFrame(place),observer=new ResizeObserver(place);if(root.current?.parentElement)observer.observe(root.current.parentElement);const hud=document.querySelector('.voice-room-hud');if(hud)observer.observe(hud);window.addEventListener('resize',place);return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',place);};
 },[open]);
 return <>
  <div ref={root} data-snowball-ui data-open={open} className="snowball-tools absolute left-3 top-14 z-[2100] text-xs" onPointerDown={e=>e.stopPropagation()}>
   <button type="button" aria-label="눈 놀이" aria-expanded={open} onClick={()=>setOpen(v=>!v)} className="rounded-xl border border-stone-600 bg-[#191817]/95 px-3 py-2 text-sky-100">❄ 눈 놀이{ball?' · '+(ball.mode==='held'?'들고 있어요':'굴리는 중'):''}</button>
   {open&&<section aria-label="눈덩이 조작" className="mt-2 w-64 max-w-[calc(100vw-24px)] rounded-2xl border border-stone-700 bg-[#191817]/95 p-2 text-stone-100 shadow-xl">
    <div className="mb-1 flex items-center justify-between gap-2"><p className="min-w-0 truncate text-[11px] text-sky-200">{ball?ball.mode==='rolling'?`굴리는 중 · ${Math.round(ball.radius/11*100)}%`:'마우스 또는 상대를 눌러 조준':'눈덩이를 눌러 다가가 보세요'}</p><button type="button" aria-label="눈 놀이 접기" onClick={()=>setOpen(false)} className="h-8 w-8 shrink-0 text-stone-400">⌄</button></div>
    <div className="flex gap-1.5"><button type="button" disabled={control.pending} className="min-h-11 flex-1 rounded-xl border border-stone-600 px-2 disabled:opacity-40" onClick={()=>onAction(ball?'release':'roll')}>{ball?'놓기 (E)':'굴리기 (E)'}</button><button type="button" disabled={control.pending} className="min-h-11 flex-1 rounded-xl bg-sky-200 px-2 font-semibold text-slate-900 disabled:opacity-40" onClick={()=>onAction(ball?.mode==='held'?'throw':'lift')}>{ball?.mode==='held'?'던지기 (F)':'집기 (F)'}</button></div>
    {ball&&<div className="snowball-directions mt-1.5 grid grid-cols-4 gap-1">{[['arrowleft','←'],['arrowup','↑'],['arrowdown','↓'],['arrowright','→']].map(([key,label])=><button key={key} type="button" aria-label={`눈덩이 ${label} 이동`} className="min-h-11 touch-none rounded-lg border border-stone-600 text-lg active:bg-sky-200 active:text-slate-900" onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);onDirection(key,true);}} onPointerUp={()=>onDirection(key,false)} onPointerCancel={()=>onDirection(key,false)} onLostPointerCapture={()=>onDirection(key,false)}>{label}</button>)}</div>}
    {control.message&&<p role="status" className="mt-1.5 text-[10px] text-amber-200">{control.message}</p>}
    {!ball&&<button type="button" onClick={onBuild} className="mt-1.5 w-full rounded-lg py-1.5 text-[10px] text-stone-400">⛄ 눈사람 만들기</button>}
   </section>}
  </div>
 </>;
}
export function SnowballTargets({control,onBall}:{control:SnowballControl;onBall:(ball:SnowBall)=>void}){
 const state=useSyncExternalStore(control.store.subscribe,control.store.getSnapshot,control.store.getServerSnapshot);
 return state?.balls.filter(b=>b.mode==='ground').map(b=><button type="button" key={b.id} data-snow-ball={b.id} aria-label={`눈덩이 굴리기 · ${Math.round(b.radius)} 크기`} className="absolute z-[1800] min-h-11 min-w-11 rounded-full border border-transparent hover:border-sky-200 focus-visible:outline-2 focus-visible:outline-sky-200" style={{left:b.point.x*1672,top:b.point.y*941-b.radius,width:Math.max(44,b.radius*2),height:Math.max(44,b.radius*2),transform:'translate(-50%,-50%)'}} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onBall(b);}}/>);
}
function GroundSnowballs({control}:{control:SnowballControl}){
 const state=useSyncExternalStore(control.store.subscribe,control.store.getSnapshot,control.store.getServerSnapshot);
 return state?.balls.map(b=><div key={b.id} data-snowball={b.id} data-snowball-mode={b.mode} data-snowball-radius={b.radius.toFixed(2)} className="pointer-events-none absolute" style={{left:b.point.x*1672,top:b.point.y*941,width:b.radius*2,height:b.radius*2,transform:`translate(-50%,-100%) translateY(${b.mode==='held'?-115:0}px)`,zIndex:b.mode==='held'?1500:10+Math.round(b.point.y*1000),transition:'left 140ms linear, top 140ms linear, width 140ms linear, height 140ms linear'}}>
  {b.mode!=='held'&&<span className="absolute -bottom-1 left-[5%] h-[18%] w-[90%] rounded-[50%] bg-slate-900/20 blur-[1px]"/>}
  <span className="absolute inset-0 overflow-hidden rounded-full border border-white/70 shadow-sm" style={{background:'radial-gradient(circle at 32% 25%, #fff 0%, #f0f6ff 45%, #a4b9d5 100%)',transform:`rotate(${b.angle}rad)`,transition:'transform 140ms linear'}}><span className="absolute left-[24%] top-[8%] h-[84%] w-[50%] rotate-[25deg] rounded-[50%] border border-slate-400/30"/><span className="absolute left-[45%] top-[20%] h-[16%] w-[16%] rounded-full border border-slate-400/30"/></span>
 </div>);
}

/** One bounded canvas, no new character atlases and no full-page React animation clock. */
export function SnowballWorld({control}:{control:SnowballControl}){
 const element=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const canvas=element.current,ctx=canvas?.getContext('2d');if(!canvas||!ctx)return;
  let frame=0,disposed=false;
  const sphere=(x:number,y:number,r:number,angle=0)=>{ctx.save();ctx.translate(x,y);const gradient=ctx.createRadialGradient(-r*.35,-r*.4,1,0,0,r);gradient.addColorStop(0,'#ffffff');gradient.addColorStop(.5,'#f0f6ff');gradient.addColorStop(1,'#a4b9d5');ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.rotate(angle);ctx.strokeStyle='rgba(117,146,183,.3)';ctx.lineWidth=Math.max(1,r*.035);ctx.beginPath();ctx.ellipse(0,0,r*.55,r*.9,.45,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(r*.22,-r*.28,r*.16,0,Math.PI*1.4);ctx.stroke();ctx.restore();};
  const draw=()=>{
   cancelAnimationFrame(frame);if(disposed||document.hidden)return;const state=control.store.current,now=Date.now();ctx.clearRect(0,0,1672,941);if(!state)return;let animate=false;
   for(const shot of state.shots){const t=Math.max(0,Math.min(1,(now-shot.at)/shot.duration));if(shot.endedAt===undefined&&t<1){animate=true;const x=(shot.from.x+(shot.to.x-shot.from.x)*t)*1672,y=(shot.from.y+(shot.to.y-shot.from.y)*t)*941;ctx.fillStyle='rgba(35,55,85,.16)';ctx.beginPath();ctx.ellipse(x,y,shot.radius*.8,4,0,0,Math.PI*2);ctx.fill();sphere(x,y-(115+shot.radius)*(1-t)-38*t-Math.sin(t*Math.PI)*70,shot.radius,now/150);}
    else{const q=Math.max(0,Math.min(1,(now-(shot.endedAt??shot.at+shot.duration))/650)),p=shot.impact??shot.to;animate||=q<1;ctx.globalAlpha=1-q;for(let i=0;i<12;i++){const angle=i*Math.PI/6;sphere(p.x*1672+Math.cos(angle)*q*(shot.radius+35),p.y*941-30+Math.sin(angle)*q*30+q*q*25,2+i%3);}ctx.globalAlpha=1;}}
   const own=ownedSnowball(state,control.owner),me=control.world.current.me,target=control.aim.current;
   if(own?.mode==='held'&&me&&target&&!snowDown(state,control.owner,now)){animate=true;const dx=(target.x-me.point.x)*1672,dy=(target.y-me.point.y)*941,len=Math.hypot(dx,dy)||1,range=Math.min(len,380-(own.radius-10)*4),end={x:me.point.x*1672+dx/len*range,y:me.point.y*941+dy/len*range-30};ctx.setLineDash([6,7]);ctx.strokeStyle='rgba(150,215,255,.85)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(me.point.x*1672,me.point.y*941-42);ctx.quadraticCurveTo((me.point.x*1672+end.x)/2,(me.point.y*941+end.y)/2-95,end.x,end.y);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.ellipse(end.x,end.y,16,7,0,0,Math.PI*2);ctx.stroke();}
   if(animate)frame=requestAnimationFrame(draw);
  };
  const stop=control.store.subscribe(draw);draw();document.addEventListener('visibilitychange',draw);return()=>{disposed=true;cancelAnimationFrame(frame);stop();document.removeEventListener('visibilitychange',draw);};
 },[control.store,control.world,control.aim,control.owner]);
 return <><GroundSnowballs control={control}/><canvas ref={element} width={1672} height={941} data-snowball-world aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" style={{zIndex:1450}}/></>;
}
