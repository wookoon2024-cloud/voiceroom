// AI generated true-alpha silhouettes; these regions assign object ownership only.
// No opaque background is copied into a foreground rectangle.
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
const dir=path.resolve(import.meta.dirname,'../public/plaza/christmas-camp-v1');
const {data,info}=await sharp(path.join(dir,'foreground-source.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const W=1672,H=941;if(info.width!==W||info.height!==H)throw Error('Unexpected artwork size');
const regions=[
 ['christmas_tree',630,0,420,405],['winter_tent',70,110,420,420],['cocoa_stall',1180,105,420,380],
 ['campfire',773,410,128,140],
 ['seat_northwest',685,406,110,75],['seat_northeast',883,407,100,75],
 ['seat_west',632,481,90,80],['seat_east',947,480,90,80],
 ['seat_southwest',698,552,115,80],['seat_southeast',869,551,108,80],
 ['picnic_left',0,568,340,220],['picnic_right',1305,557,367,240],
];
const layers=regions.map(([id])=>({id,left:W,top:H,right:0,bottom:0,count:0,points:[]}));let discarded=0;
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const p=y*W+x;if(!data[p*4+3])continue;
 const index=regions.findIndex(([,l,t,w,h])=>x>=l&&x<l+w&&y>=t&&y<t+h);
 if(index<0){if(data[p*4+3]>64)throw Error(`Unassigned solid pixel ${x},${y}`);discarded++;continue;}
 const a=layers[index];a.left=Math.min(a.left,x);a.top=Math.min(a.top,y);a.right=Math.max(a.right,x);a.bottom=Math.max(a.bottom,y);a.count++;a.points.push(p);
}
const assets={};
for(const a of layers){
 if(a.count<500)throw Error('Missing object '+a.id);
 const left=Math.max(0,a.left-2),top=Math.max(0,a.top-2),width=Math.min(W-left,a.right-left+3),height=Math.min(H-top,a.bottom-top+3);
 const out=Buffer.alloc(width*height*4);
 for(const p of a.points){const x=p%W,y=Math.floor(p/W);data.copy(out,((y-top)*width+x-left)*4,p*4,p*4+4);}
 const file=a.id+'.png';await sharp(out,{raw:{width,height,channels:4}}).png().toFile(path.join(dir,file));
 assets[a.id]={file,x:left/W,y:top/H,w:width/W,h:height/H,width,height,pixels:a.count};
}
await fs.writeFile(path.join(dir,'assets.json'),JSON.stringify({width:W,height:H,assets,discarded},null,2));
await sharp(path.join(dir,'ground.png')).composite(Object.values(assets).map(a=>({input:path.join(dir,a.file),left:Math.round(a.x*W),top:Math.round(a.y*H)}))).png().toFile(path.join(dir,'layer-preview.png'));
console.log(JSON.stringify({objects:Object.keys(assets).length,discarded,assets},null,2));
