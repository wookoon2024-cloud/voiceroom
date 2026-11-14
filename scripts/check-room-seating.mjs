import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'..'),require=createRequire(path.join(root,'package.json')),cache=new Map();let active;
const react={...require('react'),useState(initial){const i=active.index++,cell=active.memory[i]??(active.memory[i]={value:initial});return [cell.value,v=>{cell.value=typeof v==='function'?v(cell.value):v;}];},useRef(initial){const i=active.index++;return active.memory[i]??(active.memory[i]={current:initial});}};
function load(file){if(!path.extname(file))file=['.ts','.tsx','.json'].map(ext=>file+ext).find(fs.existsSync);if(file.endsWith('.json'))return JSON.parse(fs.readFileSync(file,'utf8'));if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2020}}).outputText;vm.runInNewContext(code,{module:m,exports:m.exports,require:n=>n==='react'?react:n.startsWith('@/')?load(path.join(root,n.slice(2))):n.startsWith('.')?load(path.resolve(path.dirname(file),n)):require(n),setInterval,clearInterval,Date});return m.exports;}
const {useRoomRest}=load(path.join(root,'lib/use-room-rest.ts'));const plaza=load(path.join(root,'lib/plaza.tsx'));
const {resolveBenchClaims}=load(path.join(root,'lib/bench-seating.ts'));
const nav=load(path.join(root,'lib/plaza-navigation.ts'));
const christmas=plaza.PLAZA_THEMES.find(t=>t.id==='christmas_party'),assets=JSON.parse(fs.readFileSync(path.join(root,'public/plaza/christmas-garden-v18/assets.json'),'utf8'));
assert.ok(christmas.mapImg.includes('/christmas-garden-v18/'));
const blocked=p=>plaza.isBlockedInTheme(p.x,p.y,christmas);
const detour=nav.findWalkPath({x:.3,y:.54},{x:.7,y:.54},blocked);assert.ok(detour?.length>1,'walk around the lowered fountain');
let point={x:.3,y:.54};for(const next of detour){assert.ok(nav.clearWalkSegment(point,next,blocked));point=next;}
for(const prop of christmas.props){const asset=Object.values(assets).find(a=>prop.src.endsWith('/'+a.file));assert.ok(asset,'all active props use the replacement art');assert.ok(Math.abs(prop.w*1600/(prop.h*1000)-asset.width/asset.height)<1e-9,'native aspect ratio');}

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
for(const theme of plaza.PLAZA_THEMES){const world=plaza.plazaWorldSize(theme,390,844);if(theme.id==='christmas_party'){assert.equal(world.w,1600);assert.equal(world.h,1000);assert.ok(plaza.isBlockedInTheme(.5,.54,theme),'lowered fountain blocks walking');assert.equal(theme.props.filter(p=>p.festiveLight==='tree').length,4);assert.equal(theme.props.filter(p=>p.seats).length,4);assert.ok(theme.props.find(p=>p.water).anchorY>.60,'fountain is lower than the concept');assert.ok(plaza.isBlockedInTheme(.1,.30,theme),'tree base blocks walking');}for(let i=0;i<10;i++){const p=plaza.defaultPlazaPos(i,theme.id);assert.equal(plaza.isBlockedInTheme(p.x,p.y,theme),false,`safe spawn ${theme.id}/${i}`);}for(const prop of theme.props??[])if(prop.seats){assert.equal(prop.seats.length,theme.id==='moonlit_camp'?1:2);for(const p of prop.seats)assert.equal(plaza.isBlockedInTheme(p.x,p.y,theme),false,`reachable chair ${theme.id}/${prop.id}`);}}
for(const c of clients){render(c).stop();}flush();for(const c of clients){c.theme='moonlit_camp';render(c);}
for(const c of clients)assert.equal(c.api.sitOnBench('fire_stool_northwest'),true);flush();
for(const c of clients){const camp=Object.values(c.api.claims).filter(p=>p.theme==='moonlit_camp');assert.equal(camp.length,1,'campfire chair accepts only one simultaneous reservation');assert.equal(camp[0].identity,'Alice');}
assert.equal(chen.api.sitOnBench('fire_stool_northwest'),false);alice.api.arrive(alice.api.request.id);flush();assert.equal(chen.api.rests.Alice.pose,'sit');
alice.api.onMove();flush();assert.equal(chen.api.sitOnBench('fire_stool_northwest'),true);flush();
const camp=plaza.PLAZA_THEMES.find(t=>t.id==='moonlit_camp');assert.equal(camp.props.filter(p=>p.seats).length,6);
assert.equal(plaza.isBlockedInTheme(835/1672,510/941,camp),true,'campfire stone ring is solid');assert.equal(plaza.isBlockedInTheme(.5,.1,camp),true,'sea is not walkable');assert.equal(plaza.isBlockedInTheme(1545/1672,420/941,camp),true,'projection screen supports are solid');assert.equal(plaza.isBlockedInTheme(.5,.32,camp),false,'sea-view deck entrance remains open');
for(const prop of camp.props.filter(p=>p.seats)){const start=prop.seats[0],outside=plaza.defaultPlazaPos(0,camp.id);assert.ok(nav.findWalkPath(start,outside,p=>plaza.isBlockedInTheme(p.x,p.y,camp,plaza.CHAR_FOOT_HW,plaza.CHAR_FOOT_HH,prop.id)),`seated owner can leave ${prop.id}`);}
const campMotion=load(path.join(root,'lib/npc-motion.ts')).buildNpcRoute(p=>plaza.isBlockedInTheme(p.x,p.y,camp));assert.ok(campMotion.length,'NPC also avoids camp furniture');for(const step of campMotion)assert.ok(nav.clearWalkSegment(step.from,step.to,p=>plaza.isBlockedInTheme(p.x,p.y,camp)));
for(const prop of camp.props.filter(p=>p.seats)){const goal=prop.seats[0],from=plaza.defaultPlazaPos(0,camp.id),path=nav.findWalkPath(from,goal,p=>plaza.isBlockedInTheme(p.x,p.y,camp,plaza.CHAR_FOOT_HW,plaza.CHAR_FOOT_HH,prop.id));assert.ok(path,`camp chair approachable: ${prop.id}`);let previous=from;for(const next of path){assert.ok(nav.clearWalkSegment(previous,next,p=>plaza.isBlockedInTheme(p.x,p.y,camp,plaza.CHAR_FOOT_HW,plaza.CHAR_FOOT_HH,prop.id)));previous=next;}}
const {SPRITE_CHARACTERS_V2,characterAssetRoot}=load(path.join(root,'lib/sprite-v2.ts'));let frames=0;
for(const {id} of SPRITE_CHARACTERS_V2){const dir=path.join(root,'public',characterAssetRoot(id,false,true)),m=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8')),png=fs.readFileSync(path.join(dir,m.sprite_sheet_alpha));assert.equal(png.readUInt32BE(16),m.frame_layout.sheetWidth);assert.equal(png.readUInt32BE(20),m.frame_layout.sheetHeight);for(const state of ['down_sit','down_lie']){assert.equal(m.animation.rows[state].loop,true);assert.equal(m.frame_layout.rows[state].length,4);frames+=4;}}
for(const {id} of SPRITE_CHARACTERS_V2){const dir=path.join(root,'public',characterAssetRoot(id,false,'floor')),m=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));assert.equal(m.animation.rows.down_floor_sit.loop,true);assert.equal(m.frame_layout.rows.down_floor_sit.length,4);frames+=4;}
console.log(JSON.stringify({ok:true,restFrames:frames,themes:plaza.PLAZA_THEMES.length,checks:['simultaneous third person rejected','distinct chair places','arrival and remote rest state','move releases seat','lying toggle','invalid claim ignored','all spawns and chair endpoints walkable','garden Christmas skin, lowered fountain and solid tree bases']},null,2));
