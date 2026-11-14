"use client";

import {useEffect,useRef} from 'react';
import type {PlazaPropDef} from './plaza';

const ART={width:1672,height:941};
const SEA_HEIGHT=260;
const FIRE={x:784,y:390,width:112,height:158,baseX:51,baseY:114};
const images=new Map<string,Promise<HTMLImageElement>>();
function loadArt(src:string){
  let pending=images.get(src);
  if(!pending){const image=new Image();image.src=src;pending=image.decode().then(()=>image).catch(error=>{images.delete(src);throw error;});images.set(src,pending);}
  return pending;
}
function surface(width:number,height:number){const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;return canvas;}

/** Real painting runs outside React; stop all frame requests offscreen or in background. */
function animate(canvas:HTMLCanvasElement,paint:(time:number)=>void,fps:number){
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame=0,request=0,intersecting=true,disposed=false,last=-Infinity;
  const start=performance.now();
  const draw=(time:number)=>{paint(time);canvas.dataset.animationFrame=String(++frame);};
  const tick=(now:number)=>{if(disposed)return;if(now-last>=1000/fps){last=now;draw((now-start)/1000);}request=requestAnimationFrame(tick);};
  const sync=()=>{cancelAnimationFrame(request);if(disposed)return;if(motion.matches){draw(0);return;}if(!document.hidden&&intersecting)request=requestAnimationFrame(tick);};
  const observer=new IntersectionObserver(entries=>{intersecting=entries.some(entry=>entry.isIntersecting);sync();});observer.observe(canvas);
  document.addEventListener('visibilitychange',sync);motion.addEventListener('change',sync);
  draw(0);canvas.dataset.animationReady='true';sync();
  return()=>{disposed=true;cancelAnimationFrame(request);observer.disconnect();document.removeEventListener('visibilitychange',sync);motion.removeEventListener('change',sync);};
}

export function CampSeaAnimation({src}:{src:string}){
  const element=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=element.current,ctx=canvas?.getContext('2d');if(!canvas||!ctx)return;
    let cancelled=false,stop:(()=>void)|undefined;
    void loadArt(src).then(image=>{
      if(cancelled)return;canvas.width=ART.width;canvas.height=SEA_HEIGHT;
      const mask=surface(ART.width,SEA_HEIGHT),m=mask.getContext('2d')!;m.drawImage(image,0,0,ART.width,ART.height);
      const pixels=m.getImageData(0,0,ART.width,SEA_HEIGHT),data=pixels.data;
      for(let i=0;i<data.length;i+=4){
        const r=data[i],g=data[i+1],b=data[i+2];
        // Cool blue water/foam only. Warm sand, timber, foliage and rocks stay fixed.
        const blue=b>r+12&&g>r+3&&b>g*.88;
        const foam=b>145&&g>140&&b>r+4&&g>r+2;
        const y=Math.floor(i/4/ART.width),edge=Math.max(0,Math.min(1,(SEA_HEIGHT-y)/12));
        const alpha=(blue?Math.min(1,(b-r-9)/14):foam?.8:0)*edge;
        data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(alpha*255);
      }
      m.putImageData(pixels,0,0);
      stop=animate(canvas,time=>{
        ctx.clearRect(0,0,ART.width,SEA_HEIGHT);ctx.globalCompositeOperation='source-over';
        // Deform the painted wave texture itself, not a whole-map translation.
        for(let y=0;y<SEA_HEIGHT;y+=3){
          const dx=Math.sin(y*.043+time*.95)*4.2+Math.sin(y*.091-time*.62)*1.8;
          const sy=Math.max(0,y+Math.sin(y*.031-time*.9)*3.2+Math.sin(time*1.6+y*.054)*1.4);
          ctx.drawImage(image,0,sy,image.naturalWidth,3,dx,y,ART.width,3);
        }
        ctx.lineWidth=1.3;
        for(let row=0;row<8;row++){
          const phase=(time*.14+row/8)%1,fade=Math.sin(phase*Math.PI);
          ctx.beginPath();
          for(let x=0;x<=ART.width;x+=12){const y=18+phase*225+Math.sin(x*.009+row*1.3+time*.43)*8+Math.sin(x*.027-time*.6)*2.5;if(!x)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
          ctx.strokeStyle=`rgba(211,245,250,${fade*.11})`;ctx.stroke();
        }
        ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask,0,0);ctx.globalCompositeOperation='source-over';
      },24);
    }).catch(()=>{/* The original sea remains visible if the effect cannot load. */});
    return()=>{cancelled=true;stop?.();};
  },[src]);
  return <canvas ref={element} data-camp-sea-animation aria-hidden="true" className="absolute left-0 top-0 w-full pointer-events-none" style={{height:`${SEA_HEIGHT/ART.height*100}%`}}/>;
}

