export const FLIGHT_W=360,FLIGHT_H=480,FLIGHT_LIMIT=180*60;
export type FlightInput={x:number;y:number;target?:{x:number;y:number};bomb?:boolean};
type Bullet={x:number;y:number;vx:number;vy:number;r:number;power:number};
type Enemy={id:number;x:number;y:number;origin:number;kind:'scout'|'heavy'|'boss';hp:number;maxHp:number;age:number;phase:number};
type Pickup={x:number;y:number;kind:'power'|'shield'|'bomb'};
type Particle={x:number;y:number;vx:number;vy:number;life:number;color:string};
export type FlightState={seed:number;random:number;tick:number;serial:number;status:'playing'|'over'|'clear';score:number;kills:number;bosses:number;health:number;bombs:number;level:number;shield:number;invincible:number;player:{x:number;y:number};bullets:Bullet[];hostile:Bullet[];enemies:Enemy[];pickups:Pickup[];particles:Particle[];nextWave:number;nextBoss:number;lastShot:number;flash:number};
export function newFlightGame(seed:number):FlightState{return{seed,random:seed>>>0,tick:0,serial:0,status:'playing',score:0,kills:0,bosses:0,health:3,bombs:2,level:1,shield:0,invincible:90,player:{x:180,y:410},bullets:[],hostile:[],enemies:[],pickups:[],particles:[],nextWave:45,nextBoss:25*60,lastShot:-20,flash:0};}
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const random=(s:FlightState)=>{s.random=(Math.imul(s.random,1664525)+1013904223)>>>0;return s.random/4294967296;};
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
function burst(s:FlightState,x:number,y:number,color:string,count=12){for(let i=0;i<count&&s.particles.length<90;i++){const angle=random(s)*Math.PI*2,speed=.5+random(s)*2;s.particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:20+random(s)*15,color});}}
function destroy(s:FlightState,e:Enemy){
 s.kills++;s.score+=e.kind==='boss'?1800:e.kind==='heavy'?180:100;if(e.kind==='boss'){s.bosses++;s.flash=10;}
 burst(s,e.x,e.y,e.kind==='boss'?'#d8b4fe':'#fbbf24',e.kind==='boss'?26:12);
 const roll=random(s);if((e.kind==='boss'||roll<.18)&&s.pickups.length<8)s.pickups.push({x:e.x,y:e.y,kind:e.kind==='boss'?'power':roll<.06?'shield':roll<.1?'bomb':'power'});
}
function damage(s:FlightState){if(s.invincible>0)return;burst(s,s.player.x,s.player.y,'#67e8f9',16);s.invincible=90;if(s.shield>0){s.shield--;return;}s.health--;s.level=Math.max(1,s.level-1);if(s.health<=0){s.status='over';s.flash=12;}}
export function stepFlightGame(s:FlightState,input:FlightInput):FlightState{
 if(s.status!=='playing')return s;s.tick++;s.invincible=Math.max(0,s.invincible-1);s.flash=Math.max(0,s.flash-1);
 const difficulty=Math.min(6,s.tick/(20*60));
 let dx=clamp(input.x,-1,1),dy=clamp(input.y,-1,1),length=Math.hypot(dx,dy);
 if(input.target){dx=input.target.x-s.player.x;dy=input.target.y-s.player.y;length=Math.hypot(dx,dy);const step=Math.min(5.2,length);if(length>0){s.player.x+=dx/length*step;s.player.y+=dy/length*step;}}
 else if(length){s.player.x+=dx/Math.max(1,length)*4.1;s.player.y+=dy/Math.max(1,length)*4.1;}
 s.player.x=clamp(s.player.x,18,FLIGHT_W-18);s.player.y=clamp(s.player.y,42,FLIGHT_H-20);
 if(input.bomb&&s.bombs>0){s.bombs--;s.hostile=[];s.flash=12;for(const e of s.enemies){e.hp-=e.kind==='boss'?28:99;if(e.hp<=0)destroy(s,e);}s.enemies=s.enemies.filter(e=>e.hp>0);}
 if(s.tick-s.lastShot>=9){s.lastShot=s.tick;for(const angle of s.level===1?[0]:s.level===2?[-.06,.06]:[-.16,0,.16])if(s.bullets.length<100)s.bullets.push({x:s.player.x+Math.sin(angle)*25,y:s.player.y-18,vx:Math.sin(angle)*8,vy:-Math.cos(angle)*8,r:2.5,power:1});}
 const hasBoss=s.enemies.some(e=>e.kind==='boss');
 if(s.tick>=s.nextBoss&&!hasBoss){const hp=55+s.bosses*22;s.enemies.push({id:++s.serial,x:180,y:-50,origin:180,kind:'boss',hp,maxHp:hp,age:0,phase:0});s.nextBoss+=35*60;}
 if(s.tick>=s.nextWave&&!s.enemies.some(e=>e.kind==='boss')){
  const count=3+Math.min(3,Math.floor(difficulty/2));for(let i=0;i<count&&s.enemies.length<28;i++){const x=36+i*(FLIGHT_W-72)/(count-1),heavy=random(s)<.2+Math.min(.2,difficulty*.03),hp=heavy?4:1+Math.floor(difficulty/3);s.enemies.push({id:++s.serial,x,y:-24-i*18,origin:x,kind:heavy?'heavy':'scout',hp,maxHp:hp,age:0,phase:random(s)*Math.PI*2});}s.nextWave=s.tick+Math.max(66,135-Math.floor(difficulty*9));
 }
 for(const e of s.enemies){
  e.age++;e.y+=e.kind==='boss'?(e.y<74?1.1:0):1+Math.min(1.4,difficulty*.18);e.x=e.kind==='boss'?180+Math.sin(e.age*.014)*105:clamp(e.origin+Math.sin(e.age*.025+e.phase)*24,18,342);
  const every=e.kind==='boss'?Math.max(34,60-s.bosses*3):Math.max(65,125-Math.floor(difficulty*8));
  if(e.y>15&&e.y<370&&e.age%every===0&&s.hostile.length<140){const angle=Math.atan2(s.player.y-e.y,s.player.x-e.x),fan=e.kind==='boss'?[-.5,-.25,0,.25,.5]:e.kind==='heavy'?[-.16,.16]:[0];for(const offset of fan)if(s.hostile.length<150)s.hostile.push({x:e.x,y:e.y+12,vx:Math.cos(angle+offset)*(1.55+difficulty*.2),vy:Math.sin(angle+offset)*(1.55+difficulty*.2),r:e.kind==='boss'?4:3.5,power:1});}
 }
 for(const bullet of s.bullets){bullet.x+=bullet.vx;bullet.y+=bullet.vy;for(const e of s.enemies){if(e.hp>0&&distance(bullet,e)<(e.kind==='boss'?34:e.kind==='heavy'?16:12)+bullet.r){e.hp-=bullet.power;bullet.y=-100;if(e.hp<=0)destroy(s,e);break;}}}
 s.bullets=s.bullets.filter(b=>b.y>-25&&b.x>-15&&b.x<375);s.enemies=s.enemies.filter(e=>e.hp>0&&e.y<530);
 for(const b of s.hostile){b.x+=b.vx;b.y+=b.vy;if(distance(b,s.player)<b.r+7){damage(s);b.y=999;}}
 s.hostile=s.hostile.filter(b=>b.x>-30&&b.x<390&&b.y>-40&&b.y<510);
 for(const e of s.enemies)if(distance(e,s.player)<(e.kind==='boss'?34:13)+8)damage(s);
 for(const p of s.pickups){p.y+=1.6;if(distance(p,s.player)<23){if(p.kind==='power'){s.level=Math.min(3,s.level+1);s.score+=50;}else if(p.kind==='shield')s.shield=Math.min(2,s.shield+1);else s.bombs=Math.min(4,s.bombs+1);burst(s,p.x,p.y,'#6ee7b7',8);p.y=999;}}
 s.pickups=s.pickups.filter(p=>p.y<510);
 for(const p of s.particles){p.x+=p.vx;p.y+=p.vy;p.life--;p.vx*=.98;p.vy*=.98;}s.particles=s.particles.filter(p=>p.life>0);
 if(s.tick%60===0)s.score+=5;
 if(s.status==='playing'&&s.tick>=FLIGHT_LIMIT){s.status='clear';s.score+=3000;}
 return s;
}

