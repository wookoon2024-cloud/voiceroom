"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { RoomEvent, type Room, type RemoteParticipant } from "livekit-client";
import { isNpcReply, type NpcReply } from "./npc-packets";
import type { NpcMessage } from "./exaone";

type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null;
  start(): void; abort(): void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

export function useNpcLounge({ joined, room, identity, roomRef, tokenRef, deafened, volume }: {
  joined: boolean; room: string; identity: string; roomRef: RefObject<Room | null>; tokenRef: RefObject<string>; deafened: boolean; volume: number;
}) {
  const [open, setOpen] = useState(false), [input, setInput] = useState("");
  const [history, setHistory] = useState<NpcMessage[]>([]), historyRef = useRef<NpcMessage[]>([]);
  const [reply, setReply] = useState<NpcReply | null>(null), [bubble, setBubble] = useState<{ id: string; text: string }>();
  const [busy, setBusy] = useState(false), [listening, setListening] = useState(false), [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState(""), [audioBlocked, setAudioBlocked] = useState(false);
  const busyRef = useRef(false), seen = useRef(new Set<string>()), recognition = useRef<Recognition | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null), utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const request = useRef<AbortController | null>(null), bubbleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const playbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const session = useRef(0);
  const output = useRef({ deafened, volume });

  const stopListening = useCallback(() => {
    const r = recognition.current; recognition.current = null;
    if (r) { r.onresult = null; r.onerror = null; r.onend = null; r.abort(); }
    setListening(false);
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
      u.onstart = () => setSpeaking(true); u.onend = () => { setSpeaking(false); utterance.current = null; };
      u.onerror = () => { setSpeaking(false); setAudioBlocked(true); utterance.current = null; };
      utterance.current = u; window.speechSynthesis.speak(u);
    };
    const a = new Audio(`/api/tts?text=${encodeURIComponent(text)}&voice=male_bright&source=npc`); audio.current = a;
    a.volume = Math.max(0, Math.min(1, soundVolume / 100));
    a.onplaying = () => setSpeaking(true);
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
    if (seen.current.size > 100) seen.current.clear();
    seen.current.add(packet.id); setReply(packet); setBubble({ id: packet.id, text: packet.text });
    clearTimeout(bubbleTimer.current); bubbleTimer.current = setTimeout(() => setBubble(undefined), 15_000);
    if (packet.asker === identity) {
      historyRef.current = [...historyRef.current, { role: "assistant" as const, content: packet.text }].slice(-8);
      setHistory(historyRef.current);
    }
    speak(packet.text);
  }, [room, identity, speak]);

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
        body: JSON.stringify({ room, prompt, history: previous }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(55_000)]) });
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

  const startListening = () => {
    if (recognition.current) { stopListening(); return; }
    const w = window as SpeechWindow, Constructor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Constructor) { setError("이 브라우저는 음성 인식을 지원하지 않아요. 아래에 글로 질문해 주세요."); return; }
    if (!tokenRef.current) { setError("방에 입장한 뒤 음성 대화를 시작해 주세요."); return; }
    setError(""); stopAudio();
    const r = new Constructor(); recognition.current = r; r.lang = "ko-KR"; r.continuous = false; r.interimResults = true;
    r.onresult = event => {
      let text = "", final = false;
      for (let i = 0; i < event.results.length; i++) { text += event.results[i][0].transcript; final ||= event.results[i].isFinal; }
      setInput(text.slice(0, 500));
      if (final && text.trim()) { stopListening(); void send(text); }
    };
    r.onerror = e => { setListening(false); recognition.current = null;
      setError(e.error === "not-allowed" || e.error === "service-not-allowed" ? "마이크 권한을 허용한 뒤 다시 눌러 주세요. 글로도 질문할 수 있어요."
        : e.error === "no-speech" ? "목소리가 들리지 않았어요. 다시 눌러 말해 주세요." : "음성 인식 연결이 원활하지 않아요. 글로 질문하거나 다시 시도해 주세요."); };
    r.onend = () => { if (recognition.current === r) { recognition.current = null; setListening(false); } };
    try { r.start(); setListening(true); } catch { recognition.current = null; setError("음성 인식을 시작하지 못했어요. 다시 눌러 주세요."); }
  };
  const close = () => { setOpen(false); stopListening(); };
  const dialog = joined && open ? <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-3" onClick={close}>
    <section role="dialog" aria-modal="true" aria-label="루미와 대화" data-npc-dialog className="rpg-frame w-full max-w-sm max-h-[85dvh] overflow-y-auto p-4 text-stone-100 shadow-2xl" onClick={e => e.stopPropagation()} onKeyDown={e => { e.stopPropagation(); if (e.key === "Escape") close(); }}>
      <header className="flex items-center justify-between border-b border-amber-800/60 pb-3"><div><h2 className="font-bold text-amber-200">루미 <span className="text-xs font-normal text-stone-400">AI 정원 안내원</span></h2><p className="mt-1 text-[11px] text-stone-400">말로 질문하면 답변해요. 답변은 방 전체에 들려요.</p></div><button type="button" aria-label="루미 대화 닫기" onClick={close} className="p-2">✕</button></header>
      <div className="my-3 max-h-[30dvh] min-h-20 space-y-2 overflow-y-auto text-sm" aria-live="polite">
        {history.length ? history.map((m, i) => <p key={i} className={`rounded-lg p-2 leading-relaxed ${m.role === "user" ? "ml-8 bg-stone-800" : "mr-4 bg-amber-950/45 text-amber-100"}`}><span className="mb-1 block text-[10px] text-stone-400">{m.role === "user" ? "나" : "루미"}</span>{m.content}</p>)
          : <p className="rounded-lg bg-amber-950/35 p-3 text-amber-100">안녕하세요, 정원 안내원 루미예요. 인사나 궁금한 것을 편하게 물어보세요.</p>}
        {busy && <p className="text-xs text-amber-300">루미가 답변을 생각하고 있어요…</p>}
        {reply && reply.asker !== identity && <p className="rounded-lg bg-stone-800 p-2 text-xs"><span className="block text-stone-400">{reply.asker}님에게 루미의 답변</span>{reply.text}</p>}
      </div>
      {error && <p role="alert" className="mb-2 text-xs text-rose-300">{error}</p>}
      {audioBlocked && <p className="mb-2 text-xs text-amber-300">음성을 들으려면 아래 재생 버튼을 눌러 주세요.</p>}
      <button type="button" disabled={busy} onClick={startListening} className={`mb-2 w-full rounded-lg border px-3 py-2.5 text-sm disabled:opacity-40 ${listening ? "border-rose-400 bg-rose-950/60 text-rose-200" : "border-amber-700 bg-amber-950/40 text-amber-100"}`}>{listening ? "■ 듣는 중 · 누르면 중지" : "🎙 말로 물어보기"}</button>
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); void send(input); }}>
        <input aria-label="루미에게 질문" value={input} maxLength={500} disabled={busy || listening} onChange={e => setInput(e.target.value)} placeholder="글로도 물어보세요" className="min-w-0 flex-1 rounded-lg border border-stone-600 bg-stone-950 px-3 py-2 text-sm" />
        <button type="submit" disabled={busy || listening || !input.trim()} className="rounded-lg bg-amber-700 px-3 text-sm disabled:opacity-40">보내기</button>
      </form>
      {reply && <button type="button" onClick={() => speak(reply.text)} disabled={deafened} className="mt-2 text-xs text-amber-300 disabled:opacity-40">▶ 답변 음성 다시 듣기</button>}
    </section>
  </div> : null;
  return { open: () => setOpen(true), dialog, bubble, speaking, busy };
}
