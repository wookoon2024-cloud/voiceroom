import sharp from 'sharp';import fs from 'node:fs/promises';import path from 'node:path';
const dir=path.resolve(import.meta.dirname,'../public/plaza/tent-interior-v1');
const {data,info}=await sharp(path.join(dir,'furniture-source.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true}),W=info.width,H=info.height;
const box=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const regions=[
 ['cushion_back',box(1055,260,132,67)],['cushion_left',box(1025,329,130,76)],
 ['cushion_right',box(1295,305,112,66)],['cushion_front',box(1228,373,145,75)],
 ['bed_left',[[200,316],[215,272],[310,265],[354,304],[401,324],[471,377],[472,423],[415,452],[319,452],[203,399]]],
 ['bed_right',box(325,165,310,230)],
 ['tea_table',[[1131,315],[1157,290],[1210,279],[1285,290],[1313,312],[1313,360],[1265,402],[1174,401],[1134,365]]],
 ['night_crate',box(1154,175,182,149)],['book_nook',box(35,385,305,370)],['flower_crate',box(1365,455,270,300)],
];
function inside(x,y,p){let a=false;for(let i=0,j=p.length-1;i<p.length;j=i++){if((p[i][1]>y)!==(p[j][1]>y)&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])a=!a;}return a;}
const layers=regions.map(([id])=>({id,data:Buffer.alloc(data.length),x:W,y:H,right:0,bottom:0}));let missed=0;const tiles={};
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;if(data[i+3]<=3)continue;const index=regions.findIndex(([,p])=>inside(x+.5,y+.5,p));if(index<0){missed++;const k=`${Math.floor(x/40)*40},${Math.floor(y/40)*40}`;tiles[k]=(tiles[k]??0)+1;continue;}const l=layers[index];data.copy(l.data,i,i,i+4);l.x=Math.min(l.x,x);l.y=Math.min(l.y,y);l.right=Math.max(l.right,x);l.bottom=Math.max(l.bottom,y);}
if(missed>50)throw Error(JSON.stringify({missed,tiles}));
const assets={};for(const l of layers){const width=l.right-l.x+1,height=l.bottom-l.y+1;if(width<2||height<2)throw Error(l.id);await sharp(l.data,{raw:{width:W,height:H,channels:4}}).extract({left:l.x,top:l.y,width,height}).png().toFile(path.join(dir,`${l.id}.png`));assets[l.id]={file:`${l.id}.png`,x:l.x/W,y:l.y/H,w:width/W,h:height/H};}
const clean=path.join(dir,'bed-left-clean-source.png');
try{await fs.access(clean);const {data:rgba,info:m}=await sharp(clean).ensureAlpha().raw().toBuffer({resolveWithObject:true});let x0=m.width,y0=m.height,x1=0,y1=0;for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++){const i=(y*m.width+x)*4;if(rgba[i+3]<=3){rgba[i+3]=0;continue;}x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}const a=assets.bed_left;await sharp(rgba,{raw:{width:m.width,height:m.height,channels:4}}).extract({left:x0,top:y0,width:x1-x0+1,height:y1-y0+1}).resize(Math.round(a.w*W),Math.round(a.h*H),{fit:'contain',background:'#00000000'}).png().toFile(path.join(dir,a.file));}catch(error){if(error.code!=='ENOENT')throw error;}
await fs.writeFile(path.join(dir,'assets.json'),JSON.stringify({width:W,height:H,assets},null,2));console.log({layers:layers.length,missed});
