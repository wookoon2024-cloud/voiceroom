"use client";

import React, { useEffect, useRef, useState } from "react";

/* =====================================================================
 * 캐릭터 모드 (광장) - 2.5D 캐릭터 & 걸어다니는 씬
 * 모든 캐릭터는 코드로 그린 SVG라 외부 에셋 라이선스가 필요 없음
 * 좌표는 씬 기준 0~1 정규화 좌표 (x: 좌→우, y: 위→아래, 캐릭터 발 위치)
 * ===================================================================== */

export type ViewMode = "basic" | "plaza";

export type CharacterId =
  | "nerd"
  | "sporty"
  | "muscle"
  | "cute"
  | "handsome"
  | "hiphop"
  | "office"
  | "cat";

export const CHARACTER_STYLES: { id: CharacterId; name: string; desc: string }[] = [
  { id: "nerd", name: "범생형", desc: "동그란 안경 + 니트 조끼" },
  { id: "sporty", name: "스포츠형", desc: "헤어밴드 + 등번호 저지" },
  { id: "muscle", name: "근육형", desc: "탄탄한 어깨 + 민소매" },
  { id: "cute", name: "귀여운형", desc: "핑크 단발 + 리본" },
  { id: "handsome", name: "잘생긴형", desc: "넘긴 머리 + 재킷" },
  { id: "hiphop", name: "힙스터형", desc: "비니 + 후드티" },
  { id: "office", name: "직장인형", desc: "단정한 정장 + 넥타이" },
  { id: "cat", name: "냥냥형", desc: "고양이 귀 후드" },
];

export const DEFAULT_CHARACTER: CharacterId = "cute";

export const isCharacterId = (v: unknown): v is CharacterId =>
  typeof v === "string" && CHARACTER_STYLES.some((c) => c.id === v);

export type PlazaPos = { x: number; y: number };
/** 이동 정보: 출발(x,y) → 목표(tx,ty), ts = 보낸 시각 */
export type PlazaMove = { x: number; y: number; tx: number; ty: number; ts: number };

const MIN_X = 0.04;
const MAX_X = 0.96;
const MIN_Y = 0.065;
const MAX_Y = 0.955;
/** 초당 이동 거리 (정규화 좌표) */
const WALK_SPEED = 0.3;

export const clampPlazaPos = (p: PlazaPos): PlazaPos => ({
  x: Math.min(MAX_X, Math.max(MIN_X, Number.isFinite(p.x) ? p.x : 0.5)),
  y: Math.min(MAX_Y, Math.max(MIN_Y, Number.isFinite(p.y) ? p.y : 0.6)),
});

export type PlazaCollisionRect = [number, number, number, number];

export type PlazaPropDef = {
  id: string;
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  anchorY: number;
  cols: PlazaCollisionRect[];
};

export const FOREST_PARK_PROPS: PlazaPropDef[] = [
  { id: "top_pine_0", src: "/plaza/gather/props/tree_pine_viridian_down.png", x: 0.0125, y: -0.04, w: 0.075, h: 0.2, anchorY: 0.12875, cols: [[0.03438, 0.11, 0.06563, 0.14125]] },
  { id: "top_pine_1", src: "/plaza/gather/props/tree_pine_viridian_down.png", x: 0.0875, y: -0.04, w: 0.075, h: 0.2, anchorY: 0.12875, cols: [[0.10938, 0.11, 0.14062, 0.14125]] },
  { id: "top_pine_2", src: "/plaza/gather/props/tree_pine_viridian_down.png", x: 0.1625, y: -0.04, w: 0.075, h: 0.2, anchorY: 0.12875, cols: [[0.18438, 0.11, 0.21563, 0.14125]] },
  { id: "top_pine_3", src: "/plaza/gather/props/tree_pine_viridian_down.png", x: 0.2375, y: -0.04, w: 0.075, h: 0.2, anchorY: 0.12875, cols: [[0.25938, 0.11, 0.29063, 0.14125]] },
  { id: "top_pine_4", src: "/plaza/gather/props/tree_pine_viridian_down.png", x: 0.3125, y: -0.04, w: 0.075, h: 0.2, anchorY: 0.12875, cols: [[0.33437, 0.11, 0.36562, 0.14125]] },
  { id: "top_pine_5", src: "/plaza/gather/props/tree_pine_viridian_down.png", x: 0.3875, y: -0.04, w: 0.075, h: 0.2, anchorY: 0.12875, cols: [[0.40937, 0.11, 0.44062, 0.14125]] },
  { id: "top_pine_6", src: "/plaza/gather/props/tree_pine_viridian_down.png", x: 0.4625, y: -0.04, w: 0.075, h: 0.2, anchorY: 0.12875, cols: [[0.48438, 0.11, 0.51562, 0.14125]] },
  { id: "top_pine_7", src: "/plaza/gather/props/tree_pine_viridian_down.png", x: 0.5375, y: -0.04, w: 0.075, h: 0.2, anchorY: 0.12875, cols: [[0.55937, 0.11, 0.59062, 0.14125]] },
  { id: "top_pine_8", src: "/plaza/gather/props/tree_pine_viridian_down.png", x: 0.6125, y: -0.04, w: 0.075, h: 0.2, anchorY: 0.12875, cols: [[0.63438, 0.11, 0.66563, 0.14125]] },
  { id: "top_pine_9", src: "/plaza/gather/props/tree_pine_viridian_down.png", x: 0.6875, y: -0.04, w: 0.075, h: 0.2, anchorY: 0.12875, cols: [[0.70937, 0.11, 0.74062, 0.14125]] },
  { id: "top_pine_10", src: "/plaza/gather/props/tree_pine_viridian_down.png", x: 0.7625, y: -0.04, w: 0.075, h: 0.2, anchorY: 0.12875, cols: [[0.78438, 0.11, 0.81563, 0.14125]] },
  { id: "top_pine_11", src: "/plaza/gather/props/tree_pine_viridian_down.png", x: 0.8375, y: -0.04, w: 0.075, h: 0.2, anchorY: 0.12875, cols: [[0.85938, 0.11, 0.89062, 0.14125]] },
  { id: "top_pine_12", src: "/plaza/gather/props/tree_pine_viridian_down.png", x: 0.9125, y: -0.04, w: 0.075, h: 0.2, anchorY: 0.12875, cols: [[0.93437, 0.11, 0.96562, 0.14125]] },
  { id: "top_pine_r2_0", src: "/plaza/gather/props/tree_pine_viridian_down.png", x: 0.0375, y: 0.048, w: 0.075, h: 0.2, anchorY: 0.21675, cols: [[0.05937, 0.198, 0.09062, 0.22925]] },
  { id: "top_pine_r2_1", src: "/plaza/gather/props/tree_pine_viridian_down.png", x: 0.125, y: 0.048, w: 0.075, h: 0.2, anchorY: 0.21675, cols: [[0.14688, 0.198, 0.17813, 0.22925]] },
  { id: "top_pine_r2_2", src: "/plaza/gather/props/tree_pine_viridian_down.png", x: 0.25, y: 0.048, w: 0.075, h: 0.2, anchorY: 0.21675, cols: [[0.27187, 0.198, 0.30312, 0.22925]] },
  { id: "top_pine_r2_3", src: "/plaza/gather/props/tree_pine_viridian_down.png", x: 0.35, y: 0.048, w: 0.075, h: 0.2, anchorY: 0.21675, cols: [[0.37188, 0.198, 0.40313, 0.22925]] },
  { id: "top_pine_r2_4", src: "/plaza/gather/props/tree_pine_viridian_down.png", x: 0.575, y: 0.048, w: 0.075, h: 0.2, anchorY: 0.21675, cols: [[0.59688, 0.198, 0.62813, 0.22925]] },
  { id: "top_pine_r2_5", src: "/plaza/gather/props/tree_pine_viridian_down.png", x: 0.7125, y: 0.048, w: 0.075, h: 0.2, anchorY: 0.21675, cols: [[0.73438, 0.198, 0.76562, 0.22925]] },
  { id: "top_pine_r2_6", src: "/plaza/gather/props/tree_pine_viridian_down.png", x: 0.8625, y: 0.048, w: 0.075, h: 0.2, anchorY: 0.21675, cols: [[0.88438, 0.198, 0.91563, 0.22925]] },
  { id: "camp_trailer", src: "/plaza/gather/props/trailer_round_white_down.png", x: 0.075, y: 0.32, w: 0.1, h: 0.16, anchorY: 0.455, cols: [[0.08438, 0.395, 0.16562, 0.47]] },
  { id: "camp_pine", src: "/plaza/gather/props/tree_pine_viridian_down.png", x: 0.0125, y: 0.38, w: 0.075, h: 0.2, anchorY: 0.54875, cols: [[0.03438, 0.53, 0.06563, 0.56125]] },
  { id: "camp_cherry", src: "/plaza/gather/props/cherry_tree_pink.png", x: 0.025, y: 0.66, w: 0.075, h: 0.12, anchorY: 0.76125, cols: [[0.05, 0.75, 0.075, 0.7725]] },
  { id: "camp_bench", src: "/plaza/gather/props/bench_tan_down.png", x: 0.0875, y: 0.58, w: 0.075, h: 0.04, anchorY: 0.6125, cols: [[0.09219, 0.5925, 0.15781, 0.6175]] },
  { id: "corner_pine_bl", src: "/plaza/gather/props/tree_pine_viridian_down.png", x: 0.025, y: 0.78, w: 0.075, h: 0.2, anchorY: 0.94875, cols: [[0.04688, 0.93, 0.07812, 0.96125]] },
  { id: "corner_bench_bl", src: "/plaza/gather/props/bench_tan_down.png", x: 0.1125, y: 0.86, w: 0.075, h: 0.04, anchorY: 0.8925, cols: [[0.11719, 0.8725, 0.18281, 0.8975]] },
  { id: "center_fountain", src: "/plaza/gather/props/fountain_medium.png", x: 0.4375, y: 0.42, w: 0.125, h: 0.16, anchorY: 0.5575, cols: [[0.44922, 0.5, 0.55078, 0.57]] },
  { id: "fountain_bench_left", src: "/plaza/gather/props/bench_tan_down.png", x: 0.3375, y: 0.48, w: 0.075, h: 0.04, anchorY: 0.5125, cols: [[0.34219, 0.4925, 0.40781, 0.5175]] },
  { id: "fountain_bench_right", src: "/plaza/gather/props/bench_tan_down.png", x: 0.5875, y: 0.48, w: 0.075, h: 0.04, anchorY: 0.5125, cols: [[0.59219, 0.4925, 0.65781, 0.5175]] },
  { id: "picnic_oak", src: "/plaza/gather/props/oak_tree_green.png", x: 0.775, y: 0.26, w: 0.075, h: 0.16, anchorY: 0.395, cols: [[0.79844, 0.37875, 0.82656, 0.41]] },
  { id: "picnic_cherry_1", src: "/plaza/gather/props/cherry_tree_pink.png", x: 0.6875, y: 0.34, w: 0.075, h: 0.12, anchorY: 0.44125, cols: [[0.7125, 0.43, 0.7375, 0.4525]] },
  { id: "picnic_table", src: "/plaza/gather/props/table_seats_tan_down.png", x: 0.7375, y: 0.56, w: 0.1, h: 0.12, anchorY: 0.665, cols: [[0.74375, 0.585, 0.83125, 0.67]] },
  { id: "east_pine_1", src: "/plaza/gather/props/tree_pine_viridian_down.png", x: 0.9, y: 0.34, w: 0.075, h: 0.2, anchorY: 0.50875, cols: [[0.92188, 0.49, 0.95312, 0.52125]] },
  { id: "east_pine_2", src: "/plaza/gather/props/tree_pine_viridian_down.png", x: 0.9125, y: 0.62, w: 0.075, h: 0.2, anchorY: 0.78875, cols: [[0.93437, 0.77, 0.96562, 0.80125]] },
  { id: "picnic_cherry_2", src: "/plaza/gather/props/cherry_tree_pink.png", x: 0.85, y: 0.78, w: 0.075, h: 0.12, anchorY: 0.88125, cols: [[0.875, 0.87, 0.9, 0.8925]] },
  { id: "corner_bench_br", src: "/plaza/gather/props/bench_tan_down.png", x: 0.725, y: 0.82, w: 0.075, h: 0.04, anchorY: 0.8525, cols: [[0.72969, 0.8325, 0.79531, 0.8575]] },
];

