"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { preloadSpriteMask } from "./sprite-hit";
import { isSocialAction } from "./social-actions";
import { characterManifest } from "./character-manifests";
import { characterAssetRoot, characterScale, isAnimalCharacter, spriteStateScale, spriteFrameV2, type SpriteCharacterV2 } from "./sprite-v2";

/** Animate height independently of sprite-frame changes and ground movement. */
function JumpLift({ startedAt, children }: { startedAt?: number; children: ReactNode }) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!element.current) return;
    const lift = element.current.animate([
      { transform: "translateY(0)", offset: 0, easing: "cubic-bezier(.2,.65,.35,1)" },
      { transform: "translateY(-42px)", offset: .5, easing: "cubic-bezier(.65,0,.8,.35)" },
      { transform: "translateY(0)", offset: 1 },
    ], { duration: 668, fill: "both" });
    lift.currentTime = startedAt ? Math.max(0, Date.now() - startedAt) : 0;
    return () => lift.cancel();
  }, [startedAt]);
  return <div ref={element} data-jump-lift className="h-full w-full overflow-visible">{children}</div>;
}

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
  loop?: boolean;
  seatedOnBench?: boolean;
};

export function RoomCharacterSprite({ id, dir = "down", facing = 1, walking = false, talking = false, pose, poseInfo, className = "", visualFilter }: {
  id: SpriteCharacterV2;
  dir?: "down" | "up" | "left" | "right";
  facing?: 1 | -1;
  walking?: boolean;
  talking?: boolean;
  pose?: string | null;
  poseInfo?: SpritePoseInfo;
  className?: string;
  visualFilter?: string;
}) {
  useEffect(() => {
    // Decode interaction textures when the actor appears, before a short remote pose starts.
    const urls = [...new Set([false, true].map(extra => `${characterAssetRoot(id, extra)}/${characterManifest(id, extra).sprite_sheet_alpha}`))];
    urls.push(`${characterAssetRoot(id, false, true)}/${characterManifest(id, false, true).sprite_sheet_alpha}`);
    urls.push(`${characterAssetRoot(id, false, "floor")}/${characterManifest(id, false, "floor").sprite_sheet_alpha}`);
    urls.forEach(src => { void preloadSpriteMask(src); });
  }, [id]);
  const now = useSyncExternalStore(subscribe, getClock, getServerClock);
  const effectivePose = poseInfo && now < poseInfo.startedAt ? null : pose;
  const direction = dir === "left" || dir === "right" ? "side" : dir;
  const social = isSocialAction(effectivePose);
  const rest = effectivePose === "sit" || effectivePose === "lie";
  const floor = effectivePose === "sit" && !poseInfo?.seatedOnBench;
  const restPack = floor ? "floor" : rest;
  const state = effectivePose === "jump" ? "down_jump"
    : rest ? (floor ? "down_floor_sit" : `down_${effectivePose}`)
    : social ? `side_${effectivePose}_${poseInfo?.role ?? "send"}`
    : effectivePose === "talk" || (talking && !walking) ? "down_talk"
    : `${direction}_${walking ? "walk" : "idle"}`;
  const extraSocial = social && effectivePose !== "hug" && effectivePose !== "kiss";
  const manifest = characterManifest(id, extraSocial, restPack);
  const elapsed = poseInfo ? Math.max(0, now - poseInfo.startedAt) : now;
  const selected = spriteFrameV2(manifest, state, elapsed, poseInfo?.loop === true && social);
  const idle = selected?.ended;
  const activeManifest = idle ? characterManifest(id) : manifest;
  const frame = idle ? spriteFrameV2(activeManifest, social ? "side_idle" : "down_idle", 0) : selected;
  if (!frame) return null;
  const { rect } = frame;
  const layout = activeManifest.frame_layout;
  // Change direction only between complete solo cycles, using the shared start time.
  const alternateFacing = social && poseInfo?.loop === true && !poseInfo.partner && selected
    ? Math.floor(elapsed / selected.total) % 2 === 1 : false;
  const flip = social ? ((poseInfo?.facing ?? facing) === -1) !== alternateFacing : dir === "left" && state.startsWith("side_");
  const root = effectivePose === "sit" && poseInfo?.seatedOnBench && isAnimalCharacter(id) ? -72 : 0;
  const texture = <div className="h-full w-full" data-sprite-texture={`${characterAssetRoot(id, extraSocial && !idle, idle ? false : restPack)}/${activeManifest.sprite_sheet_alpha}`} data-sprite-rect={JSON.stringify(rect)} data-sprite-flip={flip} style={{
      width: `${rect.w / 192 * 100}%`,
      marginLeft: `${(1 - rect.w / 192) / 2 * 100}%`,
      backgroundImage: `url(${characterAssetRoot(id, extraSocial && !idle, idle ? false : restPack)}/${activeManifest.sprite_sheet_alpha})`,
      backgroundSize: `${layout.sheetWidth / rect.w * 100}% ${layout.sheetHeight / rect.h * 100}%`,
      backgroundPosition: `${layout.sheetWidth === rect.w ? 0 : rect.x / (layout.sheetWidth - rect.w) * 100}% ${layout.sheetHeight === rect.h ? 0 : rect.y / (layout.sheetHeight - rect.h) * 100}%`,
      backgroundRepeat: "no-repeat",
      // Filter the actual painted frame before ancestor scaling/jumping. A filter
      // on the nominal actor box can clip overflowing heads in WebKit (313665).
      filter: visualFilter,
      transform: `translateY(${(22 + root) / 240 * 100}%) scale(${idle ? 1 : spriteStateScale(id, state)}) scaleX(${flip ? -1 : 1})`,
      transformOrigin: "50% 90.8333333333%",
    }} />;
  return <div className={`relative select-none pointer-events-none ${className}`} style={{ transform: `scale(${characterScale(id)})`, transformOrigin: "50% 100%", overflow: "visible" }} aria-hidden="true" data-character={id} data-character-scale={characterScale(id)} data-sprite-state={state} data-sprite-frame={frame.index}>
    {effectivePose === "jump" ? <JumpLift key={poseInfo?.startedAt} startedAt={poseInfo?.startedAt}>{texture}</JumpLift> : texture}
  </div>;
}
