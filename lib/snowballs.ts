export type SnowPoint={x:number;y:number};
export type SnowPlayer={id:string;point:SnowPoint;canHit:boolean;heading?:SnowPoint;handHeight?:number};
export type SnowBall={id:string;point:SnowPoint;radius:number;angle:number;mode:'ground'|'rolling'|'held';owner?:string;last?:SnowPoint;updatedAt:number};
export type SnowShot={id:string;owner:string;from:SnowPoint;to:SnowPoint;radius:number;at:number;duration:number;impact?:SnowPoint;endedAt?:number;handHeight?:number};
export type SnowHit={id:string;target:string;point:SnowPoint;at:number;until:number;immuneUntil:number;direction:number};
export type SnowState={version:number;at:number;seed:string;cursor:number;balls:SnowBall[];shots:SnowShot[];hits:SnowHit[];seen:string[]};
export type SnowCommand={id:string;actor:string;kind:'roll'|'release'|'lift'|'throw';ballId:string;point:SnowPoint;aim:SnowPoint};
export type SnowEnvironment={players:SnowPlayer[];blocked:(p:SnowPoint,radius:number)=>boolean};
export const SNOW_MAX_RADIUS=34,SNOW_FALL_MS=1200;
export const snowDistance=(a:SnowPoint,b:SnowPoint)=>Math.hypot((a.x-b.x)*1672,(a.y-b.y)*941);
export const snowPoint=(p:unknown):p is SnowPoint=>{const a=p as SnowPoint;return !!a&&Number.isFinite(a.x)&&Number.isFinite(a.y)&&a.x>=.02&&a.x<=.98&&a.y>=.06&&a.y<=.96;};
export const ownedSnowball=(s:SnowState|null,owner:string)=>s?.balls.find(b=>b.owner===owner&&b.mode!=='ground');
export const snowDown=(s:SnowState|null,id:string,now=Date.now())=>s?.hits.some(h=>h.target===id&&now<h.until)??false;
export function snowForward(point:SnowPoint,heading:SnowPoint={x:0,y:1},distance=320):SnowPoint{
 const length=Math.hypot(heading.x,heading.y)||1;
 return{x:Math.max(.02,Math.min(.98,point.x+heading.x/length*distance/1672)),y:Math.max(.06,Math.min(.96,point.y+heading.y/length*distance/941))};
}
export function snowBallVisual(ball:SnowBall,player?:SnowPlayer){
 const heading=player?.heading??{x:0,y:1},length=Math.hypot(heading.x,heading.y)||1;
 if(player&&ball.mode==='held')return{x:player.point.x*1672+heading.x/length*(12+ball.radius*.3),y:player.point.y*941-(player.handHeight??42)+heading.y/length*8,depth:10+Math.round(player.point.y*1000)+(heading.y<0?-2:2)};
 const point=player&&ball.mode==='rolling'?snowForward(player.point,heading,ball.radius+23):ball.point;
 return{x:point.x*1672,y:point.y*941-ball.radius,depth:10+Math.round(point.y*1000)};
}
const text=(v:unknown,max=150):v is string=>typeof v==='string'&&v.length>0&&v.length<=max;
export function validSnowCommand(v:unknown):v is SnowCommand{const c=v as SnowCommand;return !!c&&text(c.id)&&text(c.actor,60)&&text(c.ballId)&&['roll','release','lift','throw'].includes(c.kind)&&snowPoint(c.point)&&snowPoint(c.aim);}
const radius=(n:number)=>Number.isFinite(n)&&n>=10&&n<=SNOW_MAX_RADIUS;
export function validSnowState(v:unknown,now=Date.now()):v is SnowState{
 const s=v as SnowState;if(!s||!Number.isSafeInteger(s.version)||s.version<0||!Number.isSafeInteger(s.at)||s.at>now+5000||!text(s.seed)||!Number.isSafeInteger(s.cursor)||!Array.isArray(s.balls)||s.balls.length>10||!Array.isArray(s.shots)||s.shots.length>12||!Array.isArray(s.hits)||s.hits.length>20||!Array.isArray(s.seen)||s.seen.length>64||!s.seen.every(i=>text(i)))return false;
 const ids=new Set(),owners=new Set();for(const b of s.balls){if(!b||!text(b.id)||ids.has(b.id)||!snowPoint(b.point)||!radius(b.radius)||!Number.isFinite(b.angle)||!['ground','rolling','held'].includes(b.mode)||!Number.isSafeInteger(b.updatedAt)||b.updatedAt>now+5000||b.mode!=='ground'&&(!text(b.owner,60)||owners.has(b.owner))||b.last&&!snowPoint(b.last))return false;ids.add(b.id);if(b.mode!=='ground')owners.add(b.owner);}
 if(s.shots.some(p=>p?.handHeight!==undefined&&(!Number.isFinite(p.handHeight)||p.handHeight<20||p.handHeight>80)))return false;
 for(const p of s.shots)if(!p||!text(p.id)||!text(p.owner,60)||!snowPoint(p.from)||!snowPoint(p.to)||!radius(p.radius)||!Number.isSafeInteger(p.at)||p.at>now+5000||!Number.isFinite(p.duration)||p.duration<500||p.duration>1300||p.impact&&!snowPoint(p.impact)||p.endedAt!==undefined&&!Number.isSafeInteger(p.endedAt))return false;
 for(const h of s.hits)if(!h||!text(h.id)||!text(h.target,60)||!snowPoint(h.point)||!Number.isSafeInteger(h.at)||h.at>now+5000||h.until!==h.at+SNOW_FALL_MS||h.immuneUntil!==h.at+3500||![-1,1].includes(h.direction))return false;
 return true;
}
export function newSnowState(room:string,now:number):SnowState{return{version:0,at:now,seed:room+'/'+now,cursor:Math.floor(now/12000)-4,balls:[],shots:[],hits:[],seen:[]};}
const spots=[[570,683],[1110,690],[720,747],[969,749],[480,460],[1160,460],[550,770],[1120,775],[835,700],[700,375],[1080,390],[450,680]];
const ballClear=(s:SnowState,p:SnowPoint,r:number,env:SnowEnvironment,except?:string)=>snowPoint(p)&&!env.blocked(p,r)&&!s.balls.some(b=>b.id!==except&&b.mode!=='held'&&snowDistance(b.point,p)<b.radius+r+3);
export function snowSegmentClear(s:SnowState,a:SnowPoint,b:SnowPoint,r:number,env:SnowEnvironment,except?:string){const steps=Math.max(1,Math.ceil(snowDistance(a,b)/8));for(let i=1;i<=steps;i++){const t=i/steps;if(!ballClear(s,{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},r,env,except))return false;}return true;}
export function advanceSnow(state:SnowState,now:number,env:SnowEnvironment):SnowState{
 const s:SnowState={...state,balls:state.balls.map(b=>({...b})),shots:state.shots.filter(p=>now-(p.endedAt??p.at+p.duration)<650).map(p=>({...p})),hits:state.hits.filter(h=>h.immuneUntil>now)};
 let changed=s.shots.length!==state.shots.length||s.hits.length!==state.hits.length;
 for(const b of s.balls){
  if(b.mode==='ground')continue;const player=env.players.find(p=>p.id===b.owner);
  if(!player||!player.canHit||now-b.updatedAt>2500){
   const candidates=[b.point,...Array.from({length:8},(_,i)=>({x:b.point.x+Math.cos(i*Math.PI/4)*(b.radius+30)/1672,y:b.point.y+Math.sin(i*Math.PI/4)*(b.radius+30)/941}))];
   const place=candidates.find(p=>ballClear(s,p,b.radius,env,b.id));if(place)b.point=place;else s.balls=s.balls.filter(v=>v.id!==b.id);
   b.mode='ground';delete b.owner;delete b.last;changed=true;continue;
  }
  if(b.mode==='held'){if(snowDistance(player.point,b.point)>1){b.point=player.point;changed=true;}b.updatedAt=now;continue;}
  const last=b.last??player.point,dx=(player.point.x-last.x)*1672,dy=(player.point.y-last.y)*941,travel=Math.hypot(dx,dy);
  if(travel>100){b.mode='ground';delete b.owner;delete b.last;changed=true;continue;}
  if(travel>.4){const grown=Math.min(SNOW_MAX_RADIUS,b.radius+travel*.018),next=snowForward(player.point,{x:dx,y:dy},grown+23);
   if(snowSegmentClear(s,b.point,next,grown,env,b.id)){b.point=next;b.radius=grown;b.angle+=travel/b.radius;}
   b.last=player.point;changed=true;
  }b.updatedAt=now;
 }
 const bucket=Math.floor(now/12000);if(bucket!==s.cursor){
  for(let k=Math.max(s.cursor+1,bucket-3);k<=bucket&&s.balls.length<8;k++){
   const start=Math.abs(k+s.seed.length)%spots.length;
   for(let j=0;j<spots.length;j++){const [x,y]=spots[(start+j)%spots.length],p={x:x/1672,y:y/941};if(ballClear(s,p,11,env)){s.balls.push({id:s.seed+'/'+k,point:p,radius:11,angle:0,mode:'ground',updatedAt:now});break;}}
  }s.cursor=bucket;changed=true;
 }
 for(const shot of s.shots){if(shot.endedAt!==undefined)continue;
  const from=Math.max(0,Math.min(1,(state.at-shot.at)/shot.duration)),to=Math.max(0,Math.min(1,(now-shot.at)/shot.duration));
  const steps=Math.max(1,Math.ceil(snowDistance(shot.from,shot.to)*(to-from)/8));
  for(let i=1;i<=steps;i++){const t=from+(to-from)*i/steps,p={x:shot.from.x+(shot.to.x-shot.from.x)*t,y:shot.from.y+(shot.to.y-shot.from.y)*t};
   const victim=env.players.filter(v=>v.canHit&&v.id!==shot.owner&&!s.hits.some(h=>h.target===v.id&&h.immuneUntil>now)).find(v=>snowDistance(v.point,p)<shot.radius+17);
   if(victim||env.blocked(p,shot.radius)||t>=1){shot.impact=victim?victim.point:p;shot.endedAt=now;changed=true;if(victim)s.hits.push({id:shot.id,target:victim.id,point:victim.point,at:now,until:now+SNOW_FALL_MS,immuneUntil:now+3500,direction:shot.to.x>=shot.from.x?1:-1});break;}
  }
 }
 if(s.shots.some(p=>p.endedAt===undefined)||s.balls.some(b=>b.mode!=='ground'))changed=true;
 return changed?{...s,version:state.version+1,at:now}:state;
}
export function reduceSnow(state:SnowState,command:SnowCommand,sender:string,now:number,env:SnowEnvironment):{state:SnowState;error?:string}{
 if(!validSnowCommand(command)||command.actor!==sender)return{state,error:'눈 놀이 요청을 확인해 주세요.'};
 if(state.seen.includes(command.id))return{state};
 const player=env.players.find(p=>p.id===sender);if(!player?.canHit||snowDown(state,sender,now))return{state,error:'일어난 뒤 눈 놀이를 해 주세요.'};
 if(snowDistance(player.point,command.point)>100)return{state,error:'현재 위치를 확인하고 다시 눌러 주세요.'};
 const s={...state,balls:state.balls.map(b=>({...b})),shots:[...state.shots]},b=s.balls.find(v=>v.id===command.ballId),owned=ownedSnowball(s,sender);
 if(!b)return{state,error:'눈덩이가 없어졌어요.'};
 if(command.kind==='release'){
  if(b.owner!==sender)return{state,error:'내 눈덩이가 아니에요.'};
  const dx=(command.aim.x-command.point.x)*1672,dy=(command.aim.y-command.point.y)*941,len=Math.hypot(dx,dy)||1;
  const place=b.mode==='held'?{x:command.point.x+dx/len*(b.radius+24)/1672,y:command.point.y+dy/len*(b.radius+24)/941}:b.point;
  if(!ballClear(s,place,b.radius,env,b.id))return{state,error:'눈덩이를 놓을 공간이 없어요.'};
  b.point=place;b.mode='ground';delete b.owner;delete b.last;
 }else if(command.kind==='roll'||command.kind==='lift'){
  if(owned&&owned.id!==b.id||b.owner&&b.owner!==sender)return{state,error:'다른 사람이 잡고 있어요.'};
  if(snowDistance(b.point,command.point)>b.radius+85)return{state,error:'눈덩이 가까이로 가 주세요.'};
  b.mode=command.kind==='roll'?'rolling':'held';b.owner=sender;b.last=command.point;
 }else{
  if(b.mode!=='held'||b.owner!==sender)return{state,error:'먼저 눈덩이를 들어 주세요.'};
  if(s.shots.filter(v=>v.endedAt===undefined).length>=8||s.shots.some(v=>v.owner===sender&&now-v.at<1400))return{state,error:'잠시 후 다시 던져 주세요.'};
  const dx=(command.aim.x-command.point.x)*1672,dy=(command.aim.y-command.point.y)*941,len=Math.hypot(dx,dy);if(len<12)return{state,error:'던질 방향을 골라 주세요.'};
  const range=Math.min(len,380-(b.radius-10)*4),to={x:command.point.x+dx/len*range/1672,y:command.point.y+dy/len*range/941};
  s.balls=s.balls.filter(v=>v.id!==b.id);s.shots.push({id:command.id,owner:sender,from:command.point,to,radius:b.radius,at:now,handHeight:Math.max(20,Math.min(80,player.handHeight??42)),duration:Math.max(550,Math.min(1100,range*2.5))});
 }
 b.updatedAt=now;return{state:{...s,version:state.version+1,at:now,seen:[...s.seen,command.id].slice(-64)}};
}
