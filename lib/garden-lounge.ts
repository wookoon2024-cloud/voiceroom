import type { PlazaCollisionRect, PlazaPropDef, PlazaThemeDef } from "./plaza";

const root = "/plaza/garden-v3";
const tree = (id: string, x: number, y: number): PlazaPropDef => ({
  id, src: `${root}/cherry-tree.png`, x, y, w: 0.18, h: 0.28,
  anchorY: y + 0.274,
  // The canopy is an occlusion layer, not a wall. Only the trunk/roots block feet.
  cols: [[x + 0.075, y + 0.251, x + 0.112, y + 0.277]],
});
const bench = (id: string, x: number, y: number): PlazaPropDef => ({
  id, src: `${root}/teak-bench.png`, x, y, w: 0.15, h: 0.16,
  anchorY: y + 0.151,
  cols: [[x + 0.016, y + 0.082, x + 0.135, y + 0.154]],
});

export const GARDEN_PROPS: PlazaPropDef[] = [
  tree("cherry_northwest", 0.015, 0.035),
  tree("cherry_northeast", 0.805, 0.045),
  tree("cherry_southwest", 0.015, 0.65),
  tree("cherry_southeast", 0.805, 0.65),
  bench("deck_bench", 0.17, 0.145),
  bench("east_bench", 0.69, 0.18),
  bench("southwest_bench", 0.23, 0.745),
  bench("southeast_bench", 0.63, 0.745),
  {
    id: "reflecting_fountain", src: `${root}/reflecting-fountain.png`,
    x: 0.415, y: 0.30, w: 0.17, h: 0.18, anchorY: 0.463,
    // Three nested rectangles follow the basin's rounded footprint without blocking its empty corners.
    cols: [[0.432, 0.382, 0.568, 0.455], [0.448, 0.365, 0.552, 0.468], [0.421, 0.401, 0.579, 0.443]],
  },
];
const walls: PlazaCollisionRect[] = [
  [0, 0, 1, 0.055], [0, 0, 0.027, 1], [0.973, 0, 1, 1], [0, 0.965, 1, 1],
];
export const GARDEN_LOUNGE_THEME: PlazaThemeDef = {
  id: "garden_lounge", name: "꽃빛 정원 라운지", icon: "🌸",
  desc: "따뜻한 석재 광장과 나무 데크 · 벚나무 그늘 아래 대화",
  mapImg: `${root}/garden-floor.png`, smooth: true,
  skyClass: "bg-[#d5ddbf]", floorBg: "#eee0bd", decor: [],
  props: GARDEN_PROPS, wallCols: walls,
};
