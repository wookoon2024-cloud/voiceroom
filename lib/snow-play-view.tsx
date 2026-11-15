"use client";
import {useEffect,useRef,useState} from 'react';
import {SNOW_DURATION,type SnowKind,type SnowPlay} from './snow-play';
export function SnowPlayMenu({busy,onPlay}:{busy:boolean;onPlay:(kind:SnowKind)=>void}){
 const [open,setOpen]=useState(false);
 return <div data-snow-menu className="absolute left-3 top-14 z-[2100] text-xs" onPointerDown={e=>e.stopPropagation()}>
  <button type="button" aria-expanded={open} className="rounded-xl border border-stone-600 bg-stone-950/90 px-3 py-2 text-sky-100 shadow-lg" onClick={()=>setOpen(v=>!v)}>❄ 눈 놀이</button>
  {open&&<div className="mt-2 flex w-40 flex-col gap-1 rounded-2xl border border-stone-700 bg-[#1b1a18] p-2 shadow-xl">
   {([['roll','⚪ 눈덩이 굴리기'],['build','⛄ 눈사람 만들기'],['throw','❄ 눈덩이 던지기']] as const).map(([kind,label])=><button key={kind} type="button" disabled={busy} className="rounded-xl px-3 py-2.5 text-left text-stone-100 hover:bg-white/10 disabled:opacity-40" onClick={()=>{onPlay(kind);setOpen(false);}}>{label}</button>)}
  </div>}
 </div>;
}
function SnowmanBuild({play:p}:{play:SnowPlay}){
 const element=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const frame=requestAnimationFrame(()=>{const elapsed=Math.max(0,Date.now()-p.at);element.current?.getAnimations({subtree:true}).forEach(animation=>{animation.currentTime=elapsed;});});
  return()=>cancelAnimationFrame(frame);
 },[p.at]);
 return <div ref={element} data-snowman={p.id} className="pointer-events-none absolute" style={{left:p.to.x*1672,top:p.to.y*941,width:100,height:120,transform:'translate(-50%,-100%)',zIndex:10+Math.round(p.to.y*1000)}}>
  {[0,1,2].map(i=><div key={i} className="absolute rounded-full shadow-sm" style={{width:56-i*13,height:44-i*10,left:22+i*6.5,bottom:i*28,background:'radial-gradient(circle at 35% 25%, #fffdf5, #eaf2ff 55%, #9fb5ce)',animation:'snow-building 4500ms both',animationDelay:`${700*i}ms`}}/>)}
  <img src="/plaza/christmas-play-v1/snowman.png" alt="함께 만든 눈사람" className="absolute inset-0 h-full w-full object-contain" style={{animation:'snow-finished 4500ms both'}}/>
 </div>;
}
export function SnowPlayOverlay({plays}:{plays:SnowPlay[]}){
 const canvasRef=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const canvas=canvasRef.current,ctx=canvas?.getContext('2d');if(!canvas||!ctx)return;
  let frame=0,stopped=false;
  const ball=(x:number,y:number,r:number)=>{const g=ctx.createRadialGradient(x-r*.3,y-r*.4,r*.08,x,y,r);g.addColorStop(0,'#fffdf1');g.addColorStop(.65,'#eaf3fc');g.addColorStop(1,'#9cb3ce');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();};
  const tick=()=>{
   ctx.clearRect(0,0,1672,941);let active=false;
   for(const p of plays){const ms=Date.now()-p.at;if(p.kind==='build'||ms>SNOW_DURATION[p.kind]+500)continue;active=true;if(ms<0)continue;
    const rollTime=Math.max(350,Math.hypot(p.to.x-p.from.x,p.to.y-p.from.y)/(.3*1200/1672)*1000);
    const t=Math.min(1,Math.max(0,(ms-(p.kind==='throw'?280:0))/(p.kind==='throw'?750:rollTime)));
    const direction=p.to.x>=p.from.x?1:-1;
    const x=(p.from.x+(p.to.x-p.from.x)*t)*1672+(p.kind==='roll'?direction*28:0),ground=(p.from.y+(p.to.y-p.from.y)*t)*941;
    if(p.kind==='roll'){ctx.fillStyle='rgba(52,65,90,.15)';ctx.beginPath();ctx.ellipse(x,ground+3,14+t*10,5,0,0,Math.PI*2);ctx.fill();ball(x,ground-8-t*9,9+t*13);}
    else if(t<1)ball(x,ground-40-Math.sin(t*Math.PI)*70,7);
    else{const q=Math.min(1,(ms-1030)/500);for(let i=0;i<12;i++){const angle=i*Math.PI/6;ctx.globalAlpha=Math.max(0,1-q);ball(x+Math.cos(angle)*q*38,ground-30+Math.sin(angle)*q*27+q*q*18,2+i%3);}ctx.globalAlpha=1;}
   }
   if(active&&!stopped)frame=requestAnimationFrame(tick);
  };
  const resume=()=>{cancelAnimationFrame(frame);if(!document.hidden)tick();};
  resume();document.addEventListener('visibilitychange',resume);
  return()=>{stopped=true;cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',resume);};
 },[plays]);
 return <>
  <canvas ref={canvasRef} width={1672} height={941} data-snow-projectiles aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" style={{zIndex:1500}}/>
  {plays.filter(p=>p.kind==='build').map(p=><SnowmanBuild key={p.id} play={p}/>)}
 </>;
}
