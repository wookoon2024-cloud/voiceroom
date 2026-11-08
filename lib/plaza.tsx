"use client";

import React, { useEffect, useRef, useState } from "react";
import { RoomCharacterSprite, type SpritePoseInfo } from "./character-sprite-v2";
import { isSocialAction, socialContactOffset, type SocialAction } from "./social-actions";
import { characterScale, SPRITE_CHARACTERS_V2, type SpriteCharacterV2 } from "./sprite-v2";
import { GARDEN_LOUNGE_THEME } from "./garden-lounge";
import { GardenWater } from "./garden-water";
import { pickSpriteActor } from "./sprite-hit";
import { clearWalkSegment, findWalkPath, walkDistance, walkPathLength } from "./plaza-navigation";
export type { SpritePoseInfo } from "./character-sprite-v2";

/* =====================================================================
 * 캐릭터 모드 (광장) - 2.5D 캐릭터 & 걸어다니는 씬
 * 새 캐릭터 2종: sprite-gen 투명 아틀라스와 manifest 기반 재생
 * 좌표는 씬 기준 0~1 정규화 좌표 (x: 좌→우, y: 위→아래, 캐릭터 발 위치)
 * ===================================================================== */

export type ViewMode = "basic" | "plaza";

export type CharacterId = SpriteCharacterV2;

export const CHARACTER_STYLES = SPRITE_CHARACTERS_V2;
export const DEFAULT_CHARACTER: CharacterId = "cute_male_v2";
/** Read old saved/remote IDs without exposing the retired skins in the picker. */
export const normalizeCharacterId = (value: unknown): CharacterId =>
  value === "muscle" ? "strong_male_v2" : isCharacterId(value) ? value : "cute_male_v2";

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
  water?: boolean;
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

export const LIBRARY_PROPS: PlazaPropDef[] = [{"id": "shelf_t1", "src": "/plaza/gather/props/bookshelf_white_down.png", "x": 0.05, "y": 0.04, "w": 0.05, "h": 0.08, "anchorY": 0.112, "cols": [[0.05, 0.06, 0.1, 0.12]]}, {"id": "shelf_t2", "src": "/plaza/gather/props/bookshelf_white_down.png", "x": 0.12, "y": 0.04, "w": 0.05, "h": 0.08, "anchorY": 0.112, "cols": [[0.12, 0.06, 0.17, 0.12]]}, {"id": "shelf_t3", "src": "/plaza/gather/props/shelves_cubes_down.png", "x": 0.2, "y": 0.04, "w": 0.075, "h": 0.08, "anchorY": 0.112, "cols": [[0.2, 0.06, 0.275, 0.12]]}, {"id": "shelf_t4", "src": "/plaza/gather/props/shelves_cubes_down.png", "x": 0.725, "y": 0.04, "w": 0.075, "h": 0.08, "anchorY": 0.112, "cols": [[0.725, 0.06, 0.8, 0.12]]}, {"id": "shelf_t5", "src": "/plaza/gather/props/bookshelf_white_down.png", "x": 0.82, "y": 0.04, "w": 0.05, "h": 0.08, "anchorY": 0.112, "cols": [[0.82, 0.06, 0.87, 0.12]]}, {"id": "shelf_t6", "src": "/plaza/gather/props/bookshelf_white_down.png", "x": 0.89, "y": 0.04, "w": 0.05, "h": 0.08, "anchorY": 0.112, "cols": [[0.89, 0.06, 0.94, 0.12]]}, {"id": "plant_1", "src": "/plaza/gather/props/pottedplant3_large_white_down.png", "x": 0.42, "y": 0.04, "w": 0.075, "h": 0.12, "anchorY": 0.148, "cols": [[0.43, 0.1, 0.485, 0.15]]}, {"id": "plant_2", "src": "/plaza/gather/props/pottedplant3_large_white_down.png", "x": 0.505, "y": 0.04, "w": 0.075, "h": 0.12, "anchorY": 0.148, "cols": [[0.515, 0.1, 0.57, 0.15]]}, {"id": "long_tbl_1", "src": "/plaza/gather/props/table_long_tan_down.png", "x": 0.175, "y": 0.38, "w": 0.125, "h": 0.12, "anchorY": 0.488, "cols": [[0.178, 0.41, 0.297, 0.495]]}, {"id": "chair_l1", "src": "/plaza/gather/props/chair1_blue_right.png", "x": 0.14, "y": 0.4, "w": 0.025, "h": 0.08, "anchorY": 0.472, "cols": []}, {"id": "chair_r1", "src": "/plaza/gather/props/chair1_blue_left.png", "x": 0.31, "y": 0.4, "w": 0.025, "h": 0.08, "anchorY": 0.472, "cols": []}, {"id": "long_tbl_2", "src": "/plaza/gather/props/table_long_tan_down.png", "x": 0.7, "y": 0.38, "w": 0.125, "h": 0.12, "anchorY": 0.488, "cols": [[0.703, 0.41, 0.822, 0.495]]}, {"id": "chair_l2", "src": "/plaza/gather/props/chair1_blue_right.png", "x": 0.665, "y": 0.4, "w": 0.025, "h": 0.08, "anchorY": 0.472, "cols": []}, {"id": "chair_r2", "src": "/plaza/gather/props/chair1_blue_left.png", "x": 0.835, "y": 0.4, "w": 0.025, "h": 0.08, "anchorY": 0.472, "cols": []}, {"id": "round_tbl_l", "src": "/plaza/gather/props/countertop_round_white_down.png", "x": 0.175, "y": 0.7, "w": 0.125, "h": 0.08, "anchorY": 0.772, "cols": [[0.18, 0.72, 0.295, 0.775]]}, {"id": "round_tbl_r", "src": "/plaza/gather/props/countertop_round_white_down.png", "x": 0.7, "y": 0.7, "w": 0.125, "h": 0.08, "anchorY": 0.772, "cols": [[0.705, 0.72, 0.82, 0.775]]}, {"id": "plant_bl", "src": "/plaza/gather/props/pottedplant4_tall_white_down.png", "x": 0.05, "y": 0.8, "w": 0.025, "h": 0.12, "anchorY": 0.908, "cols": [[0.05, 0.87, 0.075, 0.92]]}, {"id": "plant_br", "src": "/plaza/gather/props/pottedplant4_tall_white_down.png", "x": 0.925, "y": 0.8, "w": 0.025, "h": 0.12, "anchorY": 0.908, "cols": [[0.925, 0.87, 0.95, 0.92]]}];
export const LIBRARY_WALL_COLS: PlazaCollisionRect[] = [[0.0, 0.0, 1.0, 0.12], [0.0, 0.0, 0.025, 1.0], [0.975, 0.0, 1.0, 1.0], [0.0, 0.96, 1.0, 1.0]];

export const GAME_ROOM_PROPS: PlazaPropDef[] = [{"id": "cubby_1", "src": "/plaza/gather/props/cubby_black_right.png", "x": 0.08, "y": 0.04, "w": 0.075, "h": 0.16, "anchorY": 0.184, "cols": [[0.08, 0.12, 0.155, 0.2]]}, {"id": "vending_1", "src": "/plaza/gather/props/vendingmachine_white_down.png", "x": 0.44, "y": 0.04, "w": 0.025, "h": 0.08, "anchorY": 0.112, "cols": [[0.44, 0.08, 0.465, 0.12]]}, {"id": "vending_2", "src": "/plaza/gather/props/vendingmachine_white_down.png", "x": 0.52, "y": 0.04, "w": 0.025, "h": 0.08, "anchorY": 0.112, "cols": [[0.52, 0.08, 0.545, 0.12]]}, {"id": "cubby_2", "src": "/plaza/gather/props/cubby_black_right.png", "x": 0.84, "y": 0.04, "w": 0.075, "h": 0.16, "anchorY": 0.184, "cols": [[0.84, 0.12, 0.915, 0.2]]}, {"id": "pool_table", "src": "/plaza/gather/props/pool_green_down.png", "x": 0.22, "y": 0.36, "w": 0.05, "h": 0.16, "anchorY": 0.504, "cols": [[0.222, 0.38, 0.268, 0.515]]}, {"id": "sofa_l", "src": "/plaza/gather/props/bigsofa_orange_left.png", "x": 0.6, "y": 0.35, "w": 0.025, "h": 0.16, "anchorY": 0.494, "cols": [[0.6, 0.38, 0.625, 0.5]]}, {"id": "coffee_tbl", "src": "/plaza/gather/props/table_coffee_tan_down.png", "x": 0.67, "y": 0.39, "w": 0.05, "h": 0.08, "anchorY": 0.462, "cols": [[0.672, 0.41, 0.718, 0.465]]}, {"id": "sofa_r", "src": "/plaza/gather/props/bigsofa_orange_right.png", "x": 0.76, "y": 0.35, "w": 0.025, "h": 0.16, "anchorY": 0.494, "cols": [[0.76, 0.38, 0.785, 0.5]]}, {"id": "bench_b1", "src": "/plaza/gather/props/bench_tan_down.png", "x": 0.22, "y": 0.8, "w": 0.075, "h": 0.04, "anchorY": 0.836, "cols": [[0.22, 0.81, 0.295, 0.84]]}, {"id": "bench_b2", "src": "/plaza/gather/props/bench_tan_down.png", "x": 0.68, "y": 0.8, "w": 0.075, "h": 0.04, "anchorY": 0.836, "cols": [[0.68, 0.81, 0.755, 0.84]]}];
export const GAME_ROOM_WALL_COLS: PlazaCollisionRect[] = [[0.0, 0.0, 1.0, 0.12], [0.0, 0.0, 0.025, 1.0], [0.975, 0.0, 1.0, 1.0], [0.0, 0.96, 1.0, 1.0]];

