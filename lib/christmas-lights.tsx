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
      const height=kind==="tree"?900:384,width=Math.max(1,Math.round(height*image.naturalWidth/image.naturalHeight));
      const sample=document.createElement("canvas");sample.width=width;sample.height=height;
      const context=sample.getContext("2d");if(!context)return;
      context.drawImage(image,0,0,width,height);
      const points=findFestiveLights(context.getImageData(0,0,width,height).data,width,height,kind);
      root.dataset.lightPoints=String(points.length);
      root.dataset.lightVersion="visible-bloom-v9";
      root.querySelectorAll("canvas").forEach((canvas,group)=>{
        canvas.width=width;canvas.height=height;
        const ctx=canvas.getContext("2d");if(!ctx)return;
        points.forEach((point,index)=>{
          if(index%groups!==group)return;
          const x=point.x*width,y=point.y*height,r=point.radius*(kind==="tree"?3.2:2.4);
          const glow=ctx.createRadialGradient(x,y,0,x,y,r);
          glow.addColorStop(0,"rgba(255,247,208,1)");
          glow.addColorStop(.16,"rgba(255,211,105,.85)");
          glow.addColorStop(.45,"rgba(255,180,46,.35)");glow.addColorStop(1,"rgba(255,161,35,0)");
          ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
          if(kind==="tree"){
            ctx.fillStyle="rgba(255,255,226,.85)";ctx.beginPath();ctx.arc(x,y,2,0,Math.PI*2);ctx.fill();
          }
        });
        // Broad, artwork-aligned light sources remain visible at normal map zoom.
        // Window centres refer to the two glass panes in christmas-v7/cabin.webp.
        const glowAt=(x:number,y:number,rx:number,ry:number,strength:number)=>{
          ctx.save();ctx.translate(x*width,y*height);ctx.scale(rx*width,ry*height);
          const glow=ctx.createRadialGradient(0,0,0,0,0,1);
          glow.addColorStop(0,`rgba(255,230,150,${strength})`);
          glow.addColorStop(.35,`rgba(255,190,70,${strength*.7})`);
          glow.addColorStop(1,"rgba(255,160,40,0)");
          ctx.fillStyle=glow;ctx.fillRect(-1,-1,2,2);ctx.restore();
        };
        if(kind==="tree"&&group===0)glowAt(.51,.065,.17,.09,.75);
        if(kind==="cabin"){
          glowAt(.245,.605,.15,.16,.80);glowAt(.755,.605,.15,.16,.80);
          glowAt(.372,.575,.045,.08,.85);glowAt(.627,.575,.045,.08,.85);
        }
        if(kind==="lantern")glowAt(.50,.285,.48,.12,.95);
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