export const FOREST_PARK_WALL_COLS: PlazaCollisionRect[] = [[0.0, 0.0, 1.0, 0.12], [0.0, 0.0, 0.01875, 1.0], [0.98125, 0.0, 1.0, 1.0], [0.0, 0.97, 1.0, 1.0]];

export const LIBRARY_PROPS: PlazaPropDef[] = [{"id": "shelf_t1", "src": "/plaza/gather/props/bookshelf_white_down.png", "x": 0.05, "y": 0.05, "w": 0.1, "h": 0.16, "anchorY": 0.2, "cols": [[0.05469, 0.15, 0.14531, 0.2]]}, {"id": "shelf_t2", "src": "/plaza/gather/props/bookshelf_white_down.png", "x": 0.175, "y": 0.05, "w": 0.1, "h": 0.16, "anchorY": 0.2, "cols": [[0.17969, 0.15, 0.27031, 0.2]]}, {"id": "shelf_t3", "src": "/plaza/gather/props/shelves_cubes_down.png", "x": 0.3, "y": 0.1, "w": 0.1, "h": 0.12, "anchorY": 0.21, "cols": [[0.30469, 0.1625, 0.39531, 0.21]]}, {"id": "shelf_t4", "src": "/plaza/gather/props/shelves_cubes_down.png", "x": 0.6, "y": 0.1, "w": 0.1, "h": 0.12, "anchorY": 0.21, "cols": [[0.60469, 0.1625, 0.69531, 0.21]]}, {"id": "shelf_t5", "src": "/plaza/gather/props/bookshelf_white_down.png", "x": 0.725, "y": 0.05, "w": 0.1, "h": 0.16, "anchorY": 0.2, "cols": [[0.72969, 0.15, 0.82031, 0.2]]}, {"id": "shelf_t6", "src": "/plaza/gather/props/bookshelf_white_down.png", "x": 0.85, "y": 0.05, "w": 0.1, "h": 0.16, "anchorY": 0.2, "cols": [[0.85469, 0.15, 0.94531, 0.2]]}, {"id": "long_tbl_1", "src": "/plaza/gather/props/table_long_tan_down.png", "x": 0.25, "y": 0.4, "w": 0.2, "h": 0.12, "anchorY": 0.5, "cols": [[0.25781, 0.425, 0.44219, 0.5]]}, {"id": "chair_l1", "src": "/plaza/gather/props/chair1_blue_right.png", "x": 0.20312, "y": 0.425, "w": 0.05, "h": 0.08, "anchorY": 0.495, "cols": [[0.20625, 0.4375, 0.24688, 0.495]]}, {"id": "chair_r1", "src": "/plaza/gather/props/chair1_blue_left.png", "x": 0.45312, "y": 0.425, "w": 0.05, "h": 0.08, "anchorY": 0.495, "cols": [[0.45625, 0.4375, 0.49688, 0.495]]}, {"id": "long_tbl_2", "src": "/plaza/gather/props/table_long_tan_down.png", "x": 0.55, "y": 0.4, "w": 0.2, "h": 0.12, "anchorY": 0.5, "cols": [[0.55781, 0.425, 0.74219, 0.5]]}, {"id": "chair_l2", "src": "/plaza/gather/props/chair1_blue_right.png", "x": 0.50313, "y": 0.425, "w": 0.05, "h": 0.08, "anchorY": 0.495, "cols": [[0.50625, 0.4375, 0.54688, 0.495]]}, {"id": "chair_r2", "src": "/plaza/gather/props/chair1_blue_left.png", "x": 0.75313, "y": 0.425, "w": 0.05, "h": 0.08, "anchorY": 0.495, "cols": [[0.75625, 0.4375, 0.79688, 0.495]]}, {"id": "round_tbl_l", "src": "/plaza/gather/props/countertop_round_white_down.png", "x": 0.14062, "y": 0.7, "w": 0.125, "h": 0.12, "anchorY": 0.8, "cols": [[0.14844, 0.725, 0.25781, 0.8]]}, {"id": "round_tbl_r", "src": "/plaza/gather/props/countertop_round_white_down.png", "x": 0.73438, "y": 0.7, "w": 0.125, "h": 0.12, "anchorY": 0.8, "cols": [[0.74219, 0.725, 0.85156, 0.8]]}, {"id": "plant_1", "src": "/plaza/gather/props/pottedplant3_large_white_down.png", "x": 0.4375, "y": 0.1, "w": 0.0625, "h": 0.12, "anchorY": 0.21, "cols": [[0.44141, 0.1625, 0.49609, 0.21]]}, {"id": "plant_2", "src": "/plaza/gather/props/pottedplant3_large_white_down.png", "x": 0.5, "y": 0.1, "w": 0.0625, "h": 0.12, "anchorY": 0.21, "cols": [[0.50391, 0.1625, 0.55859, 0.21]]}, {"id": "plant_bl", "src": "/plaza/gather/props/pottedplant4_tall_white_down.png", "x": 0.05, "y": 0.8, "w": 0.05, "h": 0.12, "anchorY": 0.9125, "cols": [[0.05312, 0.8625, 0.09688, 0.9125]]}, {"id": "plant_br", "src": "/plaza/gather/props/pottedplant4_tall_white_down.png", "x": 0.9, "y": 0.8, "w": 0.05, "h": 0.12, "anchorY": 0.9125, "cols": [[0.90312, 0.8625, 0.94688, 0.9125]]}];
export const LIBRARY_WALL_COLS: PlazaCollisionRect[] = [[0.0, 0.0, 1.0, 0.1375], [0.0, 0.0, 0.025, 1.0], [0.975, 0.0, 1.0, 1.0], [0.0, 0.96, 1.0, 1.0]];

export const GAME_ROOM_PROPS: PlazaPropDef[] = [{"id": "pool_table", "src": "/plaza/gather/props/pool_green_down.png", "x": 0.20312, "y": 0.375, "w": 0.17188, "h": 0.2, "anchorY": 0.55, "cols": [[0.21094, 0.4125, 0.36719, 0.55]]}, {"id": "sofa_l", "src": "/plaza/gather/props/bigsofa_orange_left.png", "x": 0.57812, "y": 0.375, "w": 0.05, "h": 0.2, "anchorY": 0.55, "cols": [[0.58125, 0.4, 0.62344, 0.55]]}, {"id": "sofa_r", "src": "/plaza/gather/props/bigsofa_orange_right.png", "x": 0.79688, "y": 0.375, "w": 0.05, "h": 0.2, "anchorY": 0.55, "cols": [[0.8, 0.4, 0.84219, 0.55]]}, {"id": "coffee_tbl", "src": "/plaza/gather/props/table_tan_down.png", "x": 0.64844, "y": 0.4125, "w": 0.125, "h": 0.125, "anchorY": 0.525, "cols": [[0.65625, 0.4375, 0.76562, 0.525]]}, {"id": "cubby_1", "src": "/plaza/gather/props/cubby_black_right.png", "x": 0.1, "y": 0.075, "w": 0.125, "h": 0.16, "anchorY": 0.21875, "cols": [[0.10469, 0.15, 0.21875, 0.21875]]}, {"id": "vending_1", "src": "/plaza/gather/props/vendingmachine_white_down.png", "x": 0.4375, "y": 0.08, "w": 0.075, "h": 0.16, "anchorY": 0.225, "cols": [[0.44141, 0.15, 0.50781, 0.225]]}, {"id": "vending_2", "src": "/plaza/gather/props/vendingmachine_white_down.png", "x": 0.53125, "y": 0.08, "w": 0.075, "h": 0.16, "anchorY": 0.225, "cols": [[0.53516, 0.15, 0.60156, 0.225]]}, {"id": "cubby_2", "src": "/plaza/gather/props/cubby_black_right.png", "x": 0.775, "y": 0.075, "w": 0.125, "h": 0.16, "anchorY": 0.21875, "cols": [[0.77969, 0.15, 0.89375, 0.21875]]}, {"id": "bench_b1", "src": "/plaza/gather/props/bench_tan_down.png", "x": 0.25, "y": 0.8, "w": 0.075, "h": 0.04, "anchorY": 0.8325, "cols": [[0.25391, 0.81, 0.32031, 0.8325]]}, {"id": "bench_b2", "src": "/plaza/gather/props/bench_tan_down.png", "x": 0.67188, "y": 0.8, "w": 0.075, "h": 0.04, "anchorY": 0.8325, "cols": [[0.67578, 0.81, 0.74219, 0.8325]]}];
export const GAME_ROOM_WALL_COLS: PlazaCollisionRect[] = [[0.0, 0.0, 1.0, 0.12], [0.0, 0.0, 0.025, 1.0], [0.975, 0.0, 1.0, 1.0], [0.0, 0.96, 1.0, 1.0]];

