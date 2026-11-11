"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { RoomEvent, type Room, type RemoteParticipant } from "livekit-client";
import { isNpcReply, isNpcQuestion, type NpcReply, type NpcQuestion } from "./npc-packets";
import type { NpcMessage } from "./exaone";
import { useNpcAmbient, type PublicChat } from "./use-npc-ambient";
import { NpcPanel } from "./npc-panel";
import type { SocialAction } from "./social-actions";
import { NpcSharedHistory } from "./npc-shared-history";

export function useNpcLounge({ joined, room, identity, roomRef, tokenRef, deafened, volume, micMuted, privateConversation, chatMessages, onInteraction, onPublicQuestion, onPublicReply }: {
  joined: boolean; room: string; identity: string; roomRef: RefObject<Room | null>; tokenRef: RefObject<string>; deafened: boolean; volume: number;
  micMuted: boolean; privateConversation: boolean; chatMessages: PublicChat[];
  onInteraction: (action: SocialAction) => void;
  onPublicQuestion: (question: NpcQuestion) => void;
  onPublicReply: (reply: NpcReply) => void;
}) {
  const [open, setOpen] = useState(false), [input, setInput] = useState("");
  const historyRef = useRef<NpcMessage[]>([]);
  const [reply, setReply] = useState<NpcReply | null>(null), [bubble, setBubble] = useState<{ id: string; text: string }>();
  const [busy, setBusy] = useState(false), [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState(""), [audioBlocked, setAudioBlocked] = useState(false);
  const busyRef = useRef(false), seen = useRef(new Set<string>());
  const ambientSettings = useRef({ enabled: true, tts: false }), stopCaptureRef = useRef<() => void>(() => {});
  const sharedHandlers = useRef({ onPublicQuestion, onPublicReply });
  const sharedHistory = useRef(new NpcSharedHistory());
  useEffect(()=>{sharedHandlers.current={onPublicQuestion,onPublicReply};},[onPublicQuestion,onPublicReply]);
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
    if (isNpcQuestion(packet)) {
      if (packet.room !== room || seen.current.has(packet.id) || Math.abs(Date.now()-packet.sentAt)>90_000) return;
      seen.current.add(packet.id); sharedHistory.current.question(packet);
      historyRef.current=sharedHistory.current.messages();
      sharedHandlers.current.onPublicQuestion(packet); return;
    }
    if (!isNpcReply(packet) || packet.room !== room || seen.current.has(packet.id) || Math.abs(Date.now() - packet.sentAt) > 90_000) return;
    if (packet.ambient && !ambientSettings.current.enabled) return;
    if (seen.current.size > 100) seen.current.clear();
    seen.current.add(packet.id); setError(""); setReply(packet); setBubble({ id: packet.id, text: packet.text });
    sharedHandlers.current.onPublicReply(packet);
    clearTimeout(bubbleTimer.current); bubbleTimer.current = setTimeout(() => setBubble(undefined), 15_000);
    if (packet.questionId) {
      sharedHistory.current.reply(packet);historyRef.current=sharedHistory.current.messages();
    }
    if (packet.ambient ? packet.tts === true : ambientSettings.current.tts) speak(packet.text);
    else stopAudio();
  }, [room, speak, stopAudio]);
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
    const sessionRef = session, seenIds = seen.current, commonHistory = sharedHistory.current;
    return () => {
      sessionRef.current++; request.current?.abort(); stopListening(); stopAudio(); clearTimeout(bubbleTimer.current);
      busyRef.current = false; seenIds.clear(); historyRef.current = []; commonHistory.clear();
      setOpen(false); setBusy(false); setReply(null); setBubble(undefined); setInput(""); setError("");
    };
  }, [joined, room, identity, stopListening, stopAudio]);

  const send = async (question: string) => {
    const prompt = question.trim();
    if (!prompt || busyRef.current || !joined) return;
    stopListening(); stopAudio(); setError("");
    if (prompt.length > 500) { setError("질문은 500자 이내로 입력해 주세요."); return; }
    if (!tokenRef.current) { setError("방에 입장한 뒤 루미에게 말을 걸어 주세요."); return; }
    const currentSession = session.current, previous = historyRef.current.slice(-8);
    setInput("");
    const controller = new AbortController(); request.current = controller;
    busyRef.current = true; setBusy(true);
    try {
      const response = await fetch("/api/npc", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenRef.current}` },
        body: JSON.stringify({ room, prompt, history: previous }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(125_000)]) });
      const data = await response.json();
      if (response.status === 429) ambient.pauseProvider(data.retryAfter);
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "답변을 받지 못했어요.");
      if (!isNpcReply(data.reply)) throw new Error("답변 형식이 올바르지 않아요.");
      if (session.current !== currentSession) return;
      if (data.question) receive(data.question);
      receive(data.reply);
      if (!data.shared) setError("지금 답변은 나에게만 들려요. 방 공유 연결을 확인해 주세요.");
    } catch (e) {
      if (!controller.signal.aborted && session.current === currentSession) setError(e instanceof DOMException ? "연결이 지연되고 있어요. 잠시 후 다시 시도해 주세요." : e instanceof Error ? e.message : "연결을 확인해 주세요.");
    } finally { if (session.current === currentSession) { busyRef.current = false; setBusy(false); } }
  };

  const close = () => setOpen(false);
  const dialog = joined && open ? <NpcPanel
    enabled={ambient.state.enabled} tts={ambient.state.tts} voice={ambient.voice} listening={ambient.listening}
    micMuted={micMuted} privateConversation={privateConversation} busy={busy} working={busy || ambient.busy}
    saving={ambient.saving} error={error || ambient.error} audioBlocked={audioBlocked} canReplay={Boolean(reply)} deafened={deafened}
    input={input} onInput={setInput} onSend={()=>{void send(input);}} onClose={close}
    onReplay={()=>{if(reply)speak(reply.text);}} onInteraction={action=>{close();onInteraction(action);}}
    onToggleVoice={ambient.toggleVoice} onToggleEnabled={()=>{void ambient.configure({enabled:!ambient.state.enabled});}}
    onToggleTts={()=>{void ambient.configure({tts:!ambient.state.tts});}}
  /> : null;
  return { open: () => setOpen(true), dialog, bubble, speaking, busy: busy || ambient.busy, react: ambient.react, voiceConnected: ambient.listening, label: ambient.state.enabled ? "루미 ON" : "루미 OFF" };
}
