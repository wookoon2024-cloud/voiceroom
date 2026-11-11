"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { RoomEvent, type Room, type RemoteParticipant } from "livekit-client";
import { isNpcReply, type NpcReply } from "./npc-packets";
import type { NpcMessage } from "./exaone";
import { useNpcAmbient, type PublicChat } from "./use-npc-ambient";
import { SocialActionMenu } from "./social-action-menu";
import type { SocialAction } from "./social-actions";

export function useNpcLounge({ joined, room, identity, roomRef, tokenRef, deafened, volume, micMuted, privateConversation, chatMessages, onInteraction }: {
  joined: boolean; room: string; identity: string; roomRef: RefObject<Room | null>; tokenRef: RefObject<string>; deafened: boolean; volume: number;
  micMuted: boolean; privateConversation: boolean; chatMessages: PublicChat[];
  onInteraction: (action: SocialAction) => void;
}) {
  const [open, setOpen] = useState(false), [input, setInput] = useState("");
  const [history, setHistory] = useState<NpcMessage[]>([]), historyRef = useRef<NpcMessage[]>([]);
  const [reply, setReply] = useState<NpcReply | null>(null), [bubble, setBubble] = useState<{ id: string; text: string }>();
  const [busy, setBusy] = useState(false), [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState(""), [audioBlocked, setAudioBlocked] = useState(false);
  const busyRef = useRef(false), seen = useRef(new Set<string>());
  const ambientSettings = useRef({ enabled: true, tts: false }), stopCaptureRef = useRef<() => void>(() => {});
  const audio = useRef<HTMLAudioElement | null>(null), utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const request = useRef<AbortController | null>(null), bubbleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const playbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const session = useRef(0);
  const output = useRef({ deafened, volume });

  const stopListening = useCallback(() => {
    stopCaptureRef.current();
  }, []);
  const stopAudio = useCallback(() => {
    clearTimeout(playbackTimer.current);
    if (audio.current) { audio.current.onplaying = null; audio.current.onended = null; audio.current.onerror = null; audio.current.pause(); audio.current = null; }
    if (utterance.current) { utterance.current.onstart = null; utterance.current.onend = null; utterance.current.onerror = null; window.speechSynthesis?.cancel(); utterance.current = null; }
    setSpeaking(false);
  }, []);
  const speak = useCallback((text: string) => {
    stopListening(); stopAudio(); setAudioBlocked(false);
    const { deafened: silent, volume: soundVolume } = output.current;
    if (silent || soundVolume === 0) return;
    const fallback = () => {
      if (!window.speechSynthesis) { setAudioBlocked(true); return; }
      const u = new SpeechSynthesisUtterance(text); u.lang = "ko-KR"; u.volume = Math.max(0, Math.min(1, soundVolume / 100));
      u.onstart = () => { stopListening(); setSpeaking(true); }; u.onend = () => { setSpeaking(false); utterance.current = null; };
      u.onerror = () => { setSpeaking(false); setAudioBlocked(true); utterance.current = null; };
      utterance.current = u; window.speechSynthesis.speak(u);
    };
    const a = new Audio(`/api/tts?text=${encodeURIComponent(text)}&voice=male_bright&source=npc`); audio.current = a;
    a.volume = Math.max(0, Math.min(1, soundVolume / 100));
    a.onplaying = () => { stopListening(); setSpeaking(true); };
    a.onended = () => { setSpeaking(false); audio.current = null; clearTimeout(playbackTimer.current); };
    a.onerror = () => { if (audio.current === a) { audio.current = null; fallback(); } };
    void a.play().catch(e => {
      if (audio.current !== a) return;
      if (e instanceof DOMException && e.name === "NotAllowedError") { setAudioBlocked(true); setSpeaking(false); }
      else { a.onerror = null; audio.current = null; fallback(); }
    });
    playbackTimer.current = setTimeout(() => { stopAudio(); }, 45_000);
  }, [stopAudio, stopListening]);

  const receive = useCallback((packet: unknown) => {
    if (!isNpcReply(packet) || packet.room !== room || seen.current.has(packet.id) || Math.abs(Date.now() - packet.sentAt) > 90_000) return;
    if (packet.ambient && !ambientSettings.current.enabled) return;
    if (seen.current.size > 100) seen.current.clear();
    seen.current.add(packet.id); setReply(packet); setBubble({ id: packet.id, text: packet.text });
    clearTimeout(bubbleTimer.current); bubbleTimer.current = setTimeout(() => setBubble(undefined), 15_000);
    if (packet.asker === identity && !packet.ambient) {
      historyRef.current = [...historyRef.current, { role: "assistant" as const, content: packet.text }].slice(-8);
      setHistory(historyRef.current);
    }
    if (packet.ambient ? packet.tts === true : ambientSettings.current.tts) speak(packet.text);
    else stopAudio();
  }, [room, identity, speak, stopAudio]);
  const ambient = useNpcAmbient({ joined, room, identity, roomRef, tokenRef, micMuted, privateConversation, speaking, chatMessages, onReply: receive });
  useEffect(() => { ambientSettings.current = ambient.state; stopCaptureRef.current = ambient.stopCapture; }, [ambient.state, ambient.stopCapture]);

  useEffect(() => {
    if (!joined) return;
    const liveRoom = roomRef.current;
    const onData = (data: Uint8Array, participant?: RemoteParticipant) => {
      // Only the server may publish NPC replies; ignore participant impersonation.
      if (participant) return;
      try { receive(JSON.parse(new TextDecoder().decode(data))); } catch { /* Other room data. */ }
    };
    liveRoom?.on(RoomEvent.DataReceived, onData);
    const mock = process.env.NODE_ENV === "development" && ["localhost", "127.0.0.1"].includes(location.hostname) && new URLSearchParams(location.search).get("mock") === "plaza";
    const onMock = (event: Event) => receive((event as CustomEvent).detail);
    if (mock) window.addEventListener("voiceroom:mock-data", onMock);
    return () => { liveRoom?.off(RoomEvent.DataReceived, onData); if (mock) window.removeEventListener("voiceroom:mock-data", onMock); };
  }, [joined, roomRef, receive]);
  useEffect(() => {
    output.current = { deafened, volume };
    if (audio.current) audio.current.volume = deafened ? 0 : Math.max(0, Math.min(1, volume / 100));
    if (deafened) { const timer = setTimeout(stopAudio, 0); return () => clearTimeout(timer); }
  }, [deafened, volume, stopAudio]);
  useEffect(() => {
    const sessionRef = session, seenIds = seen.current;
    return () => {
      sessionRef.current++; request.current?.abort(); stopListening(); stopAudio(); clearTimeout(bubbleTimer.current);
      busyRef.current = false; seenIds.clear(); historyRef.current = [];
      setOpen(false); setBusy(false); setHistory([]); setReply(null); setBubble(undefined); setInput(""); setError("");
    };
  }, [joined, room, identity, stopListening, stopAudio]);

  const send = async (question: string) => {
    const prompt = question.trim();
    if (!prompt || busyRef.current || !joined) return;
    stopListening(); stopAudio(); setError("");
    if (prompt.length > 500) { setError("질문은 500자 이내로 입력해 주세요."); return; }
    if (!tokenRef.current) { setError("방에 입장한 뒤 루미에게 말을 걸어 주세요."); return; }
    const currentSession = session.current, previous = historyRef.current.slice(-8);
    historyRef.current = [...previous, { role: "user" as const, content: prompt }].slice(-8); setHistory(historyRef.current); setInput("");
    const controller = new AbortController(); request.current = controller;
    busyRef.current = true; setBusy(true);
    try {
      const response = await fetch("/api/npc", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenRef.current}` },
        body: JSON.stringify({ room, prompt, history: previous }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(125_000)]) });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "답변을 받지 못했어요.");
      if (!isNpcReply(data.reply)) throw new Error("답변 형식이 올바르지 않아요.");
      if (session.current !== currentSession) return;
      receive(data.reply);
      if (!data.shared) setError("지금 답변은 나에게만 들려요. 방 공유 연결을 확인해 주세요.");
    } catch (e) {
      if (!controller.signal.aborted && session.current === currentSession) setError(e instanceof DOMException ? "연결이 지연되고 있어요. 잠시 후 다시 시도해 주세요." : e instanceof Error ? e.message : "연결을 확인해 주세요.");
    } finally { if (session.current === currentSession) { busyRef.current = false; setBusy(false); } }
  };

  const close = () => setOpen(false);
  const dialog = joined && open ? <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-3" onClick={close}>
    <section role="dialog" aria-modal="true" aria-label="루미와 대화" data-npc-dialog className="rpg-frame w-full max-w-sm max-h-[85dvh] overflow-y-auto p-4 text-stone-100 shadow-2xl" onClick={e => e.stopPropagation()} onKeyDown={e => { e.stopPropagation(); if (e.key === "Escape") close(); }}>
      <header className="flex items-center justify-between border-b border-amber-800/60 pb-3"><div><h2 className="font-bold text-amber-200">루미 <span className="text-xs font-normal text-stone-400">함께 이야기하는 AI 친구</span></h2><p className="mt-1 text-[11px] text-stone-400">공유된 목소리와 공개 채팅에 가끔 의견을 보태요.</p></div><button type="button" aria-label="루미 대화 닫기" onClick={close} className="p-2">✕</button></header>
      <div className="my-3 space-y-2 text-sm">
        <p className="text-[11px] text-amber-300">루미와 함께하기 · 걸어가서 동작해요</p>
        <SocialActionMenu onSelect={action=>{close();onInteraction(action);}} />
        <button type="button" disabled={ambient.saving} onClick={() => void ambient.configure({ enabled: !ambient.state.enabled })} className="flex w-full items-center justify-between rounded-lg border border-amber-700 bg-amber-950/40 px-3 py-2.5 disabled:opacity-40"><span>방 대화 참여</span><strong>{ambient.state.enabled ? "ON" : "OFF"}</strong></button>
        <button type="button" disabled={!ambient.state.enabled} onClick={ambient.toggleVoice} className="flex w-full items-center justify-between rounded-lg border border-stone-600 px-3 py-2.5 disabled:opacity-40" aria-label={ambient.voice ? "내 목소리 연결 해제" : "내 목소리 연결"}><span>{ambient.voice ? "내 목소리 연결 해제" : "내 목소리 연결"}</span><span className="text-xs text-emerald-300">{ambient.listening ? "인식 중" : ambient.voice ? (micMuted ? "마이크 꺼짐" : privateConversation ? "귓속말 중지" : "연결 대기") : "미연결"}</span></button>
        <p className="px-1 text-[11px] leading-relaxed text-stone-400">각자 내 목소리를 한 번 연결하면 창을 닫아도 대화를 들어요. 마이크를 끄거나 귓속말 중에는 공유를 멈춰요. 인식된 말은 같은 방의 루미 대화 맥락에 사용돼요.</p>
        <p className="px-1 text-[11px] text-emerald-300/80">이름·연락처·주소는 가리고, 개인정보를 알리는 문장은 제외한 뒤 EXAONE에게 보내요. 음성 인식은 브라우저 제공 서비스를 사용해요.</p>
        <button type="button" disabled={ambient.saving} onClick={() => void ambient.configure({ tts: !ambient.state.tts })} className="flex w-full items-center justify-between rounded-lg border border-stone-600 px-3 py-2 disabled:opacity-40"><span>루미 음성으로도 듣기</span><span>{ambient.state.tts ? "ON" : "OFF · 말풍선만"}</span></button>
      </div>
      {(error || ambient.error) && <p role="alert" className="mb-2 text-xs text-rose-300">{error || ambient.error}</p>}
      <div aria-live="polite" className="my-3 text-sm">
        {reply ? <p className="rounded-lg bg-amber-950/40 p-3 leading-relaxed text-amber-100">{reply.text}</p> : <p className="text-xs leading-relaxed text-stone-400">대화가 모이면 자연스럽게 참여해요. 루미를 부르면 먼저 답해요.</p>}
        {(busy || ambient.busy) && <p className="mt-2 text-xs text-amber-300">대화를 듣고 생각하는 중…</p>}
      </div>
      {audioBlocked && <p className="mb-2 text-xs text-amber-300">아래 버튼을 눌러 답변 음성을 들을 수 있어요.</p>}
      {reply && <button type="button" onClick={() => speak(reply.text)} disabled={deafened} className="mb-3 text-xs text-amber-300 disabled:opacity-40">▶ 이번 답변 음성 듣기</button>}
      <details className="border-t border-stone-700 pt-2 text-xs"><summary className="cursor-pointer text-stone-400">루미에게 직접 글로 말하기</summary>
        {history.slice(-2).map((m,i)=><p key={i} className="mt-2 rounded bg-stone-800 p-2">{m.role === "user" ? "나: " : "루미: "}{m.content}</p>)}
        <form className="mt-2 flex gap-2" onSubmit={e => { e.preventDefault(); void send(input); }}><input aria-label="루미에게 질문" value={input} maxLength={500} disabled={busy} onChange={e=>setInput(e.target.value)} placeholder="루미야, 안녕" className="min-w-0 flex-1 rounded-lg border border-stone-600 bg-stone-950 px-3 py-2 text-sm"/><button type="submit" disabled={busy || !input.trim()} className="rounded-lg bg-amber-700 px-3 disabled:opacity-40">보내기</button></form>
      </details>
    </section>
  </div> : null;
  return { open: () => setOpen(true), dialog, bubble, speaking, busy: busy || ambient.busy, react: ambient.react, label: ambient.state.enabled ? (ambient.listening ? "루미 ON · 음성 연결" : "루미 참여 ON") : "루미 참여 OFF" };
}
