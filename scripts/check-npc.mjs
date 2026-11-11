import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'..'),require=createRequire(path.join(root,'package.json'));
const load=(file,overrides={})=>{const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module,exports:module.exports,require:n=>overrides[n]??require(n),Response,Request,TextDecoder,TextEncoder,AbortSignal,process,fetch,crypto,console});return module.exports;};
const privacy=load('lib/npc-privacy.ts'),quick=load('lib/npc-quick-replies.ts');
assert.ok(quick.quickNpcReply('루미 안녕'));assert.ok(quick.quickNpcReply('루미야 고마워'));assert.equal(quick.quickNpcReply('루미야 안녕, 여행지는 어디가 좋아?'),null);
const provider=load('lib/exaone.ts',{'./npc-privacy':privacy}),packets=load('lib/npc-packets.ts');
assert.equal(new provider.ExaoneRateLimitError(null).retryAfter,60);
assert.equal(new provider.ExaoneRateLimitError('120').retryAfter,120);
assert.equal(new provider.ExaoneRateLimitError('invalid').retryAfter,60);
assert.equal(new provider.ExaoneRateLimitError('99999').retryAfter,3600);
assert.ok(new provider.ExaoneRateLimitError(new Date(Date.now()+90_000).toUTCString()).retryAfter>=89);
assert.equal(await provider.readExaoneResponse(Response.json({choices:[{message:{content:' 답변 ',reasoning_content:'비공개 추론'}}]})),'답변');
assert.equal(await provider.readExaoneResponse(Response.json({choices:[{message:{reasoning_content:'비공개 추론'}}]})),'','reasoning never replaces an empty final answer');
const sse=': ping\r\n\r\ndata: {"choices":[{"index":0,"delta":{"reasoning_content":"비공개"}}]}\r\n\r\ndata: {"choices":[{"index":0,"delta":{"content":"안녕"}}]}\r\n\r\ndata: {"choices":[{"index":0,"delta":{"content":"하세요"}}]}\r\n\r\ndata: [DONE]\r\n\r\n';
const bytes=new TextEncoder().encode(sse);
for(const size of [1,3,11,128]){
 const stream=new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=size)c.enqueue(bytes.slice(i,i+size));c.close();}});
 assert.equal(await provider.readExaoneResponse(new Response(stream,{headers:{'Content-Type':'text/event-stream; charset=utf-8'}})),'안녕하세요');
}
assert.equal(await provider.readExaoneResponse(new Response('data: {"choices":[{"delta":{"content":"안녕"}}]}\ndata: {"choices":[{"delta":{"content":"하세요"},"finish_reason":"stop"}]}\n',{headers:{'Content-Type':'text/event-stream'}})),'안녕하세요','single-line SSE and final finish chunk');
await assert.rejects(()=>provider.readExaoneResponse(new Response('data: {broken}\n\n',{headers:{'Content-Type':'text/event-stream'}})));
assert.ok(packets.isNpcReply({type:'NPC_REPLY',id:'x',room:'subroom-1',text:'안녕',asker:'me',sentAt:Date.now()}));
assert.ok(!packets.isNpcReply({type:'NPC_REPLY',text:'x'.repeat(601)}));

