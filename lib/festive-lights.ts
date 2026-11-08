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
export function festiveFade() {
  return { duration: 24,
    min: .18, max: 1 };
}

/** A cached unlit stencil dims the baked-in illumination, preserving image detail. */
export function festiveShade(rgba: ArrayLike<number>, width: number, height: number, kind: FestiveLightKind, points: FestiveLightPoint[], group: number, groups: number) {
  const result = new Uint8ClampedArray(width * height * 4);
  const ellipse = (x:number,y:number,cx:number,cy:number,rx:number,ry:number) =>
    Math.max(0, Math.min(1, (1 - Math.hypot((x-cx)/rx,(y-cy)/ry)) * 5));
  for (let y=0;y<height;y++) for (let x=0;x<width;x++) {
    const offset=(y*width+x)*4, alpha=rgba[offset+3];
    if (!alpha) continue;
    const nx=x/width,ny=y/height,r=rgba[offset],g=rgba[offset+1],b=rgba[offset+2];
    let mask=0;
    if (kind==="tree") {
      // Snow and foliage remain untouched; only warm painted light is attenuated.
      if(r<230||g<160||b>g*.95)continue;
      let nearest=-1,distance=Infinity;
      points.forEach((p,index)=>{const d=Math.hypot(x-p.x*width,y-p.y*height);if(d<distance){nearest=index;distance=d;}});
      if(nearest>=0&&nearest%groups===group)mask=Math.max(0,1-distance/(points[nearest].radius*2.5));
      if(group===0)mask=Math.max(mask,ellipse(nx,ny,.51,.065,.15,.075));
      mask*=Math.min(1,(r-225)/25)*Math.min(1,(g-150)/50);
    } else if (kind==="cabin") {
      mask=Math.max(ellipse(nx,ny,.245,.605,.095,.10),ellipse(nx,ny,.755,.605,.095,.10),
        ellipse(nx,ny,.372,.575,.022,.04),ellipse(nx,ny,.627,.575,.022,.04));
    } else {
      mask=ellipse(nx,ny,.50,.285,.27,.075);
    }
    if(mask<=0)continue;
    result[offset]=r*.28;result[offset+1]=g*.23;result[offset+2]=b*.22;
    result[offset+3]=alpha*mask;
  }
  return result;
}

export function festivePhase(seed: string) {
  return Array.from(seed).reduce((sum,c)=>sum+c.charCodeAt(0),0)%17;
}
export function festiveBrightness(seconds: number, phase: number, reduced = false) {
  const fade=festiveFade(),duration=reduced?36:fade.duration;
  return fade.min+(fade.max-fade.min)*(1-Math.cos((seconds+phase)*Math.PI*2/duration))/2;
}
