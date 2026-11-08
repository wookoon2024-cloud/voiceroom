import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'..'),require=createRequire(path.join(root,'package.json')),cache=new Map();let active;
const react={...require('react'),useState(initial){const i=active.index++,cell=active.memory[i]??(active.memory[i]={value:initial});return [cell.value,v=>{cell.value=typeof v==='function'?v(cell.value):v;}];},useRef(initial){const i=active.index++;return active.memory[i]??(active.memory[i]={current:initial});}};
function load(file){if(!path.extname(file))file=['.ts','.tsx','.json'].map(ext=>file+ext).find(fs.existsSync);if(file.endsWith('.json'))return JSON.parse(fs.readFileSync(file,'utf8'));if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;vm.runInNewContext(code,{module:m,exports:m.exports,require:n=>n==='react'?react:n.startsWith('@/')?load(path.join(root,n.slice(2))):n.startsWith('.')?load(path.resolve(path.dirname(file),n)):require(n),setInterval,clearInterval,Date});return m.exports;}
const {useRoomRest}=load(path.join(root,'lib/use-room-rest.ts'));const plaza=load(path.join(root,'lib/plaza.tsx'));
const {resolveBenchClaims}=load(path.join(root,'lib/bench-seating.ts'));
for(const theme of plaza.PLAZA_THEMES){
 const initial=plaza.plazaWorldSize(theme,1920,1080);
 for(const [width,height] of [[390,844],[1280,720],[2560,1440],[3840,2160]]){
  const resized=plaza.plazaWorldSize(theme,width,height);
  assert.equal(resized.w,initial.w,'resizing the viewport never scales map width');
  assert.equal(resized.h,initial.h,'resizing the viewport never scales map height');
  for(const prop of theme.props??[])assert.equal(prop.w*resized.w,prop.w*initial.w,'furniture retains its pixel size');
 }
 if(theme.id==='garden_lounge')assert.equal(theme.props.find(prop=>prop.id==='deck_bench').w*initial.w,128,'garden furniture is smaller while avatar scale stays fixed');
}
const queue=[];const clients=['Alice','Bob','Chen'].map(nick=>({nick,memory:[],index:0,theme:'garden_lounge'}));
function render(c){active=c;c.index=0;c.api=useRoomRest(()=>c.nick,()=>c.theme,p=>queue.push({from:c,packet:JSON.parse(JSON.stringify(p))}));return c.api;}
function flush(){let count=0;while(queue.length){assert.ok(count++<100);const {from,packet}=queue.shift();for(const c of clients)if(c!==from)render(c).receive(packet);}clients.forEach(render);}
clients.forEach(render);for(const c of clients)assert.equal(c.api.sitOnBench('deck_bench'),true);flush();
for(const c of clients){assert.equal(Object.keys(c.api.claims).length,2,'capacity stays two after simultaneous reservations');assert.deepEqual(Object.keys(c.api.claims).sort(),['Alice','Bob']);assert.equal(new Set(Object.values(c.api.claims).map(x=>x.seat)).size,2,'two distinct places');}
const [alice,bob,chen]=clients;assert.equal(chen.api.request,null,'third participant cannot start approach');assert.equal(chen.api.sitOnBench('deck_bench'),false);
alice.api.onMove();assert.ok(render(alice).claims.Alice,'walking TO a reserved bench retains reservation');
alice.api.arrive(alice.api.request.id);flush();for(const c of clients)assert.equal(c.api.rests.Alice.pose,'sit','arrival replicates persistent seated state');
alice.api.onMove();flush();for(const c of clients)assert.equal(c.api.claims.Alice,undefined,'standing and moving releases the place');assert.equal(chen.api.sitOnBench('deck_bench'),true);flush();
bob.api.rest('lie');flush();for(const c of clients){assert.equal(c.api.rests.Bob.pose,'lie');assert.equal(c.api.claims.Bob,undefined);}
bob.api.rest('lie');flush();assert.equal(bob.api.rests.Bob,undefined,'same rest pose toggles off');
const fake={identity:'fake',theme:'garden_lounge',benchId:'missing',claimId:'fake',claimedAt:1,seat:0};alice.api.receive({type:'BENCH_CLAIM',identity:'fake',claim:fake});assert.equal(render(alice).claims.fake,undefined);
for(const theme of plaza.PLAZA_THEMES){const world=plaza.plazaWorldSize(theme,390,844);if(theme.id==='christmas_party'){assert.ok(world.w>=2880&&world.h>=1800);assert.ok(plaza.isBlockedInTheme(.5,.5,theme),'tree trunk blocks walking');}for(let i=0;i<10;i++){const p=plaza.defaultPlazaPos(i,theme.id);assert.equal(plaza.isBlockedInTheme(p.x,p.y,theme),false,`safe spawn ${theme.id}/${i}`);}for(const prop of theme.props??[])if(prop.seats){assert.equal(prop.seats.length,2);for(const p of prop.seats)assert.equal(plaza.isBlockedInTheme(p.x,p.y,theme),false,`reachable chair ${theme.id}/${prop.id}`);}}
const {SPRITE_CHARACTERS_V2}=load(path.join(root,'lib/sprite-v2.ts'));let frames=0;
for(const {id} of SPRITE_CHARACTERS_V2){const dir=path.join(root,'public/plaza/rest-v6',id),m=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8')),png=fs.readFileSync(path.join(dir,m.sprite_sheet_alpha));assert.equal(png.readUInt32BE(16),m.frame_layout.sheetWidth);assert.equal(png.readUInt32BE(20),m.frame_layout.sheetHeight);for(const state of ['down_sit','down_lie']){assert.equal(m.animation.rows[state].loop,true);assert.equal(m.frame_layout.rows[state].length,4);frames+=4;}}
for(const {id} of SPRITE_CHARACTERS_V2){const dir=path.join(root,'public/plaza/floor-rest-v6',id),m=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));assert.equal(m.animation.rows.down_floor_sit.loop,true);assert.equal(m.frame_layout.rows.down_floor_sit.length,4);frames+=4;}
console.log(JSON.stringify({ok:true,restFrames:frames,themes:plaza.PLAZA_THEMES.length,checks:['simultaneous third person rejected','distinct chair places','arrival and remote rest state','move releases seat','lying toggle','invalid claim ignored','all spawns and chair endpoints walkable','large Christmas world and solid tree trunk']},null,2));