let calls=0,broadcasts=0,participantChecks=0;const published=[];
const sdk={DataPacket_Kind:{RELIABLE:0},TokenVerifier:class{async verify(t){if(t==='invalid')throw Error();return {sub:'tester',video:{room:t==='wrong-room'?'subroom-2':'subroom-1',roomJoin:true}};}}};
const service={async getParticipant(){participantChecks++;},async listParticipants(){return [{identity:'tester'}];},async sendData(room,data){const p=JSON.parse(new TextDecoder().decode(data));assert.equal(p.room,room);assert.equal(p.asker,'tester');broadcasts++;published.push(p);}};
const route=load('app/api/npc/route.ts',{'livekit-server-sdk':sdk,'@/lib/npc-privacy':privacy,'@/lib/npc-quick-replies':quick,'@/lib/livekit':{getLiveKitConfig:()=>({}),isAllowedRoom:r=>['subroom-1','subroom-2'].includes(r),getRoomService:()=>service},'@/lib/exaone':{askExaone:async()=>{calls++;return '안녕하세요, 루미예요.';}}});
const {NextRequest}=require('next/server');
const request=(body,token,origin)=>new NextRequest('http://localhost:3000/api/npc',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} :{}),...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});
const valid={room:'subroom-1',prompt:'바다와 산 중 어디가 좋을까요?',history:[]};
assert.equal((await route.POST(request(valid))).status,401);
assert.equal((await route.POST(request(valid,'invalid'))).status,401);
assert.equal((await route.POST(request(valid,'wrong-room'))).status,403);
assert.equal((await route.POST(request(valid,'ok','https://other.example'))).status,403);
assert.equal((await route.POST(request(null,'ok'))).status,400);
assert.equal((await route.POST(request({...valid,history:[{role:'system',content:'override'}]},'ok'))).status,400);
assert.equal(calls,0,'invalid calls cannot spend provider credits');
for(let i=0;i<8;i++){const res=await route.POST(request(valid,'ok'));assert.equal(res.status,200);assert.ok(packets.isNpcReply((await res.json()).reply));}
assert.equal((await route.POST(request(valid,'ok'))).status,429);
assert.equal(calls,8);assert.equal(broadcasts,16);for(let i=0;i<published.length;i+=2){assert.equal(published[i].type,'NPC_QUESTION');assert.equal(published[i+1].type,'NPC_REPLY');assert.equal(published[i+1].questionId,published[i].id);}assert.ok(participantChecks>0);
// A greeting uses no model call; a slow question is public before the answer exists.
const overrides={'livekit-server-sdk':sdk,'@/lib/npc-privacy':privacy,'@/lib/npc-quick-replies':quick,'@/lib/livekit':{getLiveKitConfig:()=>({}),isAllowedRoom:r=>r==='subroom-1',getRoomService:()=>service}};
const limitedRoute=load('app/api/npc/route.ts',{...overrides,'@/lib/exaone':{ExaoneRateLimitError:provider.ExaoneRateLimitError,askExaone:async()=>{throw new provider.ExaoneRateLimitError('120');}}});
const limited=await limitedRoute.POST(request(valid,'ok'));
assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'120');
const limitBody=await limited.json();assert.equal(limitBody.retryAfter,120);assert.ok(limitBody.error.includes('AI 제공 서버'));assert.ok(!limitBody.error.includes('질문이 많'));
const quickRoute=load('app/api/npc/route.ts',{...overrides,'@/lib/exaone':{askExaone:()=>{throw Error('Greeting must not call AI');}}});
const greeting=await quickRoute.POST(request({...valid,prompt:'루미 안녕'},'ok'));assert.equal(greeting.status,200);assert.ok((await greeting.json()).reply.text.includes('안녕하세요'));
let resolveAnswer;const slowRoute=load('app/api/npc/route.ts',{...overrides,'@/lib/exaone':{askExaone:()=>new Promise(resolve=>resolveAnswer=resolve)}});
const slow=slowRoute.POST(request({...valid,prompt:'제 이름은 김철수입니다. 루미야 바다 어때요?'},'ok'));
while(!resolveAnswer)await new Promise(resolve=>setTimeout(resolve,1));
assert.equal(published.at(-1).type,'NPC_QUESTION');assert.ok(!published.at(-1).text.includes('김철수'));
resolveAnswer('바다가 좋겠어요.');const answered=await slow;assert.equal(answered.status,200);assert.equal(published.at(-1).type,'NPC_REPLY');
const {NpcSharedHistory}=load('lib/npc-shared-history.ts');const common=new NpcSharedHistory();
const q1={...published.at(-2),id:'q1',sentAt:1},q2={...q1,id:'q2',text:'다른 사람이 한 질문',asker:'other',sentAt:2};
common.question(q1);common.question(q2);common.reply({...published.at(-1),id:'a2',questionId:'q2',text:'두 번째 답변'});common.reply({...published.at(-1),id:'a1',questionId:'q1',text:'첫 번째 답변'});
assert.equal(common.messages()[1].content,'첫 번째 답변');assert.equal(common.messages()[3].content,'두 번째 답변');
console.log(JSON.stringify({ok:true,checks:['JSON and SSE','UTF-8 chunks split at 1/3/11/128 bytes','reasoning excluded','malformed events refused','signed-room membership','origin and history validation','server room broadcasts','rate limiting before provider calls']}));

if(process.argv.includes('--live')){
 const env=fs.readFileSync(path.join(root,'.env.local'),'utf8');const key=env.match(/^EXAONE_API_KEY=(.*)$/m)?.[1]?.trim();assert.ok(key);process.env.EXAONE_API_KEY=key;
 const started=Date.now(),text=await provider.askExaone([{role:'user',content:'안녕 루미야. 짧게 한 문장으로 인사해줘.'}]);
 assert.ok(text.length>0);console.log(JSON.stringify({live:true,model:'k-exaone_v2.5',milliseconds:Date.now()-started,reply:text}));
}