export const CAFE_PROPS: PlazaPropDef[] = [{"id": "fridge_1", "src": "/plaza/gather/props/fridge_grey_down.png", "x": 0.12, "y": 0.04, "w": 0.025, "h": 0.12, "anchorY": 0.148, "cols": [[0.12, 0.1, 0.145, 0.16]]}, {"id": "vending_cafe", "src": "/plaza/gather/props/vendingmachine_white_down.png", "x": 0.85, "y": 0.04, "w": 0.025, "h": 0.08, "anchorY": 0.112, "cols": [[0.85, 0.08, 0.875, 0.12]]}, {"id": "bar_1", "src": "/plaza/gather/props/countertop_marble_white_down.png", "x": 0.35, "y": 0.25, "w": 0.15, "h": 0.08, "anchorY": 0.322, "cols": [[0.352, 0.27, 0.498, 0.33]]}, {"id": "bar_2", "src": "/plaza/gather/props/countertop_marble_white_down.png", "x": 0.5, "y": 0.25, "w": 0.15, "h": 0.08, "anchorY": 0.322, "cols": [[0.502, 0.27, 0.648, 0.33]]}, {"id": "stool_1", "src": "/plaza/gather/props/stool_tall_blue_down.png", "x": 0.38, "y": 0.34, "w": 0.025, "h": 0.08, "anchorY": 0.412, "cols": []}, {"id": "stool_2", "src": "/plaza/gather/props/stool_tall_blue_down.png", "x": 0.49, "y": 0.34, "w": 0.025, "h": 0.08, "anchorY": 0.412, "cols": []}, {"id": "stool_3", "src": "/plaza/gather/props/stool_tall_blue_down.png", "x": 0.6, "y": 0.34, "w": 0.025, "h": 0.08, "anchorY": 0.412, "cols": []}, {"id": "dining_l", "src": "/plaza/gather/props/table_seats_tan_down.png", "x": 0.14, "y": 0.6, "w": 0.1, "h": 0.12, "anchorY": 0.708, "cols": [[0.142, 0.62, 0.238, 0.715]]}, {"id": "dining_r", "src": "/plaza/gather/props/table_seats_tan_down.png", "x": 0.76, "y": 0.6, "w": 0.1, "h": 0.12, "anchorY": 0.708, "cols": [[0.762, 0.62, 0.858, 0.715]]}, {"id": "cafe_plant_1", "src": "/plaza/gather/props/pottedplant3_large_white_down.png", "x": 0.05, "y": 0.4, "w": 0.075, "h": 0.12, "anchorY": 0.508, "cols": [[0.055, 0.46, 0.12, 0.515]]}, {"id": "cafe_plant_2", "src": "/plaza/gather/props/pottedplant3_large_white_down.png", "x": 0.875, "y": 0.4, "w": 0.075, "h": 0.12, "anchorY": 0.508, "cols": [[0.88, 0.46, 0.945, 0.515]]}];
export const CAFE_WALL_COLS: PlazaCollisionRect[] = [[0.0, 0.0, 1.0, 0.12], [0.0, 0.0, 0.025, 1.0], [0.975, 0.0, 1.0, 1.0], [0.0, 0.96, 1.0, 1.0]];

export const OFFICE_PROPS: PlazaPropDef[] = [{"id": "desk_l1", "src": "/plaza/gather/props/desk_drawers_white_down.png", "x": 0.18, "y": 0.3, "w": 0.05, "h": 0.08, "anchorY": 0.372, "cols": [[0.182, 0.33, 0.228, 0.38]]}, {"id": "comp_l1", "src": "/plaza/gather/props/computer_double_down.png", "x": 0.18, "y": 0.28, "w": 0.05, "h": 0.08, "anchorY": 0.352, "cols": []}, {"id": "chair_l1", "src": "/plaza/gather/props/officechair_black_up.png", "x": 0.19, "y": 0.39, "w": 0.025, "h": 0.08, "anchorY": 0.462, "cols": []}, {"id": "desk_l2", "src": "/plaza/gather/props/desk_drawers_white_down.png", "x": 0.28, "y": 0.3, "w": 0.05, "h": 0.08, "anchorY": 0.372, "cols": [[0.282, 0.33, 0.328, 0.38]]}, {"id": "comp_l2", "src": "/plaza/gather/props/computer_double_down.png", "x": 0.28, "y": 0.28, "w": 0.05, "h": 0.08, "anchorY": 0.352, "cols": []}, {"id": "chair_l2", "src": "/plaza/gather/props/officechair_orange_up.png", "x": 0.29, "y": 0.39, "w": 0.025, "h": 0.08, "anchorY": 0.462, "cols": []}, {"id": "glass_wall", "src": "/plaza/gather/props/fg_wall_mid_glass_left.png", "x": 0.36, "y": 0.32, "w": 0.27891, "h": 0.0475, "anchorY": 0.36275, "cols": [[0.36, 0.33, 0.638, 0.365]]}, {"id": "desk_r1", "src": "/plaza/gather/props/desk_drawers_white_down.png", "x": 0.67, "y": 0.3, "w": 0.05, "h": 0.08, "anchorY": 0.372, "cols": [[0.672, 0.33, 0.718, 0.38]]}, {"id": "comp_r1", "src": "/plaza/gather/props/computer_double_down.png", "x": 0.67, "y": 0.28, "w": 0.05, "h": 0.08, "anchorY": 0.352, "cols": []}, {"id": "chair_r1", "src": "/plaza/gather/props/officechair_pink_up.png", "x": 0.68, "y": 0.39, "w": 0.025, "h": 0.08, "anchorY": 0.462, "cols": []}, {"id": "desk_r2", "src": "/plaza/gather/props/desk_drawers_white_down.png", "x": 0.77, "y": 0.3, "w": 0.05, "h": 0.08, "anchorY": 0.372, "cols": [[0.772, 0.33, 0.818, 0.38]]}, {"id": "comp_r2", "src": "/plaza/gather/props/computer_double_down.png", "x": 0.77, "y": 0.28, "w": 0.05, "h": 0.08, "anchorY": 0.352, "cols": []}, {"id": "chair_r2", "src": "/plaza/gather/props/officechair_black_up.png", "x": 0.78, "y": 0.39, "w": 0.025, "h": 0.08, "anchorY": 0.462, "cols": []}, {"id": "off_plant_1", "src": "/plaza/gather/props/pottedplant4_tall_white_down.png", "x": 0.06, "y": 0.1, "w": 0.025, "h": 0.12, "anchorY": 0.208, "cols": [[0.06, 0.17, 0.085, 0.22]]}, {"id": "off_plant_2", "src": "/plaza/gather/props/pottedplant4_tall_white_down.png", "x": 0.91, "y": 0.1, "w": 0.025, "h": 0.12, "anchorY": 0.208, "cols": [[0.91, 0.17, 0.935, 0.22]]}];
export const OFFICE_WALL_COLS: PlazaCollisionRect[] = [[0.0, 0.0, 1.0, 0.12], [0.0, 0.0, 0.025, 1.0], [0.975, 0.0, 1.0, 1.0], [0.0, 0.96, 1.0, 1.0]];

