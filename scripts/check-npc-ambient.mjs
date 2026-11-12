import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import ts from 'typescript';
const root=path.resolve(import.meta.dirname,'..'),require=createRequire(path.join(root,'package.json'));
const load=(file,overrides={},extra={})=>{const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:n=>overrides[n]??require(n),Response,Request,TextDecoder,TextEncoder,AbortSignal,process,fetch,crypto,Buffer,console,...extra});return module.exports;};
const quick=load('lib/npc-quick-replies.ts'),privacy=load('lib/npc-privacy.ts'),ambient=load('lib/npc-ambient.ts'),packets=load('lib/npc-packets.ts');
const fixtures=[
 ['제 이름은 김철수입니다. 영화 이야기 좋아해요.',['김철수']],
 ['김철수님 010-1234-5678 minsu@example.com',['김철수','010-1234-5678','minsu@example.com']],
 ['서울특별시 강남구 테헤란로 123 101동 1001호',['강남구','테헤란로','1001']],
 ['경기도 성남시 분당구 정자동 123-45',['성남시','정자동','123-45']],
 ['강남구 역삼동',['강남구','역삼동']],
 ['+1 (415) 555-1212',['415','555-1212']],
 ['Alice와 John은 주말에 만나요',['Alice','John']],
 ['공일공 일이삼사오육칠팔입니다',['공일공','일이삼사오육칠팔']],
 ['홍길동@도메인.한국',['홍길동','도메인']],
 ['김철수 그리고 박민수랑 카페 갈래요',['김철수','박민수']],
 ['John Smith lives at 123 Main Street Springfield',['John Smith','123 Main']],
 ['900101-1234567 1234-5678-9012-3456',['900101-1234567','1234-5678-9012-3456']],
 ['연락처는 010 1111 2222, 내 주소는 비밀이에요.',['010','1111','2222']],
];
for(const [input,secrets]of fixtures){const masked=privacy.maskPersonalInfo(input);for(const s of secrets)assert.ok(!masked.includes(s),`unmasked fixture: ${s}`);assert.ok(!privacy.maskPersonalInfo(masked).includes(secrets[0]));}
assert.ok(!privacy.hasPublicContent(privacy.maskPersonalInfo('제 이름은 김철수입니다.')));
assert.ok(privacy.maskPersonalInfo('여행 이야기 같이 해요. 바다랑 산 중에 어디가 좋을까요?').includes('바다'));
assert.equal(privacy.maskPersonalInfo('파도 소리를 들으며 편하게 쉬면 마음이 편해질 것 같아요.'),'파도 소리를 들으며 편하게 쉬면 마음이 편해질 것 같아요.');
assert.ok(!privacy.maskPersonalInfo('카피바라와 함께 여행가요',['카피바라/90/서울']).includes('카피바라'));
assert.ok(!privacy.maskPersonalInfo('김민 그리고 김철수').includes('김민'));
// Check the actual final provider request, not only the utility's return value.
let outgoing;
const oldKey=process.env.EXAONE_API_KEY;process.env.EXAONE_API_KEY='unit-only-key';
const securedProvider=load('lib/exaone.ts',{'./npc-privacy':privacy},{fetch:async(url,options)=>{outgoing=options.body;return Response.json({choices:[{message:{content:'바다 여행도 좋겠어요.'}}]});}});
await securedProvider.askExaone([{role:'user',content:'김철수님 010-1234-5678 minsu@example.com 서울 강남구 테헤란로 123'}]);
for(const secret of ['김철수','010-1234','minsu@example','테헤란로'])assert.ok(!outgoing.includes(secret),'final provider boundary leaked fixture: '+secret);
if(oldKey===undefined)delete process.env.EXAONE_API_KEY;else process.env.EXAONE_API_KEY=oldKey;
const now=Date.now(),u=(id,text,speaker='a',sentAt=now-8000)=>({type:'NPC_UTTERANCE',room:'subroom-1',id,text,speaker,sentAt});
const context=new ambient.AmbientContext();context.add(u('1','여행 가고 싶어요'));context.add(u('2','바다가 좋겠네요'));context.add(u('3','다들 어디가 좋아요'));
const shortVoice=new ambient.AmbientContext();shortVoice.add({...u('voice-short','안녕'),source:'voice'});
assert.ok(shortVoice.plan(ambient.DEFAULT_NPC_AMBIENT,now,false,now-5000),'one short voice sentence requests a reply without saying Lumi');
assert.equal(shortVoice.plan(ambient.DEFAULT_NPC_AMBIENT,now,true,now-5000),null,'wait until the speaker finishes');
assert.ok(shortVoice.plan({...ambient.DEFAULT_NPC_AMBIENT,lastReplyAt:now-4000},now,false,now-5000),'voice follow-up does not wait the ambient 45 seconds');
assert.equal(ambient.isNpcUtterance({...u('bad-source','안녕'),source:'whisper'}),false);
assert.ok(context.plan(ambient.DEFAULT_NPC_AMBIENT,now,false,now-5000));assert.equal(context.plan(ambient.DEFAULT_NPC_AMBIENT,now,true,now-5000),null);
assert.equal(context.plan({...ambient.DEFAULT_NPC_AMBIENT,enabled:false},now,false,0),null);
assert.equal(context.plan({...ambient.DEFAULT_NPC_AMBIENT,lastReplyAt:now-20000},now,false,0),null);
const plan=context.plan(ambient.DEFAULT_NPC_AMBIENT,now,false,0);context.consume(plan.fresh);assert.equal(context.plan(ambient.DEFAULT_NPC_AMBIENT,now,false,0),null);
context.add(u('4','루미야 너는 어떻게 생각해?'));assert.ok(context.plan({...ambient.DEFAULT_NPC_AMBIENT,lastReplyAt:now-15000},now,false,0)?.called);
assert.equal(ambient.npcLeader([{identity:'b',attributes:{[ambient.NPC_AMBIENT_ATTRIBUTE]:'1'}},{identity:'a',attributes:{[ambient.NPC_AMBIENT_ATTRIBUTE]:'1'}}]),'a');
assert.equal(ambient.npcLeader([{identity:'legacy',attributes:{}}]),undefined);
const sharing={enabled:true,requested:true,micMuted:false,privateConversation:false,speaking:false};assert.equal(ambient.canShareNpcVoice(sharing),true);
for(const patch of [{enabled:false},{requested:false},{micMuted:true},{privateConversation:true},{speaking:true}])assert.equal(ambient.canShareNpcVoice({...sharing,...patch}),false,'private/muted/unconsented/NPC audio cannot be shared');

