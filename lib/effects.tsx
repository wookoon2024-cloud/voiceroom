"use client";

import React, { useEffect, useRef } from "react";

export type BgEffectType =
  | "off"
  | "snow"
  | "rain"
  | "steam"
  | "bubbles"
  | "stars"
  | "sakura"
  | "fireflies"
  | "hearts";

export interface BgEffectOption {
  id: BgEffectType;
  name: string;
  icon: string;
  desc: string;
  badge?: string;
}

export const BG_EFFECTS: BgEffectOption[] = [
  {
    id: "off",
    name: "효과 끄기",
    icon: "🚫",
    desc: "배경 시각 효과를 사용하지 않습니다",
  },
  {
    id: "snow",
    name: "눈 내리기",
    icon: "❄️",
    desc: "하얀 눈송이가 포근하게 흩날립니다",
    badge: "인기",
  },
  {
    id: "rain",
    name: "비 내리기",
    icon: "🌧️",
    desc: "감성적인 빗줄기와 물방울 파문이 내립니다",
    badge: "감성",
  },
  {
    id: "steam",
    name: "수증기 (온천 김)",
    icon: "♨️",
    desc: "따뜻한 수증기와 안개가 모락모락 피어오릅니다",
  },
  {
    id: "bubbles",
    name: "비누방울 날리기",
    icon: "🫧",
    desc: "영롱한 무지개빛 비누방울이 둥둥 떠다닙니다",
    badge: "추천",
  },
  {
    id: "stars",
    name: "별 떨어지기",
    icon: "🌠",
    desc: "반짝이는 별빛과 별똥별이 밤하늘에 쏟아집니다",
    badge: "낭만",
  },
  {
    id: "sakura",
    name: "벚꽃잎 흩날리기",
    icon: "🌸",
    desc: "분홍빛 벚꽃잎이 봄바람을 타고 날립니다",
  },
  {
    id: "fireflies",
    name: "반딧불이",
    icon: "✨",
    desc: "신비로운 황금빛 반딧불이가 은은하게 유영합니다",
  },
  {
    id: "hearts",
    name: "하트 둥둥",
    icon: "💕",
    desc: "사랑스러운 핑크빛 하트가 화면에 떠오릅니다",
  },
];

export interface SeatEmoteOption {
  id: string;
  emoji: string;
  impactEmoji: string;
  label: string;
  color: string;
  particles: string[];
  shakeType: "punch" | "love" | "laugh";
}

export const SEAT_EMOTES: SeatEmoteOption[] = [
  {
    id: "heart",
    emoji: "❤️",
    impactEmoji: "💖",
    label: "하트",
    color: "#f43f5e",
    particles: ["❤️", "💖", "💕", "✨"],
    shakeType: "love",
  },
  {
    id: "angry",
    emoji: "😡",
    impactEmoji: "💢",
    label: "화내기",
    color: "#ef4444",
    particles: ["💢", "🔥", "⚡", "😤"],
    shakeType: "punch",
  },
  {
    id: "laugh",
    emoji: "😂",
    impactEmoji: "🤣",
    label: "웃기",
    color: "#facc15",
    particles: ["😂", "🤣", "😆", "✨"],
    shakeType: "laugh",
  },
  {
    id: "punch",
    emoji: "👊",
    impactEmoji: "💥",
    label: "펀치",
    color: "#f97316",
    particles: ["💥", "👊", "⚡", "💫"],
    shakeType: "punch",
  },
  {
    id: "kiss",
    emoji: "😘",
    impactEmoji: "💋",
    label: "뽀뽀",
    color: "#ec4899",
    particles: ["💋", "💕", "💖", "✨"],
    shakeType: "love",
  },
  {
    id: "bomb",
    emoji: "💣",
    impactEmoji: "💥",
    label: "폭탄",
    color: "#ef4444",
    particles: ["💥", "🔥", "💨", "⚡"],
    shakeType: "punch",
  },
  {
    id: "cheer",
    emoji: "🎉",
    impactEmoji: "🎊",
    label: "축하",
    color: "#a855f7",
    particles: ["🎉", "🎊", "✨", "⭐"],
    shakeType: "laugh",
  },
  {
    id: "clap",
    emoji: "👏",
    impactEmoji: "🙌",
    label: "박수",
    color: "#38bdf8",
    particles: ["👏", "✨", "🌟", "👍"],
    shakeType: "laugh",
  },
  {
    id: "cry",
    emoji: "😭",
    impactEmoji: "💧",
    label: "눈물",
    color: "#60a5fa",
    particles: ["💧", "💦", "😭", "✨"],
    shakeType: "laugh",
  },
  {
    id: "fire",
    emoji: "🔥",
    impactEmoji: "🔥",
    label: "불꽃",
    color: "#fb923c",
    particles: ["🔥", "✨", "💥", "⚡"],
    shakeType: "punch",
  },
];

