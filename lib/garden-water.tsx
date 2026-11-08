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
        // Move the water's own painted texture, not only a nearly invisible white overlay.
        // The final mask keeps the rim, foliage and fountain stone completely still.
        for (let y = 0; y < height; y += 3) {
          const shift = Math.sin(y * 0.11 + time * 2.0) * 2.2 + Math.sin(y * 0.047 - time * 1.3);
          ctx.drawImage(image, 0, y / height * image.height, image.width, 3 / height * image.height,
            shift, y, width, 3);
        }
        // Two crossing wave families, with visible but gentle reflected highlights.
        for (let row = 0; row < 17; row++) {
          ctx.beginPath();
          for (let x = 0; x <= width; x += 5) {
            const y = row * 17 + Math.sin(x * 0.032 + time * 1.2 + row * 0.83) * 7 + Math.sin(x * 0.06 - time * 0.9 + row) * 3;
            if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = `rgba(225,255,253,${0.15 + (Math.sin(time + row) + 1) * 0.08})`;
          ctx.lineWidth = 2; ctx.stroke();
        }
        for (let ring = 0; ring < 4; ring++) {
          const phase = (time * 0.42 + ring / 4) % 1;
          ctx.beginPath();
          ctx.ellipse(width * 0.50, height * 0.51, width * (0.035 + phase * 0.38), height * (0.02 + phase * 0.21), 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(231,255,255,${(1 - phase) * 0.65})`;
          ctx.lineWidth = 2.2; ctx.stroke();
        }
        ctx.globalCompositeOperation = "destination-in";
        ctx.drawImage(mask, 0, 0);
        ctx.globalCompositeOperation = "source-over";
        // Flowing centre jet and falling droplets give the fountain a clear motion cue.
        ctx.lineCap = "round";
        for (let jet = -1; jet <= 1; jet++) {
          const sway = Math.sin(time * 3.4 + jet) * 2;
          ctx.beginPath();
          ctx.moveTo(width * 0.505, height * 0.403);
          ctx.quadraticCurveTo(width * 0.505 + jet * 11 + sway, height * 0.235,
            width * 0.505 + jet * 16 + sway, height * (jet ? 0.35 : 0.265));
          ctx.strokeStyle = "rgba(226,255,255,0.88)"; ctx.lineWidth = jet ? 2 : 3;
          ctx.stroke();
        }
        for (let drop = 0; drop < 10; drop++) {
          const phase = (time * 1.25 + drop / 10) % 1;
          const side = drop % 2 ? 1 : -1;
          const x = width * 0.505 + side * (8 + phase * 24);
          const y = height * 0.34 - Math.sin(phase * Math.PI) * 12 + phase * 27;
          ctx.globalAlpha = Math.sin(phase * Math.PI) * 0.9;
          ctx.fillStyle = "#eaffff";
          ctx.beginPath(); ctx.ellipse(x, y, 1.5, 2.5, side * -0.3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      };
      paint();
      if (!reduced) timer = setInterval(paint, 1000 / 30);
    }).catch(() => { /* The painted water in the base prop remains visible if an overlay cannot load. */ });
    return () => { stopped = true; if (timer) clearInterval(timer); };
  }, [src]);
  return <canvas ref={canvasRef} data-water-animation aria-hidden="true" className="absolute inset-0 h-full w-full pointer-events-none" />;
}
