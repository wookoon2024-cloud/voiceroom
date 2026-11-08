import { festiveBrightness, type FestiveLightKind } from "./festive-lights";

type Light = { glow: HTMLElement; shade: HTMLElement; phase: number; kind: FestiveLightKind };
const lights = new Set<Light>();
let timer: ReturnType<typeof setInterval> | undefined;

/** One small clock for every lamp: no React renders or repeated canvas painting. */
export function registerFestiveLight(light: Light) {
  const paint = () => {
    const seconds = performance.now() / 1000;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const entry of lights) {
      const level = festiveBrightness(seconds, entry.phase, reduced, entry.kind);
      entry.glow.style.opacity = level.toFixed(4);
      entry.shade.style.opacity = (1 - level).toFixed(4);
    }
  };
  lights.add(light);
  paint();
  timer ??= setInterval(paint, 50);
  return () => {
    lights.delete(light);
    if (!lights.size && timer !== undefined) { clearInterval(timer); timer = undefined; }
  };
}
