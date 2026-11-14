import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import assert from 'node:assert/strict';
const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../lib/speaker-seats.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports});
const {changeSpeakerClaim:change,mergeSpeakerClaims:merge,resolveSpeakerSlots:resolve,seedSpeakerSlots:seed}=module.exports;
const plain=v=>JSON.parse(JSON.stringify(v));
const same=(a,b)=>assert.deepEqual(plain(resolve(a)),plain(resolve(b)));
const invariant=claims=>{const slots=resolve(claims);assert.ok(Object.keys(slots).length<=10);assert.equal(new Set(Object.values(slots)).size,Object.values(slots).length);for(const key of Object.keys(slots))assert.ok(Number(key)>=0&&Number(key)<10);};
const a=change({},'A',0,100),b=change({},'B',0,100);
same(merge(a,b),merge(b,a));assert.deepEqual(plain(resolve(merge(a,b))),{0:'A',1:'B'});
// Existing requested seats stay intact; losing requests take other empty seats.
const c=change({},'C',1,80),occupied=merge(merge(a,b),c);assert.deepEqual(plain(resolve(occupied)),{0:'A',1:'C',2:'B'});
// New joiner restoring a stale seat cannot overwrite its current occupant.
const fresh=change({},'new',0,200);assert.equal(resolve(merge(a,fresh))[0],'A');assert.equal(resolve(merge(a,fresh))[1],'new');
let all={};for(let i=0;i<12;i++)all=merge(all,change({},`user${String(i).padStart(2,'0')}`,i%3,100+i));invariant(all);assert.equal(Object.keys(resolve(all)).length,10);assert.ok(!Object.values(resolve(all)).includes('user11'));
const leave=change(a,'A',null,300),moved=change(leave,'A',4,400);
same(merge(merge(moved,leave),a),moved);assert.deepEqual(plain(resolve(seed(leave,{0:'A'}))),{});
const duplicate=merge(merge(a,a),a);same(duplicate,a);
same(merge(moved,{A:{identity:'A',slot:99,version:999,claimedAt:0}}),moved);
same(merge(moved,{A:{identity:'someoneElse',slot:0,version:999,claimedAt:0}}),moved);
// Every replica receives requests, moves, releases and duplicate/stale snapshots in a different order.
const packets=[];for(let i=0;i<15;i++){const name=`p${i}`,first=change({},name,i%5,100+i),move=change(first,name,(i+3)%10,300+i);packets.push(first,move,first);if(i%4===0)packets.push(change(move,name,null,500+i));}
const expected=packets.reduce((state,p)=>merge(state,p),{});let rng=8191;
for(let run=0;run<250;run++){
 const shuffled=[...packets];for(let i=shuffled.length-1;i>0;i--){rng=(rng*1664525+1013904223)>>>0;const j=rng%(i+1);[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
 const peer=shuffled.reduce((state,p)=>{const next=merge(state,p);invariant(next);return next;},{});same(peer,expected);
 // Late joiners and repeated full snapshots converge without claiming fallback seats again.
 same(merge({},peer),expected);same(merge(peer,expected),expected);
}
console.log('PASS: 250 reordered multi-client runs; simultaneous seat claims; full room; restore; late join; duplicates; stale release/snapshots; invalid packets; unique seats');