function jet(ctx:CanvasRenderingContext2D,x:number,y:number,size:number,color:string,enemy=false,boss=false){
 ctx.save();ctx.translate(x,y);if(enemy)ctx.rotate(Math.PI);ctx.scale(size,size);
 ctx.fillStyle=boss?'#f0abfc':'#fbbf24';ctx.beginPath();ctx.moveTo(-4,12);ctx.lineTo(0,22);ctx.lineTo(4,12);ctx.fill();
 ctx.fillStyle='rgba(0,0,0,.24)';ctx.beginPath();ctx.ellipse(2,5,boss?24:13,10,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,-21);ctx.lineTo(5,-5);ctx.lineTo(boss?25:17,9);ctx.lineTo(17,13);ctx.lineTo(5,8);ctx.lineTo(4,16);ctx.lineTo(-4,16);ctx.lineTo(-5,8);ctx.lineTo(-17,13);ctx.lineTo(boss?-25:-17,9);ctx.lineTo(-5,-5);ctx.closePath();ctx.fill();
 ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=.8;ctx.stroke();ctx.fillStyle='#e0f2fe';ctx.beginPath();ctx.ellipse(0,-6,2.4,6,0,0,Math.PI*2);ctx.fill();ctx.restore();
}
export function drawFlightGame(ctx:CanvasRenderingContext2D,s:FlightState){
 const background=ctx.createLinearGradient(0,0,0,480);background.addColorStop(0,'#071326');background.addColorStop(.6,'#102a44');background.addColorStop(1,'#0c3440');ctx.fillStyle=background;ctx.fillRect(0,0,360,480);
 for(let i=0;i<45;i++){const x=(i*79+23)%360,y=(i*113+s.tick*(.35+i%3*.16))%500;ctx.globalAlpha=.15+(i%4)*.12;ctx.fillStyle='#d7f5ff';ctx.fillRect(x,y,i%4===0?2:1,i%4===0?4:2);}ctx.globalAlpha=1;
 for(let i=0;i<4;i++){const y=((i*153+s.tick*.65)%660)-100,x=i%2===0?-50:260;const cloud=ctx.createRadialGradient(x,y,0,x,y,115);cloud.addColorStop(0,'rgba(125,211,252,.055)');cloud.addColorStop(1,'rgba(125,211,252,0)');ctx.fillStyle=cloud;ctx.fillRect(0,y-115,360,230);}
 ctx.strokeStyle='rgba(103,232,249,.07)';ctx.beginPath();ctx.moveTo(24,0);ctx.lineTo(24,480);ctx.moveTo(336,0);ctx.lineTo(336,480);ctx.stroke();
 for(const b of s.bullets){ctx.fillStyle='#a5f3fc';ctx.fillRect(b.x-1.5,b.y-5,3,12);ctx.fillStyle='#fff';ctx.fillRect(b.x-.5,b.y-4,1,7);}
 for(const e of s.enemies)jet(ctx,e.x,e.y,e.kind==='boss'?2:e.kind==='heavy'?1.05:.8,e.kind==='boss'?'#a78bfa':e.kind==='heavy'?'#fb923c':'#fb7185',true,e.kind==='boss');
 for(const b of s.hostile){ctx.fillStyle='#fb923c';ctx.beginPath();ctx.arc(b.x,b.y,b.r+1,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff7cd';ctx.beginPath();ctx.arc(b.x,b.y,b.r*.45,0,Math.PI*2);ctx.fill();}
 for(const p of s.pickups){ctx.fillStyle=p.kind==='power'?'#34d399':p.kind==='shield'?'#38bdf8':'#fbbf24';ctx.beginPath();ctx.roundRect(p.x-10,p.y-10,20,20,6);ctx.fill();ctx.fillStyle='#082f49';ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.fillText(p.kind==='power'?'P':p.kind==='shield'?'S':'B',p.x,p.y+4);}
 if(s.health>0){ctx.globalAlpha=s.invincible>0?.55+.25*Math.sin(s.tick*.18):1;jet(ctx,s.player.x,s.player.y,1,'#5eead4');ctx.globalAlpha=1;if(s.shield>0){ctx.strokeStyle='rgba(125,211,252,.65)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(s.player.x,s.player.y,23,0,Math.PI*2);ctx.stroke();}ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(s.player.x,s.player.y,2,0,Math.PI*2);ctx.fill();}
 for(const p of s.particles){ctx.globalAlpha=Math.min(1,p.life/15);ctx.fillStyle=p.color;ctx.fillRect(p.x-1.5,p.y-1.5,3,3);}ctx.globalAlpha=1;
 const boss=s.enemies.find(e=>e.kind==='boss');if(boss){ctx.fillStyle='#1e293b';ctx.fillRect(55,16,250,5);ctx.fillStyle='#c4b5fd';ctx.fillRect(55,16,250*Math.max(0,boss.hp/boss.maxHp),5);ctx.fillStyle='#ddd6fe';ctx.font='9px sans-serif';ctx.textAlign='center';ctx.fillText('BOSS',180,12);}
 if(s.flash>0){ctx.fillStyle=`rgba(186,230,253,${s.flash/12*.18})`;ctx.fillRect(0,0,360,480);}
}