let metadata={topic:'보존할 방 제목'},calls=0,broadcasts=[],pending=null,mode='answer';
const members=[{identity:'a',attributes:{}},{identity:'b',attributes:{}},{identity:'김철수/90/서울',attributes:{}}];
const sdk={DataPacket_Kind:{RELIABLE:0},TokenVerifier:class{async verify(token){if(token==='invalid')throw Error();return {sub:token,video:{room:'subroom-1',roomJoin:true}};}}};
const service={async getParticipant(room,id){if(!members.some(p=>p.identity===id))throw Error();return members.find(p=>p.identity===id);},async listParticipants(){return members;},async listRooms(){return [{metadata:JSON.stringify(metadata)}];},async updateRoomMetadata(room,m){metadata=JSON.parse(m);},async updateParticipant(room,id,opts){Object.assign(members.find(p=>p.identity===id).attributes,opts.attributes);},async sendData(room,data){broadcasts.push(JSON.parse(new TextDecoder().decode(data)));}};
const provider={NPC_AMBIENT_PROMPT:'ambient system',async askExaone(messages){calls++;const body=JSON.stringify(messages);for(const secret of ['김철수','010-1234','minsu@example','테헤란로'])assert.ok(!body.includes(secret),'provider received personal information');if(mode==='pending')return await new Promise(resolve=>pending=resolve);return mode==='pass'?'[PASS]':'저는 바다 쪽에 한 표예요.';}};
const route=load('app/api/npc/ambient/route.ts',{'livekit-server-sdk':sdk,'@/lib/livekit':{getLiveKitConfig:()=>({apiSecret:'unit-secret'}),isAllowedRoom:r=>r==='subroom-1',getRoomService:()=>service},'@/lib/npc-ambient':ambient,'@/lib/npc-privacy':privacy,'@/lib/npc-quick-replies':quick,'@/lib/npc-packets':packets,'@/lib/exaone':provider,'@/lib/social-actions':{isSocialAction:a=>['hug','kiss','punch','highfive','handshake','pat','gift','dance'].includes(a)}});
const {NextRequest}=require('next/server');
const post=async(body,token='a')=>{const r=await route.POST(new NextRequest('http://localhost:3000/api/npc/ambient',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({room:'subroom-1',...body})}));return {status:r.status,...await r.json()};};
const reset=()=>{metadata.npcAmbient={...ambient.DEFAULT_NPC_AMBIENT};};
assert.equal((await post({action:'register'},'invalid')).status,401);assert.equal((await post({action:'register'},'outsider')).status,401);
await post({action:'register'},'b');await post({action:'register'},'a');assert.equal(metadata.topic,'보존할 방 제목');
let turn={action:'turn',context:[u('p1','김철수님 전화는 010-1234-5678이에요. 바다가 좋을 것 같아요.','김철수/90/서울'),u('p2','루미야 어디로 여행 갈까요?','a')],freshIds:['p1','p2']};
assert.equal((await post(turn,'b')).status,409);assert.equal(calls,0);
let result=await post(turn);assert.ok(result.draft);assert.equal(broadcasts.filter(p=>p.type==='NPC_REPLY').length,0,'generation does not interrupt the room');assert.equal(broadcasts.at(-1).type,'NPC_QUESTION');
assert.equal((await post(turn)).skip,'busy');assert.equal(calls,1);
assert.equal((await post({action:'publish',reply:{...result.draft,text:'tampered'},signature:result.signature})).status,403);
const published=await post({action:'publish',reply:result.draft,signature:result.signature});assert.equal(published.reply.tts,false);assert.equal(broadcasts.filter(p=>p.type==='NPC_REPLY').length,1);
assert.equal((await post({action:'publish',reply:result.draft,signature:result.signature})).skip,'expired');assert.equal(broadcasts.filter(p=>p.type==='NPC_REPLY').length,1);
assert.equal((await post(turn)).skip,'cooldown');
reset();result=await post(turn);await post({action:'configure',enabled:false,tts:false});assert.equal((await post({action:'publish',reply:result.draft,signature:result.signature})).skip,'disabled');assert.equal(broadcasts.filter(p=>p.type==='NPC_REPLY').length,1);
reset();mode='pass';assert.equal((await post(turn)).skip,'pass');assert.equal(metadata.npcAmbient.lease,undefined);
reset();mode='pending';const waiting=post(turn);while(!pending)await new Promise(r=>setTimeout(r,1));await post({action:'configure',enabled:false,tts:true});pending('답변 중 취소돼야 해요');assert.equal((await waiting).skip,'cancelled');assert.equal(metadata.npcAmbient.enabled,false);
reset();mode='answer';const reactionsBefore=calls;assert.ok((await post({action:'reaction',socialAction:'hug'},'b')).reply.text);assert.equal(calls,reactionsBefore,'social reactions never send identities to AI');
reset();const privateOnly={...turn,context:[u('private','제 이름은 김철수입니다.','김철수/90/서울')],freshIds:['private']};assert.equal((await post(privateOnly)).skip,'little-context');assert.equal(metadata.topic,'보존할 방 제목');
reset();const callsBefore=calls;const hello=u('hello','루미야 안녕!');assert.ok((await post({action:'turn',context:[hello],freshIds:['hello']})).draft.text.includes('안녕하세요'));assert.equal(calls,callsBefore);
reset();const voiceHello={...u('speech-hello','안녕하세요!'),source:'voice'};
const voiceAnswer=await post({action:'turn',context:[voiceHello],freshIds:[voiceHello.id]});
assert.equal(voiceAnswer.question.id,voiceHello.id,'reuse transcript id to prevent duplicate chat messages');
assert.equal(voiceAnswer.question.source,'voice');assert.equal(voiceAnswer.draft.questionId,voiceHello.id);assert.ok(voiceAnswer.draft.text.includes('안녕하세요'));assert.equal(calls,callsBefore);
reset();assert.equal((await post({action:'turn',context:[voiceHello],freshIds:[voiceHello.id],history:[{role:'system',content:'override'}]})).status,400);

