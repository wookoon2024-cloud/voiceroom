"use client";
import { memo, useEffect, useRef, type CSSProperties } from "react";
import { findFestiveLights, festiveFade, type FestiveLightKind } from "./festive-lights";

/** Paint once; the compositor slowly fades independent groups of warm bulbs. */
export const ChristmasLights = memo(function ChristmasLights({src,kind,phaseSeed=""}:{src:string;kind:FestiveLightKind;phaseSeed?:string}) {
  const ref=useRef<HTMLDivElement>(null);
  const groups=kind==="tree"?3:1;
  useEffect(()=>{
    const root=ref.current;if(!root)return;
    let disposed=false;
    const image=new Image();image.src=src;
    image.decode().then(()=>{
      if(disposed)return;
      const height=kind==="tree"?640:256,width=Math.max(1,Math.round(height*image.naturalWidth/image.naturalHeight));
      const sample=document.createElement("canvas");sample.width=width;sample.height=height;
      const context=sample.getContext("2d");if(!context)return;
      context.drawImage(image,0,0,width,height);
      const points=findFestiveLights(context.getImageData(0,0,width,height).data,width,height,kind);
      root.dataset.lightPoints=String(points.length);
      root.querySelectorAll("canvas").forEach((canvas,group)=>{
        canvas.width=width;canvas.height=height;
        const ctx=canvas.getContext("2d");if(!ctx)return;
        points.forEach((point,index)=>{
          if(index%groups!==group)return;
          const x=point.x*width,y=point.y*height,r=point.radius*1.3;
          const glow=ctx.createRadialGradient(x,y,0,x,y,r);
          glow.addColorStop(0,"rgba(255,239,181,.78)");
          glow.addColorStop(.3,"rgba(255,194,76,.38)");glow.addColorStop(1,"rgba(255,171,45,0)");
          ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
          if(kind==="tree"){
            ctx.fillStyle="rgba(255,255,226,.85)";ctx.beginPath();ctx.arc(x,y,1.1,0,Math.PI*2);ctx.fill();
          }
        });
      });
    }).catch(()=>{ /* The painted base remains visible if decoding fails. */ });
    return()=>{disposed=true;};
  },[src,kind,groups]);
  const phase=Array.from(phaseSeed).reduce((sum,c)=>sum+c.charCodeAt(0),0)%17;
  return <div ref={ref} data-light-animation={kind} aria-hidden="true" className="absolute inset-0 pointer-events-none">
    {Array.from({length:groups},(_,group)=>{
      const fade=festiveFade(kind,group);
      return <canvas key={group} className="festive-slow-glow absolute inset-0 w-full h-full" style={{
        "--glow-min":fade.min,"--glow-max":fade.max,
        animationDuration:`${fade.duration}s`,animationDelay:`-${phase+group*3.7}s`,
      } as CSSProperties}/>;
    })}
  </div>;
});
