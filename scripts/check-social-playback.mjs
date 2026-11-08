import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'..');
const modules=new Map();
function load(name){
 const file=path.join(root,'lib',name+'.ts');if(modules.has(file))return modules.get(file);
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require:n=>load(n.replace('./',''))});
 modules.set(file,module.exports);return module.exports;
}
const {receivedSocialStart,canReplaceSocial}=load('social-playback');
const {socialContactOffset,SOCIAL_ACTIONS}=load('social-actions');
const now=100000;
for(const skew of [-10000,-2000,-500,0,500,2000,10000]){
 for(const delay of [0,40,200,800,2500]){
  const sentAt=now+skew-delay,startedAt=sentAt+220;
  const local=receivedSocialStart({sentAt,startedAt},now);
  assert.ok(local>=now&&local<=now+250,`never skip action for skew ${skew} delay ${delay}`);
  for(const action of Object.values(SOCIAL_ACTIONS))assert.equal(local+action.duration-now,action.duration+(local-now));
 }
}
assert.ok(receivedSocialStart({startedAt:now-2500},now)>=now,'legacy packet gets a complete action');
for(const pose of [null,'talk','laugh','wave','jump'])assert.equal(canReplaceSocial(now+1200,pose,now),false);
assert.equal(canReplaceSocial(now+1200,'hug',now),true);
assert.equal(canReplaceSocial(now-1,'talk',now),true);
for(const action of Object.keys(SOCIAL_ACTIONS)){
 const equal=socialContactOffset(action,1,1,100),mixed=socialContactOffset(action,1,1.2,100);
 assert.ok(mixed.gap>equal.gap,'larger body has a larger reach');
 assert.ok(Number.isFinite(mixed.footY));
 assert.equal(mixed.footY,0,'both characters share the planted foot baseline');
}
console.log(JSON.stringify({ok:true,clockSkewCases:35,checks:['complete remote playback','legacy packets','chat/stop cannot overwrite paired action','body scale contact spacing','shared foot baseline']},null,2));
