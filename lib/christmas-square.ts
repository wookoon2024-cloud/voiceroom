import type { PlazaPropDef, PlazaThemeDef } from "./plaza";

const root = "/plaza/christmas-v6";
const bench = (id: string, x: number, y: number): PlazaPropDef => ({
  id, src: "/plaza/garden-v3/teak-bench.png", x, y, w: .044, h: .038,
  anchorY: y + .037, cols: [[x + .005, y + .02, x + .04, y + .037]],
  seats: [{ x: x + .014, y: y + .048 }, { x: x + .031, y: y + .048 }],
});
export const CHRISTMAS_SQUARE_THEME: PlazaThemeDef = {
  id: "christmas_party", name: "별빛 크리스마스 광장", icon: "🎄",
  desc: "커다란 트리와 눈 덮인 산책길 · 넓은 맵의 작은 모임 공간",
  mapImg: `${root}/floor.svg`, smooth: true, worldSize: { w: 2880, h: 1800 },
  skyClass: "bg-[#192e42]", floorBg: "#c7dce5", decor: [],
  wallCols: [[0,0,1,.055],[0,0,.03,1],[.97,0,1,1],[0,.96,1,1]],
  props: [
    { id: "great_christmas_tree", src: `${root}/tree.svg`, x: .405, y: .13, w: .19, h: .39, anchorY: .512,
      cols: [[.465,.482,.535,.514]] },
    ...[.12,.26,.71,.85].map((x,i): PlazaPropDef=>({id:`north_pine_${i}`,src:"/plaza/gather/props/tree_pine_viridian_down.png",x,y:.07,w:.05,h:.13,anchorY:.197,cols:[[x+.018,.178,x+.035,.20]]})),
    ...[.1,.87].flatMap((x,i)=>[.36,.67].map((y,j):PlazaPropDef=>({id:`edge_pine_${i}_${j}`,src:"/plaza/gather/props/tree_pine_viridian_down.png",x,y,w:.05,h:.13,anchorY:y+.127,cols:[[x+.018,y+.108,x+.035,y+.13]]}))),
    ...[[.36,.56],[.60,.56],[.36,.73],[.60,.73],[.17,.43],[.78,.43],[.16,.78],[.80,.78]].map(([x,y],i)=>bench(`winter_bench_${i}`,x,y)),
    ...[[.32,.48],[.66,.48],[.32,.78],[.66,.78],[.19,.30],[.79,.30]].map(([x,y],i):PlazaPropDef=>({id:`warm_lamp_${i}`,src:`${root}/lamp.svg`,x,y,w:.022,h:.075,anchorY:y+.074,cols:[[x+.008,y+.065,x+.014,y+.075]]})),
    {id:"cocoa_cabin",src:`${root}/cabin.svg`,x:.15,y:.17,w:.12,h:.14,anchorY:.305,cols:[[.16,.24,.26,.308]]},
    {id:"gift_cabin",src:`${root}/cabin.svg`,x:.73,y:.17,w:.12,h:.14,anchorY:.305,cols:[[.74,.24,.84,.308]]},
  ],
};