export const CAFE_PROPS: PlazaPropDef[] = [{"id": "bar_1", "src": "/plaza/gather/props/countertop_marble_white_down.png", "x": 0.3125, "y": 0.25, "w": 0.125, "h": 0.1, "anchorY": 0.3375, "cols": [[0.31641, 0.275, 0.43359, 0.3375]]}, {"id": "bar_2", "src": "/plaza/gather/props/countertop_marble_white_down.png", "x": 0.4375, "y": 0.25, "w": 0.125, "h": 0.1, "anchorY": 0.3375, "cols": [[0.44141, 0.275, 0.55859, 0.3375]]}, {"id": "bar_3", "src": "/plaza/gather/props/countertop_marble_white_down.png", "x": 0.5625, "y": 0.25, "w": 0.125, "h": 0.1, "anchorY": 0.3375, "cols": [[0.56641, 0.275, 0.68359, 0.3375]]}, {"id": "stool_1", "src": "/plaza/gather/props/stool_tall_blue_down.png", "x": 0.34375, "y": 0.3625, "w": 0.0375, "h": 0.08, "anchorY": 0.43125, "cols": [[0.34687, 0.3875, 0.37812, 0.43125]]}, {"id": "stool_2", "src": "/plaza/gather/props/stool_tall_blue_down.png", "x": 0.46875, "y": 0.3625, "w": 0.0375, "h": 0.08, "anchorY": 0.43125, "cols": [[0.47187, 0.3875, 0.50313, 0.43125]]}, {"id": "stool_3", "src": "/plaza/gather/props/stool_tall_blue_down.png", "x": 0.59375, "y": 0.3625, "w": 0.0375, "h": 0.08, "anchorY": 0.43125, "cols": [[0.59688, 0.3875, 0.62813, 0.43125]]}, {"id": "dining_l", "src": "/plaza/gather/props/table_seats_tan_down.png", "x": 0.14062, "y": 0.6, "w": 0.125, "h": 0.16, "anchorY": 0.74375, "cols": [[0.14844, 0.6375, 0.25781, 0.74375]]}, {"id": "dining_r", "src": "/plaza/gather/props/table_seats_tan_down.png", "x": 0.73438, "y": 0.6, "w": 0.125, "h": 0.16, "anchorY": 0.74375, "cols": [[0.74219, 0.6375, 0.85156, 0.74375]]}, {"id": "fridge_1", "src": "/plaza/gather/props/fridge_grey_down.png", "x": 0.125, "y": 0.1, "w": 0.0625, "h": 0.16, "anchorY": 0.24375, "cols": [[0.12891, 0.1625, 0.18359, 0.24375]]}, {"id": "vending_cafe", "src": "/plaza/gather/props/vendingmachine_white_down.png", "x": 0.8125, "y": 0.1, "w": 0.075, "h": 0.16, "anchorY": 0.24375, "cols": [[0.81641, 0.1625, 0.88281, 0.24375]]}, {"id": "cafe_plant_1", "src": "/plaza/gather/props/pottedplant3_large_white_down.png", "x": 0.0625, "y": 0.375, "w": 0.0625, "h": 0.12, "anchorY": 0.48125, "cols": [[0.06641, 0.425, 0.12109, 0.48125]]}, {"id": "cafe_plant_2", "src": "/plaza/gather/props/pottedplant3_large_white_down.png", "x": 0.875, "y": 0.375, "w": 0.0625, "h": 0.12, "anchorY": 0.48125, "cols": [[0.87891, 0.425, 0.93359, 0.48125]]}];
export const CAFE_WALL_COLS: PlazaCollisionRect[] = [[0.0, 0.0, 1.0, 0.12], [0.0, 0.0, 0.025, 1.0], [0.975, 0.0, 1.0, 1.0], [0.0, 0.96, 1.0, 1.0]];

export const OFFICE_PROPS: PlazaPropDef[] = [{"id": "desk_l1", "src": "/plaza/gather/props/desk_drawers_white_down.png", "x": 0.14062, "y": 0.275, "w": 0.1, "h": 0.12, "anchorY": 0.38125, "cols": [[0.14453, 0.3125, 0.23438, 0.38125]]}, {"id": "comp_l1", "src": "/plaza/gather/props/computer_double_down.png", "x": 0.15234, "y": 0.25, "w": 0.075, "h": 0.08, "anchorY": 0.375, "cols": []}, {"id": "chair_l1", "src": "/plaza/gather/props/officechair_black_up.png", "x": 0.16797, "y": 0.375, "w": 0.05, "h": 0.08, "anchorY": 0.44375, "cols": []}, {"id": "desk_l2", "src": "/plaza/gather/props/desk_drawers_white_down.png", "x": 0.29688, "y": 0.275, "w": 0.1, "h": 0.12, "anchorY": 0.38125, "cols": [[0.30078, 0.3125, 0.39062, 0.38125]]}, {"id": "comp_l2", "src": "/plaza/gather/props/computer_double_down.png", "x": 0.30859, "y": 0.25, "w": 0.075, "h": 0.08, "anchorY": 0.375, "cols": []}, {"id": "chair_l2", "src": "/plaza/gather/props/officechair_orange_up.png", "x": 0.32422, "y": 0.375, "w": 0.05, "h": 0.08, "anchorY": 0.44375, "cols": []}, {"id": "desk_r1", "src": "/plaza/gather/props/desk_drawers_white_down.png", "x": 0.59375, "y": 0.275, "w": 0.1, "h": 0.12, "anchorY": 0.38125, "cols": [[0.59766, 0.3125, 0.6875, 0.38125]]}, {"id": "comp_r1", "src": "/plaza/gather/props/computer_double_down.png", "x": 0.60547, "y": 0.25, "w": 0.075, "h": 0.08, "anchorY": 0.375, "cols": []}, {"id": "chair_r1", "src": "/plaza/gather/props/officechair_pink_up.png", "x": 0.62109, "y": 0.375, "w": 0.05, "h": 0.08, "anchorY": 0.44375, "cols": []}, {"id": "desk_r2", "src": "/plaza/gather/props/desk_drawers_white_down.png", "x": 0.75, "y": 0.275, "w": 0.1, "h": 0.12, "anchorY": 0.38125, "cols": [[0.75391, 0.3125, 0.84375, 0.38125]]}, {"id": "comp_r2", "src": "/plaza/gather/props/computer_double_down.png", "x": 0.76172, "y": 0.25, "w": 0.075, "h": 0.08, "anchorY": 0.375, "cols": []}, {"id": "chair_r2", "src": "/plaza/gather/props/officechair_black_up.png", "x": 0.77734, "y": 0.375, "w": 0.05, "h": 0.08, "anchorY": 0.44375, "cols": []}, {"id": "glass_wall", "src": "/plaza/gather/props/fg_wall_mid_glass_left.png", "x": 0.40625, "y": 0.3, "w": 0.1875, "h": 0.08, "anchorY": 0.36875, "cols": [[0.40625, 0.325, 0.59375, 0.36875]]}, {"id": "off_plant_1", "src": "/plaza/gather/props/pottedplant4_tall_white_down.png", "x": 0.0625, "y": 0.1, "w": 0.05, "h": 0.12, "anchorY": 0.21, "cols": [[0.06641, 0.15, 0.10938, 0.21]]}, {"id": "off_plant_2", "src": "/plaza/gather/props/pottedplant4_tall_white_down.png", "x": 0.8875, "y": 0.1, "w": 0.05, "h": 0.12, "anchorY": 0.21, "cols": [[0.89062, 0.15, 0.93359, 0.21]]}];
export const OFFICE_WALL_COLS: PlazaCollisionRect[] = [[0.0, 0.0, 1.0, 0.12], [0.0, 0.0, 0.025, 1.0], [0.975, 0.0, 1.0, 1.0], [0.0, 0.96, 1.0, 1.0]];

export const PIANO_LOUNGE_PROPS: PlazaPropDef[] = [{"id": "grand_piano", "src": "/plaza/gather/props/piano_grand_down.png", "x": 0.10938, "y": 0.325, "w": 0.17188, "h": 0.225, "anchorY": 0.525, "cols": [[0.11719, 0.3875, 0.26562, 0.525]]}, {"id": "guitar_stand", "src": "/plaza/gather/props/guitar_stand_left.png", "x": 0.28906, "y": 0.375, "w": 0.05, "h": 0.12, "anchorY": 0.48125, "cols": [[0.29297, 0.425, 0.33203, 0.48125]]}, {"id": "sofa_top", "src": "/plaza/gather/props/bigsofa_orange_down.png", "x": 0.54688, "y": 0.325, "w": 0.17188, "h": 0.125, "anchorY": 0.4375, "cols": [[0.55469, 0.35, 0.71094, 0.4375]]}, {"id": "sofa_left", "src": "/plaza/gather/props/bigsofa_orange_left.png", "x": 0.42188, "y": 0.425, "w": 0.05, "h": 0.2, "anchorY": 0.6125, "cols": [[0.42578, 0.45, 0.46484, 0.6125]]}, {"id": "sofa_right", "src": "/plaza/gather/props/bigsofa_orange_right.png", "x": 0.8125, "y": 0.425, "w": 0.05, "h": 0.2, "anchorY": 0.6125, "cols": [[0.81641, 0.45, 0.85547, 0.6125]]}, {"id": "coffee_table_main", "src": "/plaza/gather/props/table_coffee_tan_down.png", "x": 0.55469, "y": 0.4875, "w": 0.15625, "h": 0.1125, "anchorY": 0.5875, "cols": [[0.5625, 0.5125, 0.70312, 0.5875]]}, {"id": "sofa_bottom", "src": "/plaza/gather/props/bigsofa_tan_up.png", "x": 0.54688, "y": 0.6375, "w": 0.17188, "h": 0.125, "anchorY": 0.75, "cols": [[0.55469, 0.6625, 0.71094, 0.75]]}, {"id": "bookshelf_p", "src": "/plaza/gather/props/bookshelf_white_down.png", "x": 0.125, "y": 0.08, "w": 0.1, "h": 0.16, "anchorY": 0.225, "cols": [[0.12891, 0.15, 0.21875, 0.225]]}, {"id": "lounge_plant_1", "src": "/plaza/gather/props/pottedplant1_tall_white_down.png", "x": 0.35938, "y": 0.1, "w": 0.05, "h": 0.12, "anchorY": 0.21, "cols": [[0.36328, 0.15, 0.40625, 0.21]]}, {"id": "lounge_plant_2", "src": "/plaza/gather/props/pottedplant4_tall_white_down.png", "x": 0.875, "y": 0.1, "w": 0.05, "h": 0.12, "anchorY": 0.21, "cols": [[0.87891, 0.15, 0.92188, 0.21]]}];
export const PIANO_LOUNGE_WALL_COLS: PlazaCollisionRect[] = [[0.0, 0.0, 1.0, 0.12], [0.0, 0.0, 0.025, 1.0], [0.975, 0.0, 1.0, 1.0], [0.0, 0.96, 1.0, 1.0]];

