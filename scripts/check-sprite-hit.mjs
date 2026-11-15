import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import ts from 'typescript';
const pixels=new Uint8ClampedArray(200*100*4);
for(let y=0;y<100;y++)for(let x=0;x<200;x++){
 // Frame 0: left half opaque, frame 1: fully opaque.
 pixels[(y*200+x)*4+3]=(x<50||x>=100)?255:0;
}
const module={exports:{}};
let fetches=0;
const bytesFor=(width,height)=>{const b=new ArrayBuffer(16+Math.ceil(width*height/8)),v=new DataView(b);new Uint8Array(b,0,4).set([86,82,72,77]);v.setUint32(4,1,true);v.setUint32(8,width,true);v.setUint32(12,height,true);const bits=new Uint8Array(b,16);for(let p=0;p<width*height;p++)if(width!==200||pixels[p*4+3]>=48)bits[p>>3]|=1<<(p&7);return b;};
const fetch=async src=>{fetches++;assert.ok(src.endsWith('.hit.bin'));return{ok:!src.includes('missing'),arrayBuffer:async()=>src.includes('corrupt')?new ArrayBuffer(5):src.includes('cache-')?bytesFor(1024,512):bytesFor(200,100)};};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../lib/sprite-hit.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module,exports:module.exports,fetch,Uint8Array,Image:class{constructor(){throw Error('must not decode images for hits');}},document:{createElement(){throw Error('must not allocate a canvas for hits');}}});
const {preloadSpriteMask,spriteOpaqueAt,pickSpriteActor}=module.exports;
await preloadSpriteMask('/atlas.png');
assert.equal(spriteOpaqueAt('/atlas.png',30,40),true);assert.equal(spriteOpaqueAt('/atlas.png',70,40),false);
assert.equal(spriteOpaqueAt('/atlas.png',-1,40),false);assert.equal(spriteOpaqueAt('/missing.png',10,10),null);
function actor(nick,z,rectX,flip=false){return{dataset:{plazaActor:nick},style:{zIndex:String(z)},querySelector:()=>({dataset:{spriteTexture:'/atlas.png',spriteRect:JSON.stringify({x:rectX,y:0,w:100,h:100}),spriteFlip:String(flip)},closest:()=>null,getBoundingClientRect:()=>({left:0,top:0,width:100,height:100})})}}
let actors=[actor('partner',1,100),actor('me',2,0)];const world={querySelectorAll:()=>actors};
assert.equal(pickSpriteActor(world,75,50),'partner','transparent part of own cell must pass through to partner');
assert.equal(pickSpriteActor(world,25,50),'me','front opaque body remains selectable');
actors=[actor('partner',1,100),actor('me',2,0,true)];
assert.equal(pickSpriteActor(world,25,50),'partner','mirroring must also mirror alpha hit mask');
assert.equal(pickSpriteActor(world,75,50),'me');
actors=[actor('earlier',1,100),actor('later',1,100)];assert.equal(pickSpriteActor(world,50,50),'later','equal depth follows browser paint order');
assert.equal(pickSpriteActor(world,150,50),null);
console.log(JSON.stringify({ok:true,checks:['transparent padding passes to partner','visible front body','mirrored alpha','depth and paint order','outside bounds','texture not loaded']},null,2));

const angle=32*Math.PI/180,c=Math.cos(angle),sn=Math.sin(angle),size=100*(c+sn);
const mapped=module.exports.spriteFramePoint({left:0,top:0,width:size,height:size},size/2-25*c,size/2-25*sn,1,32);assert.ok(Math.abs(mapped.u-.25)<1e-9);assert.ok(Math.abs(mapped.v-.5)<1e-9,'rotated lying pixels use inverse rotation');

await Promise.all([preloadSpriteMask('/same.png'),preloadSpriteMask('/same.png')]);const fetched=fetches;await preloadSpriteMask('/same.png');assert.equal(fetches,fetched,'deduplicated/cache loads');
await preloadSpriteMask('/corrupt.png');assert.equal(spriteOpaqueAt('/corrupt.png',0,0),null);
await preloadSpriteMask('/missing.png');assert.equal(spriteOpaqueAt('/missing.png',0,0),null);
for(let i=0;i<55;i++)await preloadSpriteMask('/cache-'+i+'.png');assert.equal(spriteOpaqueAt('/cache-0.png',10,10),null,'bounded mask cache evicts oldest rows');assert.equal(spriteOpaqueAt('/cache-54.png',10,10),true);
console.log('PASS: no Image/Canvas allocation, binary hit masks, deduplicated loads, corrupt/missing responses, bounded cache');
