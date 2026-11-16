import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import ts from 'typescript';
const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function load(file,deps={},extra={}){const m={exports:{}};vm.runInNewContext(compile(fs.readFileSync(file,'utf8')),{module:m,exports:m.exports,require:n=>deps[n],Date,Map,Set,...extra});return m.exports;}
const game=load('lib/snowballs.ts');let now=1_000_000;
const player=(id,x,y)=>({id,point:{x:x/1672,y:y/941},canHit:true});
const A=player('A',700,700),B=player('B',900,700),env={players:[A,B],blocked:()=>false};
let s=game.advanceSnow(game.newSnowState('winter',now),now,env);assert.equal(s.balls.length,4);assert(game.validSnowState(s,now));
const first=s.balls[0];A.point={x:first.point.x-42/1672,y:first.point.y};B.point={...A.point};
let serial=0;const command=(actor,kind,ballId,aim=player('target',1000,700).point)=>({id:actor.id+'/'+(++serial),actor:actor.id,kind,ballId,point:{...actor.point},aim});
let c=command(A,'roll',first.id);s=game.reduceSnow(s,c,'A',now,env).state;
assert(game.reduceSnow(s,command(B,'lift',first.id),'B',now,env).error,'simultaneous second grab rejected');
assert.equal(game.reduceSnow(s,c,'A',now,env).state.version,s.version,'command retries are idempotent');
assert(game.reduceSnow(s,command(A,'lift',s.balls[1].id),'A',now,env).error,'one ball per person');
const initial=s.balls[0].radius;for(let i=0;i<15;i++){now+=100;s=game.advanceSnow(s,now,env);}assert.equal(s.balls[0].radius,initial,'stationary ball never grows');
for(let i=0;i<50;i++){A.point={x:A.point.x+8/1672,y:A.point.y};now+=100;s=game.advanceSnow(s,now,env);}assert(s.balls[0].radius>initial+4,'actual rolling grows ball');
const grown=s.balls[0].radius;s=game.reduceSnow(s,command(A,'release',first.id),'A',now,env).state;const resting=JSON.stringify(s.balls[0].point);now+=400;s=game.advanceSnow(s,now,env);assert.equal(JSON.stringify(s.balls[0].point),resting);assert.equal(s.balls[0].radius,grown,'released ball retains size and location');
assert.equal(s.balls[0].owner,undefined);B.point={x:s.balls[0].point.x-40/1672,y:s.balls[0].point.y};s=game.reduceSnow(s,command(B,'lift',first.id),'B',now,env).state;assert.equal(game.ownedSnowball(s,'B').mode,'held','someone else can lift rolled ball');
const owned=game.ownedSnowball(s,'B');A.point={x:B.point.x+180/1672,y:B.point.y};s=game.reduceSnow(s,command(B,'throw',owned.id,A.point),'B',now,env).state;
assert(!game.ownedSnowball(s,'B'));assert.equal(s.shots.length,1);
for(let i=0;i<15;i++){now+=100;s=game.advanceSnow(s,now,env);}assert(s.hits.some(h=>h.target==='A'),'aimed projectile hits a player along its swept path');assert(!s.hits.some(h=>h.target==='B'),'thrower cannot hit self');
const hit=s.hits.find(h=>h.target==='A');assert.equal(hit.until-hit.at,1200);assert.equal(hit.immuneUntil-hit.at,3500);now=hit.until+1;s=game.advanceSnow(s,now,env);assert(!game.snowDown(s,'A',now),'player stands back up after 1.2 seconds');
assert(game.reduceSnow(s,{...command(A,'lift',s.balls[0].id),actor:'fake'},'A',now,env).error,'sender cannot impersonate another player');
assert.equal(game.validSnowState({...s,balls:[...s.balls,s.balls[0]]},now),false,'duplicate balls rejected');assert.equal(game.validSnowState({...s,balls:[{...s.balls[0],radius:999}]},now),false);assert.equal(game.validSnowCommand({...c,point:{x:NaN,y:1}}),false);
const wall={players:[A],blocked:p=>p.x>.6};let blocked=game.newSnowState('wall',now);blocked.balls=[{id:'wall',point:{x:.59,y:.7},radius:20,angle:0,mode:'rolling',owner:'A',last:{x:.56,y:.7},updatedAt:now}];A.point={x:.575,y:.7};now+=100;blocked=game.advanceSnow(blocked,now,wall);assert.equal(blocked.balls[0].radius,20,'blocked rolling cannot grow a ball');
blocked=game.advanceSnow(blocked,now+100,{players:[],blocked:()=>false});assert.equal(blocked.balls[0].mode,'ground','departed owner releases ball');

