"use client";

import { useEffect, useRef } from "react";

/** Animated light on water pixels only: the stone rim, leaves and ground never move. */
export function GardenWater({ src }: { src: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const image = new window.Image();
    image.src = src;
    image.decode().then(() => {
      if (stopped) return;
      const width = 384, height = 288;
      canvas.width = width; canvas.height = height;
      const mask = document.createElement("canvas");
      mask.width = width; mask.height = height;
      const m = mask.getContext("2d")!;
      m.drawImage(image, 0, 0, width, height);
      const pixels = m.getImageData(0, 0, width, height);
      for (let i = 0; i < pixels.data.length; i += 4) {
        const [r, g, b, alpha] = pixels.data.slice(i, i + 4);
        // Teal water and blue-white spout highlights; exclude green foliage and tan stone.
        const water = g > r + 12 && b > r + 10 && b > g * 0.72 && alpha > 100;
        pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 255;
        pixels.data[i + 3] = water ? alpha : 0;
      }
      m.putImageData(pixels, 0, 0);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const start = performance.now();
      const paint = () => {
        if (stopped || document.hidden) return;
        const time = reduced ? 0 : (performance.now() - start) / 1000;
        ctx.clearRect(0, 0, width, height);
        ctx.globalCompositeOperation = "source-over";
        // Two overlapping low-amplitude wave families create a slowly changing caustic pattern.
        for (let row = 0; row < 17; row++) {
          ctx.beginPath();
          for (let x = 0; x <= width; x += 5) {
            const y = row * 17 + Math.sin(x * 0.032 + time * 0.65 + row * 0.83) * 7 + Math.sin(x * 0.06 - time * 0.45 + row) * 3;
            if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = `rgba(225,255,253,${0.08 + (Math.sin(time * 0.5 + row) + 1) * 0.035})`;
          ctx.lineWidth = 1.8; ctx.stroke();
        }
        for (let ring = 0; ring < 4; ring++) {
          const phase = (time * 0.16 + ring / 4) % 1;
          ctx.beginPath();
          ctx.ellipse(width * 0.50, height * 0.51, width * (0.035 + phase * 0.38), height * (0.02 + phase * 0.21), 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(231,255,255,${(1 - phase) * 0.22})`;
          ctx.lineWidth = 1.4; ctx.stroke();
        }
        ctx.globalCompositeOperation = "destination-in";
        ctx.drawImage(mask, 0, 0);
      };
      paint();
      if (!reduced) timer = setInterval(paint, 50);
    }).catch(() => { /* The painted water in the base prop remains visible if an overlay cannot load. */ });
    return () => { stopped = true; if (timer) clearInterval(timer); };
  }, [src]);
  return <canvas ref={canvasRef} data-water-animation aria-hidden="true" className="absolute inset-0 h-full w-full pointer-events-none" />;
}
