"use client";
import { useEffect, useRef } from "react";
import { findFestiveLights, festiveIntensity, type FestiveLightKind } from "./festive-lights";

/** Independent warm glows on the AI-painted bulbs, with the base artwork completely stationary. */
export function ChristmasLights({src,kind}:{src:string;kind:FestiveLightKind}) {
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=ref.current,ctx=canvas?.getContext("2d");if(!canvas||!ctx)return;
    const media=window.matchMedia("(prefers-reduced-motion: reduce)");
    let disposed=false,timer:ReturnType<typeof setInterval>|undefined,removeMedia:()=>void=()=>{};
    const image=new Image();image.src=src;
    image.decode().then(()=>{
      if(disposed)return;
      const height=kind==="tree"?640:256,width=Math.max(1,Math.round(height*image.naturalWidth/image.naturalHeight));
      canvas.width=width;canvas.height=height;ctx.drawImage(image,0,0,width,height);
      const points=findFestiveLights(ctx.getImageData(0,0,width,height).data,width,height,kind);
      canvas.dataset.lightPoints=String(points.length);
      const start=performance.now();let frame=0;
      const paint=()=>{
        if(disposed)return;
        const time=media.matches?0:(performance.now()-start)/1000;ctx.clearRect(0,0,width,height);
        ctx.globalCompositeOperation="source-over";
        points.forEach((point,index)=>{
          const power=festiveIntensity(point,time,kind),x=point.x*width,y=point.y*height,r=point.radius*(.8+power*.5);
          const glow=ctx.createRadialGradient(x,y,0,x,y,r);
          glow.addColorStop(0,`rgba(255,239,181,${power*.58})`);
          glow.addColorStop(.3,`rgba(255,194,76,${power*.25})`);glow.addColorStop(1,"rgba(255,171,45,0)");
          ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
          if(kind==="tree"){
            ctx.fillStyle=`rgba(255,255,226,${power*.84})`;ctx.beginPath();ctx.arc(x,y,.55+power*.65,0,Math.PI*2);ctx.fill();
            const glint=Math.pow(Math.max(0,Math.sin(time*.9+point.phase)),24);
            if(index%7===0&&glint>.1){ctx.strokeStyle=`rgba(255,248,206,${glint*.8})`;ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(x-4*glint,y);ctx.lineTo(x+4*glint,y);ctx.moveTo(x,y-5*glint);ctx.lineTo(x,y+5*glint);ctx.stroke();}
          }
        });
        if(kind==="tree"&&!media.matches)for(let i=0;i<Math.min(10,points.length);i++){
          const point=points[(i*7)%points.length],life=(time*.17+i/10)%1;
          ctx.fillStyle=`rgba(255,236,169,${Math.sin(life*Math.PI)*.65})`;
          ctx.beginPath();ctx.arc(point.x*width+Math.sin(life*5+i)*2,point.y*height-life*12,.7,0,Math.PI*2);ctx.fill();
        }
        canvas.dataset.lightFrame=String(++frame);
      };
      const schedule=()=>{if(timer)clearInterval(timer);paint();if(!media.matches)timer=setInterval(paint,50);};
      schedule();media.addEventListener("change",schedule);removeMedia=()=>media.removeEventListener("change",schedule);
    }).catch(()=>{ /* Static AI artwork stays visible if the glow layer cannot decode. */ });
    return()=>{disposed=true;if(timer)clearInterval(timer);removeMedia();};
  },[src,kind]);
  return <canvas ref={ref} data-light-animation={kind} aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none"/>;
}
