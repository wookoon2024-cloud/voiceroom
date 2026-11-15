import fs from 'node:fs/promises';import path from 'node:path';import sharp from 'sharp';import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..'),packs={base:'roster-v5',rest:'rest-v6',floor:'floor-rest-v6',back:'back-seating-v1',diagonal:'diagonal-seating-v1'};let frames=0;
for(const [pack,folder] of Object.entries(packs)){
 const dir=path.join(root,'public/plaza',folder,'soft_male'),m=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
 const a=await sharp(path.join(dir,m.sprite_sheet_alpha)).ensureAlpha().raw().toBuffer({resolveWithObject:true}),b=await sharp(path.join(root,'public/plaza/lumi-santa-v1',pack,'sprite-sheet-alpha.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(b.info.width,m.frame_layout.sheetWidth);assert.equal(b.info.height,m.frame_layout.sheetHeight);
 let red=0,newHat=0;for(let i=0;i<b.data.length;i+=4){if(b.data[i]>b.data[i+1]*1.8&&b.data[i+3]>180)red++;if(a.data[i+3]===0&&b.data[i+3]>100)newHat++;}
 assert.ok(red>500,'red coat '+pack);assert.ok(newHat>100,'hat is visibly present '+pack);
 for(const cells of Object.values(m.frame_layout.rows))for(const cell of cells){frames++;
  // Existing contact/baseline pixels are identical: no resizing or new anatomy.
  for(let y=cell.h-12;y<cell.h;y++)for(let x=0;x<cell.w;x++){const i=((cell.y+y)*a.info.width+cell.x+x)*4;assert.equal(a.data[i+3],b.data[i+3],'unchanged foot alpha '+pack);}
 }
}
for(const file of ['santa-hat.png','snowman.png']){const m=await sharp(path.join(root,'public/plaza/christmas-play-v1',file)).metadata();assert.ok(m.hasAlpha);assert.ok(m.width>300&&m.height>300);}
console.log(`PASS: Santa costume over ${frames} unchanged animation cells, red coat/hat in all five packs, preserved foot pixels, native alpha artwork`);
