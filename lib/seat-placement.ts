export type SeatDirection='down'|'up'|'down_left'|'down_right'|'up_left'|'up_right';
export const isSeatDirection=(value:unknown):value is SeatDirection=>['down','up','down_left','down_right','up_left','up_right'].includes(String(value));
export type SpriteSupport={x:number;y:number;width:number;height:number;kind:'bench'|'floor'|'bed';angle?:number};
/** Match the painted pelvis/body center to the furniture, independent of height. */
export function supportPlacement(support:SpriteSupport,state:string,characterScale:number,bodyScale:number,root:number,animal:boolean,flipped:boolean){
 const diagonal=state.startsWith('diagonal_');
 let hx=diagonal?152:160;
 const hy=support.kind==='bed'?178:support.kind==='floor'?(animal?190:191):animal?205:state==='up_sit'||state==='diagonal_back_sit'?168:158;
 if(flipped)hx=320-hx;
 const x=characterScale*support.width*(hx-160)/192*bodyScale;
 const y=characterScale*support.height*(root+(hy-218)*bodyScale)/240;
 const angle=support.angle??0,r=angle*Math.PI/180;
 return {x:support.x-(x*Math.cos(r)-y*Math.sin(r)),y:support.y-(x*Math.sin(r)+y*Math.cos(r)),angle};
}