export function CampFireAnimation({prop}:{prop:Pick<PlazaPropDef,'x'|'y'|'w'|'h'>}){
  const element=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=element.current,ctx=canvas?.getContext('2d');if(!canvas||!ctx)return;
    canvas.width=FIRE.width*2;canvas.height=FIRE.height*2;
    // Draw light only. Never sample, erase or warp the painting: warm sand and
    // nearby furniture can have the same colors as flames, so color keying is unsafe.
    return animate(canvas,time=>{
        ctx.setTransform(2,0,0,2,0,0);ctx.clearRect(0,0,FIRE.width,FIRE.height);
        ctx.globalCompositeOperation='screen';
        for(let tongue=0;tongue<5;tongue++){
          const phase=time*(3.2+tongue*.31)+tongue*1.9;
          const x=FIRE.baseX+(tongue-2)*5.5,y=FIRE.baseY-3;
          const height=(tongue===2?63:43-Math.abs(tongue-2)*5)*(1+Math.sin(phase)*.12);
          const sway=Math.sin(phase*.83)*3.5,width=tongue===2?7:5;
          const tipY=y-height;
          const fill=ctx.createLinearGradient(x,y,x,tipY);
          fill.addColorStop(0,'rgba(255,163,30,0)');
          fill.addColorStop(.2,'rgba(255,179,42,0.25)');
          fill.addColorStop(.65,`rgba(255,228,133,${.24+Math.sin(phase)*.06})`);
          fill.addColorStop(1,'rgba(255,190,53,0)');
          ctx.fillStyle=fill;ctx.beginPath();ctx.moveTo(x-width,y);
          ctx.bezierCurveTo(x-width*1.8,y-height*.4,x+sway-width,tipY+height*.2,x+sway,tipY);
          ctx.bezierCurveTo(x+sway+width*.3,tipY+height*.35,x+width*1.5,y-height*.25,x+width,y);
          ctx.closePath();ctx.fill();
        }
        ctx.globalCompositeOperation='screen';const glow=ctx.createRadialGradient(FIRE.baseX,FIRE.baseY,3,FIRE.baseX,FIRE.baseY,50);
        glow.addColorStop(0,`rgba(255,161,47,${.08+Math.sin(time*2.1)*.018})`);glow.addColorStop(1,'rgba(255,135,24,0)');ctx.fillStyle=glow;ctx.fillRect(0,70,FIRE.width,88);
        for(let spark=0;spark<7;spark++){
          const phase=(time/(1.9+spark*.17)+spark*.137)%1,alpha=Math.sin(phase*Math.PI)*.7;
          const x=FIRE.baseX+Math.sin(spark*2.1+phase*5)*9+Math.sin(time*.8+spark)*phase*8,y=FIRE.baseY-12-phase*(58+spark*3);
          ctx.fillStyle=`rgba(255,${180+spark*8},104,${alpha})`;ctx.beginPath();ctx.ellipse(x,y,.65,1.1,phase*.6,0,Math.PI*2);ctx.fill();
        }
        ctx.globalCompositeOperation='source-over';
      },30);
  },[]);
  return <canvas ref={element} data-camp-fire-animation aria-hidden="true" className="absolute pointer-events-none" style={{left:`${(FIRE.x/ART.width-prop.x)/prop.w*100}%`,top:`${(FIRE.y/ART.height-prop.y)/prop.h*100}%`,width:`${FIRE.width/ART.width/prop.w*100}%`,height:`${FIRE.height/ART.height/prop.h*100}%`}}/>;
}