export const PIANO_LOUNGE_PROPS: PlazaPropDef[] = [{"id": "bookshelf_p", "src": "/plaza/gather/props/bookshelf_white_down.png", "x": 0.12, "y": 0.04, "w": 0.05, "h": 0.08, "anchorY": 0.112, "cols": [[0.12, 0.06, 0.17, 0.12]]}, {"id": "lounge_plant_1", "src": "/plaza/gather/props/pottedplant1_tall_white_down.png", "x": 0.36, "y": 0.04, "w": 0.025, "h": 0.08, "anchorY": 0.112, "cols": [[0.36, 0.08, 0.385, 0.12]]}, {"id": "lounge_plant_2", "src": "/plaza/gather/props/pottedplant4_tall_white_down.png", "x": 0.88, "y": 0.04, "w": 0.025, "h": 0.12, "anchorY": 0.148, "cols": [[0.88, 0.11, 0.905, 0.16]]}, {"id": "grand_piano", "src": "/plaza/gather/props/piano_grand_down.png", "x": 0.18, "y": 0.38, "w": 0.05, "h": 0.08, "anchorY": 0.452, "cols": [[0.182, 0.4, 0.228, 0.455]]}, {"id": "guitar_stand", "src": "/plaza/gather/props/guitar_stand_left.png", "x": 0.26, "y": 0.4, "w": 0.025, "h": 0.08, "anchorY": 0.472, "cols": [[0.26, 0.44, 0.285, 0.475]]}, {"id": "sofa_top", "src": "/plaza/gather/props/bigsofa_orange_down.png", "x": 0.6, "y": 0.32, "w": 0.075, "h": 0.08, "anchorY": 0.392, "cols": [[0.602, 0.34, 0.673, 0.395]]}, {"id": "sofa_left", "src": "/plaza/gather/props/bigsofa_orange_left.png", "x": 0.54, "y": 0.38, "w": 0.025, "h": 0.16, "anchorY": 0.524, "cols": [[0.54, 0.41, 0.565, 0.535]]}, {"id": "coffee_table_main", "src": "/plaza/gather/props/table_coffee_tan_down.png", "x": 0.6125, "y": 0.42, "w": 0.05, "h": 0.08, "anchorY": 0.492, "cols": [[0.615, 0.44, 0.66, 0.495]]}, {"id": "sofa_right", "src": "/plaza/gather/props/bigsofa_orange_right.png", "x": 0.71, "y": 0.38, "w": 0.025, "h": 0.16, "anchorY": 0.524, "cols": [[0.71, 0.41, 0.735, 0.535]]}, {"id": "sofa_bottom", "src": "/plaza/gather/props/bigsofa_tan_up.png", "x": 0.6, "y": 0.56, "w": 0.075, "h": 0.08, "anchorY": 0.632, "cols": []}];
export const PIANO_LOUNGE_WALL_COLS: PlazaCollisionRect[] = [[0.0, 0.0, 1.0, 0.12], [0.0, 0.0, 0.025, 1.0], [0.975, 0.0, 1.0, 1.0], [0.0, 0.96, 1.0, 1.0]];

export const FOUNTAIN_TERRACE_PROPS: PlazaPropDef[] = [{"id": "bamboo_t1", "src": "/plaza/gather/props/pottedplant3_large_white_down.png", "x": 0.32, "y": 0.04, "w": 0.075, "h": 0.12, "anchorY": 0.148, "cols": [[0.325, 0.1, 0.39, 0.155]]}, {"id": "bamboo_t2", "src": "/plaza/gather/props/pottedplant3_large_white_down.png", "x": 0.4625, "y": 0.04, "w": 0.075, "h": 0.12, "anchorY": 0.148, "cols": [[0.467, 0.1, 0.532, 0.155]]}, {"id": "bamboo_t3", "src": "/plaza/gather/props/pottedplant3_large_white_down.png", "x": 0.605, "y": 0.04, "w": 0.075, "h": 0.12, "anchorY": 0.148, "cols": [[0.61, 0.1, 0.675, 0.155]]}, {"id": "terrace_oak_l", "src": "/plaza/gather/props/oak_tree_green.png", "x": 0.06, "y": 0.2, "w": 0.075, "h": 0.16, "anchorY": 0.344, "cols": [[0.08, 0.3, 0.115, 0.355]]}, {"id": "terrace_oak_r", "src": "/plaza/gather/props/oak_tree_green.png", "x": 0.865, "y": 0.2, "w": 0.075, "h": 0.16, "anchorY": 0.344, "cols": [[0.885, 0.3, 0.92, 0.355]]}, {"id": "terrace_fountain", "src": "/plaza/gather/props/fountain_medium.png", "x": 0.4375, "y": 0.38, "w": 0.125, "h": 0.16, "anchorY": 0.524, "cols": [[0.445, 0.43, 0.555, 0.535]]}, {"id": "corner_seat_l", "src": "/plaza/gather/props/seating_corner_long_yellow_down.png", "x": 0.14, "y": 0.42, "w": 0.15, "h": 0.12, "anchorY": 0.528, "cols": [[0.145, 0.45, 0.285, 0.535]]}, {"id": "corner_seat_r", "src": "/plaza/gather/props/seating_corner_long_yellow_down.png", "x": 0.71, "y": 0.42, "w": 0.15, "h": 0.12, "anchorY": 0.528, "cols": [[0.715, 0.45, 0.855, 0.535]]}, {"id": "f_bench_1", "src": "/plaza/gather/props/bench_tan_down.png", "x": 0.32, "y": 0.65, "w": 0.075, "h": 0.04, "anchorY": 0.686, "cols": [[0.32, 0.66, 0.395, 0.69]]}, {"id": "f_bench_2", "src": "/plaza/gather/props/bench_tan_down.png", "x": 0.605, "y": 0.65, "w": 0.075, "h": 0.04, "anchorY": 0.686, "cols": [[0.605, 0.66, 0.68, 0.69]]}];
export const FOUNTAIN_TERRACE_WALL_COLS: PlazaCollisionRect[] = [[0.0, 0.0, 1.0, 0.12], [0.0, 0.0, 0.025, 1.0], [0.975, 0.0, 1.0, 1.0], [0.0, 0.96, 1.0, 1.0]];

