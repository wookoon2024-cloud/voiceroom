import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import ts from 'typescript';
function load(file,deps={},extra={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{module:m,exports:m.exports,require:n=>deps[n],Map,Date,...extra});return m.exports;}
const game=load('lib/office-game.ts'),now=1_000_000,targets=game.officeTargets(42),perfect=targets.map(t=>({at:t.at+20,cell:t.cell}));
assert.equal(targets[0].at,0);assert.equal(targets.at(-1).until,30_000);assert(targets.every((t,i)=>i===0||t.cell!==targets[i-1].cell));
const score=game.officeFrame(42,perfect,30_000);assert.equal(score.hits,targets.length);assert.equal(score.misses,0);assert(score.score>targets.length*10);assert.equal(score.target,null);
assert.equal(game.officeFrame(42,[],30_000).score,0);assert.equal(game.officeFrame(42,[],30_000).misses,targets.length);
assert.equal(game.officeFrame(42,[perfect[0],perfect[0]],100).hits,1,'same bug cannot score twice');assert.equal(game.officeFrame(42,[perfect[0],perfect[0]],100).score,5,'double tapping resets combo and penalizes score');
const run=(owner,inputs=perfect)=>({id:owner+'/run',owner,nick:owner,seed:42,startedAt:now-30_000,finishedAt:now,inputs});
assert(game.validOfficeRun(run('Alice'),now));for(const invalid of [{...run('A'),inputs:[{at:-1,cell:0}]},{...run('A'),inputs:[{at:5,cell:9}]},{...run('A'),inputs:[{at:10,cell:0},{at:9,cell:1}]},{...run('A'),finishedAt:now+100},{...run('A'),inputs:Array(181).fill({at:0,cell:0})},{...run('A'),seed:NaN}])assert(!game.validOfficeRun(invalid,now));
let rank=game.officeRanking([run('Alice'),run('Bob',perfect.slice(0,3)),{...run('Alice',[]),id:'worse'}],now);assert.equal(rank.length,2);assert.equal(rank[0].run.owner,'Alice');assert.equal(rank[0].run.id,'Alice/run');
assert.equal(game.officeRanking(Array.from({length:30},(_,i)=>run('p'+i)),now).length,20);assert.equal(game.officeRanking([run('Alice')],now+7*60*60*1000).length,0,'stale records expire');
// Execute the real sharing hook with two in-memory participants and a late joiner.
let active,timerId=0;const clients=[],packets=[],timers=new Map();
const react={useState(initial){const c=active,i=c.i++;if(!c.cells[i])c.cells[i]={value:typeof initial==='function'?initial():initial};return[c.cells[i].value,v=>{c.cells[i].value=typeof v==='function'?v(c.cells[i].value):v;}];},useRef(value){const c=active,i=c.i++;return c.cells[i]??={current:value};},useCallback(fn,deps){const c=active,i=c.i++,old=c.cells[i];if(old&&deps.every((v,n)=>v===old.deps[n]))return old.fn;c.cells[i]={fn,deps};return fn;},useEffect(fn,deps){const c=active,i=c.i++,old=c.cells[i];if(!old||deps.some((v,n)=>v!==old.deps[n])){old?.cleanup?.();c.effects.push(()=>c.cells[i]={deps,cleanup:fn()});}}};
const hook=load('lib/use-office-game.ts',{'react':react,'./office-game':{...game,validOfficeRun:r=>game.validOfficeRun(r,now),officeRanking:r=>game.officeRanking(r,now)}},{Date:{now:()=>now},setTimeout:(fn,delay)=>{const id=++timerId;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id)});
function render(c){active=c;c.i=0;c.api=hook.useOfficeGame({room:c.room,joined:true,identity:()=>c.name,nick:()=>c.nick,publish:(packet,destination)=>packets.push({sender:c.name,packet:JSON.parse(JSON.stringify(packet)),destination})});for(const effect of c.effects.splice(0))effect();}
function flush(){let count=0;while(packets.length){assert(count++<100,'bounded sharing');const p=packets.shift();for(const c of clients)if(c.name!==p.sender&&(!p.destination||p.destination===c.name))c.api.receive(p.packet,p.sender);}for(const c of clients)render(c);}
function fire(){for(const [id,t]of [...timers].sort((a,b)=>a[1].delay-b[1].delay)){timers.delete(id);t.fn();flush();}}
function client(name){const c={name,nick:name,room:'office',cells:[],i:0,effects:[]};clients.push(c);render(c);return c;}
const alice=client('Alice'),bob=client('Bob');fire();alice.api.submit(run('Alice'));flush();assert.equal(bob.api.ranking[0].run.owner,'Alice','score shared with room');
bob.api.receive({type:'OG_RUN',room:'office',run:run('Alice')},'Mallory');flush();assert.equal(bob.api.ranking.length,1,'sender cannot impersonate score owner');
const chen=client('Chen');fire();assert.equal(chen.api.ranking[0].run.owner,'Alice','late join receives best proof');assert(packets.length===0);
bob.api.receive({type:'OG_RUN',room:'another-room',run:run('Bad')},'Bad');flush();assert.equal(bob.api.ranking.length,1,'cross-room scores ignored');
alice.nick='새 닉네임';render(alice);alice.api.submit({...run('Alice'),id:'new-run',startedAt:now-30_000,finishedAt:now});flush();assert.equal(bob.api.ranking.length,1,'identity has one best entry after nickname changes');
chen.room='different-room';render(chen);fire();assert.equal(chen.api.ranking.length,0,'room change clears in-memory board');
console.log('PASS: deterministic 30s targets, combo/miss scoring, duplicate clicks, proof validation, best-per-person/top20, real peer sharing, authenticated submissions, late join, nickname and room isolation');
