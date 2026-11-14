// The AI supplies the actual transparent silhouettes. Regions below only assign
// touching objects to depth layers; they never copy opaque background rectangles.
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),dir=path.join(root,'public/plaza/moonlit-camp-v2');
const {data,info}=await sharp(path.join(dir,'foreground-source.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const W=info.width,H=info.height;
const rectangle=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const domains=[
 ['fire_stool_northwest',rectangle(710,425,85,65)],
 ['fire_stool_northeast',rectangle(880,429,79,55)],
 ['fire_stool_west',rectangle(681,495,62,59)],
 ['fire_stool_east',rectangle(931,493,60,63)],
 ['fire_stool_southwest',rectangle(733,547,80,55)],
 ['fire_stool_southeast',rectangle(839,545,100,65)],
 ['campfire',rectangle(784,403,106,141)],
 ['camp_deck_bench_left',rectangle(710,190,120,80)],
 ['camp_deck_bench_right',rectangle(875,190,115,80)],
 ['camp_picnic_left',rectangle(89,410,223,130)],
 ['camp_picnic_right',rectangle(1335,570,285,190)],
 ['camp_tent_northwest',[[97,310],[130,269],[184,206],[213,159],[255,170],[279,206],[329,258],[375,309],[373,343],[298,368],[211,360],[145,348]]],
 ['camp_tent_southwest',rectangle(2,520,310,220)],
 ['camp_projector',rectangle(1430,211,229,249)],
 ['camp_hammock',[[1222,214],[1256,239],[1320,252],[1377,231],[1402,213],[1376,278],[1323,307],[1264,298],[1231,271]]],
 ['camp_tree_left',rectangle(0,0,500,425)],
 ['camp_tree_right',rectangle(1100,0,571,360)],
];
function contains(x,y,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
const layers=domains.map(([id])=>({id,pixels:Buffer.alloc(data.length),left:W,top:H,right:0,bottom:0,count:0}));
let unassigned=0;const missed={};
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const i=(y*W+x)*4;if(data[i+3]<=3)continue;
 const owner=domains.findIndex(([,polygon])=>contains(x+.5,y+.5,polygon));
 if(owner<0){unassigned++;const tile=`${Math.floor(x/25)*25},${Math.floor(y/25)*25}`;missed[tile]=(missed[tile]??0)+1;continue;}
 const layer=layers[owner];data.copy(layer.pixels,i,i,i+4);layer.left=Math.min(layer.left,x);layer.top=Math.min(layer.top,y);layer.right=Math.max(layer.right,x);layer.bottom=Math.max(layer.bottom,y);layer.count++;
}
if(unassigned>100)throw new Error(`${unassigned} foreground pixels outside ownership regions: ${JSON.stringify(missed)}`);
const assets={};
const generated=path.join(dir,'sources');
const cleanups={
 camp_tent_northwest:{source:'exec-d74d9088-e6b6-4d4a-9343-7e79caec2ecb.png',box:[105,164,263,200]},
 camp_tent_southwest:{source:'exec-4b2b6c1a-85c8-4c06-9762-d68de762e2c8.png',box:[10,523,291,211]},
 camp_tree_left:{source:'exec-27c6cf53-8eaa-4685-938a-d3d645b06d53.png',box:[0,0,457,421]},
 camp_picnic_left:{source:'exec-99c07486-20a2-46a8-9c42-5308e5fe07b8.png',box:[104,422,197,112]},
};
for(const layer of layers){
 if(layer.count<100)throw new Error(`Empty layer ${layer.id}`);
 const left=Math.max(0,layer.left-1),top=Math.max(0,layer.top-1),width=Math.min(W-left,layer.right-left+2),height=Math.min(H-top,layer.bottom-top+2);
 const file=`${layer.id}.png`;
 await sharp(layer.pixels,{raw:{width:W,height:H,channels:4}}).extract({left,top,width,height}).png().toFile(path.join(dir,file));
 assets[layer.id]={file,x:left/W,y:top/H,w:width/W,h:height/H,width,height,sourcePixels:layer.count};
}
for(const [id,{source,box:[left,top,width,height]}] of Object.entries(cleanups)){
 // AI restores hidden/clipped object edges. This stage only trims transparent
 // margins and fits its complete cutout into the approved world-space footprint.
 const {data:rgba,info:meta}=await sharp(path.join(generated,source)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let x0=meta.width,y0=meta.height,x1=0,y1=0;
 for(let y=0;y<meta.height;y++)for(let x=0;x<meta.width;x++){const i=(y*meta.width+x)*4;if(rgba[i+3]<=3){rgba[i+3]=0;continue;}x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
 await sharp(rgba,{raw:{width:meta.width,height:meta.height,channels:4}}).extract({left:x0,top:y0,width:x1-x0+1,height:y1-y0+1}).resize(width,height,{fit:'contain',background:'#00000000'}).png().toFile(path.join(dir,`${id}.png`));
 assets[id]={file:`${id}.png`,x:left/W,y:top/H,w:width/W,h:height/H,width,height,cleanedSource:source};
}
await fs.writeFile(path.join(dir,'assets.json'),JSON.stringify({sourceWidth:W,sourceHeight:H,assets,unassignedPixels:unassigned},null,2)+'\n');
console.log(JSON.stringify({layers:layers.length,unassigned},null,2));
