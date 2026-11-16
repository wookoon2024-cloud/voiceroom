import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const module={exports:{}};const compile=text=>ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(compile(fs.readFileSync('lib/room-data.ts','utf8')),{module,exports:module.exports,TextEncoder,TextDecoder,Date,Math,Map,Set,Uint8Array});
const {roomDataPackets,RoomDataReceiver,ROOM_PACKET_BYTES,joinSyncScope,ownJoinSnapshot}=module.exports;
for(const text of ['안녕하세요 🌊'.repeat(9000),'\\"\n\t'.repeat(15000),'\u0001'.repeat(16000),'\ud800'.repeat(15000),'data:image/gif;base64,'+'a'.repeat(100000)]){
 const value={type:'AVATAR_UPDATE',identity:'user',text},packets=[...roomDataPackets(value)];
 assert(packets.every(p=>p.byteLength<=ROOM_PACKET_BYTES),'UTF-8 and JSON-escaped envelopes stay below 12 KiB');
 const receiver=new RoomDataReceiver();let result;for(const p of packets.toReversed()){const next=receiver.receive(p,'alice');if(next)result=next;}
 assert.equal(JSON.stringify(result),JSON.stringify(value));assert.equal(receiver.bufferedCharacters,0);
}
const bytes=o=>new TextEncoder().encode(JSON.stringify(o)),chunk=(id,idx,total,data)=>bytes({type:'__DATA_CHUNK__',id,idx,total,data});
const simultaneous=new RoomDataReceiver(),uploads=Array.from({length:10},(_,i)=>({sender:'peer'+i,packets:[...roomDataPackets({type:'AVATAR_UPDATE',identity:'peer'+i,avatar:'a'.repeat(100000)})]})),complete=[];
for(let step=0;step<uploads[0].packets.length;step++)for(const upload of uploads){const value=simultaneous.receive(upload.packets[step],upload.sender);if(value)complete.push(value.identity);}
assert.equal(complete.length,10,'ten legitimate concurrent picture transfers still complete');
const receiver=new RoomDataReceiver();
receiver.receive(chunk('same',0,2,'{"type":"a",'),'alice',0);
assert.equal(receiver.receive(chunk('same',1,2,'"value":1}'),'bob',0),null,'senders cannot splice chunks');
assert.equal(receiver.receive(chunk('same',1,2,'"value":1}'),'alice',0).value,1);
assert.equal(receiver.receive(chunk('huge',0,1e9,'x'),'bad',0),null,'no unbounded array allocation');
receiver.receive(chunk('stale',0,2,'partial'),'alice',0);receiver.sweep(15001);assert.equal(receiver.bufferedCharacters,0);
for(let i=0;i<1000;i++)receiver.receive(chunk('flood'+i,0,2,'x'.repeat(28000)),'bad',20000);
assert(receiver.bufferedCharacters<=2*28000,'one sender cannot occupy all transfer slots');receiver.clear();
for(let i=0;i<310;i++)receiver.receive(chunk('one',i,500,'x'.repeat(28000)),'bad',0);
assert(receiver.bufferedCharacters<=8*1024*1024,'aggregate retained text has a fixed budget');receiver.clear();
assert.equal(receiver.receive(chunk('bad-index',-1,2,'x'),'bad'),null);
assert.equal(receiver.receive(chunk('bad-data',0,2,{}),'bad'),null);
assert.throws(()=>[...roomDataPackets({data:'a'.repeat(8*1024*1024)})],/커요/);

// Execute the real page's join reply against ten existing clients, not a duplicate implementation.
const source=fs.readFileSync('app/page.tsx','utf8'),ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let reply,participantCallback;const visit=n=>{
 if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='replyToJoin')reply=n.initializer.getText(ast);
 if(ts.isCallExpression(n)&&n.arguments[0]?.getText(ast)==='RoomEvent.ParticipantConnected')participantCallback=n.arguments[1].getText(ast);
 ts.forEachChild(n,visit);
};visit(ast);assert(reply&&participantCallback);assert(!participantCallback.includes('.wake()'),'a member joining must not restart every existing client\'s sync retries');assert(!participantCallback.includes('broadcastData('),'no whole-room snapshot on participant connected');
const members=Array.from({length:10},(_,i)=>'peer'+i),entrant='new',sent=[],snapshots=[];let now=10000;
for(const local of members){
 const room={state:'connected',localParticipant:{identity:local},remoteParticipants:new Map([...members,entrant].filter(p=>p!==local).map(p=>[p,{}]))};
 const context={Date:{now:()=>now},Map,Set,Object,joinSyncScope,ownJoinSnapshot,room,roomRef:{current:room},joinReplies:new Map(),joinAvatars:new Map(),PLAZA_MAP_REVISION:3,
  broadcastData:(packet,options)=>{sent.push({local,packet,options});if(packet.type==='SYNC_SLOTS')snapshots.push(packet);return Promise.resolve();},
  roomRest:{syncOwn:destination=>sent.push({local,destination,kind:'rest'})},plazaSpaces:{syncOwn:destination=>sent.push({local,destination,kind:'space'})},
  snow:{sync:destination=>sent.push({local,destination,kind:'snow'})},snowballs:{sync:destination=>sent.push({local,destination,kind:'snowballs'})},officeGame:{sync:destination=>sent.push({local,destination,kind:'office-game'})},cooking:{sync:destination=>sent.push({local,destination,kind:'cooking'})},mapBoard:{sync:destination=>sent.push({local,destination,kind:'posts'})},
 };
 for(const name of [...reply.matchAll(/\b(\w+Ref)\.current/g)].map(m=>m[1]))if(!context[name])context[name]={current:{}};
 Object.assign(context,{cleanNickRef:{current:local},avatarMapRef:{current:Object.fromEntries(members.map(p=>[p,'photo'.repeat(20000)]))},isMutedRef:{current:false},myDeviceRef:{current:'ios'},myCharacterRef:{current:'cute_male_v2'},plazaSkinRef:{current:'moonlit_camp'},viewModeRef:{current:'plaza'},soloActionRef:{current:{[local]:{action:'dance'}}}});
 vm.createContext(context);vm.runInContext(compile(`globalThis.reply=${reply};`),context);
 context.reply(entrant);const count=sent.length;context.reply(entrant);context.reply('not-present');assert.equal(sent.length,count,'coalesces requests and rejects non-members');
 now+=1500;const photosBefore=sent.filter(p=>p.packet?.type==='AVATAR_UPDATE').length;context.reply(entrant);assert.equal(sent.filter(p=>p.packet?.type==='AVATAR_UPDATE').length,photosBefore,'snapshot retry does not resend an unchanged picture');
}
assert.equal(snapshots.length,20);assert.equal(snapshots.filter(p=>p.plazaMapRevision===3).length,2,'one shared room snapshot per retry');
assert(snapshots.every(p=>!p.avatars),'large images cannot delay lightweight room state');
assert.equal(sent.filter(p=>p.packet?.type==='AVATAR_UPDATE').length,10,'one owner photo per peer rather than ten copies of every photo');
assert(sent.every(p=>(p.options?.destination??p.destination)===entrant),'old clients receive no join snapshots, pictures, poses or post copies');
assert(snapshots.every(p=>p.syncTarget===entrant));
assert.equal(joinSyncScope('peer0',['peer0',entrant],'peer0'),null);
console.log('PASS: 12 KiB UTF-8/escaped packets, out-of-order reassembly, sender isolation, malformed packets, transfer memory/expiry limits, real ten-peer directed join replies, one room snapshot, request coalescing, no existing-client resync storm');
