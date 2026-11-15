import type {PlazaPropDef,PlazaThemeDef,PlazaPos} from './plaza';
import type {SeatDirection} from './seat-placement';
import art from '@/public/plaza/christmas-camp-v1/assets.json';
const W=1672,H=941,p=(x:number,y:number):PlazaPos=>({x:x/W,y:y/H});
const polygon=(points:number[][])=>points.map(([x,y])=>p(x,y));
const rectangle=(x:number,y:number,w:number,h:number)=>polygon([[x,y],[x+w,y],[x+w,y+h],[x,y+h]]);
function layer(id:keyof typeof art.assets,depth:number,footprint:number[][]=[]):PlazaPropDef {
 const a=art.assets[id];return{id,src:`/plaza/christmas-camp-v1/${a.file}`,x:a.x,y:a.y,w:a.w,h:a.h,anchorY:depth/H,cols:[],collisionPolys:footprint.length?[polygon(footprint)]:[]};
}
function seat(id:keyof typeof art.assets,contact:[number,number],target:[number,number],direction:SeatDirection):PlazaPropDef {
 const a=art.assets[id],bottom=(a.y+a.h)*H;
 return {...layer(id,bottom-3),label:'크리스마스 모닥불 의자',seats:[p(...target)],seatDirections:[direction],supports:[{point:p(...contact),kind:'bench'}],
  collisionPolys:[rectangle(contact[0]-24,bottom-21,48,17)]};
}
export const CHRISTMAS_CAMP_PROPS:PlazaPropDef[]=[
 {...layer('christmas_tree',382,[[700,337],[750,321],[930,322],[1008,343],[994,379],[925,389],[727,385],[679,365]]),festiveLight:'tree'},
 layer('winter_tent',428,[[114,321],[222,274],[360,291],[440,351],[454,391],[383,420],[185,424],[107,382]]),
 layer('cocoa_stall',424,[[1230,309],[1517,318],[1550,364],[1538,420],[1294,425],[1210,373]]),
 layer('picnic_left',764,[[11,687],[109,636],[262,682],[279,721],[215,762],[70,734]]),
 layer('picnic_right',770,[[1360,670],[1460,628],[1627,661],[1651,714],[1560,770],[1412,728]]),
 {...layer('campfire',541,[[803,489],[824,484],[862,489],[888,511],[879,535],[818,545],[788,521]]),fire:true},
 seat('seat_northwest',[737,442],[738,492],'down_right'),seat('seat_northeast',[933,443],[933,493],'down_left'),
 seat('seat_west',[675,516],[675,574],'up_right'),seat('seat_east',[995,516],[995,574],'up_left'),
 seat('seat_southwest',[752,585],[752,644],'up_right'),seat('seat_southeast',[920,585],[920,644],'up_left'),
];
/** Retain the public ID so saved Christmas selections load the replacement map. */
export const CHRISTMAS_SQUARE_THEME:PlazaThemeDef={
 id:'christmas_party',name:'크리스마스 캠핑 라운지',icon:'🎄',desc:'겨울 숲의 큰 트리와 따뜻한 모닥불 · 1인 의자 여섯 자리',
 mapImg:'/plaza/christmas-camp-v1/ground.png',smooth:true,preserveMapTone:true,worldSize:{w:W,h:H},actorZoom:1,
 skyClass:'bg-[#243956]',floorBg:'#b6a4b4',decor:[],props:CHRISTMAS_CAMP_PROPS,
 wallCols:[[0,0,.012,1],[.988,0,1,1],[0,.985,1,1]],wallPolys:[
 polygon([[0,0],[W,0],[W,385],[1592,365],[1530,285],[1340,278],[1190,266],[1030,262],[660,261],[490,277],[340,306],[160,339],[0,402]]),
 polygon([[0,439],[90,470],[164,514],[93,551],[0,579]]),
 polygon([[W,451],[1510,486],[1571,535],[W,610]]),
 polygon([[0,780],[212,787],[362,836],[451,904],[451,H],[0,H]]),
 polygon([[W,785],[1425,786],[1297,839],[1194,896],[1194,H],[W,H]]),
 ],
};
