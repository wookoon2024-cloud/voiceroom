import type {PlazaThemeDef,PlazaPropDef,PlazaPos} from './plaza';
import type {SeatDirection} from './seat-placement';
import art from '@/public/plaza/office-v1/assets.json';
const W=1672,H=941,p=(x:number,y:number):PlazaPos=>({x:x/W,y:y/H});
const rect=(x:number,y:number,w:number,h:number)=>[p(x,y),p(x+w,y),p(x+w,y+h),p(x,y+h)];
function layer(id:keyof typeof art.assets,depth:number,feet:number[][]=[]):PlazaPropDef{
 const a=art.assets[id];return{id,src:`/plaza/office-v1/${a.file}`,x:a.x,y:a.y,w:a.w,h:a.h,anchorY:depth/H,cols:[],collisionPolys:feet.map(([x,y,w,h])=>rect(x,y,w,h))};
}
function chair(id:string,label:string,target:[number,number],contact:[number,number],direction:SeatDirection,frontBackrest=false):PlazaPropDef{
 const prop=layer(('chair_'+id) as keyof typeof art.assets,target[1]+(frontBackrest?8:-12));
 const baseY=(prop.y+prop.h)*H,baseX=(prop.x+prop.w/2)*W;
 return{...prop,label,seats:[p(...target)],seatDirections:[direction],supports:[{point:p(...contact),kind:'bench'}],collisionPolys:[rect(baseX-21,baseY-16,42,16)]};
}
export const OFFICE_PROPS:PlazaPropDef[]=[
 layer('manager_storage',250,[[189,219,186,35],[383,180,80,36]]),layer('manager_side',344,[[28,300,146,40]]),
 layer('manager_desk',347,[[243,277,132,70]]),layer('manager_rug_edge',347),
 layer('window_plant_left',233,[[551,209,37,23]]),layer('window_plant_right',233,[[1098,209,37,23]]),
 layer('window_left',250,[[616,208,184,42]]),layer('window_center',250,[[808,213,87,35]]),layer('window_right',250,[[903,208,173,42]]),
 layer('coat_rack',252,[[1220,218,56,32]]),layer('printer_storage',529,[[25,453,230,72]]),
 layer('desk_island_left',578,[[451,447,335,131]]),layer('desk_island_right',578,[[904,447,337,131]]),
 layer('coffee_counter',517,[[1438,436,205,79]]),
 layer('corner_desk_left',750,[[45,668,194,80]]),layer('corner_desk_right',752,[[1386,666,260,86]]),
 layer('meeting_back',160,[[1593,300,60,41]]),layer('meeting_table',280,[[1410,213,108,54]]),
 layer('meeting_front_frame',319,[[1400,309,177,10],[1286,215,16,52]]),
 layer('entrance_planter_left',936,[[566,882,145,54]]),layer('entrance_planter_right',936,[[943,882,150,54]]),
 chair('manager','임원석',[195,335],[197,270],'down_right'),
 chair('window_left','창가 업무석 1',[708,291],[708,232],'up',true),chair('window_right','창가 업무석 2',[987,291],[987,232],'up',true),
 chair('island_left_back_left','왼쪽 업무석 1',[558,432],[558,434],'down'),chair('island_left_back_right','왼쪽 업무석 2',[707,432],[707,434],'down'),
 chair('island_right_back_left','오른쪽 업무석 1',[986,432],[986,434],'down'),chair('island_right_back_right','오른쪽 업무석 2',[1130,432],[1130,434],'down'),
 chair('island_left_front_left','왼쪽 업무석 3',[540,622],[540,549],'up',true),chair('island_left_front_right','왼쪽 업무석 4',[699,622],[699,549],'up',true),
 chair('island_right_front_left','오른쪽 업무석 3',[989,622],[989,549],'up',true),chair('island_right_front_right','오른쪽 업무석 4',[1154,622],[1154,549],'up',true),
 chair('corner_left','개인 업무석 1',[183,778],[183,683],'up_right',true),chair('corner_right','개인 업무석 2',[1444,784],[1444,706],'up_left',true),
 chair('meeting_back_left','회의석 1',[1380,194],[1416,216],'down_right'),chair('meeting_back_right','회의석 2',[1550,222],[1516,240],'down_left'),
 chair('meeting_front_left','회의석 3',[1372,291],[1399,278],'up_right',true),chair('meeting_front_right','회의석 4',[1517,297],[1500,300],'up_left',true),
];
export const OFFICE_THEME:PlazaThemeDef={id:'company_office',name:'회사 사무실',icon:'🏢',desc:'컴퓨터 업무석과 유리 회의실 · 의자 17자리',mapImg:'/plaza/office-v1/ground.png',smooth:true,preserveMapTone:true,worldSize:{w:W,h:H},actorZoom:1.25,skyClass:'bg-[#afa391]',floorBg:'#c6af99',decor:[],props:OFFICE_PROPS,
 wallCols:[[0,0,.015,1],[.985,0,1,1],[0,.985,1,1]],wallPolys:[
 [p(0,0),p(W,0),p(W,180),p(1560,170),p(1350,150),p(1300,165),p(1200,205),p(270,205),p(30,340),p(0,370)],
 [p(0,725),p(150,817),p(540,920),p(560,H),p(0,H)],
 [p(W,725),p(1550,815),p(1110,920),p(1100,H),p(W,H)],
 ]};
