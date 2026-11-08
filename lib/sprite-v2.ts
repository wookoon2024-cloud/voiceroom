/** sprite-gen's manifest owns texture rectangles and timing; the renderer never guesses a grid. */
export type SpriteRect = { x: number; y: number; w: number; h: number };
export type SpriteManifestV2 = {
  characterId: string;
  sprite_sheet_alpha: string;
  frame_layout: { sheetWidth: number; sheetHeight: number; cellWidth: number; cellHeight: number; rows: Record<string, SpriteRect[]> };
  animation: { rows: Record<string, { fps: number; loop: boolean; durations_ms: number[] }> };
};
export const SPRITE_CHARACTERS_V2 = [
  { id: "cute_male_v2", name: "귀여운 남자", color: "#90bda7", scale: 1, desc: "갈색 머리 · 민트 후드 · 크림색 반바지", assetRoot: "/plaza/v2/cute_male_v2" },
  { id: "strong_male_v2", name: "근육질 남자", color: "#8797b7", scale: 1.20, desc: "검은 머리 · 차콜 민소매 · 네이비 조거", assetRoot: "/plaza/v2/strong_male_v2" },
  { id: "blond_tan_male", name: "금발 태닝 남자", color: "#ce894e", scale: 1.14, desc: "금발 · 태닝 피부 · 오렌지 셔츠", assetRoot: "/plaza/roster-v5/blond_tan_male" },
  { id: "soft_male", name: "여성스러운 남자", color: "#a8bbd8", scale: 1.04, desc: "로즈빛 긴 머리 · 파란 카디건", assetRoot: "/plaza/roster-v5/soft_male" },
  { id: "crossdress_male", name: "여장 남자", color: "#b39acd", scale: 1.08, desc: "단발 · 라벤더 원피스 · 앵클부츠", assetRoot: "/plaza/roster-v5/crossdress_male" },
  { id: "pride_male", name: "게이 남자", color: "#af6578", scale: 1.12, desc: "짧은 수염 · 버건디 재킷 · 프라이드 핀", assetRoot: "/plaza/roster-v5/pride_male" },
  { id: "bear_male", name: "베어 남자", color: "#b36954", scale: 1.22, desc: "큰 체격 · 풍성한 수염 · 체크 셔츠", assetRoot: "/plaza/roster-v5/bear_male" },
] as const;
export type SpriteCharacterV2 = (typeof SPRITE_CHARACTERS_V2)[number]["id"];
/** Uniform scale preserves the drawing's head/body ratio; feet stay on the world anchor. */
export const characterScale = (id: SpriteCharacterV2) => SPRITE_CHARACTERS_V2.find(c => c.id === id)?.scale ?? 1;
export const characterAssetRoot = (id: SpriteCharacterV2, extraSocial = false) => {
  if (extraSocial && (id === "cute_male_v2" || id === "strong_male_v2")) return `/plaza/social-v4/${id}`;
  return SPRITE_CHARACTERS_V2.find(c => c.id === id)!.assetRoot;
};
// Root motion belongs to game placement, independently of the extractor's grounded texture cells.
// Both feet stay at the same world X; only the body rises. Shadows keep the ground position.
export const JUMP_ROOT_OFFSETS_V2 = [0, -8, -24, 0] as const;
export const SPRITE_STATES_V2: Record<string, string> = {
  down_idle: "정면 대기", side_idle: "오른쪽 대기", up_idle: "뒷모습 대기",
  down_walk: "아래로 걷기", up_walk: "위로 걷기", side_walk: "오른쪽 걷기",
  down_talk: "제자리 말하기", down_jump: "정면 제자리 점프",
  side_hug_send: "포옹 보내기", side_hug_receive: "포옹 받기",
  side_kiss_send: "뽀뽀 보내기", side_kiss_receive: "뽀뽀 받기",
};
export function spriteFrameV2(manifest: SpriteManifestV2, state: string, elapsed: number) {
  const frames = manifest.frame_layout.rows[state];
  const animation = manifest.animation.rows[state];
  if (!frames?.length || !animation) return null;
  const durations = frames.map((_, i) => animation.durations_ms?.[i] ?? 1000 / animation.fps);
  const total = durations.reduce((a, b) => a + b, 0);
  const ended = !animation.loop && elapsed >= total;
  let remaining = animation.loop ? Math.max(0, elapsed) % total : Math.min(Math.max(0, elapsed), total - 0.001);
  let index = 0;
  while (index < frames.length - 1 && remaining >= durations[index]) remaining -= durations[index++];
  return { rect: frames[index], index, total, ended };
}
