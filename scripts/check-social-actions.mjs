import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";
import ts from "typescript";

const root=path.resolve(import.meta.dirname,"..");
const module={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,"lib/social-actions.ts"),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports});
const {SOCIAL_ACTIONS, isSocialAction}=module.exports;
assert.equal(Object.keys(SOCIAL_ACTIONS).length,8);
for(const invalid of [null,{},"toString","constructor","teleport",""])assert.equal(isSocialAction(invalid),false);
let total=0;
for(const id of ["cute_male_v2","strong_male_v2"]){
 const dir=path.join(root,"public/plaza/social-v4",id);
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,"manifest.json"),"utf8"));
 const image=fs.readFileSync(path.join(dir,manifest.sprite_sheet_alpha));
 assert.equal(image.readUInt32BE(16),manifest.frame_layout.sheetWidth);
 assert.equal(image.readUInt32BE(20),manifest.frame_layout.sheetHeight);
 assert.equal(manifest.frame_layout.cellWidth,192);assert.equal(manifest.frame_layout.cellHeight,240);
 for(const [action,config] of Object.entries(SOCIAL_ACTIONS)){
  assert.equal(isSocialAction(action),true);
  assert.ok(config.gap>0&&config.gap<1);
  if(action==="hug"||action==="kiss")continue;
  for(const role of ["send","receive"]){
   const state=`side_${action}_${role}`;
   const rects=manifest.frame_layout.rows[state];const timing=manifest.animation.rows[state];
   assert.equal(rects.length,action==="dance"?8:6,`${id}/${state} frame count`);
   assert.equal(timing.loop,false);
   assert.equal(timing.durations_ms.reduce((a,b)=>a+b,0),config.duration,`${state} expires exactly at playback end`);
   for(const rect of rects){assert.equal(rect.w,192);assert.equal(rect.h,240);assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.w<=manifest.frame_layout.sheetWidth&&rect.y+rect.h<=manifest.frame_layout.sheetHeight);total++;}
  }
 }
}
console.log(JSON.stringify({ok:true,characters:2,newActions:6,independentRoles:24,frames:total,checks:["network action allowlist","full body cell bounds","send/receive timing","PNG dimensions"]},null,2));