export const FOUNTAIN_TERRACE_PROPS: PlazaPropDef[] = [{"id": "terrace_fountain", "src": "/plaza/gather/props/fountain_medium.png", "x": 0.4375, "y": 0.375, "w": 0.125, "h": 0.16, "anchorY": 0.51875, "cols": [[0.44922, 0.425, 0.55078, 0.51875]]}, {"id": "bamboo_t1", "src": "/plaza/gather/props/pottedplant3_large_white_down.png", "x": 0.28125, "y": 0.1, "w": 0.1, "h": 0.12, "anchorY": 0.21, "cols": [[0.28516, 0.15, 0.375, 0.21]]}, {"id": "bamboo_t2", "src": "/plaza/gather/props/pottedplant3_large_white_down.png", "x": 0.40625, "y": 0.1, "w": 0.1, "h": 0.12, "anchorY": 0.21, "cols": [[0.41016, 0.15, 0.5, 0.21]]}, {"id": "bamboo_t3", "src": "/plaza/gather/props/pottedplant3_large_white_down.png", "x": 0.53125, "y": 0.1, "w": 0.1, "h": 0.12, "anchorY": 0.21, "cols": [[0.53516, 0.15, 0.625, 0.21]]}, {"id": "corner_seat_l", "src": "/plaza/gather/props/seating_corner_long_yellow_down.png", "x": 0.14062, "y": 0.375, "w": 0.1, "h": 0.16, "anchorY": 0.525, "cols": [[0.14453, 0.4125, 0.23438, 0.525]]}, {"id": "corner_seat_r", "src": "/plaza/gather/props/seating_corner_long_yellow_down.png", "x": 0.75781, "y": 0.375, "w": 0.1, "h": 0.16, "anchorY": 0.525, "cols": [[0.76172, 0.4125, 0.85156, 0.525]]}, {"id": "terrace_oak_l", "src": "/plaza/gather/props/oak_tree_green.png", "x": 0.0625, "y": 0.2, "w": 0.075, "h": 0.16, "anchorY": 0.35, "cols": [[0.07812, 0.3, 0.12109, 0.35]]}, {"id": "terrace_oak_r", "src": "/plaza/gather/props/oak_tree_green.png", "x": 0.8625, "y": 0.2, "w": 0.075, "h": 0.16, "anchorY": 0.35, "cols": [[0.87813, 0.3, 0.92188, 0.35]]}, {"id": "f_bench_1", "src": "/plaza/gather/props/bench_tan_down.png", "x": 0.32812, "y": 0.5875, "w": 0.075, "h": 0.04, "anchorY": 0.62, "cols": [[0.33203, 0.5975, 0.39844, 0.62]]}, {"id": "f_bench_2", "src": "/plaza/gather/props/bench_tan_down.png", "x": 0.59375, "y": 0.5875, "w": 0.075, "h": 0.04, "anchorY": 0.62, "cols": [[0.59766, 0.5975, 0.66406, 0.62]]}];
export const FOUNTAIN_TERRACE_WALL_COLS: PlazaCollisionRect[] = [[0.0, 0.0, 1.0, 0.12], [0.0, 0.0, 0.025, 1.0], [0.975, 0.0, 1.0, 1.0], [0.0, 0.96, 1.0, 1.0]];

export const NIGHT_PARK_PROPS: PlazaPropDef[] = [{"id": "night_fountain", "src": "/plaza/gather/props/fountain_medium.png", "x": 0.4375, "y": 0.4, "w": 0.125, "h": 0.16, "anchorY": 0.54375, "cols": [[0.44922, 0.45, 0.55078, 0.54375]]}, {"id": "night_pine_1", "src": "/plaza/gather/props/tree_pine_viridian_down.png", "x": 0.0625, "y": 0.05, "w": 0.075, "h": 0.2, "anchorY": 0.24375, "cols": [[0.08203, 0.175, 0.12109, 0.24375]]}, {"id": "night_pine_2", "src": "/plaza/gather/props/tree_pine_viridian_down.png", "x": 0.26562, "y": 0.05, "w": 0.075, "h": 0.2, "anchorY": 0.24375, "cols": [[0.28516, 0.175, 0.32422, 0.24375]]}, {"id": "night_pine_3", "src": "/plaza/gather/props/tree_pine_viridian_down.png", "x": 0.65625, "y": 0.05, "w": 0.075, "h": 0.2, "anchorY": 0.24375, "cols": [[0.67578, 0.175, 0.71484, 0.24375]]}, {"id": "night_pine_4", "src": "/plaza/gather/props/tree_pine_viridian_down.png", "x": 0.8625, "y": 0.05, "w": 0.075, "h": 0.2, "anchorY": 0.24375, "cols": [[0.87891, 0.175, 0.91797, 0.24375]]}, {"id": "night_bench_l", "src": "/plaza/gather/props/bench_tan_down.png", "x": 0.3125, "y": 0.4625, "w": 0.075, "h": 0.04, "anchorY": 0.495, "cols": [[0.31641, 0.4725, 0.38281, 0.495]]}, {"id": "night_bench_r", "src": "/plaza/gather/props/bench_tan_down.png", "x": 0.60938, "y": 0.4625, "w": 0.075, "h": 0.04, "anchorY": 0.495, "cols": [[0.61328, 0.4725, 0.67969, 0.495]]}, {"id": "night_bench_bl", "src": "/plaza/gather/props/bench_tan_down.png", "x": 0.20312, "y": 0.75, "w": 0.075, "h": 0.04, "anchorY": 0.7825, "cols": [[0.20703, 0.76, 0.27344, 0.7825]]}, {"id": "night_bench_br", "src": "/plaza/gather/props/bench_tan_down.png", "x": 0.71875, "y": 0.75, "w": 0.075, "h": 0.04, "anchorY": 0.7825, "cols": [[0.72266, 0.76, 0.78906, 0.7825]]}, {"id": "night_plant_1", "src": "/plaza/gather/props/pottedplant4_tall_white_down.png", "x": 0.125, "y": 0.55, "w": 0.05, "h": 0.12, "anchorY": 0.6625, "cols": [[0.12891, 0.6, 0.17188, 0.6625]]}, {"id": "night_plant_2", "src": "/plaza/gather/props/pottedplant4_tall_white_down.png", "x": 0.825, "y": 0.55, "w": 0.05, "h": 0.12, "anchorY": 0.6625, "cols": [[0.82812, 0.6, 0.87109, 0.6625]]}];
export const NIGHT_PARK_WALL_COLS: PlazaCollisionRect[] = [[0.0, 0.0, 1.0, 0.12], [0.0, 0.0, 0.025, 1.0], [0.975, 0.0, 1.0, 1.0], [0.0, 0.96, 1.0, 1.0]];


// 캐릭터 발 접지면 정밀 AABB 바운딩 박스 (가구/벽 침범 방지)
export const CHAR_FOOT_HW = 0.012; // 좌우 반경 약 15px (어깨 및 발 폭)
export const CHAR_FOOT_HH = 0.008; // 상하 반경 약 6px (발바닥 접지 깊이)

export const isBlockedInTheme = (
  x: number,
  y: number,
  themeDef?: PlazaThemeDef | null,
  hw: number = CHAR_FOOT_HW,
  hh: number = CHAR_FOOT_HH
): boolean => {
  if (!themeDef || !themeDef.props || themeDef.props.length === 0) return false;
  const left = x - hw;
  const right = x + hw;
  const top = y - hh;
  const bottom = y + hh;

  // 외곽 벽면 충돌 검사
  for (const r of themeDef.wallCols || []) {
    if (right > r[0] && left < r[2] && bottom > r[1] && top < r[3]) return true;
  }
  // 가구 및 장애물 에셋 충돌 검사
  for (const prop of themeDef.props) {
    if (!prop || !prop.cols) continue;
    for (const r of prop.cols) {
      if (right > r[0] && left < r[2] && bottom > r[1] && top < r[3]) return true;
    }
  }
  return false;
};

export const moveWithCollision = (
  from: PlazaPos,
  to: PlazaPos,
  themeDef?: PlazaThemeDef | null
): PlazaPos => {
  if (!from) return to || { x: 0.5, y: 0.5 };
  if (!to) return from;
  const clamped = clampPlazaPos(to);
  if (!themeDef || !themeDef.props || themeDef.props.length === 0) return clamped;
  if (!isBlockedInTheme(clamped.x, clamped.y, themeDef)) return clamped;

  // 1. X축 슬라이딩 (수직 장애물 측면을 부드럽게 미끄러지듯 이동)
  if (!isBlockedInTheme(clamped.x, from.y, themeDef)) {
    return { x: clamped.x, y: from.y };
  }
  // 2. Y축 슬라이딩 (수평 장애물 상하면을 부드럽게 미끄러지듯 이동)
  if (!isBlockedInTheme(from.x, clamped.y, themeDef)) {
    return { x: from.x, y: clamped.y };
  }
  // 3. 45도 모서리 진입 시 미세 스텝 보간 (코너 걸림 방지)
  const halfX = from.x + (clamped.x - from.x) * 0.5;
  const halfY = from.y + (clamped.y - from.y) * 0.5;
  if (!isBlockedInTheme(halfX, from.y, themeDef)) return { x: halfX, y: from.y };
  if (!isBlockedInTheme(from.x, halfY, themeDef)) return { x: from.x, y: halfY };

  return from;
};

export const isPlazaMove = (v: any): v is PlazaMove =>
  v &&
  typeof v === "object" &&
  ["x", "y", "tx", "ty"].every((k) => typeof v[k] === "number" && Number.isFinite(v[k]));

