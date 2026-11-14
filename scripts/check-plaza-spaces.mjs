import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import assert from 'node:assert/strict';
let active;const timers=new Map();let nextTimer=0;const packets=[];
const react={useState(initial){const i=active.i++,c=active.cells[i]??(active.cells[i]={value:initial});return[c.value,v=>c.value=v];},useRef(initial){const i=active.i++;return active.cells[i]??(active.cells[i]={current:initial});},useCallback(fn){return fn;},useEffect(fn,deps){const i=active.i++,old=active.cells[i];if(!old||deps.some((v,n)=>v!==old.deps[n])){old?.cleanup?.();active.effects.push(()=>{active.cells[i]={deps,cleanup:fn()};});}}};
const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../lib/use-plaza-spaces.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:m,exports:m.exports,require:n=>{assert.equal(n,'react');return react;},setTimeout:fn=>{timers.set(++nextTimer,fn);return nextTimer;},clearTimeout:id=>timers.delete(id)});
const client=nick=>({nick,room:'same-room',cells:[],effects:[],api:null});const alice=client('Alice'),bob=client('Bob');
function render(c){active=c;c.i=0;c.api=m.exports.usePlazaSpaces(c.room,true,()=>c.nick,p=>packets.push({p,nick:c.nick}));for(const effect of c.effects.splice(0))effect();return c.api;}
function flush(){for(const [id,fn]of [...timers]){timers.delete(id);fn();}for(const c of [alice,bob])render(c);}
render(alice);render(bob);flush();alice.api.enter('tent_northwest');render(alice);assert.equal(alice.api.own,'tent_northwest');assert.equal(bob.api.own,'outside','entering a tent does not move everyone');
bob.api.receive(packets.at(-1).p,'Alice');render(bob);assert.equal(bob.api.spaces.Alice,'tent_northwest','peers know which actors share their space');alice.api.syncOwn();assert.equal(packets.at(-1).p.space,'tent_northwest','late-join replay reads the current space');
alice.api.enter('outside');render(alice);assert.ok(Math.abs(alice.api.spawn.x-250/1672)<1e-9,'exit returns to corresponding entrance');
alice.api.enter('tent_southwest');render(alice);alice.api.enter('outside');render(alice);assert.ok(Math.abs(alice.api.spawn.y-740/941)<1e-9,'second tent has its own return point');
bob.api.receive({space:'untrusted-room'},'Alice');render(bob);assert.equal(bob.api.spaces.Alice,'tent_northwest','unknown spaces are rejected');
alice.room='another-room';render(alice);flush();assert.equal(alice.api.own,'outside');assert.equal(Object.keys(alice.api.spaces).length,0,'changing voice rooms clears old presence');
console.log('PASS: personal spaces, shared presence, late join, both doorway return points, validation, room reset');
