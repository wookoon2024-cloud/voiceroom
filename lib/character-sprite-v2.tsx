"use client";

import { useSyncExternalStore } from "react";
import cuteManifest from "@/public/plaza/v2/cute_male_v2/manifest.json";
import strongManifest from "@/public/plaza/v2/strong_male_v2/manifest.json";
import { JUMP_ROOT_OFFSETS_V2, spriteFrameV2, type SpriteCharacterV2, type SpriteManifestV2 } from "./sprite-v2";

const manifests: Record<SpriteCharacterV2, SpriteManifestV2> = {
  cute_male_v2: cuteManifest,
  strong_male_v2: strongManifest,
};
// One timestamp for all actors keeps send/receive on the same frame boundary.
let clock = 0;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) timer = setInterval(() => {
    clock = Date.now();
    listeners.forEach(notify => notify());
  }, 50);
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer) { clearInterval(timer); timer = undefined; }
  };
}
const getClock = () => clock;
const getServerClock = () => 0;
export type SpritePoseInfo = {
  startedAt: number;
  role?: "send" | "receive";
  facing?: 1 | -1;
  partner?: string;
};

export function RoomCharacterSprite({ id, dir = "down", facing = 1, walking = false, talking = false, pose, poseInfo, className = "" }: {
  id: SpriteCharacterV2;
  dir?: "down" | "up" | "left" | "right";
  facing?: 1 | -1;
  walking?: boolean;
  talking?: boolean;
  pose?: string | null;
  poseInfo?: SpritePoseInfo;
  className?: string;
}) {
  const now = useSyncExternalStore(subscribe, getClock, getServerClock);
  const effectivePose = poseInfo && now < poseInfo.startedAt ? null : pose;
  const direction = dir === "left" || dir === "right" ? "side" : dir;
  const social = effectivePose === "hug" || effectivePose === "kiss";
  const state = effectivePose === "jump" ? "down_jump"
    : social ? `side_${effectivePose}_${poseInfo?.role ?? "send"}`
    : effectivePose === "talk" || (talking && !walking) ? "down_talk"
    : `${direction}_${walking ? "walk" : "idle"}`;
  const manifest = manifests[id];
  const elapsed = poseInfo ? Math.max(0, now - poseInfo.startedAt) : now;
  const selected = spriteFrameV2(manifest, state, elapsed);
  const frame = selected?.ended
    ? spriteFrameV2(manifest, social ? "side_idle" : "down_idle", 0)
    : selected;
  if (!frame) return null;
  const { rect } = frame;
  const layout = manifest.frame_layout;
  const flip = social ? (poseInfo?.facing ?? facing) === -1 : dir === "left" && state.startsWith("side_");
  const root = effectivePose === "jump" && !selected?.ended ? JUMP_ROOT_OFFSETS_V2[frame.index] : 0;
  return <div className={`relative select-none pointer-events-none ${className}`} aria-hidden="true" data-character={id} data-sprite-state={state} data-sprite-frame={frame.index}>
    <div className="h-full w-full" style={{
      backgroundImage: `url(/plaza/v2/${id}/${manifest.sprite_sheet_alpha})`,
      backgroundSize: `${layout.sheetWidth / rect.w * 100}% ${layout.sheetHeight / rect.h * 100}%`,
      backgroundPosition: `${rect.x / (layout.sheetWidth - rect.w) * 100}% ${rect.y / (layout.sheetHeight - rect.h) * 100}%`,
      backgroundRepeat: "no-repeat",
      transform: `translateY(${(22 + root) / 240 * 100}%) scaleX(${flip ? -1 : 1})`,
    }} />
  </div>;
}
