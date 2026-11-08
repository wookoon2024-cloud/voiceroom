import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'..'),module={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'lib/festive-lights.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module,exports:module.exports});
const {findFestiveLights,festiveFade}=module.exports;
const width=80,height=120,pixels=new Uint8Array(width*height*4);
const fill=(r,g,b,a)=>{for(let i=0;i<pixels.length;i+=4){pixels[i]=r;pixels[i+1]=g;pixels[i+2]=b;pixels[i+3]=a;}};
fill(255,210,100,0);assert.equal(findFestiveLights(pixels,width,height,'tree').length,0,'transparent gold cannot create a light');
fill(220,235,250,255);assert.equal(findFestiveLights(pixels,width,height,'tree').length,0,'snow is not a golden light');
fill(20,90,65,255);assert.equal(findFestiveLights(pixels,width,height,'tree').length,0,'foliage stays static');
fill(255,205,90,255);
for(const kind of ['tree','lantern','cabin']){
 const points=findFestiveLights(pixels,width,height,kind);assert.ok(points.length>0);assert.ok(points.length<=(kind==='tree'?96:kind==='cabin'?36:18));
 for(const p of points){assert.ok(p.x>=0&&p.x<1&&p.y>=0&&p.y<1);if(kind==='tree')assert.ok(p.y<=.89);const fade=festiveFade();assert.ok(fade.duration>=20&&fade.duration<=28,'each gradual rise and fall takes at least ten seconds');assert.ok(fade.min>=.15&&fade.min<=.25&&fade.max===1,'visible fade range without fully extinguishing lights');}
}
const assets=JSON.parse(fs.readFileSync(path.join(root,'public/plaza/christmas-v7/assets.json'),'utf8'));
for(const asset of Object.values(assets)){const p=path.join(root,'public/plaza/christmas-v7',asset.file);assert.equal(fs.statSync(p).size,asset.bytes);assert.ok(asset.width>300&&asset.height>900,'native image detail is retained');}
console.log(JSON.stringify({ok:true,artworkAssets:Object.keys(assets).length,checks:['ignore transparency and snow','bounded distributed golden points','slow fade periods and bounded brightness','native asset metadata and byte sizes']},null,2));