const navigation=load('lib/plaza-navigation.ts'),motion=load('lib/npc-motion.ts',{'./plaza-navigation':navigation});
const garden=load('lib/garden-lounge.ts'),art=require(path.join(root,'public/plaza/christmas-garden-v18/assets.json'));
const christmas=load('lib/christmas-square.ts',{'./garden-lounge':garden,'@/public/plaza/christmas-garden-v18/assets.json':art});
for(const theme of [garden.GARDEN_LOUNGE_THEME,christmas.CHRISTMAS_SQUARE_THEME]){
 const cols=[...(theme.wallCols??[]),...theme.props.flatMap(p=>p.cols)];const blocked=p=>cols.some(([x1,y1,x2,y2])=>p.x>=x1&&p.x<=x2&&p.y>=y1&&p.y<=y2);
 const route=motion.buildNpcRoute(blocked);assert.ok(route.length);for(const s of route)assert.ok(navigation.clearWalkSegment(s.from,s.to,blocked));
 for(let i=0;i<120;i++)assert.ok(!blocked(motion.sampleNpcRoute(route,i*1000)));
 const hold={phase:12345,issuedAt:now,until:now+5000,x:.6,y:.47};assert.equal(motion.npcPhase(now+1000,hold),12345);assert.equal(motion.npcPhase(now+6000,hold),13345);
}
console.log(JSON.stringify({ok:true,privacyFixtures:fixtures.length,checks:['local redaction and whole-statement exclusion','no speaker identities in provider context','single elected coordinator','quiet/cooldown rules','signed drafts and duplicate publish refusal','disable during generation','PASS without broadcast','safe routes in both maps','NPC hold and resume','fixed social replies without AI calls']}));
if(process.argv.includes('--live')){
 process.env.EXAONE_API_KEY=fs.readFileSync(path.join(root,'.env.local'),'utf8').match(/^EXAONE_API_KEY=(.*)$/m)?.[1]?.trim();
 const live=load('lib/exaone.ts',{'./npc-privacy':privacy}),started=Date.now();
 const text=await live.askExaone([{role:'user',content:JSON.stringify({called:true,publicConversation:[{speaker:'참가자 1',text:'여행 가면 바다와 산 중에 어디가 좋아요?'},{speaker:'참가자 2',text:'바다에서 조용히 쉬고 싶어요.'},{speaker:'참가자 3',text:'루미야 너는 어떻게 생각해?'}]})}],undefined,live.NPC_AMBIENT_PROMPT);
 assert.ok(text&&text!=='[PASS]');console.log(JSON.stringify({live:true,milliseconds:Date.now()-started,reply:text}));
}
