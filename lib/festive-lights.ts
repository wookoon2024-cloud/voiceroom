export type FestiveLightKind = "tree" | "lantern" | "cabin";
export type FestiveLightPoint = { x: number; y: number; phase: number; frequency: number; radius: number };

/** Locate the painted amber bulbs/window highlights; never place lights in transparent padding. */
export function findFestiveLights(rgba: ArrayLike<number>, width: number, height: number, kind: FestiveLightKind): FestiveLightPoint[] {
  const cell = Math.max(5, Math.round(width / (kind === "tree" ? 42 : 14)));
  const bins = new Map<string, {x:number;y:number;score:number}>();
  for(let y=0;y<height;y+=2)for(let x=0;x<width;x+=2){
    const offset=(y*width+x)*4,r=rgba[offset],g=rgba[offset+1],b=rgba[offset+2],a=rgba[offset+3];
    if(a<160||r<210||g<135||r<g*1.045||b>g*.93||(kind==="tree"&&y>height*.89))continue;
    const score=r+g*.7-b*.4,key=`${Math.floor(x/cell)}/${Math.floor(y/cell)}`;
    if(score>(bins.get(key)?.score??-1))bins.set(key,{x,y,score});
  }
  // A bright star cannot crowd every other garland out of the sample.
  const bands=Array.from({length:6},()=>[] as {x:number;y:number;score:number}[]);
  for(const point of bins.values())bands[Math.min(5,Math.floor(point.y/height*6))].push(point);
  const count=kind==="tree"?16:kind==="cabin"?6:3;
  return bands.flatMap(band=>band.sort((a,b)=>b.score-a.score).slice(0,count)).map((point,index)=>({
    x:point.x/width,y:point.y/height,phase:(index*2.399963+point.x*.17)% (Math.PI*2),
    frequency:.85+(index%7)*.19,radius:kind==="tree"?4+(index%4):kind==="cabin"?6+(index%3):4+(index%3),
  }));
}
export function festiveFade(kind: FestiveLightKind, group = 0) {
  return { duration: kind === "tree" ? 10 + group % 3 * 2 : kind === "cabin" ? 14 : 12,
    min: kind === "tree" ? .30 : .35, max: kind === "tree" ? .90 : .85 };
}
