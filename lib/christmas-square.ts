import type { PlazaPropDef, PlazaThemeDef } from "./plaza";
import assets from "@/public/plaza/christmas-v7/assets.json";

const root = "/plaza/christmas-v7";
type Artwork = keyof typeof assets;
const src = (id: Artwork) => `${root}/${assets[id].file}`;
const ratio = (id: Artwork) => assets[id].width / assets[id].height;
// The world is 8:5. Native artwork proportions determine every prop's displayed bounds.
const widthFor = (id: Artwork, height: number) => height * ratio(id) / 1.6;
const bench = (id: string, x: number, y: number): PlazaPropDef => {
  const w = .044, h = w * 1.6 / ratio("bench"), base = y + .046;
  return {
    id, src: src("bench"), x, y: base - h, w, h, anchorY: base,
    // Keep the front foot space open; the seat/backrest remains solid.
    cols: [[x + .004, base - h * .45, x + w - .004, base - .010]],
    seats: [{ x: x + .014, y: y + .048 }, { x: x + .031, y: y + .048 }],
  };
};
const pine = (id: string, x: number, y: number): PlazaPropDef => {
  const h = .145, w = widthFor("pine", h), center = x + .025, base = y + .127;
  return { id, src: src("pine"), x: center - w / 2, y: base - h, w, h, anchorY: base,
    cols: [[center - .006, base - .014, center + .006, base + .003]] };
};
const lamp = (id: string, x: number, y: number): PlazaPropDef => {
  const h = .09, w = widthFor("lamp", h), center = x + .011, base = y + .074;
  return { id, src: src("lamp"), x: center - w / 2, y: base - h, w, h, anchorY: base,
    cols: [[center - .0035, base - .008, center + .0035, base + .002]], festiveLight: "lantern" };
};
const cabin = (id: string, center: number): PlazaPropDef => {
  const w = .13, h = w * 1.6 / ratio("cabin"), base = .31;
  return { id, src: src("cabin"), x: center - w / 2, y: base - h, w, h, anchorY: base,
    cols: [[center - .055, .245, center + .055, base + .004]], festiveLight: "cabin" };
};
const treeH = .43, treeW = widthFor("tree", treeH);
export const CHRISTMAS_SQUARE_THEME: PlazaThemeDef = {
  id: "christmas_party", name: "별빛 크리스마스 광장", icon: "🎄",
  desc: "눈 쌓인 돌길과 반짝이는 큰 트리 · 따뜻한 불빛 아래 겨울 모임",
  mapImg: src("floor"), smooth: true, worldSize: { w: 2880, h: 1800 },
  skyClass: "bg-[#192e42]", floorBg: "#c7dce5", decor: [],
  wallCols: [[0,0,1,.055],[0,0,.03,1],[.97,0,1,1],[0,.96,1,1]],
  props: [
    { id: "great_christmas_tree", src: src("tree"), x: .5 - treeW / 2, y: .512 - treeH,
      w: treeW, h: treeH, anchorY: .512, cols: [[.443,.486,.557,.518]], festiveLight: "tree" },
    ...[.12,.26,.71,.85].map((x,i)=>pine(`north_pine_${i}`,x,.07)),
    ...[.1,.87].flatMap((x,i)=>[.36,.67].map((y,j)=>pine(`edge_pine_${i}_${j}`,x,y))),
    ...[[.36,.56],[.60,.56],[.36,.73],[.60,.73],[.17,.43],[.78,.43],[.16,.78],[.80,.78]].map(([x,y],i)=>bench(`winter_bench_${i}`,x,y)),
    ...[[.32,.48],[.66,.48],[.32,.78],[.66,.78],[.19,.30],[.79,.30]].map(([x,y],i)=>lamp(`warm_lamp_${i}`,x,y)),
    cabin("cocoa_cabin", .21), cabin("gift_cabin", .79),
  ],
};