export interface FlyingEmoteItem {
  id: string;
  emoteId: string;
  fromSlot: number;
  toSlot: number;
  fromNick: string;
  toNick: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  createdAt: number;
}

/**
 * 배경 시각 효과 캔버스 (눈, 비, 수증기, 비누방울, 별 떨어지기, 벚꽃, 반딧불이, 하트)
 * speed: 20 ~ 250 (기본값 100 = 1.0x 배속)
 */
export const BackgroundEffectCanvas: React.FC<{ effect: BgEffectType; speed?: number; worldWidth?: number; worldHeight?: number }> = ({
  effect,
  speed = 100, worldWidth, worldHeight,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const speedRef = useRef<number>(speed);

  useEffect(() => {
    speedRef.current = Math.max(20, Math.min(250, speed));
  }, [speed]);

  useEffect(() => {
    if (effect === "off") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let width = (canvas.width = worldWidth ?? window.innerWidth);
    let height = (canvas.height = worldHeight ?? window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = worldWidth ?? window.innerWidth;
      height = canvas.height = worldHeight ?? window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // 파티클 데이터 초기화
    const particles: any[] = [];
    const splashes: any[] = [];

    if (effect === "snow") {
      const count = Math.min(95, Math.max(45, Math.floor(width / 16)));
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: 1.5 + Math.random() * 4.2,
          vy: 0.6 + Math.random() * 1.5,
          vx: (Math.random() - 0.5) * 0.6,
          phase: Math.random() * Math.PI * 2,
          swaySpeed: 0.012 + Math.random() * 0.02,
          alpha: 0.35 + Math.random() * 0.6,
        });
      }
    } else if (effect === "rain") {
      const count = Math.min(120, Math.max(60, Math.floor(width / 12)));
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          len: 14 + Math.random() * 22,
          vy: 11 + Math.random() * 8,
          vx: -1.8 - Math.random() * 1.2,
          alpha: 0.25 + Math.random() * 0.45,
          thickness: 1 + Math.random() * 1.2,
        });
      }
    } else if (effect === "steam") {
      const count = 28;
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: height * 0.35 + Math.random() * (height * 0.75),
          r: 45 + Math.random() * 85,
          vy: 0.4 + Math.random() * 0.85,
          phase: Math.random() * Math.PI * 2,
          maxAlpha: 0.07 + Math.random() * 0.11,
          life: Math.random(),
          lifeSpeed: 0.002 + Math.random() * 0.003,
        });
      }
    } else if (effect === "bubbles") {
      const count = Math.min(36, Math.max(20, Math.floor(width / 40)));
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: 8 + Math.random() * 22,
          vy: 0.5 + Math.random() * 1.2,
          phase: Math.random() * Math.PI * 2,
          swayAmp: 0.4 + Math.random() * 1.1,
          hue: Math.random() * 360,
          alpha: 0.35 + Math.random() * 0.4,
        });
      }
    } else if (effect === "stars") {
      // 배경 반짝이는 별
      const starCount = Math.min(85, Math.max(45, Math.floor(width / 18)));
      for (let i = 0; i < starCount; i++) {
        particles.push({
          kind: "twinkle",
          x: Math.random() * width,
          y: Math.random() * (height * 0.85),
          r: 1 + Math.random() * 2.4,
          phase: Math.random() * Math.PI * 2,
          speed: 0.02 + Math.random() * 0.04,
          hue: [45, 195, 280, 0][Math.floor(Math.random() * 4)],
        });
      }
      // 별똥별 (유성)
      for (let i = 0; i < 5; i++) {
        particles.push({
          kind: "meteor",
          x: Math.random() * width * 1.2,
          y: Math.random() * height * 0.5,
          vx: -6 - Math.random() * 6,
          vy: 4 + Math.random() * 4.5,
          len: 55 + Math.random() * 65,
          alpha: 0.7 + Math.random() * 0.3,
          delay: Math.random() * 120,
        });
      }
    } else if (effect === "sakura") {
      const count = Math.min(55, Math.max(28, Math.floor(width / 25)));
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: 5 + Math.random() * 7,
          vy: 0.8 + Math.random() * 1.4,
          vx: 0.5 + Math.random() * 1.2,
          angle: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 0.04,
          flip: Math.random() * Math.PI * 2,
          flipSpeed: 0.03 + Math.random() * 0.04,
          alpha: 0.55 + Math.random() * 0.35,
        });
      }
    } else if (effect === "fireflies") {
      const count = Math.min(45, Math.max(24, Math.floor(width / 32)));
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: 2 + Math.random() * 3.5,
          angle: Math.random() * Math.PI * 2,
          speed: 0.4 + Math.random() * 0.9,
          phase: Math.random() * Math.PI * 2,
          hue: 50 + Math.random() * 40,
        });
      }
    } else if (effect === "hearts") {
      const count = Math.min(32, Math.max(18, Math.floor(width / 45)));
      const colors = ["#fb7185", "#f43f5e", "#f472b6", "#e879f9", "#fda4af"];
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: 8 + Math.random() * 12,
          vy: 0.6 + Math.random() * 1.1,
          phase: Math.random() * Math.PI * 2,
          alpha: 0.35 + Math.random() * 0.45,
          color: colors[i % colors.length],
        });
      }
    }

    const drawHeart = (cx: number, cy: number, size: number, color: string, alpha: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      const s = size * 0.5;
      ctx.moveTo(0, s * 0.4);
      ctx.bezierCurveTo(0, -s * 0.3, -s, -s * 0.3, -s, s * 0.25);
      ctx.bezierCurveTo(-s, s * 0.8, 0, s * 1.15, 0, s * 1.45);
      ctx.bezierCurveTo(0, s * 1.15, s, s * 0.8, s, s * 0.25);
      ctx.bezierCurveTo(s, -s * 0.3, 0, -s * 0.3, 0, s * 0.4);
      ctx.fill();
      ctx.restore();
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      const sm = Math.max(0.2, Math.min(2.5, speedRef.current / 100));

      if (effect === "snow") {
        for (const p of particles) {
          p.phase += p.swaySpeed * sm;
          p.y += p.vy * sm;
          p.x += (p.vx + Math.sin(p.phase) * 0.55) * sm;
          if (p.y > height + 10) {
            p.y = -10;
            p.x = Math.random() * width;
          }
          if (p.x > width + 10) p.x = -10;
          if (p.x < -10) p.x = width + 10;

          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          grad.addColorStop(0, `rgba(255, 255, 255, ${p.alpha})`);
          grad.addColorStop(0.6, `rgba(224, 242, 254, ${p.alpha * 0.6})`);
          grad.addColorStop(1, "rgba(255, 255, 255, 0)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (effect === "rain") {
        ctx.lineCap = "round";
        for (const p of particles) {
          p.x += p.vx * sm;
          p.y += p.vy * sm;
          if (p.y > height) {
            if (splashes.length < 35 && Math.random() < 0.35) {
              splashes.push({
                x: p.x,
                y: height - 4 - Math.random() * 18,
                r: 1,
                maxR: 6 + Math.random() * 10,
                alpha: 0.45,
              });
            }
            p.y = -20;
            p.x = Math.random() * (width + 120);
          }
          const grad = ctx.createLinearGradient(p.x, p.y, p.x - p.vx * 1.4, p.y - p.len);
          grad.addColorStop(0, `rgba(186, 230, 253, ${p.alpha})`);
          grad.addColorStop(1, "rgba(186, 230, 253, 0)");
          ctx.strokeStyle = grad;
          ctx.lineWidth = p.thickness;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 1.4, p.y - p.len);
          ctx.stroke();
        }
        for (let i = splashes.length - 1; i >= 0; i--) {
          const s = splashes[i];
          s.r += 0.45 * sm;
          s.alpha -= 0.025 * sm;
          if (s.alpha <= 0 || s.r >= s.maxR) {
            splashes.splice(i, 1);
            continue;
          }
          ctx.strokeStyle = `rgba(186, 230, 253, ${s.alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(s.x, s.y, s.r * 1.6, s.r * 0.5, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (effect === "steam") {
        for (const p of particles) {
          p.life += p.lifeSpeed * sm;
          p.phase += 0.01 * sm;
          p.y -= p.vy * sm;
          p.x += Math.sin(p.phase) * 0.45 * sm;
          if (p.life >= 1 || p.y < -p.r) {
            p.life = 0;
            p.y = height + p.r * 0.5;
            p.x = Math.random() * width;
          }
          const curAlpha = Math.sin(p.life * Math.PI) * p.maxAlpha;
          const curR = p.r * (0.85 + p.life * 0.55);
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, curR);
          grad.addColorStop(0, `rgba(241, 245, 249, ${curAlpha})`);
          grad.addColorStop(0.5, `rgba(226, 232, 240, ${curAlpha * 0.5})`);
          grad.addColorStop(1, "rgba(255, 255, 255, 0)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, curR, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (effect === "bubbles") {
        for (const p of particles) {
          p.phase += 0.02 * sm;
          p.hue = (p.hue + 0.6 * sm) % 360;
          p.y -= p.vy * sm;
          p.x += Math.sin(p.phase) * p.swayAmp * sm;
          if (p.y < -p.r * 2) {
            p.y = height + p.r * 2;
            p.x = Math.random() * width;
          }
          ctx.save();
          const grad = ctx.createRadialGradient(
            p.x - p.r * 0.3,
            p.y - p.r * 0.3,
            p.r * 0.1,
            p.x,
            p.y,
            p.r
          );
          grad.addColorStop(0, "rgba(255, 255, 255, 0.04)");
          grad.addColorStop(0.7, `hsla(${p.hue}, 85%, 75%, ${p.alpha * 0.35})`);
          grad.addColorStop(1, `hsla(${(p.hue + 60) % 360}, 90%, 80%, ${p.alpha})`);
          ctx.fillStyle = grad;
          ctx.strokeStyle = `hsla(${p.hue}, 90%, 85%, ${p.alpha * 0.9})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // 비누방울 하이라이트 반사광
          ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.95})`;
          ctx.beginPath();
          ctx.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, Math.max(1.5, p.r * 0.16), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      } else if (effect === "stars") {
        for (const p of particles) {
          if (p.kind === "twinkle") {
            p.phase += p.speed * sm;
            const a = 0.2 + ((Math.sin(p.phase) + 1) * 0.5) * 0.75;
            ctx.save();
            ctx.fillStyle = p.hue === 0 ? `rgba(255,255,255,${a})` : `hsla(${p.hue}, 90%, 85%, ${a})`;
            ctx.shadowColor = "rgba(255, 255, 255, 0.9)";
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          } else if (p.kind === "meteor") {
            if (p.delay > 0) {
              p.delay -= 1 * sm;
              continue;
            }
            p.x += p.vx * sm;
            p.y += p.vy * sm;
            const tailX = p.x - p.vx * (p.len / 8);
            const tailY = p.y - p.vy * (p.len / 8);
            const grad = ctx.createLinearGradient(p.x, p.y, tailX, tailY);
            grad.addColorStop(0, `rgba(255, 255, 255, ${p.alpha})`);
            grad.addColorStop(0.3, `rgba(191, 219, 254, ${p.alpha * 0.6})`);
            grad.addColorStop(1, "rgba(255, 255, 255, 0)");
            ctx.save();
            ctx.strokeStyle = grad;
            ctx.lineWidth = 2.2;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(tailX, tailY);
            ctx.stroke();

            // 유성 헤드 반짝임
            ctx.fillStyle = "#ffffff";
            ctx.shadowColor = "#60a5fa";
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            if (p.x < -100 || p.y > height + 100) {
              p.x = width * (0.3 + Math.random() * 0.9);
              p.y = -20 - Math.random() * 80;
              p.delay = 25 + Math.random() * 140;
            }
          }
        }
      } else if (effect === "sakura") {
        for (const p of particles) {
          p.y += p.vy * sm;
          p.x += (p.vx + Math.sin(p.flip) * 0.4) * sm;
          p.angle += p.spin * sm;
          p.flip += p.flipSpeed * sm;
          if (p.y > height + 15) {
            p.y = -15;
            p.x = Math.random() * width;
          }
          if (p.x > width + 15) p.x = -15;

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.scale(1, 0.55 + Math.abs(Math.cos(p.flip)) * 0.45);
          ctx.globalAlpha = p.alpha;
          const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, p.size);
          grad.addColorStop(0, "#ffe4e6");
          grad.addColorStop(0.7, "#fda4af");
          grad.addColorStop(1, "#fb7185");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.bezierCurveTo(p.size, -p.size * 0.6, p.size * 0.8, p.size * 0.7, 0, p.size);
          ctx.bezierCurveTo(-p.size * 0.8, p.size * 0.7, -p.size, -p.size * 0.6, 0, -p.size);
          ctx.fill();
          ctx.restore();
        }
      } else if (effect === "fireflies") {
        for (const p of particles) {
          p.phase += 0.035 * sm;
          p.angle += (Math.random() - 0.5) * 0.15 * sm;
          p.x += Math.cos(p.angle) * p.speed * sm;
          p.y += Math.sin(p.angle) * p.speed * sm;
          if (p.x < -20) p.x = width + 20;
          if (p.x > width + 20) p.x = -20;
          if (p.y < -20) p.y = height + 20;
          if (p.y > height + 20) p.y = -20;

          const glow = 0.25 + ((Math.sin(p.phase) + 1) * 0.5) * 0.75;
          const rad = p.r * 4.5;
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
          grad.addColorStop(0, `hsla(${p.hue}, 100%, 85%, ${glow})`);
          grad.addColorStop(0.4, `hsla(${p.hue}, 95%, 60%, ${glow * 0.45})`);
          grad.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (effect === "hearts") {
        for (const p of particles) {
          p.phase += 0.025 * sm;
          p.y -= p.vy * sm;
          p.x += Math.sin(p.phase) * 0.6 * sm;
          if (p.y < -25) {
            p.y = height + 25;
            p.x = Math.random() * width;
          }
          drawHeart(p.x, p.y, p.size, p.color, p.alpha);
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, [effect, worldWidth, worldHeight]);

  if (effect === "off") return null;

  return (
    <canvas
      ref={canvasRef}
      data-effect-coordinates={worldWidth ? "world" : "screen"}
      className={`${worldWidth ? "absolute z-[1500]" : "fixed z-[15]"} inset-0 pointer-events-none`}
    />
  );
};

/**
 * 내 좌석에서 상대방 좌석으로 날아가는 감정표현 투사체 & 타격 이펙트 오버레이
 */
export const FlyingEmoteOverlay: React.FC<{ flights: FlyingEmoteItem[] }> = ({ flights }) => {
  const [, setTick] = React.useState(0);

  useEffect(() => {
    if (flights.length === 0) return;
    let raf = 0;
    const loop = () => {
      setTick((t) => (t + 1) % 1000000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [flights.length]);

  if (flights.length === 0) return null;

  const now = performance.now();
  const FLIGHT_MS = 560;
  const IMPACT_MS = 720;

  return (
    <div className="fixed inset-0 pointer-events-none z-[85] overflow-hidden">
      {flights.map((f) => {
        const emote = SEAT_EMOTES.find((e) => e.id === f.emoteId) || SEAT_EMOTES[0];
        const elapsed = Math.max(0, now - f.createdAt);
        if (elapsed > FLIGHT_MS + IMPACT_MS) return null;

        const dx = f.endX - f.startX;
        const dy = f.endY - f.startY;
        const dist = Math.hypot(dx, dy);
        const arcLift = Math.max(55, Math.min(160, dist * 0.34));
        const midX = (f.startX + f.endX) / 2;
        const midY = Math.min(f.startY, f.endY) - arcLift;

        const getPointOnArc = (t: number) => {
          const u = 1 - t;
          return {
            x: u * u * f.startX + 2 * u * t * midX + t * t * f.endX,
            y: u * u * f.startY + 2 * u * t * midY + t * t * f.endY,
          };
        };

        if (elapsed <= FLIGHT_MS) {
          const rawT = elapsed / FLIGHT_MS;
          const t = rawT < 0.5 ? 2 * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 2) / 2;
          const pos = getPointOnArc(t);
          const scale = 0.85 + Math.sin(t * Math.PI) * 0.75;
          const rot =
            emote.id === "punch"
              ? (Math.atan2(dy, dx) * 180) / Math.PI
              : emote.id === "bomb" || emote.id === "laugh"
              ? t * 540
              : Math.sin(t * Math.PI * 3) * 22;

          const trails = [0.06, 0.12, 0.18, 0.24]
            .map((offset, idx) => {
              const tt = Math.max(0, t - offset);
              if (tt <= 0) return null;
              const tp = getPointOnArc(tt);
              return (
                <div
                  key={idx}
                  style={{
                    left: tp.x,
                    top: tp.y,
                    transform: `translate(-50%, -50%) scale(${Math.max(0.3, scale * (0.75 - idx * 0.15))})`,
                    opacity: Math.max(0.1, 0.55 - idx * 0.12),
                    filter: `drop-shadow(0 0 8px ${emote.color})`,
                  }}
                  className="absolute text-xl md:text-2xl select-none"
                >
                  {emote.particles[idx % emote.particles.length]}
                </div>
              );
            })
            .filter(Boolean);

          return (
            <React.Fragment key={f.id}>
              {trails}
              <div
                style={{
                  left: pos.x,
                  top: pos.y,
                  transform: `translate(-50%, -50%) scale(${scale}) rotate(${rot}deg)`,
                  filter: `drop-shadow(0 0 14px ${emote.color})`,
                }}
                className="absolute text-3xl md:text-4xl select-none"
              >
                {emote.emoji}
              </div>
            </React.Fragment>
          );
        } else {
          const ip = (elapsed - FLIGHT_MS) / IMPACT_MS;
          const fade = Math.max(0, 1 - ip);
          const ringScale = 0.4 + ip * 2.2;
          const centerScale = ip < 0.25 ? 0.8 + (ip / 0.25) * 0.9 : Math.max(0.5, 1.7 - (ip - 0.25) * 1.2);
          const burstAngles = [0, 45, 90, 135, 180, 225, 270, 315];

          return (
            <React.Fragment key={f.id}>
              <div
                style={{
                  left: f.endX,
                  top: f.endY,
                  width: 56,
                  height: 56,
                  borderColor: emote.color,
                  boxShadow: `0 0 18px ${emote.color}`,
                  transform: `translate(-50%, -50%) scale(${ringScale})`,
                  opacity: fade * 0.85,
                }}
                className="absolute rounded-full border-2"
              />
              {burstAngles.map((deg, idx) => {
                const rad = (deg * Math.PI) / 180;
                const radius = 12 + ip * 58;
                const bx = f.endX + Math.cos(rad) * radius;
                const by = f.endY + Math.sin(rad) * radius + ip * ip * 18;
                return (
                  <div
                    key={idx}
                    style={{
                      left: bx,
                      top: by,
                      transform: `translate(-50%, -50%) scale(${1.1 - ip * 0.5})`,
                      opacity: fade,
                      filter: `drop-shadow(0 0 6px ${emote.color})`,
                    }}
                    className="absolute text-base md:text-xl select-none"
                  >
                    {emote.particles[idx % emote.particles.length]}
                  </div>
                );
              })}
              <div
                style={{
                  left: f.endX,
                  top: f.endY,
                  transform: `translate(-50%, -50%) scale(${centerScale})`,
                  opacity: fade,
                  filter: `drop-shadow(0 0 16px ${emote.color})`,
                }}
                className="absolute text-4xl md:text-5xl select-none"
              >
                {emote.impactEmoji}
              </div>
              <div
                style={{
                  left: f.endX,
                  top: f.endY - 34 - ip * 22,
                  transform: "translate(-50%, -50%)",
                  opacity: fade,
                  borderColor: emote.color,
                }}
                className="absolute px-2 py-0.5 rounded-full bg-slate-950/90 border text-[10px] md:text-xs font-bold text-white whitespace-nowrap shadow-lg"
              >
                {f.fromNick} {emote.emoji}
              </div>
            </React.Fragment>
          );
        }
      })}
    </div>
  );
};
