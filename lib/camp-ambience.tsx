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
      const mask=surface(ART.width,SEA_HEIGHT),m=mask.getContext('2d')!;m.drawImage(image,0,0);
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
          ctx.drawImage(image,0,sy,ART.width,3,dx,y,ART.width,3);
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

export function CampFireAnimation({src,prop}:{src:string;prop:Pick<PlazaPropDef,'x'|'y'|'w'|'h'>}){
  const element=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=element.current,ctx=canvas?.getContext('2d');if(!canvas||!ctx)return;
    let cancelled=false,stop:(()=>void)|undefined;
    void loadArt(src).then(image=>{
      if(cancelled)return;canvas.width=FIRE.width*2;canvas.height=FIRE.height*2;
      const texture=surface(FIRE.width,FIRE.height),t=texture.getContext('2d')!;
      t.drawImage(image,FIRE.x,FIRE.y,FIRE.width,FIRE.height,0,0,FIRE.width,FIRE.height);
      const original=t.getImageData(0,0,FIRE.width,FIRE.height),flame=t.createImageData(FIRE.width,FIRE.height),hot=new Uint8Array(FIRE.width*FIRE.height);
      for(let y=0;y<FIRE.height;y++)for(let x=0;x<FIRE.width;x++){
        const index=y*FIRE.width+x,i=index*4,r=original.data[i],g=original.data[i+1],b=original.data[i+2],worldY=y+FIRE.y;
        const cone=worldY>=441&&worldY<=505&&Math.abs(x-FIRE.baseX)<=Math.min(25,7+(worldY-441)*.49);
        hot[index]=cone&&((r>225&&g>105&&r-b>70&&g-b>35)||(r>248&&g>235))?1:0;
      }
      const plate=surface(FIRE.width,FIRE.height),p=plate.getContext('2d')!,back=p.createImageData(FIRE.width,FIRE.height);
      for(let y=0;y<FIRE.height;y++)for(let x=0;x<FIRE.width;x++){
        const i=(y*FIRE.width+x)*4;let neighbours=0,near=false;
        for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
          const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=FIRE.width||yy>=FIRE.height)continue;
          const value=hot[yy*FIRE.width+xx];if(Math.abs(dx)<=1&&Math.abs(dy)<=1)neighbours+=value;if(value)near=true;
        }
        flame.data[i]=original.data[i];flame.data[i+1]=original.data[i+1];flame.data[i+2]=original.data[i+2];
        flame.data[i+3]=Math.round(Math.min(1,neighbours/3)*255);
        // Replace only the baked upper flame with neighbouring painted sand;
        // logs and the entire stone rim are never part of this repair plate.
        if(near&&y+FIRE.y<494){
          const left=(y*FIRE.width+4)*4,right=(y*FIRE.width+106)*4,blend=x/(FIRE.width-1);
          for(let c=0;c<3;c++)back.data[i+c]=original.data[left+c]*(1-blend)+original.data[right+c]*blend;
          back.data[i+3]=neighbours?255:120;
        }
      }
      t.putImageData(flame,0,0);p.putImageData(back,0,0);
      stop=animate(canvas,time=>{
        ctx.setTransform(2,0,0,2,0,0);ctx.clearRect(0,0,FIRE.width,FIRE.height);ctx.globalCompositeOperation='source-over';ctx.drawImage(plate,0,0);
        const stretch=1+Math.sin(time*4.1)*.115+Math.sin(time*7.3)*.035;
        ctx.save();ctx.translate(FIRE.baseX,FIRE.baseY);ctx.scale(1+Math.sin(time*3.3)*.035,stretch);
        for(let y=0;y<FIRE.height;y++){
          const height=Math.max(0,(FIRE.baseY-y)/65),sway=Math.sin(time*5.2+y*.13)*height*3+Math.sin(time*2.7)*height*1.5;
          ctx.drawImage(texture,0,y,FIRE.width,1,-FIRE.baseX+sway,y-FIRE.baseY,FIRE.width,1);
        }
        ctx.restore();
        ctx.globalCompositeOperation='screen';const glow=ctx.createRadialGradient(FIRE.baseX,FIRE.baseY,3,FIRE.baseX,FIRE.baseY,50);
        glow.addColorStop(0,`rgba(255,161,47,${.08+Math.sin(time*2.1)*.018})`);glow.addColorStop(1,'rgba(255,135,24,0)');ctx.fillStyle=glow;ctx.fillRect(0,70,FIRE.width,88);
        for(let spark=0;spark<7;spark++){
          const phase=(time/(1.9+spark*.17)+spark*.137)%1,alpha=Math.sin(phase*Math.PI)*.7;
          const x=FIRE.baseX+Math.sin(spark*2.1+phase*5)*9+Math.sin(time*.8+spark)*phase*8,y=FIRE.baseY-12-phase*(58+spark*3);
          ctx.fillStyle=`rgba(255,${180+spark*8},104,${alpha})`;ctx.beginPath();ctx.ellipse(x,y,.65,1.1,phase*.6,0,Math.PI*2);ctx.fill();
        }
        ctx.globalCompositeOperation='source-over';
      },30);
    }).catch(()=>{/* Preserve the approved static campfire on loading failure. */});
    return()=>{cancelled=true;stop?.();};
  },[src]);
  return <canvas ref={element} data-camp-fire-animation aria-hidden="true" className="absolute pointer-events-none" style={{left:`${(FIRE.x/ART.width-prop.x)/prop.w*100}%`,top:`${(FIRE.y/ART.height-prop.y)/prop.h*100}%`,width:`${FIRE.width/ART.width/prop.w*100}%`,height:`${FIRE.height/ART.height/prop.h*100}%`}}/>;
}
