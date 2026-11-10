import type { PlazaPropDef, PlazaThemeDef } from "./plaza";
import { GARDEN_PROPS, GARDEN_LOUNGE_THEME } from "./garden-lounge";
import assets from "@/public/plaza/christmas-garden-v17/assets.json";

const root = "/plaza/christmas-garden-v17";
const world = { w: 1600, h: 1000 };
type Artwork = keyof typeof assets;
const src = (key: Artwork) => `${root}/${assets[key].file}`;

/** Align the opaque object's feet, retaining native proportions and soft alpha edges. */
function place(key: Artwork, center: number, feet: number, bodyWidth: number) {
  const image=assets[key], [left,,right,bottom]=image.bodyBounds;
  const scale=bodyWidth*world.w/(right-left);
  return {src:src(key),x:center-(left+right)/2*scale/world.w,y:feet-bottom*scale/world.h,
    w:image.width*scale/world.w,h:image.height*scale/world.h,anchorY:feet};
}
function tree(id: string, center: number, feet: number, bodyHeight: number): PlazaPropDef {
  const image=assets.tree,[left,top,right,bottom]=image.bodyBounds;
  const bodyWidth=bodyHeight*world.h*(right-left)/(bottom-top)/world.w;
  return {id,...place("tree",center,feet,bodyWidth),festiveLight:"tree",
    cols:[[center-bodyWidth*.37,feet-.039,center+bodyWidth*.43,feet+.002]]};
}
const benches=GARDEN_PROPS.filter(prop=>prop.seats).map(prop=>({
  ...prop,...place("bench",prop.x+prop.w/2,prop.anchorY,prop.w),
}));
// The basin is lower than the approved concept: water now sits on the paving's centre.
const fountainPlacement=place("fountain",.5,.610,.19);
const fountain: PlazaPropDef={id:"reflecting_fountain",...fountainPlacement,water:true,
  cols:[[.424,.496,.576,.600],[.443,.474,.557,.608],[.413,.519,.587,.582]]};

/** Reuse the former ID so saved selections and room packets load the replacement skin. */
export const CHRISTMAS_SQUARE_THEME: PlazaThemeDef={
  id:"christmas_party",name:"꽃빛 정원 · 크리스마스",icon:"🎄",
  desc:"크리스마스 트리와 눈꽃 정원 · 반짝이는 전구와 중앙 분수",
  mapImg:src("floor"),smooth:true,worldSize:world,
  skyClass:"bg-[#d5ddbf]",floorBg:"#eee0bd",decor:[],
  wallCols:GARDEN_LOUNGE_THEME.wallCols,
  props:[tree("christmas_northwest",.10,.30,.25),tree("christmas_northeast",.90,.31,.28),
    tree("christmas_southwest",.10,.91,.26),tree("christmas_southeast",.90,.92,.27),
    ...benches,fountain],
};
