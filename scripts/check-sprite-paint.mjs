import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import ts from 'typescript';import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
function load(file,dependencies={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module,exports:module.exports,require:n=>{if(n in dependencies)return dependencies[n];throw new Error(n);},Date,Math,Set});return module.exports;}
const sprites=load('lib/sprite-v2.ts'),social=load('lib/social-actions.ts');
const jsx=(type,props)=>({type,props}),manifest=(id,extra=false,rest=false)=>JSON.parse(fs.readFileSync(path.join(root,'public',sprites.characterAssetRoot(id,extra,rest),'manifest.json'),'utf8'));
const renderer=load('lib/character-sprite-v2.tsx',{'react':{useEffect(){},useRef:()=>({current:null}),useSyncExternalStore:()=>0},'react/jsx-runtime':{jsx,jsxs:jsx},'./sprite-hit':{preloadSpriteMask(){}},'./social-actions':social,'./sprite-v2':sprites,'./character-manifests':{characterManifest:manifest}});
function findTexture(node){if(!node?.props)return null;if(node.props['data-sprite-texture'])return node;const children=Array.isArray(node.props.children)?node.props.children:[node.props.children];for(const child of children){const found=findTexture(child);if(found)return found;}return null;}
let cases=0;for(const {id} of sprites.SPRITE_CHARACTERS_V2)for(const pose of [null,'jump','hug','dance','sit','lie'])for(const filter of ['drop-shadow(0 2px 2px rgba(0,0,0,.35))','url("#speaking")']){
  const tree=renderer.RoomCharacterSprite({id,pose,poseInfo:{startedAt:0},visualFilter:filter}),texture=findTexture(tree);
  assert.ok(texture,`${id}/${pose}`);assert.equal(tree.props.style.filter,undefined,'scaled overflow container must remain unfiltered');assert.equal(tree.props.style.overflow,'visible');assert.equal(texture.props.style.filter,filter,'effects belong to the actual frame');
  for(const property of ['backgroundPosition','backgroundSize','transform'])assert.ok(!/NaN|Infinity/.test(texture.props.style[property]),`${id}/${pose}/${property}`);
  assert.equal(tree.props['data-character-scale'],sprites.characterScale(id),'keep existing full-body proportions');cases++;
}
for(const {id} of sprites.SPRITE_CHARACTERS_V2)for(const seatedOnBench of [false,true]){
  const front=renderer.RoomCharacterSprite({id,pose:'sit',poseInfo:{startedAt:0,seatedOnBench,restDirection:'down'}});
  const back=renderer.RoomCharacterSprite({id,pose:'sit',poseInfo:{startedAt:0,seatedOnBench,restDirection:'up'}});
  const state=seatedOnBench?'up_sit':'up_floor_sit',texture=findTexture(back);
  assert.equal(back.props['data-sprite-state'],state,'rear view uses a real rear seated row');
  assert.ok(texture.props['data-sprite-texture'].includes('/back-seating-v1/'),'rear view uses its own art');
  assert.equal(back.props.style.transform,front.props.style.transform,'turning preserves whole-character scale');
  assert.equal(sprites.spriteStateScale(id,state),sprites.spriteStateScale(id,state.replace('up_','down_')),'turning preserves seated body scale');
  assert.ok(!/NaN|Infinity/.test(texture.props.style.backgroundPosition));cases++;
}
const source=fs.readFileSync(path.join(root,'lib/plaza.tsx'),'utf8');assert.ok(!/data-actor-voice[^]*?style=\{\{\s*filter:/.test(source.slice(source.indexOf('data-actor-voice'),source.indexOf('data-actor-nameplate',source.indexOf('data-actor-voice')))),'actor wrapper must not apply the old clipping filter');
console.log(JSON.stringify({ok:true,cases,checks:['frame-local filters before ancestor scale/jump','visible character overflow','unchanged character proportions','finite CSS for single-row rest sheets','no actor-container filter']}));
