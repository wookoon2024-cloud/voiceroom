import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';

const deleted=[];
const indexedDB={deleteDatabase:name=>{deleted.push(name);return {};},open:()=>{throw Error('Post storage must never be opened');}};
function load(name,dependencies={},extra={}){
  const module={exports:{}};
  const source=fs.readFileSync(new URL('../lib/'+name+'.ts',import.meta.url),'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,
    {module,exports:module.exports,require:n=>{assert.ok(n in dependencies,n);return dependencies[n];},Date,indexedDB,...extra});
  return module.exports;
}
const cache=load('map-post-cache'),protocol=load('map-posts'),delivery=load('map-post-delivery');
function client(room='one'){
  const values=[],refs=[],effects=[],stops=[],timers=new Map();let cursor=0,nextTimer=0;
  const react={useState:v=>{const i=cursor++;if(!(i in values))values[i]=v;return [values[i],v=>values[i]=v];},
    useRef:v=>{const i=cursor++;return refs[i]??=( {current:v});},useCallback:f=>f,useEffect:f=>effects.push(f)};
  const events={addEventListener(){},removeEventListener(){}};
  const {useMapPosts}=load('use-map-posts',{'react':react,'./map-post-cache':cache,'./map-posts':protocol,'./map-post-delivery':delivery},
    {window:events,document:events,setTimeout:f=>{timers.set(++nextTimer,f);return nextTimer;},clearTimeout:i=>timers.delete(i),setInterval:()=>1,clearInterval(){}});
  const sent=[];
  const api=useMapPosts(room,true,()=> 'Alice',async packet=>{sent.push(packet);});
  for(const effect of effects){const stop=effect();if(stop)stops.push(stop);}
  for(const f of timers.values())f();timers.clear();
  return {api,sent,posts:()=>values[0],close:()=>stops.forEach(f=>f())};
}
const post={id:'live-post',author:'Alice',kind:'text',content:'Hello',caption:'',theme:'garden',position:{x:.5,y:.5},at:1,positionAt:1,comments:[],reactions:[],views:[]};
assert.equal(protocol.validPost(post),true);
const a=client();assert.equal(a.posts().length,0);
await a.api.send({type:'MAP_POST',post});assert.equal(a.posts().length,1);
const b=client();assert.equal(b.posts().length,0,'new client does not restore a local post');
await a.api.sync();for(const packet of a.sent.filter(p=>p.type==='MAP_POST_SYNC'))b.api.receive(packet,'Alice',true);
assert.equal(b.posts().length,1,'late join receives live peer snapshots');
await a.api.flush();a.close();
const refreshed=client();assert.equal(refreshed.posts().length,0,'solo reload starts empty');
const otherRoom=client('two');assert.equal(otherRoom.posts().length,0,'another room starts empty');
b.close();refreshed.close();otherRoom.close();
assert.ok(deleted.length>=4);assert.ok(deleted.every(name=>name==='voiceroom-map-posts'),'only legacy posts cache is removed');
load('map-post-cache',{}, {indexedDB:undefined}).clearLegacyMapPostCache();
load('map-post-cache',{}, {indexedDB:{deleteDatabase(){throw Error('storage blocked');}}}).clearLegacyMapPostCache();
console.log('PASS: no storage reads/writes, legacy cache cleanup, live/late-join sharing, empty solo refresh, room isolation, blocked storage');
