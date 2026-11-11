import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'..');const module={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'lib/sprite-v2.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports});
const {SPRITE_CHARACTERS_V2:roster,characterAssetRoot,characterScale}=module.exports;
assert.equal(roster.length,11);assert.equal(new Set(roster.map(c=>c.id)).size,11);
assert.ok(characterScale('strong_male_v2')>characterScale('cute_male_v2'));
const basics=['down_idle','side_idle','up_idle','down_walk','side_walk','up_walk','down_talk','down_jump'];
const social=['hug','kiss','punch','highfive','handshake','pat','gift','dance'];let checkedFrames=0;
for(const c of roster){
 const dir=path.join(root,'public',characterAssetRoot(c.id));
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
 assert.equal(manifest.degraded_static_fallback,false);
 const png=fs.readFileSync(path.join(dir,manifest.sprite_sheet_alpha));
 assert.equal(png.readUInt32BE(16),manifest.frame_layout.sheetWidth);assert.equal(png.readUInt32BE(20),manifest.frame_layout.sheetHeight);
 for(const state of basics){assert.ok(manifest.frame_layout.rows[state]?.length>=4,`${c.id} ${state}`);assert.equal(manifest.animation.rows[state].loop,state!=='down_jump');}
 for(const action of social){
  const extra=action!=='hug'&&action!=='kiss';
  const socialManifest=JSON.parse(fs.readFileSync(path.join(root,'public',characterAssetRoot(c.id,extra),'manifest.json'),'utf8'));
  for(const role of ['send','receive']){
   const state=`side_${action}_${role}`,frames=socialManifest.frame_layout.rows[state],timing=socialManifest.animation.rows[state];
   assert.ok(frames?.length>=4,`${c.id} ${state}`);assert.equal(timing.loop,false);
   const total=timing.durations_ms.reduce((a,b)=>a+b,0),expected=action==='dance'?1600:extra?1200:668;
   assert.ok(Math.abs(total-expected)<2,`${state} duration ${total}`);
   for(const r of frames){assert.equal(r.w,c.assetRoot.includes('/animals-')?288:192);assert.equal(r.h,240);assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=socialManifest.frame_layout.sheetWidth&&r.y+r.h<=socialManifest.frame_layout.sheetHeight);checkedFrames++;}
  }
 }
}
console.log(JSON.stringify({ok:true,selectableCharacters:roster.length,pairCombinations:roster.length**2,socialActions:social.length,checkedSocialFrames:checkedFrames,checks:['all movement states','every send and receive','unique IDs','individual scales','PNG texture geometry','full animation timing']},null,2));
