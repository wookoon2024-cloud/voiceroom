import type {PlazaPropDef,PlazaThemeDef} from './plaza';
import type {CollisionPolygon} from './plaza-polygons';
import artwork from '@/public/plaza/moonlit-camp-v2/assets.json';
const W=1672,H=941,src='/plaza/moonlit-camp-v2/ground.png';
type Pixels=[number,number][];
const poly=(points:Pixels):CollisionPolygon=>points.map(([x,y])=>({x:x/W,y:y/H}));
/** True-alpha prop textures over a clean ground plate; collision is independent. */
function layer(id:string,anchor:number,footprint:Pixels=[],extraFeet:Pixels[]=[]):PlazaPropDef{
  const asset=artwork.assets[id as keyof typeof artwork.assets];
  if(!asset)throw new Error(`Missing camp prop ${id}`);
  return {id,src:`/plaza/moonlit-camp-v2/${asset.file}`,x:asset.x,y:asset.y,w:asset.w,h:asset.h,anchorY:anchor/H,cols:[],collisionPolys:[...(footprint.length?[poly(footprint)]:[]),...extraFeet.map(poly)]};
}
function stool(id:string,shape:Pixels,seat:[number,number]):PlazaPropDef{
  const prop=layer(id,Math.max(...shape.map(p=>p[1])),shape);
  const index=['fire_stool_northwest','fire_stool_northeast','fire_stool_west','fire_stool_east','fire_stool_southwest','fire_stool_southeast'].indexOf(id);
  const contacts=[[751,452],[919,454],[710,521],[960,523],[772,569],[884,570]];
  const directions=['down_right','down_left','up_right','up_left','up_right','up_left'] as const;
  return {...prop,seats:[{x:seat[0]/W,y:seat[1]/H}],seatDirections:[directions[index]],supports:[{point:{x:contacts[index][0]/W,y:contacts[index][1]/H},kind:'bench'}]};
}
export const CAMP_PROPS:PlazaPropDef[]=[
  {...layer('camp_tent_northwest',337,[[114,294],[187,242],[263,245],[341,302],[337,337],[220,344],[151,340]]),portal:{id:'enter_northwest',label:'달빛 텐트 들어가기',space:'tent_northwest',target:{x:250/W,y:365/H},hit:{x:0,y:0,w:1,h:1}}},
  {...layer('camp_tent_southwest',702,[[42,646],[106,598],[174,608],[285,650],[275,704],[146,718],[45,687]]),portal:{id:'enter_southwest',label:'별빛 텐트 들어가기',space:'tent_southwest',target:{x:180/W,y:740/H},hit:{x:0,y:0,w:1,h:1}}},
  layer('camp_tree_left',429,[[31,338],[65,333],[85,417],[38,437]],[[[302,239],[332,244],[341,267],[312,272]]]),
  layer('camp_tree_right',348,[[1365,269],[1399,267],[1410,342],[1370,348]],[[[1199,274],[1220,274],[1233,307],[1207,310]]]),
  layer('camp_hammock',296,[[1227,245],[1271,270],[1310,286],[1367,257],[1374,285],[1307,307],[1246,286]]),
  layer('camp_projector',449,[[1457,369],[1634,422],[1639,449],[1443,397]]),
  layer('camp_picnic_left',505,[[141,474],[187,450],[245,465],[234,500],[171,513]]),
  layer('camp_picnic_right',703,[[1392,646],[1444,614],[1537,650],[1536,690],[1480,712],[1395,679]]),
  layer('camp_deck_bench_left',258,[[735,231],[817,231],[817,258],[735,258]]),
  layer('camp_deck_bench_right',258,[[887,232],[973,234],[971,260],[885,258]]),
  layer('campfire',536,[[797,498],[811,487],[856,486],[877,500],[878,525],[858,538],[817,538],[796,524]]),
  stool('fire_stool_northwest',[[719,455],[771,433],[785,445],[781,464],[736,481],[723,474]],[752,492]),
  stool('fire_stool_northeast',[[890,435],[947,455],[950,470],[936,480],[890,463]],[918,493]),
  stool('fire_stool_west',[[687,511],[703,500],[732,529],[736,542],[722,552],[700,535]],[713,566]),
  stool('fire_stool_east',[[963,500],[982,514],[960,545],[946,552],[939,540],[947,518]],[959,566]),
  stool('fire_stool_southwest',[[746,552],[799,568],[804,582],[794,592],[740,574]],[773,607]),
  stool('fire_stool_southeast',[[900,550],[917,563],[911,578],[862,594],[849,581],[854,565]],[882,609]),
];
export const MOONLIT_CAMP_THEME:PlazaThemeDef={
  id:'moonlit_camp',name:'밤바다 캠핑 라운지',icon:'🌙',desc:'달빛 해변과 모닥불 · 여섯 자리에서 함께 쉬는 밤',
  mapImg:src,smooth:true,preserveMapTone:true,worldSize:{w:W,h:H},skyClass:'bg-[#102738]',floorBg:'#b59678',decor:[],props:CAMP_PROPS,
  wallCols:[[0,0,.015,1],[.985,0,1,1],[0,.975,1,1]],
  wallPolys:[
    poly([[0,0],[1672,0],[1672,145],[1540,150],[1400,182],[1190,207],[1042,226],[1020,201],[652,201],[636,245],[548,243],[367,219],[165,180],[0,157]]),
    poly([[0,442],[55,444],[94,478],[64,540],[34,554],[0,534]]),
    poly([[0,721],[166,754],[316,807],[468,867],[667,941],[0,941]]),
    poly([[1672,448],[1631,455],[1600,516],[1635,573],[1672,584]]),
    poly([[1672,699],[1598,716],[1559,781],[1474,814],[1399,867],[1071,941],[1672,941]]),
  ],
};