// Real hook, coalesced scene samples, directed packet delivery and changing host capability.
let active,timerId=0;const clients=[],packets=[],timers=new Map();
const react={useState(initial){const c=active,i=c.i++;if(!c.cells[i])c.cells[i]={value:typeof initial==='function'?initial():initial};return[c.cells[i].value,v=>{c.cells[i].value=typeof v==='function'?v(c.cells[i].value):v;}];},useRef(value){const c=active,i=c.i++;return c.cells[i]??={current:value};},useCallback(fn,deps){const c=active,i=c.i++,old=c.cells[i];if(old&&deps.every((v,n)=>v===old.deps[n]))return old.fn;c.cells[i]={fn,deps};return fn;},useEffect(fn,deps){const c=active,i=c.i++,old=c.cells[i];if(!old||deps.some((v,n)=>v!==old.deps[n])){old?.cleanup?.();c.effects.push(()=>c.cells[i]={deps,cleanup:fn()});}}};
const timer=(fn,delay,repeat=false)=>{const id=++timerId;timers.set(id,{fn,at:now+delay,delay,repeat,client:active});return id;};
const hook=load('lib/use-snowballs.ts',{'react':react,'./snowballs':game},{Date:{now:()=>now},setTimeout:(f,d)=>timer(f,d),clearTimeout:id=>timers.delete(id),setInterval:(f,d)=>timer(f,d,true),clearInterval:id=>timers.delete(id)});
function render(c){active=c;c.i=0;c.api=hook.useSnowballs({room:c.room,joined:true,active:c.playing,identity:()=>c.name,peers:()=>clients.filter(p=>p.online&&p.room===c.room).map(p=>({identity:p.name,joinedAt:p.joinedAt})),canSend:()=>true,publish:(packet,destination)=>packets.push({sender:c.name,packet:JSON.parse(JSON.stringify(packet)),destination})});for(const effect of c.effects.splice(0))effect();c.api.observe({players:clients.filter(p=>p.online&&!p.legacy&&p.playing&&p.room===c.room).map(p=>({id:p.name,point:p.point,canHit:true})),me:{id:c.name,point:c.point,canHit:true},blocked:()=>false,heading:{x:1,y:0}});}
function client(name,joinedAt){const c={name,joinedAt,online:true,playing:true,room:'winter',point:{x:.5,y:.8},cells:[],i:0,effects:[]};clients.push(c);render(c);return c;}
function flush(){let count=0;while(packets.length){assert(count++<1000,'network stays bounded');const p=packets.shift();for(const c of clients)if(c.online&&c.api&&c.name!==p.sender&&(!p.destination||p.destination===c.name)&&!(c.dropStates&&p.packet.type==='SB_STATE'))c.api.receive(p.packet,p.sender);}for(const c of clients)if(c.online&&!c.legacy)render(c);}
function advance(ms){const end=now+ms;while(true){const next=[...timers].filter(([,t])=>t.client.online&&t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;if(next[1].repeat)next[1].at+=next[1].delay;else timers.delete(next[0]);active=next[1].client;next[1].fn();flush();}now=end;flush();}
clients.push({name:'old-client',joinedAt:0,online:true,room:'winter',legacy:true});const alice=client('Alice',1),bob=client('Bob',2),chen=client('Chen',3);advance(2300);
assert(alice.api.store.current?.balls.length);assert.equal(bob.api.store.current.version,alice.api.store.current.version,'shared state arrives');
const ball=alice.api.store.current.balls[0];alice.point={x:ball.point.x-40/1672,y:ball.point.y};bob.point={...alice.point};flush();
alice.api.request('roll',ball.id,alice.point,{x:.8,y:.7});bob.api.request('lift',ball.id,bob.point,{x:.8,y:.7});flush();assert.equal(bob.api.store.current.balls.find(v=>v.id===ball.id).owner,'Alice');
for(let i=0;i<25;i++){alice.point={x:alice.point.x+6/1672,y:alice.point.y};flush();advance(200);}assert(alice.api.store.current.balls.find(v=>v.id===ball.id).radius>11);
alice.api.request('release',ball.id,alice.point,{x:.8,y:.7});flush();const saved=alice.api.store.current.balls.find(v=>v.id===ball.id);
bob.dropStates=true;const other=chen.api.store.current.balls.find(v=>v.mode==='ground'&&v.id!==ball.id);chen.point={x:other.point.x-35/1672,y:other.point.y};flush();chen.api.request('lift',other.id,chen.point,{x:.8,y:.7});flush();alice.online=false;bob.dropStates=false;advance(2200);
assert.equal(bob.api.store.current.balls.find(v=>v.id===other.id).owner,'Chen','takeover recovers missed held inventory from offers');assert.equal(bob.api.store.current.balls.find(v=>v.id===saved.id).radius,saved.radius,'ground snowball persists across host changes');
const delta=client('Delta',4);advance(1500);assert.equal(delta.api.store.current.balls.find(v=>v.id===saved.id).radius,saved.radius,'late join retains rolled size');
const before=delta.api.store.current.version;delta.api.receive({type:'SB_STATE',room:'winter',state:{...delta.api.store.current,version:before+99}},'old-client');render(delta);assert.equal(delta.api.store.current.version,before,'unsupported legacy peer cannot author state');
bob.playing=false;render(bob);advance(2200);assert(chen.api.store.current.version>=before,'active peer takes over when old host enters tent');
delta.room='another';render(delta);advance(1500);assert(delta.api.store.current.seed.startsWith('another/'),'room memories are isolated');
console.log('PASS: shared rolling, distance growth, release/reuse, exclusive ownership, lift/aim/throw, swept hit and immunity, wall blocking, departure cleanup, validation, real multi-client hook, legacy coexistence, missed-snapshot handover, late join and room isolation');
