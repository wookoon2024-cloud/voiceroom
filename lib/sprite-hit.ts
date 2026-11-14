/** A compact one-bit mask rejects transparent atlas padding when actors overlap. */
type Mask = { width: number; height: number; bits: Uint8Array };
const masks = new Map<string, Mask>();
const loading = new Map<string, Promise<void>>();
export function preloadSpriteMask(src: string): Promise<void> {
  if (masks.has(src)) return Promise.resolve();
  const pending = loading.get(src); if (pending) return pending;
  const promise = (async () => {
    const image = new Image(); image.src = src; await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const bits = new Uint8Array(Math.ceil(canvas.width * canvas.height / 8));
    for (let pixel = 0; pixel < canvas.width * canvas.height; pixel++) {
      if (pixels[pixel * 4 + 3] >= 48) bits[pixel >> 3] |= 1 << (pixel & 7);
    }
    masks.set(src, { width: canvas.width, height: canvas.height, bits });
    canvas.width = canvas.height = 0;
  })().catch(() => {}).finally(() => { loading.delete(src); });
  loading.set(src, promise); return promise;
}

export function spriteOpaqueAt(src: string, x: number, y: number): boolean | null {
  const mask = masks.get(src); if (!mask) return null;
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
  }
  return null;
}
