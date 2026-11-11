import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'..'),m={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'lib/sprite-v2.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:m,exports:m.exports});
const {SPRITE_CHARACTERS_V2:roster,characterAssetRoot,spriteStateScale,spriteFrameV2,characterContactScale,characterScale}=m.exports;
let frames=0;for(const id of ['shiba_dog','ginger_cat','red_squirrel','cream_rabbit']){
 const animal=roster.find(c=>c.id===id);assert.ok(animal);assert.ok(animal.scale<1,'animals have their own smaller world scale');
 for(const [social,rest,expected] of [[false,false,12],[true,false,12],[false,true,3]]){
  const dir=path.join(root,'public',characterAssetRoot(id,social,rest)),manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
  assert.equal(Object.keys(manifest.frame_layout.rows).length,expected);assert.equal(manifest.degraded_static_fallback,false);
  const texture=fs.readFileSync(path.join(dir,manifest.sprite_sheet_alpha));assert.equal(texture.readUInt32BE(16),manifest.frame_layout.sheetWidth);assert.equal(texture.readUInt32BE(20),manifest.frame_layout.sheetHeight);
  for(const [state,rects] of Object.entries(manifest.frame_layout.rows)){
   assert.ok(rects.length>=4);for(const r of rects){assert.equal(r.w,rest?320:288);assert.equal(r.h,240);assert.ok(r.x>=0&&r.x+r.w<=manifest.frame_layout.sheetWidth&&r.y>=0&&r.y+r.h<=manifest.frame_layout.sheetHeight);frames++;}
   assert.equal(spriteStateScale(id,state),1,'poses never inherit human rest shrink factors');
   assert.ok(spriteFrameV2(manifest,state,250));
  }
 }
 assert.equal(characterAssetRoot(id,false,'floor'),characterAssetRoot(id,false,true));
 assert.ok(characterContactScale(id,'side_hug_send')>characterScale(id)*2,'horizontal animal bodies have enough contact spacing');
}
console.log(JSON.stringify({ok:true,animals:4,statesPerAnimal:27,frames,checks:['selectable quadruped identities','independent animal scale','wide undistorted cells','full movement and social packs','persistent animal rest poses','all texture rectangles exist']},null,2));
