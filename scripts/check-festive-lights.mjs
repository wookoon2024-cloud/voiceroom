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
 for(const p of points){assert.ok(p.x>=0&&p.x<1&&p.y>=0&&p.y<1);if(kind==='tree')assert.ok(p.y<=.89);const fade=festiveFade(kind);assert.equal(fade.duration,kind==='cabin'?9:3,'cabin lighting is three times slower than the tree');assert.ok(fade.min>=.02&&fade.min<=.05&&fade.max===1,'visible fade range without fully extinguishing lights');}
}
const assets=JSON.parse(fs.readFileSync(path.join(root,'public/plaza/christmas-camp-v2/assets.json'),'utf8')).assets;
const sharp=(await import('sharp')).default;
for(const asset of Object.values(assets)){const p=path.join(root,'public/plaza/christmas-camp-v2',asset.file),m=await sharp(p).metadata();assert.equal(m.width,asset.width);assert.equal(m.height,asset.height);assert.ok(m.hasAlpha);}
const tree=await sharp(path.join(root,'public/plaza/christmas-camp-v2/christmas_tree.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
assert.ok(findFestiveLights(tree.data,tree.info.width,tree.info.height,'tree').length>=20,'replacement tree has distributed real golden lights');
console.log(JSON.stringify({ok:true,artworkAssets:Object.keys(assets).length,checks:['ignore transparency and snow','bounded distributed golden points','continuous fade','replacement asset dimensions and alpha','real bulbs detected on new tree']},null,2));
