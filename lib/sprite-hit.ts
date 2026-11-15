/** A compact one-bit mask rejects transparent atlas padding when actors overlap. */
type Mask = { width: number; height: number; bits: Uint8Array };
const masks = new Map<string, Mask>();
const loading = new Map<string, Promise<void>>();
const MAX_MASK_BYTES=2*1024*1024,MAX_MASKS=48;
let maskBytes=0;
export function preloadSpriteMask(src: string): Promise<void> {
  if (masks.has(src)) return Promise.resolve();
  const pending=loading.get(src);if(pending)return pending;
  const promise=(async()=>{
    // The build has already computed alpha. Never decode/copy an entire atlas
    // into Image + Canvas + ImageData on a phone merely to test a click.
    const response=await fetch(src+'.hit.bin');if(!response.ok)return;
    const bytes=await response.arrayBuffer();if(bytes.byteLength<16)return;
    const header=new DataView(bytes);
    if(header.getUint32(0)!==0x5652484d||header.getUint32(4,true)!==1)return;
    const width=header.getUint32(8,true),height=header.getUint32(12,true),size=Math.ceil(width*height/8);
    if(!width||!height||width*height>8_000_000||bytes.byteLength!==16+size||size>MAX_MASK_BYTES)return;
    const bits=new Uint8Array(bytes,16);
    masks.set(src,{width,height,bits});maskBytes+=bits.byteLength;
    while(maskBytes>MAX_MASK_BYTES||masks.size>MAX_MASKS){const oldest=masks.keys().next().value;if(oldest===undefined)break;maskBytes-=masks.get(oldest)!.bits.byteLength;masks.delete(oldest);}
  })().catch(()=>{}).finally(()=>{loading.delete(src);});
  loading.set(src,promise);return promise;
}

export function spriteOpaqueAt(src: string, x: number, y: number): boolean | null {
  const mask = masks.get(src); if (!mask) return null;
  masks.delete(src);masks.set(src,mask);
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) return false;
  const pixel = y * mask.width + x;
  return Boolean(mask.bits[pixel >> 3] & (1 << (pixel & 7)));
}
/** Invert the rotated frame rectangle, rather than treating its bounding box as ink. */
export function spriteFramePoint(box:{left:number;top:number;width:number;height:number},x:number,y:number,aspect:number,angle=0){
  const r=angle*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
  const height=box.width/(aspect*Math.abs(c)+Math.abs(s)),width=height*aspect;
  const dx=x-box.left-box.width/2,dy=y-box.top-box.height/2;
  return{u:(dx*c+dy*s)/width+.5,v:(-dx*s+dy*c)/height+.5};
}

export function pickSpriteActor(world: HTMLElement, clientX: number, clientY: number, excludedNick?: string): string | null {
  const candidates = [...world.querySelectorAll<HTMLElement>("[data-plaza-actor]")]
    .map((actor, index) => ({ actor, index }))
    .sort((a, b) => Number(b.actor.style.zIndex) - Number(a.actor.style.zIndex) || b.index - a.index);
  for (const { actor } of candidates) {
    if (actor.dataset.plazaActor === excludedNick) continue;
    const sprite = actor.querySelector<HTMLElement>("[data-sprite-texture]");
    if (!sprite) continue;
    const box = sprite.getBoundingClientRect();
    const rect = JSON.parse(sprite.dataset.spriteRect!) as { x: number; y: number; w: number; h: number };
    const angle=Number(sprite.closest<HTMLElement>('[data-sprite-angle]')?.dataset.spriteAngle??0);
    const {u,v}=spriteFramePoint(box,clientX,clientY,rect.w/rect.h,angle);
    if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
    const frameX = Math.min(rect.w - 1, Math.floor((sprite.dataset.spriteFlip === "true" ? 1 - u : u) * rect.w));
    const hit = spriteOpaqueAt(sprite.dataset.spriteTexture!, rect.x + frameX, rect.y + v * rect.h);
    // A texture without a mask is still loading: avoid its large rectangle stealing a neighbour.
    if (hit) return actor.dataset.plazaActor!;
    if(hit===null)void preloadSpriteMask(sprite.dataset.spriteTexture!);
  }
  return null;
}
