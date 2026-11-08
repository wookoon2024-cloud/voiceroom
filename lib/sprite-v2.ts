/** sprite-gen's manifest owns texture rectangles and timing; the renderer never guesses a grid. */
export type SpriteRect = { x: number; y: number; w: number; h: number };
export type SpriteManifestV2 = {
  characterId: string;
  sprite_sheet_alpha: string;
  frame_layout: { sheetWidth: number; sheetHeight: number; cellWidth: number; cellHeight: number; rows: Record<string, SpriteRect[]> };
  animation: { rows: Record<string, { fps: number; loop: boolean; durations_ms: number[] }> };
};
export const SPRITE_CHARACTERS_V2 = [
  { id: "cute_male_v2", name: "귀여운 남자", color: "#90bda7" },
  { id: "strong_male_v2", name: "근육질 남자", color: "#8797b7" },
] as const;
export type SpriteCharacterV2 = (typeof SPRITE_CHARACTERS_V2)[number]["id"];
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
