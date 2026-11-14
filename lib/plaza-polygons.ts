export type CollisionPoint={x:number;y:number};
export type CollisionPolygon=CollisionPoint[];
const cross=(a:CollisionPoint,b:CollisionPoint,c:CollisionPoint)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const boundsCache=new WeakMap<CollisionPolygon,{left:number;right:number;top:number;bottom:number}>();
function onSegment(a:CollisionPoint,b:CollisionPoint,p:CollisionPoint){return Math.abs(cross(a,b,p))<1e-10&&p.x>=Math.min(a.x,b.x)-1e-10&&p.x<=Math.max(a.x,b.x)+1e-10&&p.y>=Math.min(a.y,b.y)-1e-10&&p.y<=Math.max(a.y,b.y)+1e-10;}
export function pointInPolygon(point:CollisionPoint,polygon:CollisionPolygon){
  let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[j],b=polygon[i];if(onSegment(a,b,point))return true;
    if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }return inside;
}
function intersects(a:CollisionPoint,b:CollisionPoint,c:CollisionPoint,d:CollisionPoint){
  const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);
  return (x*y<0&&z*w<0)||onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b);
}
/** Check the complete foot rectangle, including thin diagonal prop edges. */
export function polygonBlocksFoot(polygon:CollisionPolygon,x:number,y:number,hw:number,hh:number){
  if(polygon.length<3)return false;
  let bounds=boundsCache.get(polygon);if(!bounds){bounds={left:Math.min(...polygon.map(p=>p.x)),right:Math.max(...polygon.map(p=>p.x)),top:Math.min(...polygon.map(p=>p.y)),bottom:Math.max(...polygon.map(p=>p.y))};boundsCache.set(polygon,bounds);}
  if(x+hw<bounds.left||x-hw>bounds.right||y+hh<bounds.top||y-hh>bounds.bottom)return false;
  const corners=[{x:x-hw,y:y-hh},{x:x+hw,y:y-hh},{x:x+hw,y:y+hh},{x:x-hw,y:y+hh}];
  if(corners.some(p=>pointInPolygon(p,polygon))||polygon.some(p=>p.x>=x-hw&&p.x<=x+hw&&p.y>=y-hh&&p.y<=y+hh))return true;
  return polygon.some((a,i)=>corners.some((b,j)=>intersects(a,polygon[(i+1)%polygon.length],b,corners[(j+1)%4])));
}
