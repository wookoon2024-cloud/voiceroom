import type {PlazaPropDef,PlazaThemeDef,PlazaPos} from './plaza';
import type {SeatDirection} from './seat-placement';
import art from '@/public/plaza/christmas-camp-v2/assets.json';
const W=1672,H=941,p=(x:number,y:number):PlazaPos=>({x:x/W,y:y/H});
const polygon=(points:number[][])=>points.map(([x,y])=>p(x,y));
const rectangle=(x:number,y:number,w:number,h:number)=>polygon([[x,y],[x+w,y],[x+w,y+h],[x,y+h]]);
function layer(id:keyof typeof art.assets,depth:number,footprint:number[][]=[]):PlazaPropDef {
 const a=art.assets[id];return{id,src:`/plaza/christmas-camp-v2/${a.file}`,x:a.x,y:a.y,w:a.w,h:a.h,anchorY:depth/H,cols:[],collisionPolys:footprint.length?[polygon(footprint)]:[]};
}
function seat(id:keyof typeof art.assets,contact:[number,number],target:[number,number],direction:SeatDirection):PlazaPropDef {
 const a=art.assets[id],bottom=(a.y+a.h)*H;
 return {...layer(id,bottom-3),label:'크리스마스 모닥불 의자',seats:[p(...target)],seatDirections:[direction],supports:[{point:p(...contact),kind:'bench'}],
  collisionPolys:[rectangle(contact[0]-24,bottom-21,48,17)]};
}
// These are interactive floor regions over cushions already painted in the picnic art.
// No duplicate furniture/background pixels are drawn on top of a seated avatar.
const CHRISTMAS_CUSHIONS:PlazaPropDef[]=[
 ['cushion_left_back',59,555,59,605,'down'],['cushion_left_front',103,579,103,632,'down'],
 ['cushion_right_back',1616,555,1616,605,'down'],['cushion_right_front',1570,579,1570,632,'down'],
].map(([id,cx,cy,tx,ty,direction],i)=>({id:String(id),label:`피크닉 방석 ${i+1}`,src:'/plaza/christmas-camp-v2/picnic_left.png',
 x:(Number(cx)-27)/W,y:(Number(cy)-15)/H,w:54/W,h:36/H,anchorY:(Number(cy)+8)/H,cols:[],seatOnly:true,
 seats:[p(Number(tx),Number(ty))],seatDirections:[direction as SeatDirection],restStyle:'floor',supports:[{point:p(Number(cx),Number(cy)),kind:'floor'}]}));
export const CHRISTMAS_CAMP_PROPS:PlazaPropDef[]=[
 {...layer('christmas_tree',369,[[739,315],[934,317],[992,338],[936,354],[925,369],[754,368],[708,341]]),festiveLight:'tree'},
 {...layer('winter_tent',400,[[77,296],[254,228],[425,301],[438,360],[350,393],[180,400],[66,352]]),portal:{id:'enter_christmas',label:'크리스마스 텐트 들어가기',space:'tent_christmas',target:p(305,430),hit:{x:0,y:0,w:1,h:1}}},
 layer('cocoa_stall',405,[[1268,307],[1440,306],[1585,345],[1582,392],[1451,402],[1268,365]]),
 layer('picnic_left',568,[[93,532],[170,515],[207,540],[198,565],[119,573],[92,556]]),
 layer('picnic_right',568,[[1462,537],[1547,515],[1581,540],[1572,567],[1490,571],[1460,557]]),
 ...CHRISTMAS_CUSHIONS,
 {...layer('campfire',541,[[780,493],[832,479],[886,494],[895,517],[874,537],[802,540],[773,518]]),fire:true},
 seat('seat_northwest',[721,425],[721,484],'down_right'),seat('seat_northeast',[948,424],[948,484],'down_left'),
 seat('seat_west',[644,507],[640,574],'up_right'),seat('seat_east',[1027,508],[1030,574],'up_left'),
 seat('seat_southwest',[735,577],[735,647],'up_right'),seat('seat_southeast',[938,577],[938,647],'up_left'),
];
/** Retain the public ID so saved Christmas selections load the replacement map. */
export const CHRISTMAS_SQUARE_THEME:PlazaThemeDef={
 id:'christmas_party',name:'크리스마스 캠핑 라운지',icon:'🎄',desc:'넓은 설원과 따뜻한 모닥불 · 텐트 · 의자 6자리·방석 4자리',
 mapImg:'/plaza/christmas-camp-v2/ground.png',smooth:true,preserveMapTone:true,worldSize:{w:W,h:H},actorZoom:1,
 skyClass:'bg-[#243956]',floorBg:'#b6a4b4',decor:[],props:CHRISTMAS_CAMP_PROPS,
 wallCols:[[0,0,.012,1],[.988,0,1,1],[0,.985,1,1]],wallPolys:[
 polygon([[0,0],[W,0],[W,330],[1600,307],[1445,285],[250,285],[80,306],[0,330]]),
 polygon([[0,770],[220,822],[460,889],[480,H],[0,H]]),
 polygon([[W,770],[1450,822],[1220,889],[1200,H],[W,H]]),
 rectangle(546,858,45,48),rectangle(1073,858,45,48),
 ],
};