export const NIGHT_PARK_PROPS: PlazaPropDef[] = [{"id": "night_pine_1", "src": "/plaza/gather/props/tree_pine_viridian_down.png", "x": 0.06, "y": 0.02, "w": 0.075, "h": 0.2, "anchorY": 0.2, "cols": [[0.08, 0.17, 0.115, 0.215]]}, {"id": "night_pine_2", "src": "/plaza/gather/props/tree_pine_viridian_down.png", "x": 0.25, "y": 0.02, "w": 0.075, "h": 0.2, "anchorY": 0.2, "cols": [[0.27, 0.17, 0.305, 0.215]]}, {"id": "night_pine_3", "src": "/plaza/gather/props/tree_pine_viridian_down.png", "x": 0.67, "y": 0.02, "w": 0.075, "h": 0.2, "anchorY": 0.2, "cols": [[0.69, 0.17, 0.725, 0.215]]}, {"id": "night_pine_4", "src": "/plaza/gather/props/tree_pine_viridian_down.png", "x": 0.865, "y": 0.02, "w": 0.075, "h": 0.2, "anchorY": 0.2, "cols": [[0.885, 0.17, 0.92, 0.215]]}, {"id": "night_fountain", "src": "/plaza/gather/props/fountain_medium.png", "x": 0.4375, "y": 0.4, "w": 0.125, "h": 0.16, "anchorY": 0.544, "cols": [[0.445, 0.45, 0.555, 0.555]]}, {"id": "night_bench_l", "src": "/plaza/gather/props/bench_tan_down.png", "x": 0.3, "y": 0.46, "w": 0.075, "h": 0.04, "anchorY": 0.496, "cols": [[0.3, 0.47, 0.375, 0.5]]}, {"id": "night_bench_r", "src": "/plaza/gather/props/bench_tan_down.png", "x": 0.625, "y": 0.46, "w": 0.075, "h": 0.04, "anchorY": 0.496, "cols": [[0.625, 0.47, 0.7, 0.5]]}, {"id": "night_bench_bl", "src": "/plaza/gather/props/bench_tan_down.png", "x": 0.2, "y": 0.75, "w": 0.075, "h": 0.04, "anchorY": 0.786, "cols": [[0.2, 0.76, 0.275, 0.79]]}, {"id": "night_bench_br", "src": "/plaza/gather/props/bench_tan_down.png", "x": 0.725, "y": 0.75, "w": 0.075, "h": 0.04, "anchorY": 0.786, "cols": [[0.725, 0.76, 0.8, 0.79]]}, {"id": "night_plant_1", "src": "/plaza/gather/props/pottedplant4_tall_white_down.png", "x": 0.12, "y": 0.55, "w": 0.025, "h": 0.12, "anchorY": 0.658, "cols": [[0.12, 0.62, 0.145, 0.67]]}, {"id": "night_plant_2", "src": "/plaza/gather/props/pottedplant4_tall_white_down.png", "x": 0.855, "y": 0.55, "w": 0.025, "h": 0.12, "anchorY": 0.658, "cols": [[0.855, 0.62, 0.88, 0.67]]}];
export const NIGHT_PARK_WALL_COLS: PlazaCollisionRect[] = [[0.0, 0.0, 1.0, 0.12], [0.0, 0.0, 0.025, 1.0], [0.975, 0.0, 1.0, 1.0], [0.0, 0.96, 1.0, 1.0]];
export const CAMP_MOUNTAIN_PROPS: PlazaPropDef[] = [{"id": "pine_t0", "src": "/plaza/gather/props/tree_pine_viridian_down.png", "x": 0.02, "y": -0.04, "w": 0.075, "h": 0.2, "anchorY": 0.14, "cols": [[0.035, 0.1, 0.08, 0.14]]}, {"id": "pine_t1", "src": "/plaza/gather/props/tree_pine_viridian_down.png", "x": 0.12, "y": -0.04, "w": 0.075, "h": 0.2, "anchorY": 0.14, "cols": [[0.135, 0.1, 0.18, 0.14]]}, {"id": "pine_t2", "src": "/plaza/gather/props/tree_pine_viridian_down.png", "x": 0.22, "y": -0.04, "w": 0.075, "h": 0.2, "anchorY": 0.14, "cols": [[0.235, 0.1, 0.28, 0.14]]}, {"id": "pine_t3", "src": "/plaza/gather/props/tree_pine_viridian_down.png", "x": 0.32, "y": -0.04, "w": 0.075, "h": 0.2, "anchorY": 0.14, "cols": [[0.335, 0.1, 0.38, 0.14]]}, {"id": "pine_t4", "src": "/plaza/gather/props/tree_pine_viridian_down.png", "x": 0.42, "y": -0.04, "w": 0.075, "h": 0.2, "anchorY": 0.14, "cols": [[0.435, 0.1, 0.48, 0.14]]}, {"id": "pine_t5", "src": "/plaza/gather/props/tree_pine_viridian_down.png", "x": 0.52, "y": -0.04, "w": 0.075, "h": 0.2, "anchorY": 0.14, "cols": [[0.535, 0.1, 0.58, 0.14]]}, {"id": "pine_t6", "src": "/plaza/gather/props/tree_pine_viridian_down.png", "x": 0.62, "y": -0.04, "w": 0.075, "h": 0.2, "anchorY": 0.14, "cols": [[0.635, 0.1, 0.68, 0.14]]}, {"id": "pine_t7", "src": "/plaza/gather/props/tree_pine_viridian_down.png", "x": 0.72, "y": -0.04, "w": 0.075, "h": 0.2, "anchorY": 0.14, "cols": [[0.735, 0.1, 0.78, 0.14]]}, {"id": "pine_t8", "src": "/plaza/gather/props/tree_pine_viridian_down.png", "x": 0.82, "y": -0.04, "w": 0.075, "h": 0.2, "anchorY": 0.14, "cols": [[0.835, 0.1, 0.88, 0.14]]}, {"id": "pine_t9", "src": "/plaza/gather/props/tree_pine_viridian_down.png", "x": 0.92, "y": -0.04, "w": 0.075, "h": 0.2, "anchorY": 0.14, "cols": [[0.935, 0.1, 0.98, 0.14]]}, {"id": "pine_l1", "src": "/plaza/gather/props/tree_pine_viridian_down.png", "x": 0.02, "y": 0.28, "w": 0.075, "h": 0.2, "anchorY": 0.46, "cols": [[0.035, 0.42, 0.08, 0.46]]}, {"id": "pine_l2", "src": "/plaza/gather/props/tree_pine_viridian_down.png", "x": 0.02, "y": 0.58, "w": 0.075, "h": 0.2, "anchorY": 0.76, "cols": [[0.035, 0.72, 0.08, 0.76]]}, {"id": "pine_r1", "src": "/plaza/gather/props/tree_pine_viridian_down.png", "x": 0.9, "y": 0.28, "w": 0.075, "h": 0.2, "anchorY": 0.46, "cols": [[0.915, 0.42, 0.96, 0.46]]}, {"id": "pine_r2", "src": "/plaza/gather/props/tree_pine_viridian_down.png", "x": 0.9, "y": 0.58, "w": 0.075, "h": 0.2, "anchorY": 0.76, "cols": [[0.915, 0.72, 0.96, 0.76]]}, {"id": "tent_yellow", "src": "/plaza/gather/props/canvas_tent_yellow_down.png", "x": 0.14, "y": 0.26, "w": 0.075, "h": 0.12, "anchorY": 0.368, "cols": [[0.145, 0.3, 0.21, 0.375]]}, {"id": "tent_green", "src": "/plaza/gather/props/canvas_tent_green_down.png", "x": 0.78, "y": 0.26, "w": 0.075, "h": 0.12, "anchorY": 0.368, "cols": [[0.785, 0.3, 0.85, 0.375]]}, {"id": "campfire", "src": "/plaza/gather/props/campfire_darkwood.png", "x": 0.4875, "y": 0.5, "w": 0.025, "h": 0.04, "anchorY": 0.536, "cols": [[0.489, 0.51, 0.511, 0.538]]}, {"id": "stump_top", "src": "/plaza/gather/props/stump1.png", "x": 0.475, "y": 0.38, "w": 0.05, "h": 0.08, "anchorY": 0.452, "cols": []}, {"id": "stump_bot", "src": "/plaza/gather/props/stump1.png", "x": 0.475, "y": 0.6, "w": 0.05, "h": 0.08, "anchorY": 0.672, "cols": []}, {"id": "log_left", "src": "/plaza/gather/props/bench_tan_down.png", "x": 0.36, "y": 0.5, "w": 0.075, "h": 0.04, "anchorY": 0.536, "cols": []}, {"id": "log_right", "src": "/plaza/gather/props/bench_tan_down.png", "x": 0.57, "y": 0.5, "w": 0.075, "h": 0.04, "anchorY": 0.536, "cols": []}, {"id": "stump_pile", "src": "/plaza/gather/props/stumps2.png", "x": 0.15, "y": 0.7, "w": 0.075, "h": 0.12, "anchorY": 0.808, "cols": [[0.16, 0.75, 0.22, 0.81]]}];
export const CAMP_MOUNTAIN_WALL_COLS: PlazaCollisionRect[] = [[0.0, 0.0, 1.0, 0.12], [0.0, 0.0, 0.02, 1.0], [0.98, 0.0, 1.0, 1.0], [0.0, 0.96, 1.0, 1.0]];

