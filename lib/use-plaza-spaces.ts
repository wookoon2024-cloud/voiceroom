"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import type {PlazaPos} from './plaza';
export type PlazaSpace='outside'|'tent_northwest'|'tent_southwest';
export const isPlazaSpace=(v:unknown):v is PlazaSpace=>v==='outside'||v==='tent_northwest'||v==='tent_southwest';
export function usePlazaSpaces(room:string,joined:boolean,identity:()=>string,publish:(packet:object)=>unknown){
 const [own,setOwn]=useState<PlazaSpace>('outside'),ownRef=useRef<PlazaSpace>('outside');
 const [spaces,setSpaces]=useState<Record<string,PlazaSpace>>({}),spacesRef=useRef<Record<string,PlazaSpace>>({});
 const [spawn,setSpawn]=useState<PlazaPos|undefined>();
 const receive=useCallback((packet:{space?:unknown},nick:string)=>{if(!nick||!isPlazaSpace(packet.space))return;spacesRef.current={...spacesRef.current,[nick]:packet.space};setSpaces(spacesRef.current);},[]);
 const enter=(space:PlazaSpace)=>{const old=ownRef.current;if(space===old)return;ownRef.current=space;setOwn(space);setSpawn(space==='outside'?old==='tent_southwest'?{x:180/1672,y:740/941}:{x:250/1672,y:365/941}:{x:.5,y:.65});receive({space},identity());publish({type:'PLAZA_SPACE',identity:identity(),space});};
 const syncOwn=()=>publish({type:'PLAZA_SPACE',identity:identity(),space:ownRef.current});
 useEffect(()=>{const timer=setTimeout(()=>{ownRef.current='outside';setOwn('outside');spacesRef.current={};setSpaces({});setSpawn(undefined);},0);return()=>clearTimeout(timer);},[room,joined]);
 return{own,spaces,spawn,enter,receive,syncOwn};
}
