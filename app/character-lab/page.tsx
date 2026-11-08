"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { characterAssetRoot, characterScale, spriteStateScale, JUMP_ROOT_OFFSETS_V2, SPRITE_CHARACTERS_V2, SPRITE_STATES_V2, spriteFrameV2, type SpriteCharacterV2, type SpriteManifestV2 } from "@/lib/sprite-v2";
import { SOCIAL_ACTIONS, socialContactOffset, type SocialAction } from "@/lib/social-actions";
import { CHARACTER_CONCEPTS } from "@/lib/character-concepts";
import styles from "./preview.module.css";

type Asset = { manifest: SpriteManifestV2; image: HTMLImageElement };
type Action = { state: string; start: number; mirror?: boolean };


export default function CharacterLab() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const extraAssets = useRef<Partial<Record<SpriteCharacterV2, Asset>>>({});
  const assets = useRef<Partial<Record<SpriteCharacterV2, Asset>>>({});
  const action = useRef<Action>({ state: "down_idle", start: 0 });
  const pair = useRef<{ kind: SocialAction; start: number } | null>(null);
  const keys = useRef(new Set<string>());
  const clock = useRef(0);
  const position = useRef({ x: 320, y: 350 });
  const selection = useRef<[SpriteCharacterV2, SpriteCharacterV2]>(["cute_male_v2", "strong_male_v2"]);
  const [first, setFirst] = useState<SpriteCharacterV2>("cute_male_v2");
  const [second, setSecond] = useState<SpriteCharacterV2>("strong_male_v2");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [label, setLabel] = useState("정면 대기");
  const [guides, setGuides] = useState(false);
  const showGuides = useRef(false);

  function play(state: string, mirror = false, startedAt = clock.current) {
    pair.current = null;
    keys.current.clear();
    action.current = { state, mirror, start: startedAt };
    setLabel(mirror ? "왼쪽 걷기" : SPRITE_STATES_V2[state]);
  }
  function interact(kind: SocialAction, startedAt: number) {
    keys.current.clear();
    pair.current = { kind, start: startedAt };
    setLabel(`${SOCIAL_ACTIONS[kind].name} · 두 캐릭터 동작`);
  }

  useEffect(() => {
    let active = true;
    Promise.all(SPRITE_CHARACTERS_V2.map(async ({ id }) => {
      const response = await fetch(`${characterAssetRoot(id)}/manifest.json`);
      if (!response.ok) throw new Error("캐릭터 에셋을 불러오지 못했습니다.");
      const manifest: SpriteManifestV2 = await response.json();
      const image = new window.Image();
      image.src = `${characterAssetRoot(id)}/${manifest.sprite_sheet_alpha}`;
      await image.decode();
      if (active) assets.current[id] = { manifest, image };
      const extraResponse = await fetch(`${characterAssetRoot(id, true)}/manifest.json`);
      if (!extraResponse.ok) throw new Error("새 상호작용을 불러오지 못했습니다.");
      const extraManifest: SpriteManifestV2 = await extraResponse.json();
      const extraImage = new window.Image();
      extraImage.src = `${characterAssetRoot(id, true)}/${extraManifest.sprite_sheet_alpha}`;
      await extraImage.decode();
      if (active) extraAssets.current[id] = { manifest: extraManifest, image: extraImage };
    })).then(() => { if (active) setReady(true); }).catch(e => { if (active) setError(String(e.message)); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx || !ready) return;
    let last = 0;
    const scale = 0.74;
    const W = 960, H = 490;
    const draw = (id: SpriteCharacterV2, state: string, elapsed: number, x: number, y: number, mirror = false) => {
      const asset = extraAssets.current[id]?.manifest.frame_layout.rows[state] ? extraAssets.current[id] : assets.current[id];
      if (!asset) return;
      const frame = spriteFrameV2(asset.manifest, state, elapsed);
      if (!frame) return;
      const r = frame.rect;
      ctx.save();
      const bodyScale = characterScale(id);
      ctx.translate(x, y + (state === "down_jump" ? JUMP_ROOT_OFFSETS_V2[frame.index] * scale * bodyScale : 0));
      ctx.scale(bodyScale * spriteStateScale(id, state), bodyScale * spriteStateScale(id, state));
      if (mirror) ctx.scale(-1, 1);
      // Fixed cell and scale for every pose; a shared root track places the jump above ground.
      ctx.drawImage(asset.image, r.x, r.y, r.w, r.h, -96 * scale, -218 * scale, r.w * scale, r.h * scale);
      if (showGuides.current) {
        ctx.strokeStyle = "#ffffff42";
        ctx.strokeRect(-96 * scale, -218 * scale, r.w * scale, r.h * scale);
        ctx.fillStyle = "#ffbe74";
        ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    };
    const tick = (now: number) => {
      clock.current = now;
      const dt = Math.min(0.04, last ? (now - last) / 1000 : 0);
      last = now;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#182b31"; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#294048"; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 10; y < H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      const [a, b] = selection.current;
      const p = position.current;
      const social = pair.current;
      const current = action.current;
      const jump = current.state === "down_jump" && !spriteFrameV2(assets.current[a]!.manifest, current.state, now - current.start)?.ended;
      if (!social && !jump && keys.current.size) {
        const dx = Number(keys.current.has("ArrowRight") || keys.current.has("d")) - Number(keys.current.has("ArrowLeft") || keys.current.has("a"));
        const dy = Number(keys.current.has("ArrowDown") || keys.current.has("s")) - Number(keys.current.has("ArrowUp") || keys.current.has("w"));
        const norm = Math.hypot(dx, dy) || 1;
        p.x = Math.max(85, Math.min(875, p.x + dx / norm * dt * 135));
        p.y = Math.max(190, Math.min(440, p.y + dy / norm * dt * 135));
        if (dx || dy) {
          const state = dx ? "side_walk" : dy < 0 ? "up_walk" : "down_walk";
          if (current.state !== state || current.mirror !== (dx < 0)) action.current = { state, mirror: dx < 0, start: now };
        }
      }
      const shadow = (x: number, y: number, selected = false) => {
        ctx.fillStyle = selected ? "#96dfbd2c" : "#00000035";
        ctx.beginPath(); ctx.ellipse(x, y + 2, 27, 7, 0, 0, Math.PI * 2); ctx.fill();
        if (selected) { ctx.strokeStyle = "#b5e7c7"; ctx.stroke(); }
      };
      if (social) {
        const elapsed = now - social.start;
        const state = `side_${social.kind}_send`;
        const receiving = `side_${social.kind}_receive`;
        const senderManifest = extraAssets.current[a]!.manifest.frame_layout.rows[state] ? extraAssets.current[a]!.manifest : assets.current[a]!.manifest;
        const receiverManifest = extraAssets.current[b]!.manifest.frame_layout.rows[receiving] ? extraAssets.current[b]!.manifest : assets.current[b]!.manifest;
        const frame = spriteFrameV2(senderManifest, state, elapsed);
        const receiver = spriteFrameV2(receiverManifest, receiving, elapsed);
        // Contact alignment is a prototype until the measured per-frame anchors are calibrated.
        const contact = socialContactOffset(social.kind, characterScale(a) * spriteStateScale(a, state), characterScale(b) * spriteStateScale(b, receiving), 192 * scale);
        const gap = contact.gap;
        shadow(480 - gap / 2, 350 + contact.footY); shadow(480 + gap / 2, 350);
        draw(b, receiving, elapsed, 480 + gap / 2, 350, true);
        draw(a, state, elapsed, 480 - gap / 2, 350 + contact.footY);
        if (frame?.ended && receiver?.ended) {
          pair.current = null;
          action.current = { state: "down_idle", start: now };
          position.current = { x: 320, y: 350 };
          setLabel("정면 대기");
        }
      } else {
        shadow(p.x, p.y, true); shadow(650, 350);
        draw(b, "down_idle", now, 650, 350);
        const currentAction = action.current;
        draw(a, currentAction.state, now - currentAction.start, p.x, p.y, currentAction.mirror);
        const frame = spriteFrameV2(assets.current[a]!.manifest, currentAction.state, now - currentAction.start);
        if (frame?.ended) { action.current = { state: "down_idle", start: now }; setLabel("정면 대기"); }
        ctx.fillStyle = "#d4e7e3"; ctx.font = "13px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("내 캐릭터", p.x, p.y + 32); ctx.fillText("상대 캐릭터", 650, 382);
      }
    };
    // A modest fixed preview tick keeps short one-shots visible when an embedded browser
    // suppresses animation-frame callbacks while its window is partly occluded.
    const timer = window.setInterval(() => tick(performance.now()), 1000 / 30);
    return () => window.clearInterval(timer);
  }, [ready]);

  function change(slot: 0 | 1, id: SpriteCharacterV2) {
    selection.current[slot] = id;
    if (slot === 0) setFirst(id); else setSecond(id);
    play("down_idle");
  }

  return <main className={styles.page}>
    <header className={styles.header}><div><span className={styles.eyebrow}>보이스룸 · 새 캐릭터</span><h1>캐릭터 모션 미리보기</h1><p>각자의 키와 체형을 유지하는 전신 캐릭터. 조합을 바꿔가며 동작을 확인해 보세요.</p></div><Link href="/">보이스룸으로 돌아가기 ↗</Link></header>
    <section className={styles.layout}>
      <div className={styles.stagePanel}><div className={styles.stageBar}><span><i className={styles.dot} />{ready ? label : error || "캐릭터 불러오는 중…"}</span><label><input type="checkbox" checked={guides} onChange={e => { setGuides(e.target.checked); showGuides.current = e.target.checked; }} /> 크기·발 기준 보기</label></div>
        <canvas ref={canvas} width={960} height={490} tabIndex={0} aria-label="캐릭터 모션 게임 미리보기. 방향키로 이동하고 스페이스로 점프하세요." onKeyDown={e => { if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," ","w","a","s","d"].includes(e.key)) { e.preventDefault(); if (e.key === " ") { if (!e.repeat) play("down_jump", false, e.timeStamp); } else keys.current.add(e.key); } }} onKeyUp={e => { keys.current.delete(e.key); if (!keys.current.size && action.current.state.endsWith("walk")) play("down_idle", false, e.timeStamp); }} onBlur={() => keys.current.clear()} />
        <div className={styles.hint}>화면을 클릭한 뒤 <kbd>방향키</kbd> 또는 <kbd>W A S D</kbd> 이동 · <kbd>스페이스</kbd> 정면 점프</div>
      </div>
      <aside className={styles.controls}>
        <h2>캐릭터 조합</h2>{([0,1] as const).map(slot => <label key={slot} className={styles.selectLabel}>{slot === 0 ? "내 캐릭터" : "상대 캐릭터"}<select value={slot === 0 ? first : second} onChange={e => change(slot, e.target.value as SpriteCharacterV2)}>{SPRITE_CHARACTERS_V2.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>)}
        <h2>공통 동작</h2><div className={styles.buttons}>{["down_idle","down_walk","up_walk","side_walk","down_talk","down_jump"].map(s => <button disabled={!ready} key={s} onClick={e => play(s, false, e.timeStamp)}>{SPRITE_STATES_V2[s]}</button>)}<button disabled={!ready} onClick={e => play("side_walk", true, e.timeStamp)}>왼쪽 걷기</button></div>
        <h2>함께하는 상호작용</h2><div className={styles.buttons}>{(Object.keys(SOCIAL_ACTIONS) as SocialAction[]).map(kind => <button key={kind} disabled={!ready} onClick={e => interact(kind, e.timeStamp)}>{SOCIAL_ACTIONS[kind].icon} {SOCIAL_ACTIONS[kind].name}</button>)}</div><p className={styles.note}>같은 캐릭터끼리도 조합할 수 있어요. 실제 방에서는 상대에게 걸어간 뒤 동작을 시작합니다.</p>
      </aside>
    </section>
    <section className={styles.gallery} id="new-characters">
      <div><h2>새로 합류한 캐릭터</h2><p>다섯 캐릭터 모두 방에서 선택할 수 있어요. 위에서 조합을 바꾸면 함께하는 동작을 확인할 수 있어요.</p></div>
      <div className="col-span-full grid grid-cols-2 md:grid-cols-5 gap-3">{CHARACTER_CONCEPTS.map(c => <figure key={c.id} className="rounded-2xl bg-slate-800/70 border border-slate-600/50 p-3">
        <Image src={`/plaza/roster-v5/${c.id}/concept.png`} width={512} height={768} unoptimized alt={`${c.name} 전신 디자인`} className="w-full h-auto" />
        <figcaption className="text-sm text-slate-100"><strong>{c.name}</strong><p className="text-xs text-slate-300 mt-1">{c.desc}</p><button className="text-xs text-emerald-300 mt-2" onClick={() => { change(0, c.id); canvas.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>선택해서 동작 보기 ↑</button></figcaption>
      </figure>)}</div>
    </section>
    <section className={styles.gallery}><div><h2>전체 동작 프레임</h2><p>캐릭터별 동작과 비율을 확인할 수 있어요.</p></div>{ready && SPRITE_CHARACTERS_V2.map(c => <div key={c.id} className={styles.sheet}><h3>{c.name}</h3><Image src={`${characterAssetRoot(c.id)}/sprite-sheet-alpha.png`} width={768} height={2880} unoptimized alt={`${c.name}의 전신 모션 스프라이트 시트`} /></div>)}</section>
  </main>;
}