export const CHRISTMAS_PARTY_PROPS: PlazaPropDef[] = [{"id": "bunting_l", "src": "/plaza/gather/props/bunting_christmas_big_red.png", "x": 0.18, "y": 0.01, "w": 0.075, "h": 0.08, "anchorY": 0.082, "cols": []}, {"id": "bunting_r", "src": "/plaza/gather/props/bunting_christmas_big_green.png", "x": 0.74, "y": 0.01, "w": 0.075, "h": 0.08, "anchorY": 0.082, "cols": []}, {"id": "fireplace", "src": "/plaza/gather/props/fireplace.png", "x": 0.475, "y": 0.01, "w": 0.05, "h": 0.12, "anchorY": 0.118, "cols": [[0.478, 0.04, 0.522, 0.125]]}, {"id": "xmas_tree", "src": "/plaza/gather/props/Christmas_Tree_red.png", "x": 0.4625, "y": 0.32, "w": 0.075, "h": 0.16, "anchorY": 0.464, "cols": [[0.488, 0.44, 0.512, 0.475]]}, {"id": "present_1", "src": "/plaza/gather/props/present_stack.png", "x": 0.435, "y": 0.45, "w": 0.025, "h": 0.04, "anchorY": 0.486, "cols": []}, {"id": "present_2", "src": "/plaza/gather/props/present_large_green.png", "x": 0.54, "y": 0.45, "w": 0.025, "h": 0.04, "anchorY": 0.486, "cols": []}, {"id": "present_3", "src": "/plaza/gather/props/present_red_2.png", "x": 0.45, "y": 0.48, "w": 0.025, "h": 0.04, "anchorY": 0.516, "cols": []}, {"id": "present_4", "src": "/plaza/gather/props/present_medium_blue.png", "x": 0.525, "y": 0.48, "w": 0.025, "h": 0.04, "anchorY": 0.516, "cols": []}, {"id": "sofa_l", "src": "/plaza/gather/props/bigsofa_orange_down.png", "x": 0.18, "y": 0.38, "w": 0.075, "h": 0.08, "anchorY": 0.452, "cols": [[0.182, 0.4, 0.253, 0.455]]}, {"id": "table_l", "src": "/plaza/gather/props/table_coffee_tan_down.png", "x": 0.1925, "y": 0.48, "w": 0.05, "h": 0.08, "anchorY": 0.552, "cols": [[0.195, 0.5, 0.24, 0.555]]}, {"id": "chair_l", "src": "/plaza/gather/props/chair1_orange_right.png", "x": 0.13, "y": 0.44, "w": 0.025, "h": 0.08, "anchorY": 0.512, "cols": []}, {"id": "sofa_r", "src": "/plaza/gather/props/bigsofa_orange_down.png", "x": 0.74, "y": 0.38, "w": 0.075, "h": 0.08, "anchorY": 0.452, "cols": [[0.742, 0.4, 0.813, 0.455]]}, {"id": "table_r", "src": "/plaza/gather/props/table_coffee_tan_down.png", "x": 0.7525, "y": 0.48, "w": 0.05, "h": 0.08, "anchorY": 0.552, "cols": [[0.755, 0.5, 0.8, 0.555]]}, {"id": "chair_r", "src": "/plaza/gather/props/chair1_orange_left.png", "x": 0.84, "y": 0.44, "w": 0.025, "h": 0.08, "anchorY": 0.512, "cols": []}, {"id": "plant_l", "src": "/plaza/gather/props/pottedplant1_tall_white_down.png", "x": 0.06, "y": 0.08, "w": 0.025, "h": 0.08, "anchorY": 0.152, "cols": [[0.06, 0.12, 0.085, 0.155]]}, {"id": "plant_r", "src": "/plaza/gather/props/pottedplant1_tall_white_down.png", "x": 0.91, "y": 0.08, "w": 0.025, "h": 0.08, "anchorY": 0.152, "cols": [[0.91, 0.12, 0.935, 0.155]]}];
export const CHRISTMAS_PARTY_WALL_COLS: PlazaCollisionRect[] = [[0.0, 0.0, 1.0, 0.12], [0.0, 0.0, 0.02, 1.0], [0.98, 0.0, 1.0, 1.0], [0.0, 0.96, 1.0, 1.0]];

export const SPEAKEASY_WALL_COLS: PlazaCollisionRect[] = [
  [0.0, 0.0, 0.125, 1.0], [0.875, 0.0, 1.0, 1.0],
  [0.125, 0.0, 0.875, 0.188],
  [0.125, 0.868, 0.875, 1.0],
  [0.125, 0.188, 0.150, 0.868],
  [0.850, 0.188, 0.875, 0.868],
  [0.370, 0.188, 0.630, 0.400],
  [0.125, 0.670, 0.155, 0.840],
  [0.150, 0.380, 0.215, 0.480],
  [0.150, 0.540, 0.215, 0.640],
  [0.785, 0.220, 0.850, 0.320],
  [0.785, 0.380, 0.850, 0.480],
  [0.785, 0.580, 0.850, 0.680],
  [0.785, 0.740, 0.850, 0.840],
];

export const WINTER_LODGE_WALL_COLS: PlazaCollisionRect[] = [
  [0.0, 0.0, 0.125, 1.0], [0.875, 0.0, 1.0, 1.0],
  [0.125, 0.0, 0.875, 0.116],
  [0.125, 0.892, 0.875, 1.0],
  [0.125, 0.116, 0.150, 0.892],
  [0.850, 0.116, 0.875, 0.892],
  [0.473, 0.100, 0.498, 0.400],
  [0.498, 0.345, 0.600, 0.395],
  [0.720, 0.345, 0.850, 0.395],
];

export const RETRO_DINER_WALL_COLS: PlazaCollisionRect[] = [
  [0.0, 0.0, 0.200, 1.0], [0.800, 0.0, 1.0, 1.0],
  [0.200, 0.0, 0.800, 0.170],
  [0.200, 0.925, 0.435, 1.0], [0.565, 0.925, 0.800, 1.0],
  [0.200, 0.170, 0.232, 0.925],
  [0.768, 0.170, 0.800, 0.925],
  [0.348, 0.260, 0.650, 0.355],
  [0.232, 0.165, 0.358, 0.310],
  [0.232, 0.480, 0.358, 0.650],
  [0.232, 0.685, 0.358, 0.895],
  [0.358, 0.480, 0.470, 0.650],
  [0.672, 0.145, 0.768, 0.350],
  [0.530, 0.480, 0.768, 0.650],
  [0.528, 0.655, 0.652, 0.845],
  [0.370, 0.680, 0.480, 0.770],
  [0.370, 0.815, 0.480, 0.900],
  [0.708, 0.685, 0.768, 0.725],
  [0.708, 0.885, 0.768, 0.925],
];

export const LIVING_ROOM_WALL_COLS: PlazaCollisionRect[] = [
  [0.0, 0.0, 0.250, 1.0], [0.750, 0.0, 1.0, 1.0],
  [0.250, 0.0, 0.750, 0.140],
  [0.250, 0.800, 0.750, 1.0],
  [0.250, 0.140, 0.275, 0.800],
  [0.725, 0.140, 0.750, 0.800],
  [0.525, 0.140, 0.625, 0.260],
  [0.298, 0.140, 0.402, 0.250],
  [0.485, 0.315, 0.652, 0.460],
  [0.703, 0.210, 0.725, 0.420],
  [0.420, 0.530, 0.555, 0.745],
  [0.640, 0.590, 0.725, 0.760],
  [0.275, 0.490, 0.375, 0.800],
];



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
  if (!themeDef) return false;
  const hasWalls = Boolean(themeDef.wallCols && themeDef.wallCols.length > 0);
  const hasProps = Boolean(themeDef.props && themeDef.props.length > 0);
  if (!hasWalls && !hasProps) return false;
  const left = x - hw;
  const right = x + hw;
  const top = y - hh;
  const bottom = y + hh;

  // 1. 외곽 벽면 및 맵 장애물 충돌 검사
  if (themeDef.wallCols) {
    for (const r of themeDef.wallCols) {
      if (right > r[0] && left < r[2] && bottom > r[1] && top < r[3]) return true;
    }
  }
  // 2. 가구/장애물 에셋 충돌 검사
  if (themeDef.props) {
    for (const prop of themeDef.props) {
      if (!prop || !prop.cols) continue;
      for (const r of prop.cols) {
        if (right > r[0] && left < r[2] && bottom > r[1] && top < r[3]) return true;
      }
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
  if (!themeDef) return clamped;
  const hasWalls = Boolean(themeDef.wallCols && themeDef.wallCols.length > 0);
  const hasProps = Boolean(themeDef.props && themeDef.props.length > 0);
  if (!hasWalls && !hasProps) return clamped;
  const isClear = (point: PlazaPos) => clearWalkSegment(from, point, p => isBlockedInTheme(p.x, p.y, themeDef));
  if (isClear(clamped)) return clamped;

  // 1. X축 슬라이딩 (수직 장애물 측면을 부드럽게 미끄러지듯 이동)
  if (isClear({ x: clamped.x, y: from.y })) {
    return { x: clamped.x, y: from.y };
  }
  // 2. Y축 슬라이딩 (수평 장애물 상하면을 부드럽게 미끄러지듯 이동)
  if (isClear({ x: from.x, y: clamped.y })) {
    return { x: from.x, y: clamped.y };
  }
  // 3. 45도 모서리 진입 시 미세 스텝 보간 (코너 걸림 방지)
  const halfX = from.x + (clamped.x - from.x) * 0.5;
  const halfY = from.y + (clamped.y - from.y) * 0.5;
  if (isClear({ x: halfX, y: from.y })) return { x: halfX, y: from.y };
  if (isClear({ x: from.x, y: halfY })) return { x: from.x, y: halfY };

  return from;
};

export const isPlazaMove = (v: any): v is PlazaMove =>
  v &&
  typeof v === "object" &&
  ["x", "y", "tx", "ty"].every((k) => typeof v[k] === "number" && Number.isFinite(v[k]));

/** 좌석 번호 기준 기본 위치 (테마별 안전 스폰 보정) */
export const defaultPlazaPos = (slotIdx: number = 0, themeId?: PlazaThemeId): PlazaPos => {
  const safeIdx = typeof slotIdx === "number" && !isNaN(slotIdx) ? Math.max(0, slotIdx) : 0;
  const s = safeIdx % 10;
  if (themeId === "garden_lounge") return { x: 0.33 + (s % 5) * 0.085, y: s < 5 ? 0.60 : 0.72 };
  if (themeId === "winter_lodge") {
    const slots = [
      { x: 0.32, y: 0.45 }, { x: 0.38, y: 0.45 }, { x: 0.62, y: 0.45 }, { x: 0.68, y: 0.45 }, { x: 0.50, y: 0.44 },
      { x: 0.32, y: 0.52 }, { x: 0.38, y: 0.52 }, { x: 0.62, y: 0.52 }, { x: 0.68, y: 0.52 }, { x: 0.50, y: 0.68 },
    ];
    return clampPlazaPos(slots[s]);
  }
  if (themeId === "retro_diner") {
    const slots = [
      { x: 0.53, y: 0.62 }, { x: 0.58, y: 0.62 },
      { x: 0.53, y: 0.67 }, { x: 0.58, y: 0.67 },
      { x: 0.53, y: 0.72 }, { x: 0.58, y: 0.72 },
      { x: 0.53, y: 0.77 }, { x: 0.58, y: 0.77 },
      { x: 0.53, y: 0.82 }, { x: 0.58, y: 0.82 },
    ];
    return clampPlazaPos(slots[s]);
  }
  if (themeId === "living_room") {
    const col = s % 5;
    const row = s < 5 ? 0 : 1;
    return clampPlazaPos({ x: 0.43 + col * 0.035, y: 0.62 + row * 0.06 });
  }
  if (themeId === "speakeasy") {
    const col = s % 5;
    const row = s < 5 ? 0 : 1;
    return clampPlazaPos({ x: 0.36 + col * 0.065 + row * 0.02, y: 0.62 + row * 0.08 });
  }
  const col = safeIdx % 5;
  const row = safeIdx < 5 ? 0 : 1;
  return clampPlazaPos({ x: 0.35 + col * 0.07 + row * 0.02, y: 0.58 + row * 0.08 });
};

/* ----------------------------- 캐릭터 SVG ----------------------------- */

export type PlazaDirection = "down" | "up" | "left" | "right";
export type PlazaPose = "laugh" | "sad" | "wave" | "talk" | "sit" | "lie" | "jump" | SocialAction;

export function CharacterSprite({ id, dir = "down", facing = 1, walking = false, talking = false, pose = null, poseInfo, className = "" }: {
  id: CharacterId;
  dir?: PlazaDirection;
  facing?: 1 | -1;
  walking?: boolean;
  walkFrame?: number;
  talking?: boolean;
  pose?: PlazaPose | null;
  poseInfo?: SpritePoseInfo;
  className?: string;
}) {
  return <RoomCharacterSprite id={normalizeCharacterId(id)} dir={dir} facing={facing}
    walking={walking} talking={talking} pose={pose} poseInfo={poseInfo} className={className} />;
}

/* ----------------------------- 광장 테마 (캐릭터 모드 전용 배경 스킨) ----------------------------- */

export type PlazaThemeId =
  | "garden_lounge"
  | "lounge"
  | "camp_mountain"
  | "christmas_party"
  | "speakeasy"
  | "winter_lodge"
  | "retro_diner"
  | "living_room"
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
  smooth?: boolean;
  skyClass: string;
  floorBg: string;
  decor: { kind: DecorKind; x: number; y: number }[];
  props?: PlazaPropDef[];
  wallCols?: PlazaCollisionRect[];
};