/** 좌석 번호 기준 기본 위치 (앞뒤 2줄 x 5명) */
export const defaultPlazaPos = (slotIdx: number = 0, themeId?: PlazaThemeId): PlazaPos => {
  const safeIdx = typeof slotIdx === "number" && !isNaN(slotIdx) ? Math.max(0, slotIdx) : 0;
  const col = safeIdx % 5;
  const row = safeIdx < 5 ? 0 : 1;
  if (themeId === "piano_lounge") {
    return clampPlazaPos({ x: 0.28 + col * 0.10, y: 0.80 + row * 0.08 });
  }
  return clampPlazaPos({ x: 0.35 + col * 0.07 + row * 0.02, y: 0.58 + row * 0.08 });
};

/* ----------------------------- 캐릭터 SVG ----------------------------- */

type Palette = {
  skin: string;
  hair: string;
  top: string;
  bottom: string;
  shoes: string;
};

const PALETTES: Record<CharacterId, Palette> = {
  nerd: { skin: "#ffe0c4", hair: "#2b2b3a", top: "#4f7bd9", bottom: "#3b3f5c", shoes: "#2a2a2a" },
  sporty: { skin: "#f6c9a0", hair: "#6b3e1f", top: "#ef4444", bottom: "#1f2937", shoes: "#f8fafc" },
  muscle: { skin: "#e9b48a", hair: "#1c1c1c", top: "#10b981", bottom: "#374151", shoes: "#111827" },
  cute: { skin: "#ffe4d6", hair: "#f9a8d4", top: "#c4b5fd", bottom: "#ffe4d6", shoes: "#fb7185" },
  handsome: { skin: "#fde2c8", hair: "#7c4a2d", top: "#1e293b", bottom: "#0f172a", shoes: "#3f2a1d" },
  hiphop: { skin: "#d9a77c", hair: "#1f1f1f", top: "#6366f1", bottom: "#1f2937", shoes: "#f8fafc" },
  office: { skin: "#ffe3cc", hair: "#3f2d20", top: "#475569", bottom: "#334155", shoes: "#1c1917" },
  cat: { skin: "#ffe7d1", hair: "#a16207", top: "#fbbf24", bottom: "#78350f", shoes: "#92400e" },
};

const STD_HAIR =
  "M15 26 C14 12 22 7 32 7 C42 7 50 12 49 26 C46 18 40 15 32 15 C24 15 18 18 15 26 Z";

export type PlazaDirection = "down" | "up" | "left" | "right";
export type PlazaPose = "laugh" | "sad" | "wave" | "talk";

