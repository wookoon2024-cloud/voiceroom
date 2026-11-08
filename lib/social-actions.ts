/** Shared by menus, navigation, local playback and remote participants. */
export const SOCIAL_ACTIONS = {
  hug: { name: "포옹", icon: "🫂", result: "포옹했습니다", duration: 668, gap: 0.28 },
  kiss: { name: "뽀뽀", icon: "💋", result: "뽀뽀했습니다", duration: 668, gap: 0.366 },
  punch: { name: "장난 펀치", icon: "👊", result: "장난 펀치를 주고받았습니다", duration: 1200, gap: 0.36 },
  highfive: { name: "하이파이브", icon: "🙌", result: "하이파이브했습니다", duration: 1200, gap: 0.43 },
  handshake: { name: "악수", icon: "🤝", result: "악수했습니다", duration: 1200, gap: 0.40 },
  pat: { name: "쓰다듬기", icon: "🫳", result: "쓰다듬기로 마음을 전했습니다", duration: 1200, gap: 0.30 },
  gift: { name: "선물 주기", icon: "🎁", result: "선물을 주고받았습니다", duration: 1200, gap: 0.44 },
  dance: { name: "함께 춤추기", icon: "🎵", result: "함께 춤췄습니다", duration: 1600, gap: 0.75 },
} as const;
export type SocialAction = keyof typeof SOCIAL_ACTIONS;
export const isSocialAction = (value: unknown): value is SocialAction =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(SOCIAL_ACTIONS, value);

export function socialContactOffset(action: SocialAction, senderScale: number, receiverScale: number, cellWidth: number) {
  return {
    gap: cellWidth * SOCIAL_ACTIONS[action].gap * (senderScale + receiverScale) / 2,
    // Feet share the same world baseline. Height differences belong to body poses.
    footY: 0,
  };
}
