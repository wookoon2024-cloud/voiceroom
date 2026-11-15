import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
let now=0,serial=0;
const timers=new Map(),intervals=new Map();
const module={exports:{}};
const source=fs.readFileSync(new URL('../lib/room-presence.ts',import.meta.url),'utf8');
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{
  module,exports:module.exports,
  setTimeout:(fn,delay)=>{const id=++serial;timers.set(id,{fn,at:now+delay});return id;},clearTimeout:id=>timers.delete(id),
  setInterval:fn=>{const id=++serial;intervals.set(id,fn);return id;},clearInterval:id=>intervals.delete(id),
});
const advance=async ms=>{
  const end=now+ms;
  while(true){const due=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;
    now=due[1].at;timers.delete(due[0]);await due[1].fn();}
  now=end;
};
const events=()=>{const handlers=new Map();return {
  addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:(name,fn)=>{if(handlers.get(name)===fn)handlers.delete(name);},
  emit:name=>handlers.get(name)?.(),size:()=>handlers.size,
};};
const windowEvents=events(),documentEvents=events();
let connected=true,visible=true,members=['me','existing'],synced=0,delivered=0;
let current=[];
const presence=module.exports.startRoomPresence({connected:()=>connected,visible:()=>visible,members:()=>members,
  onMembers:v=>current=v,sync:()=>{synced++;if(now>=4000)delivered++;},events:windowEvents,documentEvents});
assert.deepEqual([...current],['me','existing'],'existing SDK peers are immediately reconciled');
await advance(4000);assert.equal(synced,3);assert.equal(delivered,1,'late-ready data channel still receives a retry');
visible=false;documentEvents.emit('visibilitychange');members=['me','joined-while-hidden'];await advance(6000);
assert.equal(synced,3,'no broadcasts in background');
visible=true;documentEvents.emit('visibilitychange');assert.equal(current[1],'joined-while-hidden');await advance(0);assert.equal(synced,4);
connected=false;members=['me'];await advance(1500);assert.equal(current[1],'joined-while-hidden','a reconnecting SDK must not erase membership');
connected=true;members=['me','after-reconnect'];presence.wake();await advance(0);assert.equal(current[1],'after-reconnect');
members=['me','event-was-missed'];for(const tick of intervals.values())tick();assert.equal(current[1],'event-was-missed','poll heals a missed participant event');
windowEvents.emit('online');windowEvents.emit('pageshow');assert.equal(timers.size,4,'wake bursts coalesce');
presence.stop();const before=synced;await advance(20000);assert.equal(synced,before);assert.equal(timers.size,0);assert.equal(intervals.size,0);assert.equal(windowEvents.size()+documentEvents.size(),0);
let attempts=0,exhausted=0;
module.exports.startRoomRecovery(async()=>++attempts===2,()=>exhausted++);
await advance(30000);assert.equal(attempts,2);assert.equal(exhausted,0,'successful reconnect stops retries');
attempts=0;module.exports.startRoomRecovery(async()=>{attempts++;return false;},()=>exhausted++);
await advance(30000);assert.equal(attempts,3);assert.equal(exhausted,1,'bounded recovery surfaces failure');
const cancelled=module.exports.startRoomRecovery(async()=>{throw Error('must not connect');},()=>exhausted++);cancelled.cancel();await advance(30000);assert.equal(exhausted,1);
let release;const pending=module.exports.startRoomRecovery(()=>new Promise(resolve=>release=resolve),()=>exhausted++);
const ticking=advance(1500);pending.cancel();release(false);await ticking;await advance(30000);assert.equal(exhausted,1,'leave cancels even an in-flight retry');
console.log('PASS: slow channel, mobile hide/resume, reconnect roster, missed events, online/pageshow, teardown, bounded fresh-token recovery, cancellation');
