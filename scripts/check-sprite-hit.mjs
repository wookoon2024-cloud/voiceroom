import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import ts from 'typescript';
const pixels=new Uint8ClampedArray(200*100*4);
for(let y=0;y<100;y++)for(let x=0;x<200;x++){
 // Frame 0: left half opaque, frame 1: fully opaque.
 pixels[(y*200+x)*4+3]=(x<50||x>=100)?255:0;
}
const module={exports:{}};
class FakeImage{naturalWidth=200;naturalHeight=100;async decode(){}}
const document={createElement:()=>({width:0,height:0,getContext:()=>({drawImage(){},getImageData:()=>({data:pixels})})})};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../lib/sprite-hit.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module,exports:module.exports,Image:FakeImage,document,Uint8Array});
const {preloadSpriteMask,spriteOpaqueAt,pickSpriteActor}=module.exports;
await preloadSpriteMask('/atlas.png');
assert.equal(spriteOpaqueAt('/atlas.png',30,40),true);assert.equal(spriteOpaqueAt('/atlas.png',70,40),false);
assert.equal(spriteOpaqueAt('/atlas.png',-1,40),false);assert.equal(spriteOpaqueAt('/missing.png',10,10),null);
function actor(nick,z,rectX,flip=false){return{dataset:{plazaActor:nick},style:{zIndex:String(z)},querySelector:()=>({dataset:{spriteTexture:'/atlas.png',spriteRect:JSON.stringify({x:rectX,y:0,w:100,h:100}),spriteFlip:String(flip)},getBoundingClientRect:()=>({left:0,top:0,width:100,height:100})})}}
let actors=[actor('partner',1,100),actor('me',2,0)];const world={querySelectorAll:()=>actors};
assert.equal(pickSpriteActor(world,75,50),'partner','transparent part of own cell must pass through to partner');
assert.equal(pickSpriteActor(world,25,50),'me','front opaque body remains selectable');
actors=[actor('partner',1,100),actor('me',2,0,true)];
assert.equal(pickSpriteActor(world,25,50),'partner','mirroring must also mirror alpha hit mask');
assert.equal(pickSpriteActor(world,75,50),'me');
actors=[actor('earlier',1,100),actor('later',1,100)];assert.equal(pickSpriteActor(world,50,50),'later','equal depth follows browser paint order');
assert.equal(pickSpriteActor(world,150,50),null);
console.log(JSON.stringify({ok:true,checks:['transparent padding passes to partner','visible front body','mirrored alpha','depth and paint order','outside bounds','texture not loaded']},null,2));
