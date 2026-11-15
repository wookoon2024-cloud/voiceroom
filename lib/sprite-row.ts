import type {SpriteManifestV2,SpriteRect} from './sprite-v2';
/** Read one original motion row without decoding the giant multi-motion atlas. */
export function spriteRowView(manifest:SpriteManifestV2,state:string,rect:SpriteRect){
 const cells=manifest.frame_layout.rows[state];
 const left=Math.min(...cells.map(c=>c.x)),top=Math.min(...cells.map(c=>c.y));
 const width=Math.max(...cells.map(c=>c.x+c.w))-left,height=Math.max(...cells.map(c=>c.y+c.h))-top;
 return {left,top,width,height,rect:{...rect,x:rect.x-left,y:rect.y-top}};
}
