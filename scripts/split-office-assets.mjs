import sharp from 'sharp';import fs from 'node:fs/promises';import path from 'node:path';
import vm from 'node:vm';import ts from 'typescript';
const dir=path.resolve(import.meta.dirname,'../public/plaza/office-v1'),W=1672,H=941;
const box=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const regions=[
 ['manager_desk',[[130,333],[185,309],[187,261],[245,225],[299,220],[300,187],[335,187],[352,232],[384,243],[379,316],[429,327],[351,386],[130,356]]],
 ['manager_rug_edge',box(125,310,310,82)],
 ['meeting_table',[[1365,191],[1450,179],[1545,215],[1542,235],[1505,247],[1505,281],[1482,282],[1480,244],[1423,229],[1423,271],[1396,272],[1396,227],[1365,210]]],
 ['meeting_front_frame',[[1284,50],[1310,55],[1310,252],[1372,300],[1575,300],[1575,322],[1360,322],[1284,270]]],
 ['meeting_back',box(1275,0,397,360)],
 ['manager_storage',box(178,0,305,263)],['manager_side',box(0,80,178,280)],
 ['window_plant_left',box(510,105,105,150)],['window_plant_right',box(1076,105,115,150)],
 ['window_left',box(613,110,190,150)],['window_center',box(803,95,100,165)],['window_right',box(903,110,176,150)],
 ['coat_rack',box(1192,75,92,190)],['printer_storage',box(0,360,270,185)],
 ['desk_island_left',box(430,350,365,250)],['desk_island_right',box(884,350,370,250)],
 ['coffee_counter',box(1420,315,252,207)],['corner_desk_left',box(0,540,250,225)],['corner_desk_right',box(1372,521,300,250)],
 ['entrance_planter_left',box(540,802,180,139)],['entrance_planter_right',box(928,802,180,139)],
];
const chairs=[['manager',196,245],['window_left',708,232],['window_right',987,232],['island_left_back_left',558,420],['island_left_back_right',707,420],['island_right_back_left',986,420],['island_right_back_right',1130,420],['island_left_front_left',540,551],['island_left_front_right',699,551],['island_right_front_left',984,551],['island_right_front_right',1154,551],['corner_left',183,684],['corner_right',1444,702],['meeting_back_left',1416,207],['meeting_back_right',1516,231],['meeting_front_left',1399,270],['meeting_front_right',1500,292]];
function inside(x,y,p){let a=false;for(let i=0,j=p.length-1;i<p.length;j=i++){if((p[i][1]>y)!==(p[j][1]>y)&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])a=!a;}return a;}
const assets={};const bounds=(id)=>({id,x:W,y:H,r:0,b:0,pixels:[],count:0});
async function emit(l,data){if(l.count<80)throw Error(`empty ${l.id}: ${l.count}`);const width=l.r-l.x+1,height=l.b-l.y+1,out=Buffer.alloc(width*height*4);for(const p of l.pixels){const x=p%W,y=Math.floor(p/W);data.copy(out,((y-l.y)*width+x-l.x)*4,p*4,p*4+4);}await sharp(out,{raw:{width,height,channels:4}}).png().toFile(path.join(dir,l.id+'.png'));assets[l.id]={file:l.id+'.png',x:l.x/W,y:l.y/H,w:width/W,h:height/H,pixels:l.count};}
function add(l,p){const x=p%W,y=Math.floor(p/W);l.x=Math.min(l.x,x);l.y=Math.min(l.y,y);l.r=Math.max(l.r,x);l.b=Math.max(l.b,y);l.pixels.push(p);l.count++;}
for(const source of ['furniture','chairs']){
 const {data,info}=await sharp(path.join(dir,source+'-source.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});if(info.width!==W||info.height!==H)throw Error('canvas mismatch');
 const layers=(source==='furniture'?regions.map(([id])=>id):chairs.map(([id])=>'chair_'+id)).map(bounds);let discarded=0;
 if(source==='furniture'){
  for(let p=0;p<W*H;p++){if(data[p*4+3]<24)continue;const x=p%W,y=Math.floor(p/W),i=regions.findIndex(([,poly])=>inside(x+.5,y+.5,poly));if(i<0){discarded++;continue;}add(layers[i],p);}
 }else{
  const visited=new Uint8Array(W*H),components=[];
  for(let p=0;p<W*H;p++){if(visited[p]||data[p*4+3]<24)continue;const queue=[p],component=bounds('component');visited[p]=1;for(let k=0;k<queue.length;k++){const q=queue[k],x=q%W,y=Math.floor(q/W);add(component,q);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,n=ny*W+nx;if(nx<0||nx>=W||ny<0||ny>=H||visited[n]||data[n*4+3]<24)continue;visited[n]=1;queue.push(n);}}components.push(component);}
  for(const c of components){const x=(c.x+c.r)/2,y=(c.y+c.b)/2;if(x>1300&&y<350)continue;let winner=-1,distance=Infinity;for(let i=0;i<13;i++){const [,cx,cy]=chairs[i],d=(x-cx)**2+(y-cy)**2;if(d<distance){distance=d;winner=i;}}if(distance>85**2&&c.count<100){discarded+=c.count;continue;}for(const p of c.pixels)add(layers[winner],p);}
 }
 for(const l of layers)if(source!=='chairs'||!l.id.startsWith('chair_meeting'))await emit(l,data);console.log({source,layers:layers.filter(l=>l.count).map(l=>({id:l.id,x:l.x,y:l.y,w:l.r-l.x+1,h:l.b-l.y+1,pixels:l.count})),discarded});
}
// Four fully reconstructed meeting chairs, separated with transparent gutters by the image tool.
const meeting=await sharp(path.join(dir,'meeting-chairs-source.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
for(let q=0;q<4;q++){
 const {data,info}=meeting,x0=q%2*info.width/2,y0=Math.floor(q/2)*info.height/2;let left=info.width,top=info.height,right=0,bottom=0;
 for(let y=y0;y<y0+info.height/2;y++)for(let x=x0;x<x0+info.width/2;x++){const i=(y*info.width+x)*4;if(data[i+3]<200){data[i+3]=0;continue;}left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
 const [id,cx,cy]=chairs[13+q],height=94,width=Math.round((right-left+1)/(bottom-top+1)*height),file='chair_'+id+'.png';
 await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).extract({left,top,width:right-left+1,height:bottom-top+1}).resize(width,height).png().toFile(path.join(dir,file));
 assets['chair_'+id]={file,x:(cx-width/2)/W,y:(cy-height/2)/H,w:width/W,h:height/H,pixels:width*height};
}
await fs.writeFile(path.join(dir,'assets.json'),JSON.stringify({width:W,height:H,assets},null,2));
const officeModule={exports:{}};
vm.runInNewContext(ts.transpileModule(await fs.readFile(path.join(dir,'../../..','lib/office-map.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{module:officeModule,exports:officeModule.exports,require:()=>({width:W,height:H,assets})});
const composites=[...officeModule.exports.OFFICE_PROPS].sort((a,b)=>a.anchorY-b.anchorY).map(a=>({input:path.join(dir,assets[a.id].file),left:Math.round(a.x*W),top:Math.round(a.y*H)}));
await sharp(path.join(dir,'ground.png')).composite(composites).png().toFile(path.join(dir,'layer-preview.png'));
