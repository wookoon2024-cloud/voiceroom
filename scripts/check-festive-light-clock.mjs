import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'..');
const compile=file=>ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const module={exports:{}};vm.runInNewContext(compile('lib/festive-lights.ts'),{module,exports:module.exports,Uint8ClampedArray});const {festiveShade,festiveFade}=module.exports;
let time=0,scheduled,starts=0,stops=0,reduced=false;
const clock={exports:{}};vm.runInNewContext(compile('lib/festive-light-clock.ts'),{module:clock,exports:clock.exports,require:()=>module.exports,performance:{now:()=>time},window:{matchMedia:()=>({matches:reduced})},setInterval:(callback,delay)=>{assert.equal(delay,50);scheduled=callback;starts++;return starts;},clearInterval:()=>{scheduled=undefined;stops++;}});
const element=()=>({style:{}}),glow=element(),shade=element();
const unregister=clock.exports.registerFestiveLight({glow,shade,phase:0});
const other=clock.exports.registerFestiveLight({glow:element(),shade:element(),phase:2});assert.equal(starts,1,'all lights share one timer');
assert.equal(+glow.style.opacity,festiveFade().min);
time=5000;scheduled();const before=+glow.style.opacity;time=6000;scheduled();assert.ok(+glow.style.opacity>before,'brightness advances without CSS, rAF or React');assert.ok(Math.abs(+glow.style.opacity + +shade.style.opacity-1)<.0002,'lit and unlit textures crossfade together');
time=6000;scheduled();assert.equal(+glow.style.opacity,1,'fade reaches full light after six seconds');time=12000;scheduled();assert.equal(+glow.style.opacity,festiveFade().min,'slow full cycle');reduced=true;time=9000;scheduled();assert.equal(+glow.style.opacity,1,'reduced motion is a slower fade');
unregister();assert.equal(stops,0);other();assert.equal(stops,1);assert.equal(scheduled,undefined,'unmount removes the final timer');
const width=100,height=100,data=new Uint8ClampedArray(width*height*4);for(let i=0;i<data.length;i+=4){data[i]=255;data[i+1]=220;data[i+2]=110;data[i+3]=255;}
const source=festiveShade(data,width,height,'cabin',[],0,1),at=(x,y)=>4*(y*width+x);
assert.ok(source[at(24,60)+3]>200,'the actual window artwork is darkened');assert.ok(source[at(24,60)]<100,'unlit texture preserves dimmed source colour');assert.equal(source[at(50,90)+3],0,'door and ground are untouched');
const points=[{x:.3,y:.4,radius:5,phase:0,frequency:1}];let stencil=festiveShade(data,width,height,'tree',points,0,3);assert.ok(stencil[at(30,40)+3]>0,'painted tree bulbs can dim');data[at(30,40)+2]=245;stencil=festiveShade(data,width,height,'tree',points,0,3);assert.equal(stencil[at(30,40)+3],0,'snow stays intact');data[at(30,40)+3]=0;stencil=festiveShade(data,width,height,'tree',points,0,3);assert.equal(stencil[at(30,40)+3],0,'transparent padding stays transparent');
const gifts=festiveShade(data,width,height,'tree',points,0,3);assert.equal(gifts[at(30,95)+3],0,'gift ribbons are not light sources');
console.log(JSON.stringify({ok:true,checks:['single shared clock','real time brightness progression','lit and unlit crossfade','slow continuous cycle','reduced motion fade','timer cleanup','window pixels dim','tree bulbs dim','snow and transparency preserved']},null,2));
