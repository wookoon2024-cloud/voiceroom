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

const MIN_X = 0.06;
const MAX_X = 0.94;
const MIN_Y = 0.22;
const MAX_Y = 0.94;
/** 초당 이동 거리 (정규화 좌표) */
const WALK_SPEED = 0.3;

export const clampPlazaPos = (p: PlazaPos): PlazaPos => ({
  x: Math.min(MAX_X, Math.max(MIN_X, Number.isFinite(p.x) ? p.x : 0.5)),
  y: Math.min(MAX_Y, Math.max(MIN_Y, Number.isFinite(p.y) ? p.y : 0.6)),
});

export const isPlazaMove = (v: any): v is PlazaMove =>
  v &&
  typeof v === "object" &&
  ["x", "y", "tx", "ty"].every((k) => typeof v[k] === "number" && Number.isFinite(v[k]));

/** 좌석 번호 기준 기본 위치 (앞뒤 2줄 x 5명) */
export const defaultPlazaPos = (slotIdx: number): PlazaPos => {
  // 채팅 패널(우측/하단)에 덜 가리도록 좌측-중앙에 2줄로 배치
  const col = slotIdx % 5;
  const row = slotIdx < 5 ? 0 : 1;
  return clampPlazaPos({ x: 0.1 + col * 0.12 + row * 0.06, y: row === 0 ? 0.5 : 0.62 });
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
      className={`relative select-none pointer-events-none ${className} ${
        walking ? "plaza-pixel-walking" : ""
      } ${talking || pose ? "plaza-speaking" : ""}`}
      aria-hidden="true"
    >
      <div
        className="w-full h-full select-none pointer-events-none"
        style={{
          backgroundImage: `url(/plaza/sheets/${safeId}.png)`,
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
};

export const PLAZA_THEMES: PlazaThemeDef[] = [
  {
    id: "lounge",
    name: "픽셀 카페 & 오락실 라운지",
    icon: "☕",
    desc: "커피바·소파 라운지·주크박스·오락실이 있는 픽셀 타운",
    mapImg: "/plaza/maps/lounge.jpg",
    skyClass: "bg-slate-950",
    floorBg: "#1e1b4b",
    decor: [],
  },
  {
    id: "night_park",
    name: "픽셀 별빛 밤공원",
    icon: "🌙",
    desc: "분수대와 야식 포차, 가로등이 빛나는 픽셀 밤공원 광장",
    mapImg: "/plaza/maps/night_park.jpg",
    skyClass: "bg-gradient-to-b from-indigo-950 via-violet-900/85 to-fuchsia-900/65",
    floorBg:
      "repeating-linear-gradient(0deg, rgba(255,255,255,0.08) 0 2px, transparent 2px 64px), repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0 2px, transparent 2px 64px), linear-gradient(180deg, #3b2f63 0%, #4c3d7a 40%, #5b4a8c 100%)",
    decor: [],
  },
  {
    id: "cherry_blossom",
    name: "픽셀 봄날 벚꽃공원",
    icon: "🌸",
    desc: "만개한 벚꽃나무와 연못 다리, 피크닉 돗자리가 있는 봄 공원",
    mapImg: "/plaza/maps/cherry_blossom.jpg",
    skyClass: "bg-gradient-to-b from-sky-300 via-pink-200/90 to-rose-200/80",
    floorBg:
      "repeating-linear-gradient(0deg, rgba(255,255,255,0.22) 0 2px, transparent 2px 64px), repeating-linear-gradient(90deg, rgba(255,255,255,0.22) 0 2px, transparent 2px 64px), linear-gradient(180deg, #f9a8d4 0%, #f472b6 45%, #ec4899 100%)",
    decor: [],
  },
  {
    id: "camping_forest",
    name: "픽셀 숲속 모닥불 캠핑장",
    icon: "⛺",
    desc: "타오르는 모닥불과 텐트, 통나무 산장이 있는 감성 야영장",
    mapImg: "/plaza/maps/camping_forest.jpg",
    skyClass: "bg-gradient-to-b from-slate-950 via-emerald-950/90 to-teal-900/75",
    floorBg:
      "repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0 2px, transparent 2px 64px), repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 2px, transparent 2px 64px), linear-gradient(180deg, #14532d 0%, #166534 45%, #15803d 100%)",
    decor: [],
  },
  {
    id: "beach_sunset",
    name: "노을빛 해변 리조트",
    icon: "🏖️",
    desc: "야자수와 비치 파라솔이 있는 석양 모래사장",
    skyClass: "bg-gradient-to-b from-amber-500 via-rose-500/85 to-purple-800/80",
    floorBg:
      "repeating-linear-gradient(0deg, rgba(255,255,255,0.12) 0 2px, transparent 2px 72px), linear-gradient(180deg, #0284c7 0%, #38bdf8 12%, #fef08a 16%, #facc15 55%, #eab308 100%)",
    decor: [
      { kind: "palm_tree", x: 0.07, y: 0.44 },
      { kind: "parasol", x: 0.28, y: 0.38 },
      { kind: "parasol", x: 0.72, y: 0.38 },
      { kind: "palm_tree", x: 0.93, y: 0.45 },
      { kind: "flower", x: 0.05, y: 0.91 },
    ],
  },
  {
    id: "cyber_neon",
    name: "사이버 네온시티",
    icon: "🌃",
    desc: "미래 도시 스카이라인과 빛나는 네온 그리드 광장",
    skyClass: "bg-gradient-to-b from-slate-950 via-fuchsia-950/85 to-cyan-950/80",
    floorBg:
      "repeating-linear-gradient(0deg, rgba(34,211,238,0.28) 0 2px, transparent 2px 56px), repeating-linear-gradient(90deg, rgba(232,121,249,0.28) 0 2px, transparent 2px 56px), linear-gradient(180deg, #090d16 0%, #1e1b4b 50%, #311042 100%)",
    decor: [
      { kind: "neon_lamp", x: 0.1, y: 0.42 },
      { kind: "neon_lamp", x: 0.3, y: 0.36 },
      { kind: "bench", x: 0.5, y: 0.34 },
      { kind: "neon_lamp", x: 0.7, y: 0.36 },
      { kind: "neon_lamp", x: 0.9, y: 0.42 },
    ],
  },
  {
    id: "snow_village",
    name: "오로라 겨울마을",
    icon: "⛄",
    desc: "오로라 밤하늘 아래 눈사람과 전나무가 있는 설원",
    skyClass: "bg-gradient-to-b from-slate-950 via-teal-900/75 to-indigo-900/80",
    floorBg:
      "repeating-linear-gradient(0deg, rgba(148,163,184,0.18) 0 2px, transparent 2px 64px), repeating-linear-gradient(90deg, rgba(148,163,184,0.18) 0 2px, transparent 2px 64px), linear-gradient(180deg, #cbd5e1 0%, #e2e8f0 45%, #f8fafc 100%)",
    decor: [
      { kind: "pine_tree", x: 0.07, y: 0.42 },
      { kind: "snowman", x: 0.26, y: 0.39 },
      { kind: "bench", x: 0.5, y: 0.34 },
      { kind: "lamp", x: 0.73, y: 0.36 },
      { kind: "pine_tree", x: 0.93, y: 0.44 },
    ],
  },
  {
    id: "club_stage",
    name: "미러볼 클럽 스테이지",
    icon: "🪩",
    desc: "미러볼과 스포트라이트가 빛나는 화려한 댄스 플로어",
    skyClass: "bg-gradient-to-b from-black via-purple-950/90 to-fuchsia-950/80",
    floorBg:
      "repeating-linear-gradient(0deg, rgba(244,114,182,0.25) 0 3px, transparent 3px 56px), repeating-linear-gradient(90deg, rgba(56,189,248,0.25) 0 3px, transparent 3px 56px), linear-gradient(180deg, #1e1b4b 0%, #3b0764 50%, #4a044e 100%)",
    decor: [
      { kind: "speaker", x: 0.08, y: 0.42 },
      { kind: "neon_lamp", x: 0.27, y: 0.36 },
      { kind: "neon_lamp", x: 0.73, y: 0.36 },
      { kind: "speaker", x: 0.92, y: 0.42 },
    ],
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
  const activeTheme = PLAZA_THEMES.find((t) => t.id === theme) || PLAZA_THEMES[0];
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
          const next = clampPlazaPos({
            x: p.x + (dx / len) * WALK_SPEED * dt,
            y: p.y + (dy / len) * WALK_SPEED * 0.8 * dt,
          });
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
            const lead = clampPlazaPos({ x: p.x + (dx / len) * 0.04, y: p.y + (dy / len) * 0.032 });
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
        if (step >= dist) {
          p.x = p.tx;
          p.y = p.ty;
        } else {
          p.x += (ddx / dist) * step;
          p.y += (ddy / dist) * step;
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
    const target = clampPlazaPos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
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

      {/* 테마별 소품 */}
      {activeTheme.decor.map((d, i) => {
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
        const s = activeTheme.mapImg ? 0.9 : 0.72 + 0.4 * p.y;
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
                className={`w-full h-full ${a.isSpeaking ? "plaza-speaking" : ""}`}
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
