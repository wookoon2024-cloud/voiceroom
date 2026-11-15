"use client";
import {useEffect,useRef,useState,type CSSProperties,type PointerEvent,type KeyboardEvent} from 'react';
import {clampPanel,fitPanel,parsePanelPosition,type PanelPoint,type PanelSize,type PanelViewport} from './floating-panel';
const STORAGE='voiceroom_chat_position_v1';
function viewport():PanelViewport{const v=window.visualViewport;return{left:v?.offsetLeft??0,top:v?.offsetTop??0,width:v?.width??window.innerWidth,height:v?.height??window.innerHeight};}
function save(point:PanelPoint|null){try{if(point)localStorage.setItem(STORAGE,JSON.stringify(point));else localStorage.removeItem(STORAGE);}catch{}}
export function useDraggableChat(enabled:boolean){
 const dockRef=useRef<HTMLDivElement>(null),frameRef=useRef<HTMLDivElement>(null);
 const [point,setPoint]=useState<PanelPoint|null>(null),pointRef=useRef<PanelPoint|null>(null);
 const [size,setSize]=useState<PanelSize>({width:340,height:340}),[dragging,setDragging]=useState(false);
 const gesture=useRef<{id:number;start:PanelPoint;origin:PanelPoint;size:PanelSize;moved:boolean}|null>(null);
 const place=(p:PanelPoint,s:PanelSize)=>{const next=clampPanel(p,s,viewport());pointRef.current=next;setPoint(next);return next;};
 const reset=()=>{gesture.current=null;pointRef.current=null;setPoint(null);setDragging(false);save(null);};
 useEffect(()=>{
  if(!enabled)return;
  const dock=dockRef.current;if(!dock)return;
  const measure=()=>{
   const rect=dock.getBoundingClientRect(),view=viewport(),next=fitPanel(rect,view);
   setSize(old=>old.width===next.width&&old.height===next.height?old:next);
   if(pointRef.current){const adjusted=clampPanel(pointRef.current,next,view);pointRef.current=adjusted;setPoint(old=>old?.x===adjusted.x&&old?.y===adjusted.y?old:adjusted);}
  };
  const init=requestAnimationFrame(()=>{try{pointRef.current=parsePanelPosition(localStorage.getItem(STORAGE));}catch{}measure();});
  const observer=new ResizeObserver(measure);observer.observe(dock);
  window.addEventListener('resize',measure);window.visualViewport?.addEventListener('resize',measure);window.visualViewport?.addEventListener('scroll',measure);
  return()=>{cancelAnimationFrame(init);observer.disconnect();window.removeEventListener('resize',measure);window.visualViewport?.removeEventListener('resize',measure);window.visualViewport?.removeEventListener('scroll',measure);gesture.current=null;};
 },[enabled]);
 const onPointerDown=(e:PointerEvent<HTMLDivElement>)=>{
  if(!e.isPrimary||e.button!==0||(e.target as HTMLElement).closest('button,input,textarea,a,select,[contenteditable="true"]'))return;
  const rect=frameRef.current?.getBoundingClientRect();if(!rect)return;
  e.preventDefault();e.stopPropagation();e.currentTarget.focus({preventScroll:true});
  gesture.current={id:e.pointerId,start:{x:e.clientX,y:e.clientY},origin:{x:rect.left,y:rect.top},size:fitPanel(rect,viewport()),moved:false};
  setSize(fitPanel(rect,viewport()));e.currentTarget.setPointerCapture(e.pointerId);
 };
 const onPointerMove=(e:PointerEvent<HTMLDivElement>)=>{
  const g=gesture.current;if(!g||g.id!==e.pointerId)return;
  const dx=e.clientX-g.start.x,dy=e.clientY-g.start.y;
  if(!g.moved&&Math.hypot(dx,dy)<5)return;
  const first=!g.moved;g.moved=true;if(first)setDragging(true);
  e.preventDefault();e.stopPropagation();
  const currentSize=fitPanel(dockRef.current?.getBoundingClientRect()??g.size,viewport());
  const next=clampPanel({x:g.origin.x+dx,y:g.origin.y+dy},currentSize,viewport());pointRef.current=next;
  // Keep pointer-rate movement off the large room's React render path.
  const frame=frameRef.current;if(frame){frame.style.left=`${next.x}px`;frame.style.top=`${next.y}px`;frame.style.width=`${currentSize.width}px`;frame.style.height=`${currentSize.height}px`;}
  if(first){setSize(currentSize);setPoint(next);}
 };
 const onPointerEnd=(e:PointerEvent<HTMLDivElement>)=>{
  const g=gesture.current;if(!g||g.id!==e.pointerId)return;
  gesture.current=null;setDragging(false);if(g.moved){setPoint(pointRef.current);setSize(fitPanel(dockRef.current?.getBoundingClientRect()??g.size,viewport()));save(pointRef.current);}
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
 };
 const onKeyDown=(e:KeyboardEvent<HTMLDivElement>)=>{
  if(e.target!==e.currentTarget)return;
  if(e.key==='Home'){e.preventDefault();e.stopPropagation();reset();return;}
  const direction:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},delta=direction[e.key];
  if(!delta)return;const rect=frameRef.current?.getBoundingClientRect();if(!rect)return;
  e.preventDefault();e.stopPropagation();const step=e.shiftKey?40:12;
  save(place({x:rect.left+delta[0]*step,y:rect.top+delta[1]*step},rect));
 };
 const style:CSSProperties|undefined=point?{position:'fixed',left:point.x,top:point.y,width:size.width,height:size.height,zIndex:40}:undefined;
 return{dockRef,frameRef,style,floating:point!==null,dragging,reset,handle:{onPointerDown,onPointerMove,onPointerUp:onPointerEnd,onPointerCancel:onPointerEnd,onKeyDown}};
}
