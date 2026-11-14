import type {PlazaThemeDef,PlazaPropDef,PlazaPos} from './plaza';
import art from '@/public/plaza/tent-interior-v1/assets.json';
const W=1672,H=941,point=(x:number,y:number):PlazaPos=>({x:x/W,y:y/H});
const rectangle=(x:number,y:number,w:number,h:number)=>[point(x,y),point(x+w,y),point(x+w,y+h),point(x,y+h)];
function prop(id:keyof typeof art.assets,anchor:number,foot:number[]):PlazaPropDef{const a=art.assets[id];return{id,src:`/plaza/tent-interior-v1/${a.file}`,x:a.x,y:a.y,w:a.w,h:a.h,anchorY:anchor/H,cols:[],collisionPolys:[rectangle(foot[0],foot[1],foot[2],foot[3])]};}
const props:PlazaPropDef[]=[
 {...prop('bed_left',450,[205,309,265,141]),label:'침구 1',seats:[point(432,467)],restPose:'lie',supports:[{point:point(320,350),kind:'bed',angle:32}]},
 {...prop('bed_right',384,[340,250,280,136]),label:'침구 2',seats:[point(550,407)],restPose:'lie',supports:[{point:point(454,302),kind:'bed',angle:32}]},
 {...prop('cushion_back',325,[1060,280,120,45]),label:'방석 1',seats:[point(1115,335)],restStyle:'floor',supports:[{point:point(1115,296),kind:'floor'}]},
 {...prop('cushion_left',401,[1030,345,120,56]),label:'방석 2',seats:[point(1088,422)],restStyle:'floor',seatDirections:['up'],supports:[{point:point(1088,368),kind:'floor'}]},
 {...prop('cushion_right',369,[1300,320,104,49]),label:'방석 3',seats:[point(1400,386)],restStyle:'floor',seatDirections:['up'],supports:[{point:point(1340,340),kind:'floor'}]},
 {...prop('cushion_front',442,[1230,387,140,55]),label:'방석 4',seats:[point(1294,462)],restStyle:'floor',seatDirections:['up'],supports:[{point:point(1294,410),kind:'floor'}]},
 prop('tea_table',397,[1155,316,155,81]),prop('night_crate',317,[1210,263,120,54]),
 prop('book_nook',739,[50,480,270,255]),prop('flower_crate',739,[1395,590,225,149]),
];
export const TENT_INTERIORS:PlazaThemeDef[]=['tent_northwest','tent_southwest'].map(id=>({
 id:id as PlazaThemeDef['id'],name:id==='tent_northwest'?'달빛 텐트':'별빛 텐트',icon:'⛺',desc:'침구 두 자리 · 방석 네 자리',privateSpace:true,actorZoom:1.45,
 mapImg:'/plaza/tent-interior-v1/ground.png',smooth:true,preserveMapTone:true,worldSize:{w:W,h:H},skyClass:'bg-[#332516]',floorBg:'#ad7544',decor:[],props,
 wallCols:[[0,.82,1,1]],wallPolys:[
 [point(0,0),point(W,0),point(W,350),point(1470,322),point(1300,275),point(1070,260),point(650,260),point(400,288),point(220,320),point(0,440)],
 [point(0,0),point(220,310),point(175,490),point(170,670),point(350,820),point(610,862),point(0,H)],
 [point(W,0),point(1452,310),point(1498,490),point(1502,670),point(1322,820),point(1062,862),point(W,H)]
 ],portals:[{id:'tent_exit',label:'밖으로 나가기',space:'outside',target:point(835,730),hit:{x:710/W,y:700/H,w:260/W,h:75/H}}]
}));
