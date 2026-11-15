// Costume assembly from a generated hat and sprite-gen palette variants.
// Original rectangle geometry, durations and body/face pixels remain authoritative.
import sharp from 'sharp';import fs from 'node:fs/promises';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),packs={base:'roster-v5',rest:'rest-v6',floor:'floor-rest-v6',back:'back-seating-v1',diagonal:'diagonal-seating-v1'};
const report=[];
for(const [pack,folder] of Object.entries(packs)){
 const dir=path.join(root,'public/plaza',folder,'soft_male'),manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
 const original=await sharp(path.join(dir,manifest.sprite_sheet_alpha)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const overlays=[];let frames=0;
 for(const [state,cells] of Object.entries(manifest.frame_layout.rows))for(let frame=0;frame<cells.length;frame++){
  const cell=cells[frame];let top=cell.h;
  const hair=[];
  for(let y=0;y<cell.h*.70;y++)for(let x=Math.floor(cell.w*.2);x<cell.w*.8;x++){
   const i=((cell.y+y)*original.info.width+cell.x+x)*4,[r,g,b,a]=original.data.subarray(i,i+4);
   if(a>180&&r>g+10&&r>b+18&&g-b>=0&&g-b<22&&r-g<65&&b>65){top=Math.min(top,y);hair.push([x,y]);}
  }
  const crown=hair.filter(([,y])=>y<top+16);if(crown.length<5)throw Error(`No head anchor ${pack}/${state}/${frame}`);
  const left=Math.min(...crown.map(p=>p[0])),right=Math.max(...crown.map(p=>p[0]));
  const width=Math.max(25,Math.min(62,Math.round((right-left+1)*1.18)));
  const hat=await sharp(path.join(root,'public/plaza/christmas-play-v1/santa-hat.png')).resize({width}).png().toBuffer();
  const meta=await sharp(hat).metadata();
  const x=Math.max(0,Math.min(cell.w-width,Math.round((left+right)/2-width/2))),y=Math.max(0,Math.round(top+8-meta.height));
  if(y+meta.height>cell.h)throw Error('Hat extends out of its motion cell');
  overlays.push({input:hat,left:cell.x+x,top:cell.y+y});frames++;
 }
 const out=path.join(root,'public/plaza/lumi-santa-v1',pack);
 const variant=await sharp(path.join(out,'santa.png')).ensureAlpha().raw().toBuffer();
 // Tolerance palette matches can also catch cool grey shoes/trousers. Protect
 // those original pixels explicitly; only the strongly blue cardigan is a costume.
 let protectedPixels=0;
 for(let i=0;i<variant.length;i+=4){const [r,g,b]=original.data.subarray(i,i+3);
  if(!(r>95&&b-r>16&&g-r>6&&b-g>3)){original.data.copy(variant,i,i,i+4);protectedPixels++;}}
 await sharp(variant,{raw:{width:original.info.width,height:original.info.height,channels:4}}).composite(overlays).png().toFile(path.join(out,'sprite-sheet-alpha.png'));
 report.push({pack,frames,width:original.info.width,height:original.info.height,protectedPixels});
}
await fs.writeFile(path.join(root,'public/plaza/lumi-santa-v1/costume.json'),JSON.stringify({kind:'lumi-santa-costume',paletteTool:'sprite-gen recolor',hatTool:'sprite-gen gen codex',assembly:'Manual garment protection restores non-blue-cardigan source pixels after the tolerance bake to prevent grey shoes/trousers being matched. Generated hat follows measured rose-hair crown per original frame; no frames or timing are synthesized.',packs:report},null,2));
const m=JSON.parse(await fs.readFile(path.join(root,'public/plaza/roster-v5/soft_male/manifest.json'),'utf8')),cell=m.frame_layout.rows.down_idle[0];
await sharp(path.join(root,'public/plaza/lumi-santa-v1/base/sprite-sheet-alpha.png')).extract({left:cell.x,top:cell.y,width:cell.w,height:cell.h}).resize({height:480}).png().toFile(path.join(root,'sprites_run/christmas-activities/santa-preview.png'));
console.log(report);