export function CharacterSprite({
  id,
  dir = "down",
  walking = false,
  walkFrame = 0,
  talking = false,
  pose = null,
  className = "",
}: {
  id: CharacterId;
  dir?: PlazaDirection;
  walking?: boolean;
  walkFrame?: number;
  talking?: boolean;
  pose?: PlazaPose | null;
  className?: string;
}) {
  const safeId: CharacterId = CHARACTER_STYLES.some((c) => c.id === id) ? id : DEFAULT_CHARACTER;

  let row = 0;
  let col = 0;
  if (pose) {
    row = 3;
    col = pose === "laugh" ? 0 : pose === "sad" ? 1 : pose === "wave" ? 2 : 3;
  } else if (talking && !walking) {
    // 말할 때는 정면 기본(0,0)과 입 벌리고 손짓하는 대화 포즈(3,3)를 번갈아 재생
    if (walkFrame % 2 === 1) {
      row = 3;
      col = 3;
    } else {
      row = 0;
      col = 0;
    }
  } else {
    row = dir === "up" ? 1 : dir === "left" || dir === "right" ? 2 : 0;
    col = walking ? ((walkFrame % 4) + 4) % 4 : 0;
  }

  const flipLeft = !pose && !(talking && !walking) && dir === "left" && row === 2;
  const posX = (col / 3) * 100;
  const posY = (row / 3) * 100;

  return (
    <div
      className={`relative select-none pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <div
        className="w-full h-full select-none pointer-events-none"
        style={{
          backgroundImage: `url(/plaza/sheets/${safeId}.png?v=2)`,
          backgroundSize: "400% 400%",
          backgroundPosition: `${posX}% ${posY}%`,
          backgroundRepeat: "no-repeat",
          imageRendering: "pixelated",
          transform: flipLeft ? "scaleX(-1)" : undefined,
        }}
      />
    </div>
  );
}

/* ----------------------------- 광장 테마 (캐릭터 모드 전용 배경 스킨) ----------------------------- */

export type PlazaThemeId =
  | "lounge"
  | "library"
  | "game_room"
  | "cafe"
  | "office"
  | "piano_lounge"
  | "fountain_terrace"
  | "night_park"
  | "cherry_blossom"
  | "camping_forest"
  | "beach_sunset"
  | "cyber_neon"
  | "snow_village"
  | "cozy_cafe"
  | "club_stage";

export type DecorKind =
  | "lamp"
  | "tree"
  | "bench"
  | "flower"
  | "cherry_tree"
  | "palm_tree"
  | "parasol"
  | "campfire"
  | "tent"
  | "pine_tree"
  | "snowman"
  | "neon_lamp"
  | "cafe_table"
  | "speaker";

export type PlazaThemeDef = {
  id: PlazaThemeId;
  name: string;
  icon: string;
  desc: string;
  mapImg?: string;
  skyClass: string;
  floorBg: string;
  decor: { kind: DecorKind; x: number; y: number }[];
  props?: PlazaPropDef[];
  wallCols?: PlazaCollisionRect[];
};

export const PLAZA_THEMES: PlazaThemeDef[] = [
  {
    id: "lounge",
    name: "숲속 캠핑 & 피크닉 공원",
    icon: "🌲",
    desc: "소나무 숲과 캠핑 카라반, 시원한 분수대가 있는 싱그러운 픽셀 공원",
    mapImg: "/plaza/gather/forest_park_bg.png?v=2",
    skyClass: "bg-emerald-950",
    floorBg: "#68bd57",
    decor: [],
    props: FOREST_PARK_PROPS,
    wallCols: FOREST_PARK_WALL_COLS,
  },
  {
    id: "library",
    name: "도서관 & 스터디 북카페",
    icon: "📚",
    desc: "원목 책장과 정숙한 열람 데스크, 아늑한 소파가 있는 학구적인 북카페",
    mapImg: "/plaza/gather/library_bg.png?v=2",
    skyClass: "bg-amber-950",
    floorBg: "#d5af7a",
    decor: [],
    props: LIBRARY_PROPS,
    wallCols: LIBRARY_WALL_COLS,
  },
  {
    id: "game_room",
    name: "오락실 & 게임 라운지",
    icon: "🕹️",
    desc: "레트로 아케이드 머신과 탁구대, 편안한 빈백 소파가 있는 신나는 오락실",
    mapImg: "/plaza/gather/game_room_bg.png?v=2",
    skyClass: "bg-indigo-950",
    floorBg: "#b58752",
    decor: [],
    props: GAME_ROOM_PROPS,
    wallCols: GAME_ROOM_WALL_COLS,
  },
  {
    id: "cafe",
    name: "프린스 카페 & 키친 바",
    icon: "☕",
    desc: "에스프레소 머신, 쇼케이스와 바 테이블이 있는 고급스러운 디저트 카페",
    mapImg: "/plaza/gather/cafe_bg.png?v=2",
    skyClass: "bg-stone-900",
    floorBg: "#cc9e62",
    decor: [],
    props: CAFE_PROPS,
    wallCols: CAFE_WALL_COLS,
  },
  {
    id: "office",
    name: "모던 오피스 & 코워킹 스페이스",
    icon: "💼",
    desc: "듀얼 모니터 데스크와 편안한 사무용 체어, 화이트보드가 완비된 코워킹 룸",
    mapImg: "/plaza/gather/office_bg.png?v=2",
    skyClass: "bg-slate-900",
    floorBg: "#9ea4ad",
    decor: [],
    props: OFFICE_PROPS,
    wallCols: OFFICE_WALL_COLS,
  },
  {
    id: "piano_lounge",
    name: "그랜드 피아노 & 레트로 소파 라운지",
    icon: "🎹",
    desc: "클래식 그랜드 피아노와 기하학 러그, 푹신한 라운지 소파의 음악 감상실",
    mapImg: "/plaza/gather/piano_lounge_bg.png?v=2",
    skyClass: "bg-violet-950",
    floorBg: "#c99a63",
    decor: [],
    props: PIANO_LOUNGE_PROPS,
    wallCols: PIANO_LOUNGE_WALL_COLS,
  },
  {
    id: "fountain_terrace",
    name: "중앙 테라스 정원 & 분수 광장",
    icon: "⛲",
    desc: "시원한 대리석 분수대와 정원 화단, 테라스 테이블이 어우러진 오픈 광장",
    mapImg: "/plaza/gather/fountain_terrace_bg.png?v=2",
    skyClass: "bg-sky-950",
    floorBg: "#61a84f",
    decor: [],
    props: FOUNTAIN_TERRACE_PROPS,
    wallCols: FOUNTAIN_TERRACE_WALL_COLS,
  },
  {
    id: "night_park",
    name: "별빛 루프탑 밤공원",
    icon: "🌙",
    desc: "차분한 조명과 화분, 야간 벤치가 반짝이는 감성 만점 픽셀 밤공원",
    mapImg: "/plaza/gather/night_park_bg.png?v=2",
    skyClass: "bg-slate-950",
    floorBg: "#222a3a",
    decor: [],
    props: NIGHT_PARK_PROPS,
    wallCols: NIGHT_PARK_WALL_COLS,
  },
];

export const DEFAULT_PLAZA_THEME: PlazaThemeId = "lounge";

export const isPlazaThemeId = (v: unknown): v is PlazaThemeId =>
  typeof v === "string" && PLAZA_THEMES.some((t) => t.id === v);

/* ----------------------------- 광장 씬 ----------------------------- */

export type PlazaActor = {
  slotIdx: number;
  nick: string;
  character: CharacterId;
  move?: PlazaMove;
  isMe: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  isWhisper: boolean;
  pose?: PlazaPose | null;
  bubble?: { id: string; text: string; whisper?: boolean };
  hitClass?: string;
  deviceIcon?: React.ReactNode;
};

type LivePos = {
  x: number;
  y: number;
  tx: number;
  ty: number;
  facing: 1 | -1;
  dir: PlazaDirection;
  lastMovedAt: number;
  src?: PlazaMove;
};

function DecorSprite({ kind }: { kind: DecorKind }) {
  if (kind === "lamp") {
    return (
      <svg viewBox="0 0 30 110" className="w-full h-full">
        <ellipse cx="15" cy="106" rx="9" ry="3" fill="#0006" />
        <rect x="13" y="20" width="4" height="86" fill="#334155" />
        <rect x="9" y="100" width="12" height="6" rx="2" fill="#1e293b" />
        <circle cx="15" cy="16" r="12" fill="#fde68a" opacity="0.25" />
        <path d="M7 20 L23 20 L19 8 L11 8 Z" fill="#1e293b" />
        <circle cx="15" cy="16" r="4.5" fill="#fef3c7" />
      </svg>
    );
  }
  if (kind === "neon_lamp") {
    return (
      <svg viewBox="0 0 34 110" className="w-full h-full">
        <ellipse cx="17" cy="106" rx="10" ry="3" fill="#ec489955" />
        <rect x="15" y="18" width="4" height="88" fill="#0f172a" />
        <rect x="16" y="22" width="2" height="80" fill="#22d3ee" />
        <circle cx="17" cy="14" r="13" fill="#f472b6" opacity="0.3" />
        <circle cx="17" cy="14" r="6" fill="#f472b6" />
        <circle cx="17" cy="14" r="3" fill="#fff" />
      </svg>
    );
  }
  if (kind === "tree") {
    return (
      <svg viewBox="0 0 70 110" className="w-full h-full">
        <ellipse cx="35" cy="105" rx="20" ry="4" fill="#0006" />
        <rect x="30" y="60" width="10" height="46" rx="3" fill="#7c4a2d" />
        <circle cx="35" cy="40" r="28" fill="#15803d" />
        <circle cx="20" cy="52" r="16" fill="#16a34a" />
        <circle cx="50" cy="50" r="17" fill="#16a34a" />
        <circle cx="28" cy="30" r="9" fill="#22c55e" opacity="0.8" />
      </svg>
    );
  }
  if (kind === "cherry_tree") {
    return (
      <svg viewBox="0 0 76 112" className="w-full h-full">
        <ellipse cx="38" cy="106" rx="22" ry="4" fill="#0004" />
        <rect x="33" y="58" width="10" height="48" rx="3" fill="#6b3e26" />
        <circle cx="38" cy="38" r="29" fill="#f472b6" />
        <circle cx="21" cy="50" r="18" fill="#f9a8d4" />
        <circle cx="55" cy="48" r="18" fill="#f9a8d4" />
        <circle cx="31" cy="27" r="12" fill="#fbcfe8" />
        <circle cx="46" cy="32" r="9" fill="#fce7f3" />
      </svg>
    );
  }
  if (kind === "palm_tree") {
    return (
      <svg viewBox="0 0 80 115" className="w-full h-full">
        <ellipse cx="40" cy="108" rx="20" ry="4" fill="#0004" />
        <path d="M36 108 Q30 70 42 32 L49 32 Q38 70 44 108 Z" fill="#92400e" />
        <path d="M44 32 Q15 20 6 42 Q24 36 44 35 Z" fill="#16a34a" />
        <path d="M44 32 Q72 18 76 40 Q58 34 44 35 Z" fill="#15803d" />
        <path d="M44 30 Q25 6 14 20 Q30 22 44 32 Z" fill="#22c55e" />
        <path d="M44 30 Q62 6 72 22 Q56 22 44 32 Z" fill="#22c55e" />
        <circle cx="41" cy="36" r="3.5" fill="#78350f" />
        <circle cx="46" cy="37" r="3.5" fill="#78350f" />
      </svg>
    );
  }
  if (kind === "pine_tree") {
    return (
      <svg viewBox="0 0 70 115" className="w-full h-full">
        <ellipse cx="35" cy="108" rx="20" ry="4" fill="#0005" />
        <rect x="31" y="84" width="8" height="24" rx="2" fill="#5c3a21" />
        <polygon points="35,10 12,48 58,48" fill="#065f46" />
        <polygon points="35,28 9,68 61,68" fill="#047857" />
        <polygon points="35,46 6,88 64,88" fill="#059669" />
        <polygon points="35,10 24,28 46,28" fill="#f8fafc" opacity="0.85" />
      </svg>
    );
  }
  if (kind === "parasol") {
    return (
      <svg viewBox="0 0 80 95" className="w-full h-full">
        <ellipse cx="40" cy="89" rx="26" ry="4.5" fill="#0004" />
        <rect x="38" y="28" width="4" height="61" fill="#e2e8f0" />
        <path d="M6 34 Q40 4 74 34 Z" fill="#ef4444" />
        <path d="M22 34 Q40 8 58 34 Z" fill="#fef08a" />
        <rect x="18" y="76" width="44" height="9" rx="3" fill="#38bdf8" />
      </svg>
    );
  }
  if (kind === "tent") {
    return (
      <svg viewBox="0 0 96 76" className="w-full h-full">
        <ellipse cx="48" cy="70" rx="42" ry="5" fill="#0006" />
        <polygon points="48,8 8,68 88,68" fill="#f59e0b" stroke="#b45309" strokeWidth="2" />
        <polygon points="48,8 48,68 88,68" fill="#d97706" />
        <polygon points="48,28 33,68 63,68" fill="#fde68a" />
        <polygon points="48,28 40,68 56,68" fill="#fef3c7" />
      </svg>
    );
  }
  if (kind === "campfire") {
    return (
      <svg viewBox="0 0 64 60" className="w-full h-full">
        <ellipse cx="32" cy="52" rx="24" ry="5" fill="#f9731644" />
        <rect x="12" y="44" width="40" height="7" rx="3" fill="#78350f" transform="rotate(14 32 47)" />
        <rect x="12" y="44" width="40" height="7" rx="3" fill="#92400e" transform="rotate(-14 32 47)" />
        <path d="M32 10 C20 24 18 38 32 46 C46 38 44 24 32 10 Z" fill="#f97316" className="animate-pulse" />
        <path d="M32 18 C25 28 24 38 32 44 C40 38 39 28 32 18 Z" fill="#facc15" />
        <path d="M32 26 C28 32 28 38 32 42 C36 38 36 32 32 26 Z" fill="#fef08a" />
      </svg>
    );
  }
  if (kind === "snowman") {
    return (
      <svg viewBox="0 0 64 80" className="w-full h-full">
        <ellipse cx="32" cy="74" rx="20" ry="4" fill="#0004" />
        <circle cx="32" cy="56" r="16" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
        <circle cx="32" cy="33" r="12" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
        <rect x="22" y="41" width="20" height="5" rx="2.5" fill="#ef4444" />
        <rect x="34" y="43" width="5" height="11" rx="2" fill="#dc2626" />
        <rect x="22" y="18" width="20" height="3" rx="1.5" fill="#1e293b" />
        <rect x="25" y="8" width="14" height="11" rx="2" fill="#1e293b" />
        <circle cx="28" cy="31" r="1.6" fill="#0f172a" />
        <circle cx="36" cy="31" r="1.6" fill="#0f172a" />
        <polygon points="32,33 41,35 32,37" fill="#f97316" />
      </svg>
    );
  }
  if (kind === "cafe_table") {
    return (
      <svg viewBox="0 0 84 88" className="w-full h-full">
        <ellipse cx="42" cy="82" rx="28" ry="4.5" fill="#0005" />
        <rect x="40" y="24" width="4" height="56" fill="#475569" />
        <path d="M10 28 Q42 4 74 28 Z" fill="#fef3c7" stroke="#d97706" strokeWidth="1.5" />
        <ellipse cx="42" cy="58" rx="24" ry="7" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
        <rect x="34" y="51" width="5" height="6" rx="1" fill="#b45309" />
        <rect x="46" y="51" width="5" height="6" rx="1" fill="#b45309" />
      </svg>
    );
  }
  if (kind === "speaker") {
    return (
      <svg viewBox="0 0 56 96" className="w-full h-full">
        <ellipse cx="28" cy="91" rx="22" ry="4" fill="#0007" />
        <rect x="10" y="14" width="36" height="76" rx="5" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
        <circle cx="28" cy="34" r="11" fill="#1e293b" stroke="#f472b6" strokeWidth="2" />
        <circle cx="28" cy="34" r="4" fill="#f472b6" className="animate-ping" />
        <circle cx="28" cy="66" r="13" fill="#1e293b" stroke="#22d3ee" strokeWidth="2" />
        <circle cx="28" cy="66" r="5" fill="#22d3ee" />
      </svg>
    );
  }
  if (kind === "bench") {
    return (
      <svg viewBox="0 0 100 50" className="w-full h-full">
        <ellipse cx="50" cy="46" rx="44" ry="4" fill="#0005" />
        <rect x="8" y="6" width="84" height="8" rx="2" fill="#b45309" />
        <rect x="8" y="17" width="84" height="8" rx="2" fill="#b45309" />
        <rect x="4" y="28" width="92" height="8" rx="2" fill="#d97706" />
        <rect x="12" y="36" width="5" height="10" fill="#334155" />
        <rect x="83" y="36" width="5" height="10" fill="#334155" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 40 40" className="w-full h-full">
      <ellipse cx="20" cy="36" rx="16" ry="3" fill="#0005" />
      <circle cx="12" cy="24" r="9" fill="#16a34a" />
      <circle cx="28" cy="24" r="9" fill="#15803d" />
      <circle cx="20" cy="18" r="9" fill="#22c55e" />
      <circle cx="12" cy="18" r="3" fill="#f472b6" />
      <circle cx="26" cy="14" r="3" fill="#facc15" />
      <circle cx="22" cy="26" r="3" fill="#f87171" />
    </svg>
  );
}

const isTypingTarget = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
};

export function PlazaScene({
  actors,
  theme = DEFAULT_PLAZA_THEME,
  hasSkin = false,
  onMyMove,
  onActorClick,
  registerActorEl,
  hint,
}: {
  actors: PlazaActor[];
  theme?: PlazaThemeId;
  hasSkin?: boolean;
  onMyMove: (from: PlazaPos, to: PlazaPos) => void;
  onActorClick: (actor: PlazaActor) => void;
  registerActorEl: (slotIdx: number, el: HTMLDivElement | null) => void;
  hint?: string;
}) {
  const activeTheme = (theme && PLAZA_THEMES.find((t) => t.id === theme)) || PLAZA_THEMES[0] || { id: "lounge", name: "픽셀 광장", icon: "☕", desc: "", skyClass: "bg-slate-950", floorBg: "#242130", decor: [] };
  const activeThemeRef = useRef<PlazaThemeDef>(activeTheme);
  activeThemeRef.current = activeTheme;

  // 스킨 테마 변경 시 현재 캐릭터 위치가 새 테마의 가구/벽 안에 갇히지 않도록 안전 탈출
  useEffect(() => {
    const me = actors.find((a) => a.isMe);
    if (!me) return;
    const p = posRef.current[me.nick];
    if (p && isBlockedInTheme(p.x, p.y, activeTheme)) {
      const safe = defaultPlazaPos(me.slotIdx, activeTheme.id);
      p.x = safe.x;
      p.y = safe.y;
      p.tx = safe.x;
      p.ty = safe.y;
      onMyMoveRef.current({ x: safe.x, y: safe.y }, { x: safe.x, y: safe.y });
    }
  }, [theme]);
  const sceneRef = useRef<HTMLDivElement>(null);
  const posRef = useRef<Record<string, LivePos>>({});
  const actorsRef = useRef<PlazaActor[]>(actors);
  const onMyMoveRef = useRef(onMyMove);
  const keysRef = useRef<Set<string>>(new Set());
  const lastKeySendRef = useRef(0);
  const wasKeyMovingRef = useRef(false);
  const [, setFrame] = useState(0);
  const [sceneSize, setSceneSize] = useState({ w: 800, h: 400 });

  actorsRef.current = actors;
  onMyMoveRef.current = onMyMove;

  // 외부(동기화)에서 들어온 이동 정보 반영
  const live = posRef.current;
  const present = new Set<string>();
  actors.forEach((a) => {
    present.add(a.nick);
    const cur = live[a.nick];
    if (!cur) {
      const start = a.move ? clampPlazaPos({ x: a.move.tx, y: a.move.ty }) : defaultPlazaPos(a.slotIdx);
      live[a.nick] = { x: start.x, y: start.y, tx: start.x, ty: start.y, facing: 1, dir: "down", lastMovedAt: 0, src: a.move };
      return;
    }
    if (!a.isMe && a.move && a.move !== cur.src) {
      const from = clampPlazaPos({ x: a.move.x, y: a.move.y });
      const to = clampPlazaPos({ x: a.move.tx, y: a.move.ty });
      if (Math.hypot(from.x - cur.x, from.y - cur.y) > 0.12) {
        cur.x = from.x;
        cur.y = from.y;
      }
      if (Math.hypot(to.x - cur.x, to.y - cur.y) > 0.001) {
        cur.lastMovedAt = performance.now();
      }
      cur.tx = to.x;
      cur.ty = to.y;
      cur.src = a.move;
    }
  });
  Object.keys(live).forEach((k) => {
    if (!present.has(k)) delete live[k];
  });

  // 씬 크기 측정 (캐릭터 크기 결정)
  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const update = () => setSceneSize({ w: el.clientWidth || 800, h: el.clientHeight || 400 });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 키보드 (방향키 / WASD - 한글 입력 상태 'ㅈㅁㄴㅇ' 및 물리 키코드 KeyW/A/S/D 완벽 지원)
  useEffect(() => {
    const resolveMoveKey = (e: KeyboardEvent): string | null => {
      const code = (e.code || "").toLowerCase();
      if (code === "keyw") return "w";
      if (code === "keya") return "a";
      if (code === "keys") return "s";
      if (code === "keyd") return "d";
      if (
        code === "arrowup" ||
        code === "arrowdown" ||
        code === "arrowleft" ||
        code === "arrowright"
      ) {
        return code;
      }
      const k = (e.key || "").toLowerCase();
      if (k === "w" || k === "ㅈ" || k === "ㅉ") return "w";
      if (k === "a" || k === "ㅁ") return "a";
      if (k === "s" || k === "ㄴ") return "s";
      if (k === "d" || k === "ㅇ") return "d";
      if (
        k === "arrowup" ||
        k === "arrowdown" ||
        k === "arrowleft" ||
        k === "arrowright"
      ) {
        return k;
      }
      return null;
    };

    const down = (e: KeyboardEvent) => {
      if (
        isTypingTarget(e.target) ||
        isTypingTarget(document.activeElement) ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      ) {
        return;
      }
      const moveKey = resolveMoveKey(e);
      if (!moveKey) return;
      if (!actorsRef.current.some((a) => a.isMe)) return;
      e.preventDefault();
      keysRef.current.add(moveKey);
    };
    const up = (e: KeyboardEvent) => {
      const moveKey = resolveMoveKey(e);
      if (moveKey) {
        keysRef.current.delete(moveKey);
      } else {
        keysRef.current.delete((e.key || "").toLowerCase());
      }
    };
    const clear = () => keysRef.current.clear();
    const onFocusIn = (e: FocusEvent) => {
      if (isTypingTarget(e.target)) keysRef.current.clear();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    window.addEventListener("focusin", onFocusIn);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      window.removeEventListener("focusin", onFocusIn);
    };
  }, []);

  // 걷기 애니메이션 루프
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let changed = false;
      const me = actorsRef.current.find((a) => a.isMe);

      const keys = keysRef.current;
      if (me && posRef.current[me.nick]) {
        const p = posRef.current[me.nick];
        let dx = 0;
        let dy = 0;
        if (keys.has("arrowleft") || keys.has("a")) dx -= 1;
        if (keys.has("arrowright") || keys.has("d")) dx += 1;
        if (keys.has("arrowup") || keys.has("w")) dy -= 1;
        if (keys.has("arrowdown") || keys.has("s")) dy += 1;
        if (dx || dy) {
          const len = Math.hypot(dx, dy);
          const rawNext = clampPlazaPos({
            x: p.x + (dx / len) * WALK_SPEED * dt,
            y: p.y + (dy / len) * WALK_SPEED * 0.8 * dt,
          });
          const next = moveWithCollision(p, rawNext, activeThemeRef.current);
          if (dx) p.facing = dx > 0 ? 1 : -1;
          if (Math.abs(dy) > Math.abs(dx) * 1.1) {
            p.dir = dy < 0 ? "up" : "down";
          } else if (dx !== 0) {
            p.dir = dx < 0 ? "left" : "right";
          }
          p.x = next.x;
          p.y = next.y;
          p.tx = next.x;
          p.ty = next.y;
          p.lastMovedAt = now;
          changed = true;
          wasKeyMovingRef.current = true;
          if (now - lastKeySendRef.current > 120) {
            lastKeySendRef.current = now;
            const leadRaw = clampPlazaPos({ x: p.x + (dx / len) * 0.04, y: p.y + (dy / len) * 0.032 });
            const lead = moveWithCollision(p, leadRaw, activeThemeRef.current);
            onMyMoveRef.current({ x: p.x, y: p.y }, lead);
          }
        } else if (wasKeyMovingRef.current) {
          wasKeyMovingRef.current = false;
          p.lastMovedAt = 0;
          changed = true;
          onMyMoveRef.current({ x: p.x, y: p.y }, { x: p.x, y: p.y });
        }
      }

      Object.values(posRef.current).forEach((p) => {
        const ddx = p.tx - p.x;
        const ddy = p.ty - p.y;
        const dist = Math.hypot(ddx, ddy);
        if (dist < 0.0005) {
          if (dist > 0) {
            p.x = p.tx;
            p.y = p.ty;
            changed = true;
          }
          return;
        }
        const step = WALK_SPEED * dt;
        let nextPos: PlazaPos;
        if (step >= dist) {
          nextPos = { x: p.tx, y: p.ty };
        } else {
          nextPos = {
            x: p.x + (ddx / dist) * step,
            y: p.y + (ddy / dist) * step,
          };
        }
        // 내 캐릭터의 이동 시 충돌 검사 (벽이나 가구에 부딪히면 정지/슬라이딩)
        if (me && p === posRef.current[me.nick]) {
          const resolved = moveWithCollision(p, nextPos, activeThemeRef.current);
          if (resolved.x === p.x && resolved.y === p.y) {
            p.tx = p.x;
            p.ty = p.y;
            p.lastMovedAt = 0;
            changed = true;
            return;
          }
          p.x = resolved.x;
          p.y = resolved.y;
        } else {
          p.x = nextPos.x;
          p.y = nextPos.y;
        }
        if (Math.abs(ddx) > 0.002) p.facing = ddx > 0 ? 1 : -1;
        if (Math.abs(ddy) > Math.abs(ddx) * 1.15) {
          p.dir = ddy < 0 ? "up" : "down";
        } else if (Math.abs(ddx) > 0.001) {
          p.dir = ddx < 0 ? "left" : "right";
        }
        p.lastMovedAt = now;
        changed = true;
      });

      const anyRecentlyMoved = Object.values(posRef.current).some(
        (p) => p.lastMovedAt > 0 && now - p.lastMovedAt < 240
      );
      const anySpeakingOrPosing = actorsRef.current.some((a) => a.isSpeaking || Boolean(a.pose));
      if (changed || anyRecentlyMoved || anySpeakingOrPosing) setFrame((f) => (f + 1) % 1000000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleFloorPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const me = actorsRef.current.find((a) => a.isMe);
    const el = sceneRef.current;
    if (!me || !el) return;
    const rect = el.getBoundingClientRect();
    const rawTarget = clampPlazaPos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
    const target = isBlockedInTheme(rawTarget.x, rawTarget.y, activeThemeRef.current)
      ? moveWithCollision(live[me.nick] || rawTarget, rawTarget, activeThemeRef.current)
      : rawTarget;
    const p = posRef.current[me.nick];
    if (!p) return;
    p.tx = target.x;
    p.ty = target.y;
    onMyMoveRef.current({ x: p.x, y: p.y }, target);
  };

  const unit = Math.max(40, Math.min(100, sceneSize.h * 0.17, sceneSize.w * 0.15));
  const meTarget = (() => {
    const me = actors.find((a) => a.isMe);
    if (!me) return null;
    const p = live[me.nick];
    if (!p || Math.hypot(p.tx - p.x, p.ty - p.y) < 0.01) return null;
    return { x: p.tx, y: p.ty };
  })();

  return (
    <div
      ref={sceneRef}
      onPointerDown={handleFloorPointer}
      className="absolute inset-0 overflow-hidden rounded-xl select-none touch-manipulation cursor-pointer"
    >
      {/* 픽셀 월드맵 이미지 테마 vs 2.5D 벡터 테마 렌더링 */}
      {activeTheme.mapImg ? (
        <div className="absolute inset-0 bg-slate-950">
          <img
            src={activeTheme.mapImg}
            alt={activeTheme.name}
            draggable={false}
            style={{ imageRendering: "pixelated" }}
            className="w-full h-full object-cover select-none pointer-events-none"
          />
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/35 to-transparent pointer-events-none" />
        </div>
      ) : (
        <>
          {/* 하늘 / 뒷벽 (선택한 캐릭터 광장 테마에 맞게 렌더링) */}
          <div className={`absolute inset-x-0 top-0 h-[34%] transition-colors duration-500 ${activeTheme.skyClass}`}>
            {activeTheme.id === "beach_sunset" && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-16 h-8 md:w-24 md:h-12 rounded-t-full bg-gradient-to-t from-yellow-200 via-amber-300 to-orange-400 shadow-[0_0_50px_rgba(251,191,36,0.8)]" />
            )}
            {activeTheme.id === "cyber_neon" && (
              <div className="absolute inset-x-0 bottom-0 h-12 flex items-end justify-around opacity-55 px-4">
                <div className="w-8 h-10 bg-slate-900 border-t-2 border-cyan-400" />
                <div className="w-12 h-14 bg-slate-900 border-t-2 border-fuchsia-400" />
                <div className="w-10 h-8 bg-slate-900 border-t-2 border-cyan-400" />
                <div className="w-14 h-12 bg-slate-900 border-t-2 border-pink-500" />
                <div className="w-9 h-9 bg-slate-900 border-t-2 border-cyan-300" />
              </div>
            )}
            {activeTheme.id === "snow_village" && (
              <>
                <div className="absolute inset-x-[10%] top-[14%] h-10 rounded-full bg-gradient-to-r from-emerald-400/25 via-cyan-300/35 to-purple-400/25 blur-md animate-pulse" />
                <div className="absolute right-[10%] top-[14%] w-7 h-7 md:w-9 md:h-9 rounded-full bg-sky-100/90 shadow-[0_0_28px_rgba(224,242,254,0.8)]" />
              </>
            )}
            {activeTheme.id === "club_stage" && (
              <>
                <div className="absolute left-1/2 -translate-x-1/2 top-2 w-8 h-8 md:w-11 md:h-11 rounded-full bg-gradient-to-br from-slate-100 via-cyan-200 to-fuchsia-300 shadow-[0_0_35px_rgba(232,121,249,0.9)] animate-pulse border border-white/60" />
                <div className="absolute left-[22%] top-0 w-16 h-full bg-gradient-to-b from-cyan-400/20 to-transparent -rotate-12" />
                <div className="absolute right-[22%] top-0 w-16 h-full bg-gradient-to-b from-fuchsia-400/20 to-transparent rotate-12" />
              </>
            )}
          </div>

          {/* 2.5D 바닥 (원근감 타일) */}
          <div className="absolute inset-x-0 bottom-0 top-[26%] overflow-hidden" style={{ perspective: "520px" }}>
            <div
              className="absolute left-[-40%] right-[-40%] top-0 bottom-[-30%] transition-all duration-500"
              style={{
                transform: "rotateX(52deg)",
                transformOrigin: "50% 0%",
                background: activeTheme.floorBg,
              }}
            />
            <div className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-black/30 to-transparent" />
          </div>
        </>
      )}

      {/* 이동 목표 표시 */}
      {meTarget && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: `${meTarget.x * 100}%`,
            top: `${meTarget.y * 100}%`,
            transform: "translate(-50%, -50%)",
            zIndex: 1,
          }}
        >
          <div className="w-6 h-2.5 rounded-[50%] border-2 border-sky-300/80 animate-ping" />
        </div>
      )}

      {/* 픽셀 오픈소스 분리형 투명 에셋 레이어 (Y-Sorting Occlusion) */}
      {(activeTheme.props || []).map((prop) => {
        if (!prop || !prop.id || !prop.src) return null;
        return (
          <div
            key={prop.id}
            className="absolute pointer-events-none select-none"
            style={{
              left: `${(prop.x ?? 0) * 100}%`,
              top: `${(prop.y ?? 0) * 100}%`,
              width: `${(prop.w ?? 0) * 100}%`,
              height: `${(prop.h ?? 0) * 100}%`,
              zIndex: 10 + Math.round((prop.anchorY ?? 0) * 1000),
            }}
          >
            <img
              src={prop.src}
              alt={prop.id}
              draggable={false}
              style={{ imageRendering: "pixelated" }}
              className="w-full h-full object-contain pointer-events-none select-none"
            />
          </div>
        );
      })}

      {/* 테마별 소품 */}
      {(activeTheme?.decor || []).map((d, i) => {
        const s = 0.7 + 0.45 * d.y;
        const w =
          d.kind === "bench" || d.kind === "tent"
            ? unit * 1.45
            : d.kind === "flower"
            ? unit * 0.6
            : d.kind === "lamp" || d.kind === "neon_lamp"
            ? unit * 0.48
            : d.kind === "campfire" || d.kind === "snowman"
            ? unit * 0.85
            : unit * 1.15;
        const h =
          d.kind === "bench"
            ? unit * 0.75
            : d.kind === "tent"
            ? unit * 1.1
            : d.kind === "flower"
            ? unit * 0.6
            : d.kind === "campfire"
            ? unit * 0.8
            : d.kind === "snowman"
            ? unit * 1.05
            : unit * 1.7;
        return (
          <div
            key={`${activeTheme.id}-${i}`}
            className="absolute pointer-events-none"
            style={{
              left: `${d.x * 100}%`,
              top: `${d.y * 100}%`,
              width: w * s,
              height: h * s,
              transform: "translate(-50%, -100%)",
              zIndex: Math.round(d.y * 1000),
            }}
          >
            <DecorSprite kind={d.kind} />
          </div>
        );
      })}

      {/* 캐릭터 */}
      {actors.map((a) => {
        const p = live[a.nick];
        if (!p) return null;
        const s = activeTheme?.props ? 0.68 : activeTheme?.mapImg ? 0.9 : 0.72 + 0.4 * (p?.y ?? 0.5);
        const w = unit * s;
        const walking =
          (a.isMe && wasKeyMovingRef.current) ||
          Math.hypot(p.tx - p.x, p.ty - p.y) > 0.0015 ||
          (p.lastMovedAt > 0 && performance.now() - p.lastMovedAt < 180);
        return (
          <div
            key={a.nick}
            className="absolute"
            style={{
              left: `${p.x * 100}%`,
              top: `${p.y * 100}%`,
              width: w,
              height: w * 1.3125,
              transform: "translate(-50%, -100%)",
              zIndex: 10 + Math.round(p.y * 1000),
            }}
          >
            {/* 발밑 그림자 / 발화 글로우 */}
            <div
              className={`absolute left-1/2 -translate-x-1/2 rounded-[50%] pointer-events-none transition-all ${
                a.isWhisper
                  ? "bg-purple-400/50 shadow-[0_0_16px_6px_rgba(192,132,252,0.6)]"
                  : a.isSpeaking
                  ? "bg-emerald-400/50 shadow-[0_0_18px_8px_rgba(52,211,153,0.65)] animate-pulse"
                  : a.isMe
                  ? "bg-sky-400/35 ring-2 ring-sky-300/75"
                  : "bg-black/35"
              }`}
              style={{ bottom: -w * 0.04, width: w * 0.8, height: w * 0.22 }}
            />

            {/* 말풍선 */}
            {a.bubble && (
              <div
                key={a.bubble.id}
                className="plaza-bubble absolute left-1/2 bottom-full mb-1 pointer-events-none"
                style={{ zIndex: 5 }}
              >
                <div
                  className={`relative max-w-[150px] md:max-w-[200px] w-max px-2 md:px-2.5 py-1 md:py-1.5 rounded-xl text-[10.5px] md:text-xs font-semibold leading-snug shadow-lg break-words line-clamp-3 ${
                    a.bubble.whisper ? "bg-fuchsia-100 text-fuchsia-900 border border-fuchsia-300" : "bg-white text-slate-900"
                  }`}
                >
                  {a.bubble.text}
                </div>
                <div
                  className={`mx-auto w-2.5 h-2.5 rotate-45 -mt-1.5 ${a.bubble.whisper ? "bg-fuchsia-100" : "bg-white"}`}
                />
              </div>
            )}

            {/* 캐릭터 본체 (감정표현/메뉴 타깃 겸 클릭 영역) */}
            <div
              ref={(el) => registerActorEl(a.slotIdx, el)}
              onPointerDown={(e) => {
                if (a.isMe) return;
                e.stopPropagation();
                onActorClick(a);
              }}
              className={`relative w-full h-full ${a.isMe ? "" : "cursor-pointer"} ${a.hitClass || ""}`}
            >
              <div
                className="w-full h-full"
                style={{
                  filter: a.isSpeaking
                    ? "drop-shadow(0 0 6px rgba(52,211,153,0.95))"
                    : a.isWhisper
                    ? "drop-shadow(0 0 6px rgba(192,132,252,0.95))"
                    : "drop-shadow(0 2px 2px rgba(0,0,0,0.35))",
                }}
              >
                <div className="w-full h-full">
                  <CharacterSprite
                    id={a.character}
                    dir={p.dir}
                    walking={walking}
                    walkFrame={Math.floor(performance.now() / 130)}
                    talking={a.isSpeaking}
                    pose={a.pose || null}
                    className="w-full h-full"
                  />
                </div>
              </div>
            </div>

            {/* 이름표 (닉네임 앞 좌석 숫자 제거) */}
            <div
              onPointerDown={(e) => {
                if (a.isMe) return;
                e.stopPropagation();
                onActorClick(a);
              }}
              className={`absolute left-1/2 -translate-x-1/2 top-full mt-0.5 flex items-center gap-0.5 px-2 py-0.5 rounded-full whitespace-nowrap ${
                a.isMe ? "pointer-events-none" : "cursor-pointer hover:brightness-125"
              } text-[9.5px] md:text-[11px] font-bold shadow`}
              style={{
                background: a.isMe ? "rgba(79,70,229,0.92)" : "rgba(2,6,23,0.78)",
                border: a.isSpeaking ? "1px solid rgba(52,211,153,0.9)" : "1px solid rgba(255,255,255,0.18)",
              }}
            >
              {a.deviceIcon}
              <span className="text-white max-w-[78px] md:max-w-[115px] truncate">{a.nick}</span>
              {a.isMuted ? (
                <span className="text-rose-400" title="마이크 꺼짐">🔇</span>
              ) : a.isSpeaking ? (
                <span className="text-emerald-300">🔊</span>
              ) : null}
            </div>
          </div>
        );
      })}

      {hint && (
        <div className="absolute left-1/2 -translate-x-1/2 top-[38%] md:top-[42%] pointer-events-none px-3 py-1.5 rounded-full bg-black/55 border border-white/15 text-[10.5px] md:text-xs text-slate-100 font-semibold whitespace-nowrap" style={{ zIndex: 2000 }}>
          {hint}
        </div>
      )}
    </div>
  );
}
