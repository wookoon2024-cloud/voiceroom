"use client";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { RoomEvent, type Room, type RemoteParticipant } from "livekit-client";
import { AmbientContext, ambientState, DEFAULT_NPC_AMBIENT, isNpcUtterance, npcLeader, canShareNpcVoice, type NpcAmbientState, type NpcUtterance } from "./npc-ambient";
import { isNpcReply, type NpcReply } from "./npc-packets";
import { maskPersonalInfo, hasPublicContent } from "./npc-privacy";
import type { SocialAction } from "./social-actions";

export type PublicChat = { id: string; sender: string; text: string; whisperTo?: string; isSystem?: boolean; npcConversation?: boolean };
type Recognition = { lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null; start(): void; abort(): void };
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
type Draft = { reply: NpcReply; signature: string; expires: number };

export function useNpcAmbient({ joined, room, identity, roomRef, tokenRef, micMuted, privateConversation, speaking, chatMessages, onReply }: {
  joined: boolean; room: string; identity: string; roomRef: RefObject<Room | null>; tokenRef: RefObject<string>;
  micMuted: boolean; privateConversation: boolean; speaking: boolean; chatMessages: PublicChat[]; onReply: (reply: unknown) => void;
}) {
  const [state, setState] = useState<NpcAmbientState>(DEFAULT_NPC_AMBIENT), stateRef = useRef<NpcAmbientState>({ ...DEFAULT_NPC_AMBIENT });
  const [voice, setVoice] = useState(false), voiceRef = useRef(false), [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [saving, setSaving] = useState(false);
  const controls = useRef({ micMuted, privateConversation, speaking }), replyRef = useRef(onReply);
  const buffer = useRef(new AmbientContext()), chatsSeen = useRef(new Set<string>()), chatReady = useRef(false);
  const activity = useRef(0), recognition = useRef<Recognition | null>(null), startRef = useRef<() => void>(() => {});
  const mounted = useRef(false), abort = useRef<AbortController | null>(null);
  const turnAbort = useRef<AbortController | null>(null);
  const providerPausedUntil = useRef(0);
  const applyState = useCallback((value: NpcAmbientState) => {
    if (!mounted.current || !value || typeof value.enabled !== "boolean" || typeof value.tts !== "boolean" || value.updatedAt < stateRef.current.updatedAt) return;
    stateRef.current = value; setState(value);
  }, []);
  const stopCapture = useCallback(() => {
    const r = recognition.current; recognition.current = null;
    if (r) { r.onresult = null; r.onend = null; r.onerror = null; r.abort(); }
    setListening(false);
  }, []);
  useEffect(() => { controls.current = { micMuted, privateConversation, speaking }; replyRef.current = onReply; }, [micMuted, privateConversation, speaking, onReply]);
  const api = useCallback(async (payload: object, signal?: AbortSignal) => {
    const response = await fetch("/api/npc/ambient", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenRef.current}` },
      body: JSON.stringify({ room, ...payload }), signal: AbortSignal.any([AbortSignal.timeout(125_000), ...(signal ? [signal] : [])]) });
    const data = await response.json();
    if (response.status === 429) {
      const seconds = Number(data.retryAfter);
      providerPausedUntil.current = Date.now() + (Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 3600) : 60) * 1000;
    }
    if (!response.ok && response.status !== 409) throw new Error(data.error || "루미 연결을 확인해 주세요.");
    return data;
  }, [room, tokenRef]);

  useEffect(() => {
    if (!joined) return;
    mounted.current = true;
    const liveRoom = roomRef.current, controller = new AbortController(); abort.current = controller;
    let stopped = false, registered = false, registering = false, lastRegister = 0, inFlight = false, draft: Draft | null = null, nextStart = 0;
    const context = buffer.current, knownChats = chatsSeen.current;
    const mock = process.env.NODE_ENV === "development" && ["localhost", "127.0.0.1"].includes(location.hostname) && new URLSearchParams(location.search).get("mock") === "plaza";
    const isLeader = () => mock || (liveRoom && npcLeader([liveRoom.localParticipant, ...liveRoom.remoteParticipants.values()]) === identity);
    const enabledForMic = () => canShareNpcVoice({ enabled: stateRef.current.enabled, requested: voiceRef.current, ...controls.current });
    const observe = (value: unknown, sender: string) => {
      if (!stateRef.current.enabled || !isNpcUtterance(value) || value.room !== room || value.speaker !== sender) return false;
      const text = maskPersonalInfo(value.text);
      if (!hasPublicContent(text)) return false;
      const added = context.add({ ...value, text });
      if (added) activity.current = Date.now();
      return added;
    };
    const publishVoice = (text: string, id: string) => {
      const packet: NpcUtterance = { type: "NPC_UTTERANCE", id, room, speaker: identity, text: maskPersonalInfo(text).slice(0, 500), sentAt: Date.now() };
      if (!observe(packet, identity)) return;
      void liveRoom?.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(packet)), { reliable: true }).catch(() => { if (!stopped) setError("음성 공유 연결을 확인해 주세요."); });
    };
    const start = () => {
      if (stopped || recognition.current || !enabledForMic() || Date.now() < nextStart) return;
      const w = window as SpeechWindow, Constructor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
      if (!Constructor) { voiceRef.current = false; setVoice(false); setError("이 브라우저는 음성 인식을 지원하지 않아요. 공개 채팅에는 계속 참여해요."); return; }
      const r = new Constructor(), session = crypto.randomUUID(); recognition.current = r;
      r.lang = "ko-KR"; r.continuous = true; r.interimResults = true;
      r.onresult = event => {
        if (!enabledForMic()) { stopCapture(); return; }
        activity.current = Date.now();
        for (let i = event.resultIndex ?? 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal && result[0].transcript.trim()) publishVoice(result[0].transcript, `${session}-${i}`);
        }
      };
      r.onend = () => { if (recognition.current === r) { recognition.current = null; setListening(false); nextStart = Date.now() + 900; } };
      r.onerror = e => {
        if (e.error === "no-speech" || e.error === "aborted") return;
        voiceRef.current = false; setVoice(false); stopCapture();
        setError(e.error === "not-allowed" || e.error === "service-not-allowed" ? "마이크 권한을 허용한 뒤 내 목소리 연결을 눌러 주세요." : "음성 인식 연결이 끊겼어요. 내 목소리 연결을 다시 눌러 주세요.");
      };
      try { r.start(); setListening(true); } catch { recognition.current = null; nextStart = Date.now() + 3000; setError("음성 인식을 시작하지 못했어요. 내 목소리 연결을 다시 눌러 주세요."); voiceRef.current = false; setVoice(false); }
    };
    startRef.current = start;
    const metadata = () => { if (liveRoom) { const value = ambientState(liveRoom.metadata); applyState(value); if (!value.enabled) { context.consume(context.entries); stopCapture(); draft = null; turnAbort.current?.abort(); setBusy(false); } } };
    const speakers = () => { if (liveRoom?.activeSpeakers.length) activity.current = Date.now(); };
    const onData = (data: Uint8Array, participant?: RemoteParticipant) => {
      try {
        const value = JSON.parse(new TextDecoder().decode(data));
        if (participant) observe(value, participant.identity);
        else if (isNpcReply(value) && value.room === room) {
          stateRef.current = { ...stateRef.current, lastReplyAt: Math.max(stateRef.current.lastReplyAt, value.sentAt) };
          if (value.tts) { stopCapture(); nextStart = Date.now() + 1200; }
        }
      } catch { /* Other room data. */ }
    };
    const onMock = (event: Event) => { const value = (event as CustomEvent).detail; if (value?.type === "NPC_UTTERANCE") observe(value, value.speaker); };
    liveRoom?.on(RoomEvent.RoomMetadataChanged, metadata); liveRoom?.on(RoomEvent.ActiveSpeakersChanged, speakers); liveRoom?.on(RoomEvent.DataReceived, onData);
    if (mock) window.addEventListener("voiceroom:mock-data", onMock);
    const register = async () => {
      if (registering || stopped) return;
      registering = true; lastRegister = Date.now();
      try { const data = await api({ action: "register" }, controller.signal); if (!stopped) { registered = true; applyState(data.state); setError(""); } }
      catch { if (!stopped) setError("루미 연결을 다시 시도하고 있어요."); }
      finally { registering = false; }
    };
    void register();
    const tick = async () => {
      if (stopped) return;
      if (!registered && Date.now() - lastRegister > 15_000) void register();
      if (!enabledForMic()) { if (recognition.current) stopCapture(); } else start();
      if (!registered || !isLeader() || inFlight || !stateRef.current.enabled || Date.now() < providerPausedUntil.current) return;
      const now = Date.now(), humanSpeaking = Boolean(liveRoom?.activeSpeakers.length);
      if (humanSpeaking) activity.current = now;
      if (draft) {
        if (!mock && stateRef.current.lease?.id !== draft.reply.id) { draft = null; setBusy(false); return; }
        if (now > draft.expires) { draft = null; setBusy(false); return; }
        if (humanSpeaking || now - activity.current < (draft.reply.questionId ? 1200 : 2500)) return;
        inFlight = true;
        const next = draft; draft = null;
        try { const data = await api({ action: "publish", reply: next.reply, signature: next.signature }, controller.signal);
          if (!stopped) { if (data.state) applyState(data.state); if (data.reply) { if (data.reply.tts) { stopCapture(); nextStart = Date.now() + 1200; } replyRef.current(data.reply); } } }
        catch { if (!stopped) setError("루미가 잠시 쉬고 있어요. 다음 대화에 다시 참여할게요."); }
        finally { inFlight = false; if (!stopped) setBusy(false); }
        return;
      }
      const planningState = stateRef.current.lease?.owner !== identity ? { ...stateRef.current, lease: undefined } : stateRef.current;
      const plan = context.plan(planningState, now, humanSpeaking, activity.current);
      if (!plan) return;
      const peers = new Set([identity, ...(liveRoom ? [...liveRoom.remoteParticipants.keys()] : [])]);
      const publicContext = mock ? plan.context : plan.context.filter(e=>peers.has(e.speaker));
      const freshIds = plan.fresh.filter(e=>publicContext.some(p=>p.id===e.id)).map(e=>e.id);
      if (!freshIds.length) { context.consume(plan.fresh); return; }
      context.consume(plan.fresh); stateRef.current = { ...stateRef.current, lastAttemptAt: now }; inFlight = true; setBusy(true);
      const currentTurn = new AbortController(); turnAbort.current = currentTurn;
      setError("");
      try {
        const data = await api({ action: "turn", context: publicContext, freshIds }, AbortSignal.any([controller.signal, currentTurn.signal]));
        if (!stopped) {
          if (data.state) applyState(data.state);
          if (data.question) replyRef.current(data.question);
          if (data.draft && isNpcReply(data.draft) && stateRef.current.enabled) draft = { reply: data.draft, signature: data.signature, expires: data.draft.sentAt + 40_000 };
        }
      } catch (error) { if (!stopped && !currentTurn.signal.aborted) setError(error instanceof Error ? error.message : "루미 답변이 늦어지고 있어요. 다음 대화에 다시 참여할게요."); }
      finally { inFlight = false; if (!stopped && !draft) setBusy(false); }
    };
    const timer = setInterval(() => { void tick(); }, 1000);
    return () => {
      stopped = true; mounted.current = false; controller.abort(); clearInterval(timer); stopCapture();
      liveRoom?.off(RoomEvent.RoomMetadataChanged, metadata); liveRoom?.off(RoomEvent.ActiveSpeakersChanged, speakers); liveRoom?.off(RoomEvent.DataReceived, onData);
      if (mock) window.removeEventListener("voiceroom:mock-data", onMock);
      voiceRef.current = false; setVoice(false); setBusy(false); setSaving(false); setError(""); setState({ ...DEFAULT_NPC_AMBIENT }); stateRef.current = { ...DEFAULT_NPC_AMBIENT };
      context.clear(); knownChats.clear(); chatReady.current = false;
      providerPausedUntil.current = 0;
    };
  }, [joined, room, identity, roomRef, api, applyState, stopCapture]);

  useEffect(() => {
    if (!joined) return;
    for (const chat of chatMessages) {
      if (chatsSeen.current.has(chat.id)) continue;
      chatsSeen.current.add(chat.id);
      if (chatReady.current && stateRef.current.enabled && !chat.whisperTo && !chat.isSystem && !chat.npcConversation && chat.text.trim()) {
        const text = maskPersonalInfo(chat.text).slice(0, 500);
        if (hasPublicContent(text)) { buffer.current.add({ type: "NPC_UTTERANCE", id: `chat:${chat.id}`.slice(0, 120), room, speaker: chat.sender, text, sentAt: Date.now() }); activity.current = Date.now(); }
      }
    }
    chatReady.current = true;
    if (chatsSeen.current.size > 500) chatsSeen.current = new Set(chatMessages.map(c => c.id));
  }, [joined, chatMessages, room]);

  const configure = async (patch: Partial<Pick<NpcAmbientState, "enabled" | "tts">>) => {
    if (saving) return;
    setSaving(true); setError("");
    try { const data = await api({ action: "configure", enabled: stateRef.current.enabled, tts: stateRef.current.tts, ...patch }, abort.current?.signal); applyState(data.state); if (!data.state.enabled) { stopCapture(); buffer.current.consume(buffer.current.entries); turnAbort.current?.abort(); setBusy(false); } }
    catch { setError("설정을 바꾸지 못했어요. 방 연결을 확인해 주세요."); }
    finally { if (mounted.current) setSaving(false); }
  };
  const toggleVoice = () => {
    const next = !voiceRef.current; voiceRef.current = next; setVoice(next); setError("");
    if (!next) stopCapture();
    else if (controls.current.micMuted) setError("마이크를 켜면 내 목소리가 루미에게 연결돼요.");
    else if (controls.current.privateConversation) setError("귓속말을 마치면 내 목소리가 다시 연결돼요.");
    else startRef.current();
  };
  const react = async (socialAction: SocialAction) => {
    try { const data = await api({ action:"reaction", socialAction }, abort.current?.signal); if (mounted.current && data.reply) replyRef.current(data.reply); } catch { /* Physical interaction still completes when text is unavailable. */ }
  };
  const pauseProvider = (retryAfter: unknown) => {
    const seconds = Number(retryAfter);
    providerPausedUntil.current = Date.now() + (Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 3600) : 60) * 1000;
  };
  return { state, voice, listening, busy, error, saving, configure, toggleVoice, stopCapture, react, pauseProvider };
}
