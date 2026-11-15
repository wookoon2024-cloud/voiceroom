import fs from 'node:fs/promises';import path from 'node:path';import sharp from 'sharp';import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..'),report=JSON.parse(await fs.readFile(path.join(root,'public/plaza/sprite-row-packaging.json'),'utf8'));
assert.ok(report.maxRowPixels<=600000);assert.ok(report.maxRowPixels<=report.maxAtlasPixels/10,'largest per-motion texture is at least ten times smaller');
const examples=[['v2/cute_male_v2','down_idle'],['social-v4/strong_male_v2','side_dance_receive'],['animals-v19/shiba_dog/base','side_walk'],['back-seating-v1/soft_male','up_sit'],['lumi-santa-v1/base','down_walk']];
for(const [relative,state] of examples){
 const dir=path.join(root,'public/plaza',relative),manifestDir=relative==='lumi-santa-v1/base'?path.join(root,'public/plaza/roster-v5/soft_male'):dir;
 const m=JSON.parse(await fs.readFile(path.join(manifestDir,'manifest.json'),'utf8')),cells=m.frame_layout.rows[state];
 const left=Math.min(...cells.map(c=>c.x)),top=Math.min(...cells.map(c=>c.y)),width=Math.max(...cells.map(c=>c.x+c.w))-left,height=Math.max(...cells.map(c=>c.y+c.h))-top;
 const original=await sharp(path.join(dir,m.sprite_sheet_alpha)).ensureAlpha().extract({left,top,width,height}).raw().toBuffer();
 const png=path.join(dir,'rows',state+'.png'),row=await sharp(png).ensureAlpha().raw().toBuffer();assert.ok(original.equals(row),'identical original motion pixels '+relative+'/'+state);
 const binary=await fs.readFile(png+'.hit.bin');assert.equal(binary.toString('ascii',0,4),'VRHM');assert.equal(binary.readUInt32LE(8),width);assert.equal(binary.readUInt32LE(12),height);
 for(let p=0;p<width*height;p++)assert.equal(Boolean(binary[16+(p>>3)]&(1<<(p&7))),row[p*4+3]>=48,'exact alpha mask');
}
console.log(JSON.stringify({ok:true,rows:report.rows,maxOldTextureMiB:report.maxAtlasDecodedMiB,maxNewTextureMiB:report.maxRowDecodedMiB,checks:['unchanged motion pixels','unaltered frame rectangles via source offset','exact binary alpha','bounded mobile texture dimensions']}));
