import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import assert from 'node:assert/strict';
const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../lib/floating-panel.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports});
const {fitPanel,clampPanel,parsePanelPosition}=module.exports;let cases=0;
for(const view of [{left:0,top:0,width:1280,height:720},{left:0,top:0,width:390,height:844},{left:0,top:0,width:390,height:320},{left:20,top:100,width:330,height:300}])for(const size of [{width:370,height:340},{width:370,height:48},{width:800,height:900}])for(const p of [{x:-900,y:-900},{x:9999,y:9999},{x:100,y:120}]){
 const box=fitPanel(size,view),point=clampPanel(p,size,view);assert.ok(point.x>=view.left+8&&point.y>=view.top+8);assert.ok(point.x+box.width<=view.left+view.width-8);assert.ok(point.y+box.height<=view.top+view.height-8);cases++;
}
for(const invalid of [null,'broken','null','[]','{"x":"5","y":3}','{"x":2}','{"x":1e999,"y":2}'])assert.equal(parsePanelPosition(invalid),null);
const restored=parsePanelPosition('{"x":200,"y":150}');assert.equal(restored.x,200);assert.equal(restored.y,150);
console.log(`PASS: ${cases} drag/resize/collapse/keyboard viewport bounds and saved-position validation`);
