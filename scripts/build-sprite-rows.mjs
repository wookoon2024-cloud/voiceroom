// Deterministic texture packaging only: original pixels, cells and timings stay unchanged.
import fs from 'node:fs/promises';import path from 'node:path';import vm from 'node:vm';import ts from 'typescript';import sharp from 'sharp';
const root=path.resolve(import.meta.dirname,'..');
async function load(file){const m={exports:{}};vm.runInNewContext(ts.transpileModule(await fs.readFile(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:m,exports:m.exports});return m.exports;}
const sprites=await load('lib/sprite-v2.ts'),{spriteRowView}=await load('lib/sprite-row.ts');
const sources=new Map();
for(const {id} of sprites.SPRITE_CHARACTERS_V2)for(const [extra,rest] of [[false,false],[true,false],[false,true],[false,'floor'],[false,'back'],[false,'diagonal']]){
 const dir=sprites.characterAssetRoot(id,extra,rest);if(!sources.has(dir))sources.set(dir,{dir,manifestDir:dir});
}
for(const [pack,original] of Object.entries({base:'roster-v5',rest:'rest-v6',floor:'floor-rest-v6',back:'back-seating-v1',diagonal:'diagonal-seating-v1'}))sources.set('/plaza/lumi-santa-v1/'+pack,{dir:'/plaza/lumi-santa-v1/'+pack,manifestDir:`/plaza/${original}/soft_male`});
let rows=0,totalPixels=0,maxRowPixels=0,maxAtlasPixels=0;
for(const source of sources.values()){
 const dir=path.join(root,'public',source.dir),m=JSON.parse(await fs.readFile(path.join(root,'public',source.manifestDir,'manifest.json'),'utf8'));
 const {data,info}=await sharp(path.join(dir,m.sprite_sheet_alpha)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 maxAtlasPixels=Math.max(maxAtlasPixels,info.width*info.height);await fs.mkdir(path.join(dir,'rows'),{recursive:true});
 for(const [state,cells] of Object.entries(m.frame_layout.rows)){
  const {left,top,width,height}=spriteRowView(m,state,cells[0]);
  const row=await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).extract({left,top,width,height}).raw().toBuffer();
  const file=path.join(dir,'rows',state+'.png');await sharp(row,{raw:{width,height,channels:4}}).png().toFile(file);
  const mask=Buffer.alloc(16+Math.ceil(width*height/8));mask.write('VRHM',0);mask.writeUInt32LE(1,4);mask.writeUInt32LE(width,8);mask.writeUInt32LE(height,12);
  for(let p=0;p<width*height;p++)if(row[p*4+3]>=48)mask[16+(p>>3)]|=1<<(p&7);
  await fs.writeFile(file+'.hit.bin',mask);rows++;totalPixels+=width*height;maxRowPixels=Math.max(maxRowPixels,width*height);
 }
 console.log(JSON.stringify({source:source.dir,rows:Object.keys(m.frame_layout.rows).length}));
}
const report={sources:sources.size,rows,totalPixels,maxAtlasPixels,maxRowPixels,maxAtlasDecodedMiB:maxAtlasPixels*4/1048576,maxRowDecodedMiB:maxRowPixels*4/1048576};
await fs.writeFile(path.join(root,'public/plaza/sprite-row-packaging.json'),JSON.stringify(report,null,2));console.log(report);
