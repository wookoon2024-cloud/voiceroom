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
const MIN_Y = 0.3;
const MAX_Y = 0.95;
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

export function CharacterSprite({
  id,
  walking = false,
  talking = false,
  className = "",
}: {
  id: CharacterId;
  walking?: boolean;
  talking?: boolean;
  className?: string;
}) {
  const p = PALETTES[id] || PALETTES.cute;
  const isMuscle = id === "muscle";
  const isCute = id === "cute";
  const isSporty = id === "sporty";

  return (
    <svg
      viewBox="0 0 64 84"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${walking ? "plaza-walking" : ""}`}
      aria-hidden="true"
    >
      {/* 다리 */}
      <g>
        <g className="plaza-leg-l">
          <rect x="23.5" y="58" width="7.5" height="17" rx="3" fill={isSporty || isCute ? p.skin : p.bottom} />
          {isSporty && <rect x="23.5" y="69" width="7.5" height="5" fill="#f8fafc" />}
          <ellipse cx="27" cy="76" rx="5" ry="2.6" fill={p.shoes} stroke="#0003" strokeWidth="0.6" />
        </g>
        <g className="plaza-leg-r">
          <rect x="33" y="58" width="7.5" height="17" rx="3" fill={isSporty || isCute ? p.skin : p.bottom} />
          {isSporty && <rect x="33" y="69" width="7.5" height="5" fill="#f8fafc" />}
          <ellipse cx="37" cy="76" rx="5" ry="2.6" fill={p.shoes} stroke="#0003" strokeWidth="0.6" />
        </g>
        {isSporty && <rect x="22" y="57" width="20" height="9" rx="3" fill={p.bottom} />}
      </g>

      <g className="plaza-upper">
        {/* 목 */}
        <rect x="28" y="37" width="8" height="5" fill={p.skin} />

        {/* 팔 */}
        {isMuscle ? (
          <>
            <rect x="7" y="41" width="10" height="19" rx="5" fill={p.skin} transform="rotate(12 12 42)" />
            <rect x="47" y="41" width="10" height="19" rx="5" fill={p.skin} transform="rotate(-12 52 42)" />
            <ellipse cx="11" cy="47" rx="5.5" ry="4.5" fill={p.skin} />
            <ellipse cx="53" cy="47" rx="5.5" ry="4.5" fill={p.skin} />
            <path d="M9 46 Q11 43 13.5 46" stroke="#0002" strokeWidth="0.9" fill="none" />
            <path d="M50.5 46 Q53 43 55 46" stroke="#0002" strokeWidth="0.9" fill="none" />
          </>
        ) : (
          <>
            <rect x="13.5" y="41" width="6" height="17" rx="3" fill={isCute ? p.skin : p.top} transform="rotate(10 16.5 42)" />
            <rect x="44.5" y="41" width="6" height="17" rx="3" fill={isCute ? p.skin : p.top} transform="rotate(-10 47.5 42)" />
            <circle cx="14" cy="58" r="3" fill={p.skin} />
            <circle cx="50" cy="58" r="3" fill={p.skin} />
          </>
        )}

        {/* 몸통 */}
        {isCute ? (
          <path d="M21 42 Q32 38 43 42 L49 63 Q32 68 15 63 Z" fill={p.top} />
        ) : isMuscle ? (
          <>
            <path d="M14 45 C14 40 22 39 32 39 C42 39 50 40 50 45 L46 61 C46 63 44 63 42 63 L22 63 C20 63 18 63 18 61 Z" fill={p.skin} />
            <path d="M20 42 L26 40 C28 46 36 46 38 40 L44 42 L43 62 L21 62 Z" fill={p.top} />
            <path d="M27 50 Q32 52 37 50 M27 55 Q32 57 37 55" stroke="#0002" strokeWidth="0.8" fill="none" />
          </>
        ) : (
          <path d="M19 44 C19 40 24 39 32 39 C40 39 45 40 45 44 L45 60 C45 62 43 63 41 63 L23 63 C21 63 19 62 19 60 Z" fill={p.top} />
        )}

        {/* 상의 디테일 */}
        {id === "nerd" && (
          <>
            <path d="M27 39.5 L32 47 L37 39.5 Z" fill="#f8fafc" />
            <path d="M32 42 L30.5 45 L32 53 L33.5 45 Z" fill="#dc2626" />
            <path d="M20 50 L44 50" stroke="#0001" strokeWidth="1" />
          </>
        )}
        {(id === "office" || id === "handsome") && (
          <>
            <path d="M26.5 39.5 L32 49 L37.5 39.5 Z" fill="#f8fafc" />
            {id === "office" && <path d="M32 42 L30.3 45 L32 55 L33.7 45 Z" fill="#dc2626" />}
            <path d="M26.5 39.5 L30 52 L24 47 Z M37.5 39.5 L34 52 L40 47 Z" fill="#0003" />
          </>
        )}
        {isSporty && (
          <text x="32" y="56" textAnchor="middle" fontSize="10" fontWeight="900" fill="#fff" fontFamily="sans-serif">
            7
          </text>
        )}
        {(id === "hiphop" || id === "cat") && (
          <>
            <path d="M29 41 L28 49 M35 41 L36 49" stroke="#f8fafc" strokeWidth="1" strokeLinecap="round" />
            <rect x="24" y="53" width="16" height="6" rx="2" fill="#0002" />
          </>
        )}
        {isCute && <circle cx="32" cy="44" r="2" fill="#f43f5e" />}

        {/* 머리 뒤쪽 요소 (후드 / 단발 뒷머리) */}
        {id === "cat" && (
          <>
            <circle cx="32" cy="26" r="21" fill={p.top} />
            <path d="M13 16 L15 1 L27 9 Z M51 16 L49 1 L37 9 Z" fill={p.top} />
            <path d="M16 12 L17 5 L23 9 Z M48 12 L47 5 L41 9 Z" fill="#fda4af" />
          </>
        )}
        {isCute && (
          <path d="M13 26 C13 10 22 6 32 6 C42 6 51 10 51 26 L51 38 C51 40 46 40 46 38 L18 38 C18 40 13 40 13 38 Z" fill={p.hair} />
        )}

        {/* 얼굴 */}
        <circle cx="32" cy="25" r="17" fill={p.skin} />

        {/* 앞머리 / 모자 */}
        {id === "nerd" && (
          <>
            <path d={STD_HAIR} fill={p.hair} />
            <path d="M20 17 C26 12 36 12 44 17 C38 16 30 17 24 21 Z" fill={p.hair} />
          </>
        )}
        {isSporty && (
          <>
            <path d="M15 24 C14 12 22 6 32 6 C42 6 50 12 49 24 L46 16 L42 18 L38 13 L33 17 L28 12 L24 17 L19 14 Z" fill={p.hair} />
            <path d="M15.5 20 C19 12.5 45 12.5 48.5 20 L48 15.5 C44 9.5 20 9.5 16 15.5 Z" fill="#facc15" />
          </>
        )}
        {isMuscle && (
          <path d="M16 22 C16 12 23 8 32 8 C41 8 48 12 48 22 C44 15 39 13 32 13 C25 13 20 15 16 22 Z" fill={p.hair} />
        )}
        {isCute && (
          <>
            <path d="M15 24 C15 11 23 7 32 7 C41 7 49 11 49 24 C45 19 42 16 38 18 C35 15 30 15 27 18 C23 16 19 19 15 24 Z" fill={p.hair} />
            <path d="M44 9 L50 5 L50 13 Z M44 9 L38 5 L38 13 Z" fill="#f43f5e" />
            <circle cx="44" cy="9" r="2" fill="#be123c" />
          </>
        )}
        {id === "handsome" && (
          <>
            <path d="M15 25 C13 10 24 5 35 6 C46 7 51 14 49 24 C47 18 44 15 40 14 C36 17 28 19 20 17 C17 19 16 22 15 25 Z" fill={p.hair} />
            <path d="M28 8 C40 3 51 9 49 18 C45 11 38 9 28 8 Z" fill="#9a6040" />
          </>
        )}
        {id === "hiphop" && (
          <>
            <path d="M14 22 C14 9 22 5 32 5 C42 5 50 9 50 22 Z" fill="#f97316" />
            <rect x="13" y="18" width="38" height="6" rx="3" fill="#c2410c" />
            <circle cx="32" cy="5" r="3" fill="#fdba74" />
          </>
        )}
        {id === "office" && (
          <>
            <path d={STD_HAIR} fill={p.hair} />
            <path d="M15 26 C15 18 18 14 25 13 L22 20 C19 21 16.5 23 15 26 Z" fill={p.hair} />
          </>
        )}
        {id === "cat" && <path d="M18 18 C24 12 40 12 46 18 C40 16 24 16 18 18 Z" fill={p.hair} />}

        {/* 눈 / 눈썹 */}
        {isMuscle && (
          <path d="M22 21 L29 22.5 M42 21 L35 22.5" stroke="#1c1c1c" strokeWidth="1.8" strokeLinecap="round" />
        )}
        {id === "handsome" ? (
          <>
            <path d="M23 22 L29 21.5 M35 21.5 L41 22" stroke="#4a2c1a" strokeWidth="1.2" strokeLinecap="round" />
            <ellipse cx="26" cy="27" rx="2.2" ry="2.4" fill="#1f2937" />
            <ellipse cx="38" cy="27" rx="2.2" ry="2.4" fill="#1f2937" />
          </>
        ) : (
          <>
            <ellipse cx="26" cy="27" rx="2.3" ry="2.9" fill="#1f2937" />
            <ellipse cx="38" cy="27" rx="2.3" ry="2.9" fill="#1f2937" />
          </>
        )}
        <circle cx="26.8" cy="26" r="0.9" fill="#fff" />
        <circle cx="38.8" cy="26" r="0.9" fill="#fff" />

        {id === "nerd" && (
          <g stroke="#111827" strokeWidth="1.3" fill="#ffffff22">
            <circle cx="26" cy="27" r="4.6" />
            <circle cx="38" cy="27" r="4.6" />
            <path d="M30.6 27 L33.4 27" fill="none" />
          </g>
        )}

        {/* 볼터치 */}
        <ellipse cx="21.5" cy="31.5" rx="2.6" ry="1.5" fill="#fb7185" opacity={isCute || id === "cat" ? 0.6 : 0.35} />
        <ellipse cx="42.5" cy="31.5" rx="2.6" ry="1.5" fill="#fb7185" opacity={isCute || id === "cat" ? 0.6 : 0.35} />

        {id === "cat" && (
          <path d="M14 30 L19 31 M14 33 L19 32.5 M50 30 L45 31 M50 33 L45 32.5" stroke="#78350f" strokeWidth="0.7" strokeLinecap="round" />
        )}

        {/* 입 (말할 때 벌어짐) */}
        {talking ? (
          <ellipse className="plaza-mouth-talk" cx="32" cy="33.5" rx="2.4" ry="2" fill="#9f1239" />
        ) : (
          <path d="M29 33 Q32 35.5 35 33" stroke="#7c2d12" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        )}

        {id === "handsome" && (
          <path className="plaza-sparkle" d="M53 8 L54.2 11 L57 12 L54.2 13 L53 16 L51.8 13 L49 12 L51.8 11 Z" fill="#fde047" />
        )}
      </g>
    </svg>
  );
}

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
  bubble?: { id: string; text: string; whisper?: boolean };
  hitClass?: string;
};

type LivePos = { x: number; y: number; tx: number; ty: number; facing: 1 | -1; src?: PlazaMove };

const DECOR: { kind: "lamp" | "tree" | "bench" | "flower"; x: number; y: number }[] = [
  { kind: "tree", x: 0.05, y: 0.42 },
  { kind: "lamp", x: 0.27, y: 0.36 },
  { kind: "lamp", x: 0.73, y: 0.36 },
  { kind: "tree", x: 0.95, y: 0.44 },
  { kind: "bench", x: 0.5, y: 0.33 },
  { kind: "flower", x: 0.03, y: 0.93 },
  { kind: "flower", x: 0.97, y: 0.9 },
];

function DecorSprite({ kind }: { kind: "lamp" | "tree" | "bench" | "flower" }) {
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
  hasSkin,
  onMyMove,
  onActorClick,
  registerActorEl,
  hint,
}: {
  actors: PlazaActor[];
  hasSkin: boolean;
  onMyMove: (from: PlazaPos, to: PlazaPos) => void;
  onActorClick: (actor: PlazaActor) => void;
  registerActorEl: (slotIdx: number, el: HTMLDivElement | null) => void;
  hint?: string;
}) {
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
      live[a.nick] = { x: start.x, y: start.y, tx: start.x, ty: start.y, facing: 1, src: a.move };
      return;
    }
    if (!a.isMe && a.move && a.move !== cur.src) {
      const from = clampPlazaPos({ x: a.move.x, y: a.move.y });
      const to = clampPlazaPos({ x: a.move.tx, y: a.move.ty });
      // 크게 어긋났을 때만 출발 위치로 보정 (작은 오차는 부드럽게 이어서 걷기)
      if (Math.hypot(from.x - cur.x, from.y - cur.y) > 0.12) {
        cur.x = from.x;
        cur.y = from.y;
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

  // 키보드 (방향키 / WASD) - 채팅창 포커스 시 즉시 이동키 해제
  useEffect(() => {
    const KEYS = ["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"];
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
      const k = e.key.toLowerCase();
      if (!KEYS.includes(k)) return;
      if (!actorsRef.current.some((a) => a.isMe)) return;
      e.preventDefault();
      keysRef.current.add(k);
    };
    const up = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
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

      // 키보드 이동
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
          p.x = next.x;
          p.y = next.y;
          p.tx = next.x;
          p.ty = next.y;
          changed = true;
          wasKeyMovingRef.current = true;
          if (now - lastKeySendRef.current > 120) {
            lastKeySendRef.current = now;
            const lead = clampPlazaPos({ x: p.x + (dx / len) * 0.04, y: p.y + (dy / len) * 0.032 });
            onMyMoveRef.current({ x: p.x, y: p.y }, lead);
          }
        } else if (wasKeyMovingRef.current) {
          wasKeyMovingRef.current = false;
          onMyMoveRef.current({ x: p.x, y: p.y }, { x: p.x, y: p.y });
        }
      }

      // 목표 지점으로 걷기
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
        changed = true;
      });

      if (changed) setFrame((f) => (f + 1) % 1000000);
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
      {/* 하늘 / 뒷벽 */}
      <div
        className={`absolute inset-x-0 top-0 h-[34%] ${
          hasSkin ? "bg-gradient-to-b from-black/30 to-transparent" : "bg-gradient-to-b from-indigo-950 via-violet-900/80 to-fuchsia-900/60"
        }`}
      >
        {!hasSkin && (
          <>
            <div className="absolute left-[12%] top-[18%] w-1 h-1 rounded-full bg-white/80 animate-pulse" />
            <div className="absolute left-[38%] top-[30%] w-0.5 h-0.5 rounded-full bg-white/70" />
            <div className="absolute left-[62%] top-[14%] w-1 h-1 rounded-full bg-white/70 animate-pulse" />
            <div className="absolute left-[84%] top-[26%] w-0.5 h-0.5 rounded-full bg-white/80" />
            <div className="absolute right-[8%] top-[10%] w-7 h-7 md:w-10 md:h-10 rounded-full bg-amber-100/90 shadow-[0_0_30px_rgba(254,243,199,0.6)]" />
          </>
        )}
      </div>

      {/* 2.5D 바닥 (원근감 타일) */}
      <div className="absolute inset-x-0 bottom-0 top-[26%] overflow-hidden" style={{ perspective: "520px" }}>
        <div
          className="absolute left-[-40%] right-[-40%] top-0 bottom-[-30%]"
          style={{
            transform: "rotateX(52deg)",
            transformOrigin: "50% 0%",
            background: hasSkin
              ? "repeating-linear-gradient(0deg, rgba(255,255,255,0.10) 0 2px, transparent 2px 64px), repeating-linear-gradient(90deg, rgba(255,255,255,0.10) 0 2px, transparent 2px 64px), rgba(15,23,42,0.35)"
              : "repeating-linear-gradient(0deg, rgba(255,255,255,0.08) 0 2px, transparent 2px 64px), repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0 2px, transparent 2px 64px), linear-gradient(180deg, #3b2f63 0%, #4c3d7a 40%, #5b4a8c 100%)",
          }}
        />
        <div className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-black/30 to-transparent" />
      </div>

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

      {/* 소품 */}
      {DECOR.map((d, i) => {
        const s = 0.7 + 0.45 * d.y;
        const w = d.kind === "bench" ? unit * 1.5 : d.kind === "flower" ? unit * 0.6 : d.kind === "lamp" ? unit * 0.45 : unit * 1.1;
        const h = d.kind === "bench" ? unit * 0.75 : d.kind === "flower" ? unit * 0.6 : unit * 1.7;
        return (
          <div
            key={i}
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
        const s = 0.72 + 0.4 * p.y;
        const w = unit * s;
        const walking = Math.hypot(p.tx - p.x, p.ty - p.y) > 0.002;
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
                  ? "bg-sky-400/25 ring-2 ring-sky-300/60"
                  : "bg-black/0"
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

            {/* 캐릭터 본체 (감정표현 타깃 겸 클릭 영역) */}
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
                <div className="w-full h-full" style={{ transform: `scaleX(${p.facing})` }}>
                  <CharacterSprite id={a.character} walking={walking} talking={a.isSpeaking} className="w-full h-full" />
                </div>
              </div>
            </div>

            {/* 이름표 (클릭 시에도 캐릭터 메뉴 열림) */}
            <div
              onPointerDown={(e) => {
                if (a.isMe) return;
                e.stopPropagation();
                onActorClick(a);
              }}
              className={`absolute left-1/2 -translate-x-1/2 top-full mt-0.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                a.isMe ? "pointer-events-none" : "cursor-pointer hover:brightness-125"
              } text-[9.5px] md:text-[11px] font-bold shadow`}
              style={{
                background: a.isMe ? "rgba(79,70,229,0.92)" : "rgba(2,6,23,0.78)",
                border: a.isSpeaking ? "1px solid rgba(52,211,153,0.9)" : "1px solid rgba(255,255,255,0.18)",
              }}
            >
              <span className="text-slate-300 font-extrabold">{a.slotIdx + 1}</span>
              <span className="text-white max-w-[72px] md:max-w-[110px] truncate">{a.nick}</span>
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
