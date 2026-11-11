import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import ts from 'typescript';

const root=path.resolve(import.meta.dirname,'..'), require=createRequire(path.join(root,'package.json'));
const cache=new Map(); let now=100000;
function load(file) {
  if (!path.extname(file)) file=['.ts','.tsx','.json'].map(ext=>file+ext).find(fs.existsSync);
  if(file.endsWith('.json'))return JSON.parse(fs.readFileSync(file,'utf8'));
  if(cache.has(file))return cache.get(file).exports;
  const module={exports:{}};cache.set(file,module);
  const localRequire=name=>name==='react'?{useEffect(){},useSyncExternalStore(){return now;}}:name==='./sprite-hit'?{preloadSpriteMask(){}}:name.startsWith('@/')?load(path.join(root,name.slice(2))):name.startsWith('.')?load(path.resolve(path.dirname(file),name)):require(name);
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,require:localRequire,setInterval,clearInterval,Date});return module.exports;
}
const {RoomCharacterSprite}=load(path.join(root,'lib/character-sprite-v2.tsx'));
const {SPRITE_CHARACTERS_V2,characterScale,spriteStateScale,spriteFrameV2,characterAssetRoot,isAnimalCharacter}=load(path.join(root,'lib/sprite-v2.ts'));
const {characterManifest}=load(path.join(root,'lib/character-manifests.ts'));
const {SOCIAL_ACTIONS,isSocialAction,socialContactOffset}=load(path.join(root,'lib/social-actions.ts'));
let cases=0;
for(const {id} of SPRITE_CHARACTERS_V2)for(const pose of ['sit','lie'])for(const elapsed of [0,2000,120000]){
 const el=RoomCharacterSprite({id,pose,talking:true,poseInfo:{startedAt:now-elapsed,loop:true}});
 assert.equal(el.props['data-sprite-state'],pose==='sit'?'down_floor_sit':`down_${pose}`,'talking preserves a persistent rest pose');
 assert.ok(el.props.children.props['data-sprite-texture'].startsWith(characterAssetRoot(id,false,pose==='sit'?'floor':true)+'/'));
 if(pose==='sit')assert.equal(RoomCharacterSprite({id,pose,poseInfo:{startedAt:now-elapsed,loop:true,seatedOnBench:true}}).props['data-sprite-state'],'down_sit');
 if(pose==='sit'&&isAnimalCharacter(id)){const bench=RoomCharacterSprite({id,pose,poseInfo:{startedAt:now-elapsed,loop:true,seatedOnBench:true}});assert.ok(bench.props.children.props.style.transform.includes('translateY(-20.833333333333336%)'),'animal paws rest at bench seat height');}
 assert.equal(parseFloat(el.props.children.props.style.width),320/192*100,'wide resting cells preserve source aspect ratio');
}
for(const {id} of SPRITE_CHARACTERS_V2) for(const action of Object.keys(SOCIAL_ACTIONS)) {
  const manifest=characterManifest(id,action!=='hug'&&action!=='kiss'),state=`side_${action}_send`;
  const total=manifest.animation.rows[state].durations_ms.reduce((a,b)=>a+b,0);
  for(const elapsed of [0,51,total-1,total,total+51,total*2,total*101+51]) {
    const startedAt=now-elapsed;
    const element=RoomCharacterSprite({id,pose:action,poseInfo:{startedAt,role:'send',loop:true}});
    assert.equal(element.props['data-sprite-state'],state);
    assert.equal(element.props['data-character-scale'],characterScale(id));
    assert.equal(element.props['data-sprite-frame'],spriteFrameV2(manifest,state,elapsed,true).index);
    const texture=element.props.children;
    assert.equal(texture.props['data-sprite-flip'],Math.floor(elapsed/total)%2===1,'solo facing alternates at complete cycle boundaries');
    const reversed=RoomCharacterSprite({id,pose:action,poseInfo:{startedAt,role:'send',loop:true,facing:-1}});
    assert.equal(reversed.props.children.props['data-sprite-flip'],Math.floor(elapsed/total)%2===0,'alternation respects the initial facing');
    assert.ok(texture.props.style.transform.includes(`scale(${spriteStateScale(id,state)})`));
    assert.equal(texture.props.style.transformOrigin,'50% 90.8333333333%');
  }
  const ended=RoomCharacterSprite({id,pose:action,poseInfo:{startedAt:now-total-1,role:'send'}});
  assert.ok(ended.props.children.props['data-sprite-texture']);
  assert.equal(spriteFrameV2(manifest,state,total+1).ended,true,'paired actions remain one-shot');
  assert.equal(ended.props.children.props['data-sprite-flip'],false,'paired actions keep their facing');
  assert.equal(socialContactOffset(action,characterScale(id),1,100).footY,0);
  cases++;
}