export const PLAZA_THEMES: PlazaThemeDef[] = [GARDEN_LOUNGE_THEME];
export const DEFAULT_PLAZA_THEME: PlazaThemeId = "garden_lounge";

export const isPlazaThemeId = (v: unknown): v is PlazaThemeId =>
  typeof v === "string" && PLAZA_THEMES.some((t) => t.id === v);

/* ----------------------------- 광장 씬 ----------------------------- */

export type PlazaInteractionRequest = { id: string; targetNick: string; actionType: SocialAction };
export type PlazaInteractionArrival = PlazaInteractionRequest & { from: PlazaPos; to: PlazaPos; fromFacing: 1 | -1 };

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
  poseInfo?: SpritePoseInfo;
  bubble?: { id: string; text: string; whisper?: boolean };
  status?: string;
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
  interactionRequest,
  onInteractionReady,
  onInteractionCancel,
}: {
  actors: PlazaActor[];
  theme?: PlazaThemeId;
  hasSkin?: boolean;
  onMyMove: (from: PlazaPos, to: PlazaPos) => void;
  onActorClick: (actor: PlazaActor) => void;
  registerActorEl: (slotIdx: number, el: HTMLDivElement | null) => void;
  hint?: string;
  interactionRequest?: PlazaInteractionRequest | null;
  onInteractionReady?: (arrival: PlazaInteractionArrival) => void;
  onInteractionCancel?: () => void;
}) {
  const activeTheme = (theme && PLAZA_THEMES.find((t) => t.id === theme)) || PLAZA_THEMES[0] || { id: "lounge", name: "픽셀 광장", icon: "☕", desc: "", skyClass: "bg-slate-950", floorBg: "#242130", decor: [] };
  const activeThemeRef = useRef<PlazaThemeDef>(activeTheme);
  activeThemeRef.current = activeTheme;

  // 스킨 테마 변경 시 카메라 초기화 및 가구/벽 안 갇힘 방지 안전 탈출
  useEffect(() => {
    hasInitCamRef.current = false;
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
  const routeRef = useRef<PlazaPos[]>([]);
  const approachRef = useRef<{request: PlazaInteractionRequest; goal?: PlazaPos; target?: PlazaPos; facing: 1 | -1; plannedAt: number} | null>(null);
  const readyRef = useRef(onInteractionReady);
  const cancelRef = useRef(onInteractionCancel);
  readyRef.current = onInteractionReady;
  cancelRef.current = onInteractionCancel;
  const [navigationNotice, setNavigationNotice] = useState("");
  const cancelNavigation = (notice = "") => {
    const wasMoving = Boolean(routeRef.current.length || approachRef.current);
    const hadInteraction = Boolean(approachRef.current);
    routeRef.current = [];
    approachRef.current = null;
    if (hadInteraction) cancelRef.current?.();
    const me = actorsRef.current.find(a => a.isMe);
    const p = me ? posRef.current[me.nick] : null;
    if (wasMoving && p) {
      p.tx = p.x; p.ty = p.y; p.lastMovedAt = 0;
      onMyMoveRef.current({ x: p.x, y: p.y }, { x: p.x, y: p.y });
    }
    setNavigationNotice(notice);
  };
  useEffect(() => {
    routeRef.current = [];
    approachRef.current = interactionRequest ? { request: interactionRequest, facing: 1, plannedAt: 0 } : null;
    if (interactionRequest) setNavigationNotice("상대에게 걸어가는 중…");
  }, [interactionRequest?.id]);
  useEffect(() => { routeRef.current = []; approachRef.current = null; cancelRef.current?.(); }, [theme]);

  const [sceneSize, setSceneSize] = useState({ w: 800, h: 400 });
  const sceneSizeRef = useRef({ w: 800, h: 400 });
  const worldElRef = useRef<HTMLDivElement>(null);
  const camPosRef = useRef({ x: 0, y: 0 });
  const hasInitCamRef = useRef(false);


  actorsRef.current = actors;
  onMyMoveRef.current = onMyMove;

  // 외부(동기화)에서 들어온 이동 정보 반영
  const live = posRef.current;
  const present = new Set<string>();
  actors.forEach((a) => {
    present.add(a.nick);
    const cur = live[a.nick];
    if (!cur) {
      const start = a.move ? clampPlazaPos({ x: a.move.tx, y: a.move.ty }) : defaultPlazaPos(a.slotIdx, activeTheme.id);
      live[a.nick] = { x: start.x, y: start.y, tx: start.x, ty: start.y, facing: 1, dir: "down", lastMovedAt: 0, src: a.move };
      return;
    }
    if (a.isMe && a.move && a.move !== cur.src && a.move.x === a.move.tx && a.move.y === a.move.ty) {
      const to = clampPlazaPos({ x: a.move.tx, y: a.move.ty });
      cur.x = cur.tx = to.x;
      cur.y = cur.ty = to.y;
      cur.src = a.move;
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

  // 씬 크기 측정 (캐릭터 크기 및 카메라 뷰포트 결정)
  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth || 800;
      const h = el.clientHeight || 400;
      sceneSizeRef.current = { w, h };
      setSceneSize({ w, h });
    };
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
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let changed = false;
      const me = actorsRef.current.find((a) => a.isMe);

      const keys = keysRef.current;
      const wallNow = Date.now();
      const locked = new Set(actorsRef.current.filter(a => a.pose === "jump" || (isSocialAction(a.pose) && (a.poseInfo?.role === "receive" || (a.poseInfo?.startedAt ?? 0) <= wallNow))).map(a => a.nick));
      if (me && locked.has(me.nick)) keys.clear();
      if (keys.size && (routeRef.current.length || approachRef.current)) cancelNavigation();
      const approach = approachRef.current;
      if (approach && me) {
        const p = posRef.current[me.nick];
        const other = actorsRef.current.find(a => a.nick === approach.request.targetNick);
        const target = other ? posRef.current[other.nick] : null;
        const blocked = (point: PlazaPos) => point.x < MIN_X || point.x > MAX_X || point.y < MIN_Y || point.y > MAX_Y || isBlockedInTheme(point.x, point.y, activeThemeRef.current);
        if (!p || !target || locked.has(me.nick) || (other?.pose === "jump" || isSocialAction(other?.pose))) {
          cancelNavigation("상대의 상태가 바뀌어 접근을 취소했어요.");
        } else {
          const height = Math.max(720, sceneSizeRef.current.h, sceneSizeRef.current.w / 1.6);
          const width = Math.max(1200, height * 1.6, sceneSizeRef.current.w);
          const size = Math.max(52, Math.min(80, height * 0.12)) * 0.68 * 1.4;
          const contact = socialContactOffset(approach.request.actionType, characterScale(me.character), characterScale(other!.character), size);
          const gap = contact.gap / width;
          const targetMoved = !approach.target || walkDistance(target, approach.target) > 0.006;
          if (!approach.goal || (targetMoved && now - approach.plannedAt > 250)) {
            let choice: { goal: PlazaPos; path: PlazaPos[]; facing: 1 | -1; length: number } | null = null;
            for (const facing of [1, -1] as const) {
              const goal = { x: target.x - facing * gap, y: target.y + contact.footY / height };
              const path = findWalkPath(p, goal, blocked);
              if (!path) continue;
              const length = walkPathLength(p, path);
              if (!choice || length < choice.length) choice = { goal, path, facing, length };
            }
            if (!choice) cancelNavigation("상대에게 갈 수 있는 길이 없어요.");
            else {
              approach.goal = choice.goal; approach.target = {x: target.x, y: target.y}; approach.facing = choice.facing; approach.plannedAt = now;
              routeRef.current = choice.path;
              const next = choice.path[0]; p.tx = next.x; p.ty = next.y;
              onMyMoveRef.current({x:p.x,y:p.y}, next);
              changed = true;
            }
          }
          if (approachRef.current && approach.goal && walkDistance(p, approach.goal) < 0.0025 && walkDistance(target, approach.target!) < 0.006 && !routeRef.current.length) {
            p.tx = p.x; p.ty = p.y; p.facing = approach.facing; p.lastMovedAt = 0;
            approachRef.current = null; setNavigationNotice("");
            onMyMoveRef.current({x:p.x,y:p.y}, {x:p.x,y:p.y});
            readyRef.current?.({...approach.request, from:{x:p.x,y:p.y}, to:{x:target.x,y:target.y}, fromFacing:approach.facing});
          }
        }
      }
      if (me && posRef.current[me.nick] && !locked.has(me.nick)) {
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

      Object.entries(posRef.current).forEach(([nick, p]) => {
        if (locked.has(nick)) { p.tx = p.x; p.ty = p.y; p.lastMovedAt = 0; return; }
        if (me?.nick === nick && routeRef.current.length && walkDistance(p, routeRef.current[0]) < 0.0025) {
          const reached = routeRef.current.shift()!;
          p.x = reached.x; p.y = reached.y;
          const next = routeRef.current[0] ?? reached;
          p.tx = next.x; p.ty = next.y;
          onMyMoveRef.current({x:p.x,y:p.y}, next);
          changed = true;
        }
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
            cancelNavigation("이동 경로가 막혔어요. 다시 선택해 주세요.");
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
        if (me?.nick === nick && routeRef.current.length && now - lastKeySendRef.current > 120) {
          lastKeySendRef.current = now;
          onMyMoveRef.current({x:p.x,y:p.y}, {x:p.tx,y:p.ty});
        }
      });

      // 2.5D 카메라 추적: 창 크기가 줄어도 캐릭터가 작아지지 않고, 카메라가 캐릭터를 따라다니며 배경이 스크롤
      const vwTick = Math.max(100, sceneSizeRef.current.w);
      const vhTick = Math.max(100, sceneSizeRef.current.h);
      const worldHTick = Math.max(720, vhTick, vwTick / 1.6);
      const worldWTick = Math.max(1200, Math.round(worldHTick * 1.6), vwTick);

      const meActor = actorsRef.current.find((a) => a.isMe);
      const meLive = meActor ? posRef.current[meActor.nick] : null;

      let targetCamX = 0;
      let targetCamY = 0;

      if (worldWTick > vwTick) {
        const playerX = (meLive ? meLive.x : 0.5) * worldWTick;
        targetCamX = Math.max(0, Math.min(worldWTick - vwTick, playerX - vwTick / 2));
      } else {
        targetCamX = (worldWTick - vwTick) / 2;
      }

      if (worldHTick > vhTick) {
        const playerY = (meLive ? meLive.y : 0.5) * worldHTick;
        targetCamY = Math.max(0, Math.min(worldHTick - vhTick, playerY - vhTick / 2));
      } else {
        targetCamY = (worldHTick - vhTick) / 2;
      }

      const curCam = camPosRef.current;
      if (!hasInitCamRef.current) {
        curCam.x = targetCamX;
        curCam.y = targetCamY;
        hasInitCamRef.current = true;
      } else {
        const cdx = targetCamX - curCam.x;
        const cdy = targetCamY - curCam.y;
        if (Math.abs(cdx) > 0.05 || Math.abs(cdy) > 0.05) {
          curCam.x += cdx * 0.22;
          curCam.y += cdy * 0.22;
        } else {
          curCam.x = targetCamX;
          curCam.y = targetCamY;
        }
      }

      if (worldElRef.current) {
        worldElRef.current.style.transform = `translate3d(${-Math.round(curCam.x)}px, ${-Math.round(curCam.y)}px, 0)`;
      }

      const anyRecentlyMoved = Object.values(posRef.current).some(
        (p) => p.lastMovedAt > 0 && now - p.lastMovedAt < 240
      );
      const anySpeakingOrPosing = actorsRef.current.some((a) => a.isSpeaking || Boolean(a.pose));
      if (changed || anyRecentlyMoved || anySpeakingOrPosing) setFrame((f) => (f + 1) % 1000000);
    };
    const movementTimer = window.setInterval(() => tick(performance.now()), 1000 / 30);
    return () => window.clearInterval(movementTimer);
  }, []);

  const vw = Math.max(100, sceneSize.w);
  const vh = Math.max(100, sceneSize.h);
  const worldH = Math.max(720, vh, vw / 1.6);
  const worldW = Math.max(1200, Math.round(worldH * 1.6), vw);
  const unit = Math.max(52, Math.min(80, worldH * 0.12));

  const handleFloorPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const me = actorsRef.current.find((a) => a.isMe);
    const el = sceneRef.current;
    if (!me || !el || me.pose === "jump" || isSocialAction(me.pose)) return;
    const rect = el.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // 뷰포트 클릭 좌표를 월드 절대 좌표로 역투영 (카메라 오프셋 보정)
    const worldClickX = clickX + camPosRef.current.x;
    const worldClickY = clickY + camPosRef.current.y;

    const rawTarget = clampPlazaPos({
      x: worldClickX / worldW,
      y: worldClickY / worldH,
    });
    const p = posRef.current[me.nick];
    if (!p) return;
    cancelNavigation();
    const blocked = (point: PlazaPos) => point.x < MIN_X || point.x > MAX_X || point.y < MIN_Y || point.y > MAX_Y || isBlockedInTheme(point.x, point.y, activeThemeRef.current);
    const path = findWalkPath(p, rawTarget, blocked);
    if (!path?.length) { setNavigationNotice("이동할 수 없는 곳이에요."); return; }
    routeRef.current = path;
    p.tx = path[0].x; p.ty = path[0].y;
    onMyMoveRef.current({ x: p.x, y: p.y }, path[0]);
  };

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
      onPointerDownCapture={(e) => {
        if ((e.target as HTMLElement).closest("[data-actor-nameplate]")) return;
        const world = worldElRef.current;
        const nick = world ? pickSpriteActor(world, e.clientX, e.clientY) : null;
        if (!nick) return;
        const actor = actorsRef.current.find(a => a.nick === nick);
        if (actor) { e.stopPropagation(); onActorClick(actor); }
      }}
      onPointerDown={handleFloorPointer}
      className="absolute inset-0 overflow-hidden rounded-xl select-none touch-manipulation cursor-pointer"
    >
      {navigationNotice && <div role="status" data-navigation-status className="absolute left-1/2 bottom-5 -translate-x-1/2 z-[2000] rounded-full bg-slate-950/85 px-4 py-2 text-xs text-white pointer-events-none">{navigationNotice}</div>}
      {/* 2.5D 카메라 뷰포트 월드 컨테이너 (웹 가로가 줄어도 캐릭터/가구 크기가 축소되지 않고 카메라가 이동) */}
      <div
        ref={worldElRef}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: worldW,
          height: worldH,
          transform: `translate3d(${-Math.round(camPosRef.current.x)}px, ${-Math.round(camPosRef.current.y)}px, 0)`,
          willChange: "transform",
        }}
      >
      {/* 픽셀 월드맵 이미지 테마 vs 2.5D 벡터 테마 렌더링 */}
      {activeTheme.mapImg ? (
        <div className="absolute inset-0 bg-slate-950">
          <img
            src={activeTheme.mapImg}
            alt={activeTheme.name}
            draggable={false}
            style={{ imageRendering: activeTheme.smooth ? "auto" : "pixelated" }}
            className="w-full h-full object-fill select-none pointer-events-none"
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
            data-prop={prop.id}
            data-depth-anchor={prop.anchorY}
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
              style={{ imageRendering: activeTheme.smooth ? "auto" : "pixelated" }}
              className="w-full h-full pointer-events-none select-none"
            />
            {prop.water && <GardenWater src={prop.src} />}
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
        const receiving = a.poseInfo?.role === "receive";
        const paired = isSocialAction(a.pose);
        const s = activeTheme?.mapImg ? 0.68 : 0.72 + 0.4 * (p?.y ?? 0.5);
        const baseW = unit * s;

        // Every action uses the same full-body cell and scale. Foot contact is inside the sprite renderer.
        const isLying = false;
        const isSitting = false;
        const isInteracting = isSocialAction(a.pose);
        const w = baseW * 1.4;
        const h = w * 1.25;

        const walking =
          (a.isMe && wasKeyMovingRef.current) ||
          Math.hypot(p.tx - p.x, p.ty - p.y) > 0.0015 ||
          (p.lastMovedAt > 0 && performance.now() - p.lastMovedAt < 180);
        return (
          <div
            key={a.nick}
            data-plaza-actor={a.nick}
            className="absolute transition-[width,height] duration-150"
            style={{
              left: `${p.x * 100}%`,
              top: `${p.y * 100}%`,
              width: w,
              height: h,
              transform: "translate(-50%, -100%)",
              zIndex: 10 + Math.round(p.y * 1000) + (paired && !receiving ? 1 : 0),
            }}
          >
            {/* 발밑 발화/귓속말 글로우 (평상시 파란 그림자 제거) */}
            {(a.isWhisper || a.isSpeaking) && (
              <div
                className={`absolute left-1/2 -translate-x-1/2 rounded-[50%] pointer-events-none transition-all ${
                  a.isWhisper
                    ? "bg-purple-400/50 shadow-[0_0_16px_6px_rgba(192,132,252,0.6)]"
                    : "bg-emerald-400/50 shadow-[0_0_18px_8px_rgba(52,211,153,0.65)] animate-pulse"
                }`}
                style={{
                  bottom: -baseW * 0.04,
                  width: isLying ? baseW * 1.6 : isSitting ? baseW * 1.15 : isInteracting ? baseW * 1.3 : baseW * 0.8,
                  height: isLying ? baseW * 0.35 : baseW * 0.22,
                }}
              />
            )}

            {/* 상태 표시 배지 (자리비움 / 작업중 / 업무중 / 통화중 등) */}
            {a.status && !a.bubble && (
              <div
                className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 pointer-events-none"
                style={{ zIndex: 5 }}
              >
                <div className="rpg-frame px-2 py-0.5 rounded border border-amber-500/80 bg-stone-950/95 text-amber-200 text-[10px] md:text-[11px] font-normal whitespace-nowrap shadow-md flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                  <span>{a.status}</span>
                </div>
              </div>
            )}

            {/* 말풍선 */}
            {a.bubble && (
              <div
                key={a.bubble.id}
                className="plaza-bubble absolute left-1/2 bottom-full mb-1 pointer-events-none"
                style={{ zIndex: 6 }}
              >
                <div
                  className={`relative max-w-[150px] md:max-w-[200px] w-max px-2.5 py-1 rounded-lg text-[10.5px] md:text-xs font-normal leading-snug shadow-lg break-words line-clamp-3 border-2 ${
                    a.bubble.whisper
                      ? "bg-stone-950/95 text-fuchsia-200 border-fuchsia-500"
                      : "bg-stone-950/95 text-amber-100 border-amber-500"
                  }`}
                >
                  {a.bubble.text}
                </div>
                <div
                  className={`mx-auto w-2 h-2 rotate-45 -mt-1 border-r-2 border-b-2 ${
                    a.bubble.whisper ? "bg-stone-950 border-fuchsia-500" : "bg-stone-950 border-amber-500"
                  }`}
                />
              </div>
            )}

            {/* 캐릭터 본체 (감정표현/메뉴 타깃 겸 클릭 영역) */}
            <div
              ref={(el) => registerActorEl(a.slotIdx, el)}
              className={`relative w-full h-full cursor-pointer hover:brightness-110 active:scale-95 transition-transform ${a.hitClass || ""}`}
              title={a.isMe ? "내 감정표현 선택하기 (클릭)" : `${a.nick}님 메뉴`}
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
                    facing={p.facing}
                    walking={walking}
                    walkFrame={Math.floor(performance.now() / 130)}
                    talking={a.isSpeaking}
                    pose={a.pose || null}
                    poseInfo={a.poseInfo}
                    className="w-full h-full"
                  />
                </div>
              </div>
            </div>

            {/* 액션 & 상호작용 특수 효과 (FX 배지 & 파티클) */}
            {a.pose === "lie" && (
              <div className="absolute -top-3 right-0 pointer-events-none animate-bounce text-[11px] font-bold text-sky-200 bg-slate-900/85 px-1.5 py-0.5 rounded-full border border-sky-400/40 shadow-sm shadow-sky-500/20 z-10 flex items-center gap-0.5">
                <span>💤</span>
                <span className="font-mono text-[9px]">zZ</span>
              </div>
            )}
            {a.pose === "jump" && (
              <>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 pointer-events-none text-xs z-10 animate-ping">
                  💨
                </div>
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 pointer-events-none text-sm z-10 animate-bounce">
                  ✨
                </div>
              </>
            )}
            {/* 이름표 컨테이너 (말할 때도 닉네임 박스 위치/크기 100% 고정) */}
            <div
              data-actor-nameplate
              onPointerDown={(e) => {
                e.stopPropagation();
                onActorClick(a);
              }}
              className="absolute left-1/2 -translate-x-1/2 top-full mt-0.5 flex items-center cursor-pointer hover:brightness-125"
              title={a.isMe ? "내 감정표현 선택하기 (클릭)" : `${a.nick}님 메뉴`}
            >
              {/* 고정된 닉네임 필 (2번째 이미지 상태 유지) */}
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded-full whitespace-nowrap text-[9.5px] md:text-[11px] font-bold shadow"
                style={{
                  background: a.isMe ? "rgba(79,70,229,0.92)" : "rgba(2,6,23,0.78)",
                  border: a.isSpeaking ? "1px solid rgba(52,211,153,0.9)" : "1px solid rgba(255,255,255,0.18)",
                }}
              >
                {a.deviceIcon}
                <span className="text-white max-w-[78px] md:max-w-[115px] truncate">{a.nick}</span>
                {a.isMuted && <span className="text-rose-400" title="마이크 꺼짐">🔇</span>}
              </div>

              {/* 말할 때 닉네임 배지 밖에(오른쪽) 고정 표시되는 스피커 아이콘 */}
              {a.isSpeaking && (
                <div
                  className="absolute left-[calc(100%+3px)] top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none"
                  title="발화 중"
                >
                  <span className="text-[10px] md:text-xs text-emerald-300 drop-shadow-[0_0_4px_rgba(52,211,153,0.8)]">
                    🔊
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}

      </div>

{hint && (
        <div className="absolute left-1/2 -translate-x-1/2 top-[38%] md:top-[42%] pointer-events-none px-3 py-1.5 rounded-full bg-black/55 border border-white/15 text-[10.5px] md:text-xs text-slate-100 font-semibold whitespace-nowrap" style={{ zIndex: 2000 }}>
          {hint}
        </div>
      )}
    </div>
  );
}