// Exercise the application's actual handlers with an isolated room, not duplicated logic.
const source=fs.readFileSync(path.join(root,'app/page.tsx'),'utf8');
const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const names=['updateSoloAction','stopMySoloAction','handleSoloAction','triggerPlazaPose','handleMyPlazaPose','handleMyPlazaMove'];const definitions=[];
function visit(n){if(ts.isVariableDeclaration(n)&&names.includes(n.name.getText(ast)))definitions.push(`const ${n.getText(ast)};`);ts.forEachChild(n,visit);}visit(ast);
assert.equal(definitions.length,names.length);
const packets=[],timers=new Map();let timerId=0;
const context={roomRest:{stop(){},onMove(){},rest(){}},Date,Math,isSocialAction,canReplaceSocial:()=>true,soloActionRef:{current:{}},cleanNickRef:{current:'me'},activeSocialUntilRef:{current:{}},poseVersionsRef:{current:{}},poseTimersRef:{current:{}},setSoloActionMap(){},setPoseMap(){},setPoseInfoMap(){},setShowMyEmotePicker(){},cancelPendingInteraction(){},broadcastData:async p=>packets.push(p),setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),poseMap:{},clampPlazaPos:p=>p,updatePlazaPos(){}};
const code=ts.transpileModule(definitions.join('\n')+'\nglobalThis.handlers={'+names.join(',')+'};',{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(code,context);const h=context.handlers;
h.handleSoloAction('dance');assert.equal(context.soloActionRef.current.me.action,'dance');assert.equal(packets.at(-1).type,'PLAZA_SOLO');assert.equal(timers.size,0,'repeat has no expiry timer');
h.triggerPlazaPose('me','talk',3400);assert.equal(context.soloActionRef.current.me.action,'dance','voice/chat does not clear the loop');
h.handleMyPlazaMove({x:.5,y:.5},{x:.5,y:.5},true);assert.equal(context.soloActionRef.current.me.action,'dance','freezing at current feet preserves the loop');
h.handleMyPlazaMove({x:.5,y:.5},{x:.6,y:.5});assert.equal(context.soloActionRef.current.me,undefined,'movement cancels the loop');
h.handleSoloAction('hug');h.handleSoloAction('hug');assert.equal(context.soloActionRef.current.me,undefined,'same action toggles off');
h.handleSoloAction('gift');await h.handleMyPlazaPose('jump');assert.equal(context.soloActionRef.current.me,undefined,'jump cancels the loop');
h.handleSoloAction('dance');h.triggerPlazaPose('me','hug',668,{role:'receive',partner:'other'});assert.equal(context.soloActionRef.current.me,undefined,'paired action replaces the solo loop');
console.log(JSON.stringify({ok:true,characterActionCases:cases,checks:['actual renderer after 101 cycles','paired actions end normally','stable body scale and foot anchor','chat preserves repeat','movement, jump and paired action cancel repeat','toggle and stop','freeze broadcasts without cancelling repeat']},null,2));
