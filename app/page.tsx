"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Room,
  RoomEvent,
  DisconnectReason,
  TrackEvent,
  ParticipantEvent,
  Track,
  createLocalAudioTrack,
  LocalAudioTrack,
  setLogLevel,
  LogLevel,
} from "livekit-client";
import {
  Settings,
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  VolumeX,
  Send,
  MessageSquare,
  Sliders,
  Radio,
  Speaker,
  Headphones,
  Pencil,
  Palette,
  Camera,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Flame,
  CloudRain,
  Snowflake,
  Coffee,
  Waves,
  Music,
  ImageIcon,
  Trash2,
  SmilePlus,
  CornerDownRight,
  Sparkles,
  Gamepad2,
} from "lucide-react";
import {
  BG_EFFECTS,
  BgEffectType,
  BackgroundEffectCanvas,
  SEAT_EMOTES,
  FlyingEmoteItem,
  FlyingEmoteOverlay,
} from "@/lib/effects";
import {
  CHARACTER_STYLES,
  CharacterId,
  CharacterSprite,
  DEFAULT_CHARACTER,
  DEFAULT_PLAZA_THEME,
  PLAZA_THEMES,
  PlazaActor,
  PlazaInteractionRequest,
  PlazaInteractionArrival,
  PlazaMove,
  PlazaPose,
  PlazaPos,
  PlazaScene,
  PlazaThemeId,
  ViewMode,
  clampPlazaPos,
  normalizeCharacterId,
  SpritePoseInfo,
  isPlazaMove,
  isPlazaThemeId,
} from "@/lib/plaza";

// LiveKit 내부 WebRTC 재연결 시 발생하는 무해한 콘솔 경고(Tried to add a track for a participant that's not present 등) 숨김 처리
setLogLevel(LogLevel.silent);

// Polyfill for browser extensions calling toLowerCase() on SVGAnimatedString className
if (typeof window !== "undefined" && typeof SVGAnimatedString !== "undefined" && !(SVGAnimatedString.prototype as any).toLowerCase) {
  (SVGAnimatedString.prototype as any).toLowerCase = function () {
    return (this.baseVal || "").toLowerCase();
  };
}

const DownCircleIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v8" />
    <path d="m8 12 4 4 4-4" />
  </svg>
);

const REACTION_EMOJIS = ["❤️", "👍", "😂", "😢", "👎", "😡"];

interface ChatItem {
  id: string;
  sender: string;
  text: string;
  time: string;
  isTTS?: boolean;
  ttsVoice?: string;
  isSystem?: boolean;
  imageUrl?: string;
  reactions?: { [emoji: string]: string[] };
  whisperTo?: string;
}

const TTS_VOICE_OPTIONS = [
  { id: "male_injoon", label: "남성1" },
  { id: "male_hyunsu", label: "남성2" },
  { id: "male_deep", label: "남성3" },
  { id: "male_bright", label: "남성4" },
  { id: "female_sunhi", label: "여성1" },
  { id: "female_cute", label: "여성2" },
];

const ROOM_OPTIONS = [
  { id: "subroom-1", name: "보이스룸 1", desc: "소그룹 대화" },
  { id: "subroom-2", name: "보이스룸 2", desc: "소그룹 대화" },
];

const ANIMAL_NAMES = [
  "강아지", "고양이", "토끼", "다람쥐", "햄스터",
  "판다", "곰돌이", "호랑이", "사자", "여우",
  "수달", "돌고래", "물개", "펭귄", "병아리",
  "오리", "사슴", "알파카", "코알라", "미어캣",
  "너구리", "북극곰", "양", "염소", "기린",
  "코끼리", "하마", "얼룩말", "캥거루", "고슴도치",
  "치타", "표범", "바다표범", "참새", "독수리",
  "부엉이", "올빼미", "두더지", "비버", "낙타",
  "카피바라", "라쿤", "아기곰", "물총새", "까치"
];

const generateRandomNickname = () => {
  return ANIMAL_NAMES[Math.floor(Math.random() * ANIMAL_NAMES.length)];
};

// 채팅 내 링크 자동 감지 및 새 탭 열기 (웹보이스룸이 닫히지 않도록 target="_blank")
const renderMessageWithLinks = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-300 hover:text-cyan-100 underline underline-offset-2 break-all font-medium transition-colors inline-block"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

function VoiceRoomContent() {
  const [selectedRoom, setSelectedRoom] = useState("subroom-1");
  const [nickname, setNickname] = useState("");
  const [roomCounts, setRoomCounts] = useState<{ [key: string]: number }>({
    "subroom-1": 0,
    "subroom-2": 0,
  });

  const [isJoined, setIsJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [myTTSMode, setMyTTSMode] = useState(false);
  const [myTTSVoice, setMyTTSVoice] = useState("male_injoon");
  const myTTSVoiceRef = useRef<string>("male_injoon");
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    try {
      const savedVoice = localStorage.getItem("voiceroom_tts_voice");
      if (savedVoice && TTS_VOICE_OPTIONS.some((v) => v.id === savedVoice)) {
        setMyTTSVoice(savedVoice);
        myTTSVoiceRef.current = savedVoice;
      }
    } catch (e) {}
  }, []);

  const handleSelectTTSVoice = (nextVoice: string) => {
    setMyTTSVoice(nextVoice);
    myTTSVoiceRef.current = nextVoice;
    setMyTTSMode(true);
    try {
      localStorage.setItem("voiceroom_tts_voice", nextVoice);
    } catch (e) {}
    speakText("이 목소리로 설정되었습니다.", nextVoice);
  };

  // 슬롯 (1~6번) 상태: { [slotIndex (0~5)]: "identity" }
  const [slots, setSlots] = useState<{ [key: number]: string }>({});
  const slotsRef = useRef<{ [key: number]: string }>({});

  const updateSlots = (
    newSlots:
      | { [key: number]: string }
      | ((prev: { [key: number]: string }) => { [key: number]: string })
  ) => {
    setSlots((prev) => {
      const updated = typeof newSlots === "function" ? newSlots(prev) : newSlots;
      slotsRef.current = updated;
      return updated;
    });
  };

  // 배경 스킨 설정
  const SKINS = [
    { id: "default", name: "기본 다크", icon: "🌙", desc: "깔끔한 슬레이트 다크", bg: "" },
    { id: "pool", name: "별빛 루프탑 라운지", icon: "✨", desc: "도심 야경 속 낭만 데이트", bg: "/skins/pool.jpg" },
    { id: "christmas", name: "크리스마스 트리", icon: "🎄", desc: "벽난로 앞 루돌프 파티", bg: "/skins/christmas.jpg" },
    { id: "snow", name: "눈 오는 날", icon: "❄️", desc: "눈길 위 로맨틱한 발자국", bg: "/skins/snow.jpg" },
    { id: "halloween", name: "할로윈 파티", icon: "🎃", desc: "매혹적인 코스튬 파티", bg: "/skins/halloween.jpg" },
    { id: "cafe", name: "프린스 카페", icon: "☕", desc: "설레는 꽃미남 집사 카페", bg: "/skins/cafe.jpg" },
    { id: "rain", name: "비 오는 날 우산", icon: "☔", desc: "설레는 한 우산 아래", bg: "/skins/rain.jpg" },
    { id: "library", name: "노을빛 도서관", icon: "📚", desc: "속삭이는 스터디 데이트", bg: "/skins/library.jpg" },
    { id: "onsen", name: "온천 남탕", icon: "♨️", desc: "귀여운 일본 온천", bg: "/skins/onsen.jpg" },
  ];
  const [currentSkin, setCurrentSkin] = useState<string>("default");
  const currentSkinRef = useRef<string>("default");
  const [plazaSkin, setPlazaSkin] = useState<PlazaThemeId>(DEFAULT_PLAZA_THEME);
  const plazaSkinRef = useRef<PlazaThemeId>(DEFAULT_PLAZA_THEME);
  const [showSkinModal, setShowSkinModal] = useState(false);
  const [bgEffect, setBgEffect] = useState<BgEffectType>("off");
  const bgEffectRef = useRef<BgEffectType>("off");
  const [bgEffectSpeed, setBgEffectSpeed] = useState<number>(100);
  const bgEffectSpeedRef = useRef<number>(100);
  const [showEffectModal, setShowEffectModal] = useState<boolean>(false);

  // 화면 모드 (기본 / 캐릭터 광장) - 방 전체 실시간 동기화
  const [viewMode, setViewMode] = useState<ViewMode>("basic");
  const viewModeRef = useRef<ViewMode>("basic");
  const [showModeModal, setShowModeModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  // 캐릭터 선택 & 광장 위치 (방 전체 동기화)
  const [myCharacter, setMyCharacter] = useState<CharacterId>(DEFAULT_CHARACTER);
  const myCharacterRef = useRef<CharacterId>(DEFAULT_CHARACTER);
  const [characterMap, setCharacterMap] = useState<{ [nick: string]: CharacterId }>({});
  const characterMapRef = useRef<{ [nick: string]: CharacterId }>({});
  const [plazaPosMap, setPlazaPosMap] = useState<{ [nick: string]: PlazaMove }>({});
  const plazaPosMapRef = useRef<{ [nick: string]: PlazaMove }>({});
  // 캐릭터 머리 위 말풍선 (몇 초 후 자동 사라짐)
  const [bubbleMap, setBubbleMap] = useState<{ [nick: string]: { id: string; text: string; whisper?: boolean } }>({});
  const bubbleTimersRef = useRef<{ [nick: string]: ReturnType<typeof setTimeout> }>({});
  const [pendingInteraction, setPendingInteraction] = useState<PlazaInteractionRequest | null>(null);
  const pendingInteractionRef = useRef<PlazaInteractionRequest | null>(null);
  const cancelPendingInteraction = () => { pendingInteractionRef.current = null; setPendingInteraction(null); };
  const [poseInfoMap, setPoseInfoMap] = useState<Record<string, SpritePoseInfo>>({});
  const [poseMap, setPoseMap] = useState<{ [nick: string]: PlazaPose }>({});
  const poseTimersRef = useRef<{ [nick: string]: ReturnType<typeof setTimeout> }>({});

  const triggerPlazaPose = (nick: string, pose: PlazaPose | null, durationMs = 3200, info?: Partial<SpritePoseInfo>) => {
    if (!nick) return;
    if (poseTimersRef.current[nick]) clearTimeout(poseTimersRef.current[nick]);
    if (pose === null) {
      setPoseInfoMap(prev => { const next = { ...prev }; delete next[nick]; return next; });
      setPoseMap((prev) => {
        const next = { ...prev };
        delete next[nick];
        return next;
      });
      return;
    }
    setPoseInfoMap(prev => ({ ...prev, [nick]: { startedAt: Date.now(), ...info } }));
    setPoseMap((prev) => ({ ...prev, [nick]: pose }));
    if (durationMs > 0) {
      poseTimersRef.current[nick] = setTimeout(() => {
        setPoseInfoMap(prev => { const next = { ...prev }; delete next[nick]; return next; });
        setPoseMap((prev) => {
          const next = { ...prev };
          delete next[nick];
          return next;
        });
      }, durationMs);
    }
  };

  const handleMyPlazaPose = async (pose: PlazaPose | null) => {
    cancelPendingInteraction();
    const myNick = cleanNickRef.current;
    if (!myNick) return;
    if (pose === null) {
      triggerPlazaPose(myNick, null, 0);
      await broadcastData({ type: "PLAZA_POSE", identity: myNick, pose: null });
      return;
    }
    if (pose === "sit" || pose === "lie") return;
    const duration = pose === "jump" ? 668 : 3400;
    const startedAt = Date.now();
    triggerPlazaPose(myNick, pose, duration, { startedAt });
    await broadcastData({ type: "PLAZA_POSE", identity: myNick, pose, startedAt });
  };

  // An interaction is an intent until the scene reports physical arrival along a clear route.
  const handleTriggerInteraction = (targetNick: string, actionType: "hug" | "kiss") => {
    setEmotePickerTarget(null);
    const myNick = cleanNickRef.current || cleanNick;
    if (!myNick || !targetNick || myNick === targetNick) return;
    const request: PlazaInteractionRequest = { id: `approach-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, targetNick, actionType };
    pendingInteractionRef.current = request;
    setPendingInteraction(request);
  };

  const handleInteractionReady = async (arrival: PlazaInteractionArrival) => {
    if (pendingInteractionRef.current?.id !== arrival.id) return;
    cancelPendingInteraction();
    const myNick = cleanNickRef.current || cleanNick;
    const targetNick = arrival.targetNick;
    const actionType = arrival.actionType;
    if (!myNick || !Object.values(slotsRef.current).includes(targetNick)) return;
    const finalMove: PlazaMove = { x: arrival.from.x, y: arrival.from.y, tx: arrival.from.x, ty: arrival.from.y, ts: Date.now() };
    updatePlazaPos(myNick, finalMove);
    await broadcastData({ type: "CHAR_MOVE", identity: myNick, move: finalMove });
    // Give remote interpolation a short catch-up window; it continues WALKING until this time.
    const startedAt = Date.now() + 220;
    const fromFacing = arrival.fromFacing;
    triggerPlazaPose(myNick, actionType, 888, { startedAt, role: "send", facing: fromFacing, partner: targetNick });
    triggerPlazaPose(targetNick, actionType, 888, { startedAt, role: "receive", facing: fromFacing === 1 ? -1 : 1, partner: myNick });

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const emoji = actionType === "hug" ? "🫂" : "💋";
    const label = actionType === "hug" ? "따뜻하게 껴안았습니다! 💕" : "뽀뽀했습니다! ❤️";
    const sysChat: ChatItem = {
      id: `interact-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sender: "시스템",
      text: `${emoji} [${myNick}]님이 [${targetNick}]님과 ${label}`,
      time: timeStr,
      isSystem: true,
    };
    setMessages((prev) => [...prev, sysChat]);
    showChatBubble({
      id: sysChat.id,
      sender: myNick,
      text: `${emoji} ${label}`,
      time: timeStr,
    });

    await broadcastData({
      type: "INTERACT_ACTION",
      from: myNick,
      to: targetNick,
      actionType,
      startedAt,
      fromFacing,
    });
  };

  const handleQuickEmote = async (emoji: string, pose?: PlazaPose) => {
    setShowMyEmotePicker(false);
    if (pose) {
      handleMyPlazaPose(pose);
    }
    const senderNick = cleanNickRef.current || cleanNick;
    if (!senderNick) return;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const chatItem: ChatItem = {
      id: `emote-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sender: senderNick,
      text: emoji,
      time: timeStr,
      reactions: {},
    };
    setMessages((prev) => [...prev, chatItem]);
    showChatBubble(chatItem);
    await broadcastData({ type: "CHAT_MESSAGE", chat: chatItem });
  };
  // 로컬 UI 점검용 목업 상태 여부 (세션 저장/서버 동기화 생략)
  const isMockRef = useRef<boolean>(false);

  useEffect(() => {
    try {
      const savedMode = localStorage.getItem("voiceroom_view_mode");
      if (savedMode === "basic" || savedMode === "plaza") {
        setViewMode(savedMode);
        viewModeRef.current = savedMode;
      }
      const savedChar = localStorage.getItem("voiceroom_character");
      const migrated = normalizeCharacterId(savedChar);
      setMyCharacter(migrated);
      myCharacterRef.current = migrated;
      localStorage.setItem("voiceroom_character", migrated);
      const savedPlazaSkin = localStorage.getItem("voiceroom_plaza_skin");
      const currentPlazaSkin = isPlazaThemeId(savedPlazaSkin) ? savedPlazaSkin : DEFAULT_PLAZA_THEME;
      setPlazaSkin(currentPlazaSkin);
      plazaSkinRef.current = currentPlazaSkin;
      localStorage.setItem("voiceroom_plaza_skin", currentPlazaSkin);
    } catch (e) {}
  }, []);

  const updateCharacter = (nick: string, character: CharacterId) => {
    if (!nick) return;
    setCharacterMap((prev) => {
      const next = { ...prev, [nick]: character };
      characterMapRef.current = next;
      return next;
    });
  };

  const updatePlazaPos = (nick: string, move: PlazaMove) => {
    if (!nick) return;
    setPlazaPosMap((prev) => {
      const next = { ...prev, [nick]: move };
      plazaPosMapRef.current = next;
      return next;
    });
  };

  const renamePlazaData = (oldNick: string, newNick: string) => {
    if (!oldNick || !newNick || oldNick === newNick) return;
    if (characterMapRef.current[oldNick]) {
      updateCharacter(newNick, characterMapRef.current[oldNick]);
    }
    if (plazaPosMapRef.current[oldNick]) {
      updatePlazaPos(newNick, { ...plazaPosMapRef.current[oldNick], ts: Date.now() });
    }
  };

  const showChatBubble = (chat: ChatItem | undefined) => {
    if (!chat || chat.isSystem || !chat.sender) return;
    const text = chat.imageUrl ? (chat.text ? `📷 ${chat.text}` : "📷 사진") : chat.text;
    if (!text) return;
    const nick = chat.sender;
    const clipped = text.length > 60 ? `${text.slice(0, 60)}…` : text;
    setBubbleMap((prev) => ({
      ...prev,
      [nick]: { id: chat.id, text: chat.whisperTo ? `🤫 ${clipped}` : clipped, whisper: Boolean(chat.whisperTo) },
    }));
    if (bubbleTimersRef.current[nick]) clearTimeout(bubbleTimersRef.current[nick]);
    bubbleTimersRef.current[nick] = setTimeout(() => {
      setBubbleMap((prev) => {
        if (prev[nick]?.id !== chat.id) return prev;
        const next = { ...prev };
        delete next[nick];
        return next;
      });
    }, 5200);
    // Interaction bubbles describe an animation that is already running. Do not
    // replace the sender's hug/kiss with the automatic talking reaction.
    if (chat.id.startsWith("interact-")) return;
    if (/ㅋ|ㅎ|하하|호호|웃|😆|😂|🤣/.test(text)) {
      triggerPlazaPose(nick, "laugh", 3200);
    } else if (/ㅠ|ㅜ|흑|슬퍼|울|😭|😢/.test(text)) {
      triggerPlazaPose(nick, "sad", 3200);
    } else if (/안녕|반가|하이|빠이|인사|👋/.test(text)) {
      triggerPlazaPose(nick, "wave", 3200);
    } else {
      triggerPlazaPose(nick, "talk", 2200);
    }
  };

  const handleSelectViewMode = async (mode: ViewMode) => {
    setViewMode(mode);
    viewModeRef.current = mode;
    try {
      localStorage.setItem("voiceroom_view_mode", mode);
    } catch (e) {}
    await broadcastData({ type: "ROOM_VIEW_MODE", viewMode: mode });
  };

  const handleSelectCharacter = async (character: CharacterId) => {
    setMyCharacter(character);
    myCharacterRef.current = character;
    try {
      localStorage.setItem("voiceroom_character", character);
    } catch (e) {}
    const myNick = cleanNickRef.current;
    if (myNick) updateCharacter(myNick, character);
    await broadcastData({ type: "CHAR_SET", identity: myNick, character });
  };

  // 내 캐릭터 이동 (탭/클릭 또는 방향키) -> 방 전체에 출발/목표 지점 전송
  const handleMyPlazaMove = (from: PlazaPos, to: PlazaPos) => {
    const myNick = cleanNickRef.current;
    if (!myNick) return;
    const curPose = poseMap[myNick];
    if (curPose === "sit" || curPose === "lie") {
      triggerPlazaPose(myNick, null, 0);
      broadcastData({ type: "PLAZA_POSE", identity: myNick, pose: null });
    }
    const f = clampPlazaPos(from);
    const t = clampPlazaPos(to);
    const round = (n: number) => Math.round(n * 1000) / 1000;
    const move: PlazaMove = { x: round(f.x), y: round(f.y), tx: round(t.x), ty: round(t.y), ts: Date.now() };
    updatePlazaPos(myNick, move);
    broadcastData({ type: "CHAR_MOVE", identity: myNick, move });
  };

  // 좌석 간 감정표현 투사체 & 타격 애니메이션 상태
  const slotElementsRef = useRef<{ [slotIdx: number]: HTMLDivElement | null }>({});
  const [emotePickerTarget, setEmotePickerTarget] = useState<{ slotIdx: number; occupant: string } | null>(null);
  const [showMyEmotePicker, setShowMyEmotePicker] = useState<boolean>(false);

  const [activeFlights, setActiveFlights] = useState<FlyingEmoteItem[]>([]);
  const [hitSlotMap, setHitSlotMap] = useState<{ [slotIdx: number]: { emoteId: string; color: string; shakeType: "punch" | "love" | "laugh" } }>({});
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(true);
  const [chatSizeMode, setChatSizeMode] = useState<"full" | "half" | "closed">("full");

  // 채널별 실시간 주제 상태 (입장 화면 및 방 내부 동기화)
  const [channelTopics, setChannelTopics] = useState<Record<string, string>>({
    "subroom-1": "소그룹 대화",
    "subroom-2": "소그룹 대화",
  });

  // 방 주제 상태 (방 전체 실시간 동기화)
  const [roomTopic, setRoomTopic] = useState<string>("소그룹 대화");
  const roomTopicRef = useRef<string>("소그룹 대화");
  const [showTopicModal, setShowTopicModal] = useState<boolean>(false);
  const [newTopicInput, setNewTopicInput] = useState<string>("");

  // 유령 사용자 / 대기자 정리 대상
  const [kickTarget, setKickTarget] = useState<string | null>(null);
  // 착석자 대기석으로 내리기 대상
  const [unseatTarget, setUnseatTarget] = useState<string | null>(null);

  // 이용안내 및 개인정보처리방침 모달 상태
  const [showTermsModal, setShowTermsModal] = useState(false);

  const handleKickParticipant = async (targetId: string) => {
    try {
      await fetch("/api/kick", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${livekitTokenRef.current}`,
        },
        body: JSON.stringify({ room: selectedRoom, identity: targetId }),
      });
    } catch (e) {}

    cleanupWhisperForUser(targetId);
    setAllParticipants((prev) => prev.filter((id) => id !== targetId));
    updateSlots((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (next[Number(k)] === targetId) delete next[Number(k)];
      });
      return next;
    });

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;

    const kickLogText = `📢 [${targetId}]님을 [${cleanNick}]님이 내보냈습니다.`;
    const sysChatItem: ChatItem = {
      id: Math.random().toString(),
      sender: "시스템",
      text: kickLogText,
      time: timeStr,
      isSystem: true,
    };

    setMessages((prev) => [...prev, sysChatItem]);

    await broadcastData({
      type: "KICK_USER",
      identity: targetId,
      actor: cleanNick,
      chat: sysChatItem,
    });
    setKickTarget(null);
  };

  // 착석자 대기석으로 내리기
  const handleUnseatParticipant = async (targetNick: string) => {
    cleanupWhisperForUser(targetNick);
    const nextSlots = { ...slotsRef.current };
    let changed = false;
    Object.keys(nextSlots).forEach((k) => {
      if (nextSlots[Number(k)] === targetNick) {
        delete nextSlots[Number(k)];
        changed = true;
      }
    });
    if (changed) {
      updateSlots(nextSlots);
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes()
      ).padStart(2, "0")}`;
      const sysChatItem: ChatItem = {
        id: `unseat-${Date.now()}`,
        sender: "시스템",
        text: `📢 [${targetNick}]님이 [${cleanNick}]님에 의해 대기석으로 내려갔습니다.`,
        time: timeStr,
        isSystem: true,
      };
      setMessages((prev) => [...prev, sysChatItem]);
      await broadcastData({
        type: "UNSEAT_USER",
        identity: targetNick,
        actor: cleanNick,
        slots: nextSlots,
        chat: sysChatItem,
      });
    }
    setUnseatTarget(null);
  };

  const handleUpdateTopic = async () => {
    const trimmed = newTopicInput.trim();
    if (!trimmed) return;
    setRoomTopic(trimmed);
    roomTopicRef.current = trimmed;
    setChannelTopics((prev) => ({ ...prev, [selectedRoom]: trimmed }));
    setShowTopicModal(false);
    await broadcastData({ type: "ROOM_TOPIC", topic: trimmed });
    try {
      fetch("/api/topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: selectedRoom, topic: trimmed }),
      }).catch(() => {});
    } catch (e) {}
  };

  // 스킨 변경 함수 (방 전체에 실시간 동기화)
  const selectSkin = async (skinId: string) => {
    setCurrentSkin(skinId);
    currentSkinRef.current = skinId;
    try {
      localStorage.setItem("voiceroom_skin", skinId);
    } catch (e) {}
    setShowSkinModal(false);
    await broadcastData({ type: "ROOM_SKIN", skin: skinId });
  };

  // 캐릭터 모드 광장 배경 스킨 변경 함수 (방 전체에 실시간 동기화)
  const selectPlazaSkin = async (themeId: PlazaThemeId) => {
    setPlazaSkin(themeId);
    plazaSkinRef.current = themeId;
    try {
      localStorage.setItem("voiceroom_plaza_skin", themeId);
    } catch (e) {}
    setShowSkinModal(false);
    await broadcastData({ type: "ROOM_PLAZA_SKIN", plazaSkin: themeId });
  };

  // 배경 시각 효과 변경 함수 (방 전체에 실시간 동기화)
  const selectBgEffect = async (effectId: BgEffectType) => {
    setBgEffect(effectId);
    bgEffectRef.current = effectId;
    try {
      localStorage.setItem("voiceroom_bg_effect", effectId);
    } catch (e) {}
    setShowEffectModal(false);
    await broadcastData({
      type: "ROOM_EFFECT",
      effect: effectId,
      speed: bgEffectSpeedRef.current,
    });
  };

  // 배경 시각 효과 속도 조절 함수 (방 전체 실시간 동기화)
  const handleBgEffectSpeedChange = async (newSpeed: number) => {
    const clamped = Math.max(20, Math.min(250, newSpeed));
    setBgEffectSpeed(clamped);
    bgEffectSpeedRef.current = clamped;
    try {
      localStorage.setItem("voiceroom_bg_effect_speed", String(clamped));
    } catch (e) {}
    await broadcastData({
      type: "ROOM_EFFECT",
      effect: bgEffectRef.current,
      speed: clamped,
    });
  };

  // 좌석 -> 좌석 감정표현 발사 애니메이션 실행
  const spawnFlyingEmote = (
    fromSlot: number,
    toSlot: number,
    emoteId: string,
    fromNick: string,
    toNick: string
  ) => {
    const fromEl = slotElementsRef.current[fromSlot];
    const toEl = slotElementsRef.current[toSlot];
    if (!fromEl || !toEl) return;
    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();
    const startX = fromRect.left + fromRect.width / 2;
    const startY = fromRect.top + fromRect.height / 2;
    const endX = toRect.left + toRect.width / 2;
    const endY = toRect.top + toRect.height / 2;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const emoteObj = SEAT_EMOTES.find((e) => e.id === emoteId) || SEAT_EMOTES[0];

    const newItem: FlyingEmoteItem = {
      id,
      emoteId,
      fromSlot,
      toSlot,
      fromNick,
      toNick,
      startX,
      startY,
      endX,
      endY,
      createdAt: performance.now(),
    };
    setActiveFlights((prev) => [...prev.slice(-14), newItem]);

    if (fromNick) {
      const fromPose: PlazaPose =
        emoteId === "laugh" || emoteId === "party"
          ? "laugh"
          : emoteId === "cry"
          ? "sad"
          : "wave";
      triggerPlazaPose(fromNick, fromPose, 3000);
    }

    // 착탄 시점(560ms)에 상대 좌석 흔들림/하이라이트 반응 트리거
    setTimeout(() => {
      if (toNick) {
        const toPose: PlazaPose =
          emoteId === "cry" || emoteId === "punch"
            ? "sad"
            : emoteId === "laugh" || emoteId === "party" || emoteId === "heart" || emoteId === "kiss"
            ? "laugh"
            : "wave";
        triggerPlazaPose(toNick, toPose, 3000);
      }
      setHitSlotMap((prev) => ({
        ...prev,
        [toSlot]: {
          emoteId: emoteObj.id,
          color: emoteObj.color,
          shakeType: emoteObj.shakeType,
        },
      }));
    }, 550);

    // 타격 효과 해제
    setTimeout(() => {
      setHitSlotMap((prev) => {
        const next = { ...prev };
        delete next[toSlot];
        return next;
      });
    }, 1220);

    // 완료된 비행 객체 정리
    setTimeout(() => {
      setActiveFlights((prev) => prev.filter((item) => item.id !== id));
    }, 1350);
  };

  // 갤러리 프로필 사진 (착석자 아바타 이미지)
  const [avatarMap, setAvatarMap] = useState<{ [identity: string]: string }>({});
  const avatarMapRef = useRef<{ [identity: string]: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateAvatar = (identity: string, base64: string) => {
    avatarMapRef.current[identity] = base64;
    setAvatarMap((prev) => ({ ...prev, [identity]: base64 }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isGif =
      file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif");

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      if (isGif && rawDataUrl) {
        updateAvatar(cleanNick, rawDataUrl);
        try {
          localStorage.setItem("voiceroom_my_avatar", rawDataUrl);
        } catch (e) {}
        broadcastData({
          type: "AVATAR_UPDATE",
          identity: cleanNick,
          avatar: rawDataUrl,
        });
        return;
      }

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = 120;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

        const compressed = canvas.toDataURL("image/jpeg", 0.75);
        updateAvatar(cleanNick, compressed);
        try {
          localStorage.setItem("voiceroom_my_avatar", compressed);
        } catch (e) {}

        broadcastData({
          type: "AVATAR_UPDATE",
          identity: cleanNick,
          avatar: compressed,
        });
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // 방 내부 닉네임 변경 모달 상태
  const [showNickModal, setShowNickModal] = useState(false);
  const [newNickInput, setNewNickInput] = useState("");
  const [nickChangeError, setNickChangeError] = useState("");

  const [speakingMap, setSpeakingMap] = useState<{ [identity: string]: boolean }>({});
  const [muteMap, setMuteMap] = useState<{ [identity: string]: boolean }>({});
  const muteMapRef = useRef<{ [identity: string]: boolean }>({});
  const isMutedRef = useRef<boolean>(false);

  const updateMuteStatus = (identity: string, muted: boolean) => {
    if (!identity) return;
    muteMapRef.current[identity] = muted;
    const mappedNick = identityToNickMapRef.current[identity];
    const mappedIdentity = nickToIdentityMapRef.current[identity];
    if (mappedNick) muteMapRef.current[mappedNick] = muted;
    if (mappedIdentity) muteMapRef.current[mappedIdentity] = muted;
    setMuteMap({ ...muteMapRef.current });
  };

  // 참가자 기기 종류 (ios: 아이폰 / android: 안드로이드 / tablet: 태블릿 / pc: PC)
  type DeviceType = "ios" | "android" | "tablet" | "pc";
  const detectLocalDevice = (): DeviceType => {
    if (typeof navigator === "undefined") return "pc";
    const ua = navigator.userAgent || "";
    if (/iPad/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
      return "tablet";
    }
    if (/iPhone|iPod/i.test(ua)) {
      return "ios";
    }
    if (/Android/i.test(ua)) {
      if (!/Mobile/i.test(ua)) return "tablet";
      return "android";
    }
    return "pc";
  };

  const [myDevice, setMyDevice] = useState<DeviceType>(detectLocalDevice());
  const myDeviceRef = useRef<DeviceType>(detectLocalDevice());
  const [deviceMap, setDeviceMap] = useState<{ [identity: string]: DeviceType }>({});
  const deviceMapRef = useRef<{ [identity: string]: DeviceType }>({});

  useEffect(() => {
    const dev = detectLocalDevice();
    myDeviceRef.current = dev;
    setMyDevice(dev);
  }, []);

  const updateDeviceStatus = (identity: string, device?: string) => {
    if (!identity || (device !== "ios" && device !== "android" && device !== "tablet" && device !== "pc")) return;
    deviceMapRef.current[identity] = device;
    const mappedNick = identityToNickMapRef.current[identity];
    const mappedIdentity = nickToIdentityMapRef.current[identity];
    if (mappedNick) deviceMapRef.current[mappedNick] = device;
    if (mappedIdentity) deviceMapRef.current[mappedIdentity] = device;
    setDeviceMap({ ...deviceMapRef.current });
  };

  const extractDeviceFromMetadata = (identity: string, metadata?: string) => {
    if (!identity || !metadata) return;
    try {
      const parsed = JSON.parse(metadata);
      if (parsed?.device === "ios" || parsed?.device === "android" || parsed?.device === "tablet" || parsed?.device === "pc") {
        updateDeviceStatus(identity, parsed.device);
      }
    } catch (e) {}
  };

  const getParticipantDevice = (userIdOrNick: string): DeviceType => {
    if (!userIdOrNick) return "pc";
    if (userIdOrNick === cleanNick || userIdOrNick === cleanNickRef.current) {
      return myDeviceRef.current;
    }
    const mappedIdentity = nickToIdentityMapRef.current[userIdOrNick] || userIdOrNick;
    const mappedNick = identityToNickMapRef.current[userIdOrNick] || userIdOrNick;
    return (
      deviceMap[userIdOrNick] ||
      deviceMap[mappedNick] ||
      deviceMap[mappedIdentity] ||
      deviceMapRef.current[userIdOrNick] ||
      deviceMapRef.current[mappedNick] ||
      deviceMapRef.current[mappedIdentity] ||
      "pc"
    );
  };

  const renderDeviceIcon = (userIdOrNick: string, sizeClass = "w-2.5 h-2.5 md:w-3 md:h-3") => {
    const dev = getParticipantDevice(userIdOrNick);
    if (dev === "ios") {
      return (
        <svg
          viewBox="0 0 384 512"
          fill="currentColor"
          className={`${sizeClass} text-slate-100 shrink-0 inline-block drop-shadow`}
          aria-label="아이폰"
        >
          <title>아이폰 (iOS)</title>
          <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
        </svg>
      );
    }
    if (dev === "android") {
      return (
        <svg
          viewBox="0 0 576 512"
          fill="currentColor"
          className={`${sizeClass} text-emerald-400 shrink-0 inline-block drop-shadow`}
          aria-label="안드로이드"
        >
          <title>안드로이드</title>
          <path d="M420.55,301.93a24,24,0,1,1,24-24,24,24,0,0,1-24,24m-265.1,0a24,24,0,1,1,24-24,24,24,0,0,1-24,24m273.7-144.48,47.94-83a10,10,0,1,0-17.27-10h0l-48.54,84.07a301.25,301.25,0,0,0-246.56,0L116.18,64.45a10,10,0,1,0-17.27,10h0l47.94,83C64.53,202.22,8.24,285.55,0,384H576c-8.24-98.45-64.54-181.78-146.85-226.55" />
        </svg>
      );
    }
    if (dev === "tablet") {
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`${sizeClass} text-amber-300 shrink-0 inline-block drop-shadow`}
          aria-label="태블릿"
        >
          <title>태블릿</title>
          <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
          <line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
      );
    }
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`${sizeClass} text-sky-300 shrink-0 inline-block drop-shadow`}
        aria-label="PC"
      >
        <title>PC</title>
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    );
  };

  // 실시간 로컬 음성 발화 감지 (VAD) 상태
  const [isMyVoiceActive, setIsMyVoiceActive] = useState<boolean>(false);
  const isMyVoiceActiveRef = useRef<boolean>(false);
  const vadIntervalRef = useRef<any>(null);
  const vadAudioCtxRef = useRef<AudioContext | null>(null);

  // LiveKit identity <-> 닉네임 매핑 (방 안에서 닉네임 변경 시 발화자 매핑 보존)
  const identityToNickMapRef = useRef<{ [identity: string]: string }>({});
  const nickToIdentityMapRef = useRef<{ [nick: string]: string }>({});

  const registerNickMapping = (identity: string, currentNick: string) => {
    if (!identity || !currentNick) return;
    identityToNickMapRef.current[identity] = currentNick;
    nickToIdentityMapRef.current[currentNick] = identity;
  };

  // 오디오 출력 장치 (스피커/이어폰/블루투스)
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>("");

  // 사람별 개별 볼륨 ({ [identity]: 0 ~ 100 }) 및 전체 수신 마스터 볼륨 (0 ~ 150)
  const [volumeMap, setVolumeMap] = useState<{ [identity: string]: number }>({});
  const volumeMapRef = useRef<{ [identity: string]: number }>({});
  const [masterVolume, setMasterVolume] = useState<number>(100);
  const masterVolumeRef = useRef<number>(100);
  const isDeafenedRef = useRef<boolean>(false);
  const [showVolumeModal, setShowVolumeModal] = useState(false);

  // 참여자 목록 (전체)
  const [allParticipants, setAllParticipants] = useState<string[]>([]);

  // 채팅 상태
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [pendingChatImage, setPendingChatImage] = useState<string | null>(null);
  const pendingChatImageRef = useRef<string | null>(null);
  pendingChatImageRef.current = pendingChatImage;
  const [isUploadingChatImage, setIsUploadingChatImage] = useState(false);
  const [selectedChatImage, setSelectedChatImage] = useState<string | null>(null);
  const [imageZoom, setImageZoom] = useState<number>(1);
  const [imagePan, setImagePan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [imageDragMode, setImageDragMode] = useState<"zoom" | "pan">("zoom");
  const [isDraggingImage, setIsDraggingImage] = useState<boolean>(false);
  const didDragImageRef = useRef<boolean>(false);
  const dataChunkBufferRef = useRef<{
    [id: string]: { chunks: string[]; received: number; createdAt: number };
  }>({});
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [myIpAddress, setMyIpAddress] = useState<string>("");
  const [chatWhisperTarget, setChatWhisperTarget] = useState<string | null>(null);
  const [showWhisperPicker, setShowWhisperPicker] = useState(false);
  const [hasUnreadBelow, setHasUnreadBelow] = useState(false);
  const isChatAtBottomRef = useRef<boolean>(true);
  const lightboxTouchStartXRef = useRef<number | null>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const chatTextInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 채팅창 스크롤 위치 감지 (맨 아래에 있을 때만 새 대화 수신 시 자동 스크롤)
  const handleChatScroll = () => {
    const el = chatScrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom <= 48;
    isChatAtBottomRef.current = atBottom;
    if (atBottom && hasUnreadBelow) {
      setHasUnreadBelow(false);
    }
  };

  const scrollToBottom = (force: boolean = false) => {
    if (!force && !isChatAtBottomRef.current) {
      setHasUnreadBelow(true);
      return;
    }
    isChatAtBottomRef.current = true;
    setHasUnreadBelow(false);
    const doScroll = () => {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
    };
    doScroll();
    requestAnimationFrame(doScroll);
    setTimeout(doScroll, 50);
    setTimeout(doScroll, 150);
  };

  const roomRef = useRef<Room | null>(null);
  // 현재 방 입장 토큰 (내보내기 API 인증용)
  const livekitTokenRef = useRef<string>("");
  const localTrackRef = useRef<LocalAudioTrack | null>(null);
  const audioElementsRef = useRef<{ [identity: string]: HTMLAudioElement }>({});
  const wakeLockRef = useRef<any>(null);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);

  // 귓속말 상태 (내가 귓속말 중인 대상 / 나에게 귓속말 중인 발신자)
  const [whisperingTo, setWhisperingTo] = useState<string | null>(null);
  const whisperingToRef = useRef<string | null>(null);
  const [whisperedBy, setWhisperedBy] = useState<string | null>(null);
  const activeWhispersRef = useRef<{ [fromNick: string]: string }>({});

  // 귓속말 선택/해제(✕) 또는 음성 귓속말 배너/채팅창 크기 변동 시 스크롤 맨 아래 유지
  useEffect(() => {
    scrollToBottom(true);
  }, [chatWhisperTarget, showWhisperPicker, whisperingTo, whisperedBy, chatSizeMode]);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (isChatAtBottomRef.current && chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isJoined, chatSizeMode]);

  // 내 마이크 트랙 서버 구독 권한 제어 (음성 귓속말 중일 때는 LiveKit SFU 서버 레벨에서 귓속말 대상에게만 오디오 패킷 전송!)
  const applyMyTrackWhisperPermissions = (targetNick: string | null) => {
    const room = roomRef.current;
    if (!room || !room.localParticipant) return;
    try {
      if (!targetNick) {
        room.localParticipant.setTrackSubscriptionPermissions(true, []);
        setTimeout(() => {
          try {
            if (!whisperingToRef.current && roomRef.current?.localParticipant) {
              roomRef.current.localParticipant.setTrackSubscriptionPermissions(true, []);
            }
          } catch (e) {}
        }, 150);
        return;
      }
      const targetIdentity = nickToIdentityMapRef.current[targetNick] || targetNick;
      const perms: Array<{ participantIdentity?: string; participantSid?: string; allowAll: boolean }> = [];
      const seenIdentities = new Set<string>();

      room.remoteParticipants.forEach((rp) => {
        const rpDisplayNick = identityToNickMapRef.current[rp.identity] || rp.identity;
        if (rp.identity === targetNick || rp.identity === targetIdentity || rpDisplayNick === targetNick) {
          perms.push({
            participantIdentity: rp.identity,
            participantSid: rp.sid,
            allowAll: true,
          });
          seenIdentities.add(rp.identity);
        }
      });

      // 만약 귓속말 대상이 방에서 나갔다면 즉시 전체 공개로 복원
      if (perms.length === 0) {
        room.localParticipant.setTrackSubscriptionPermissions(true, []);
        return;
      }

      if (!seenIdentities.has(targetIdentity)) {
        perms.push({
          participantIdentity: targetIdentity,
          allowAll: true,
        });
      }
      if (targetNick !== targetIdentity && !seenIdentities.has(targetNick)) {
        perms.push({
          participantIdentity: targetNick,
          allowAll: true,
        });
      }

      room.localParticipant.setTrackSubscriptionPermissions(false, perms);
    } catch (e) {}
  };

  // 특정 참가자가 퇴장/강퇴/하석했을 때 해당 참가자와 관련된 모든 송수신 귓속말 상태를 완벽히 정리
  const cleanupWhisperForUser = (userIdOrNick: string) => {
    if (!userIdOrNick) return;
    const mappedNick = identityToNickMapRef.current[userIdOrNick] || userIdOrNick;
    const mappedIdentity = nickToIdentityMapRef.current[userIdOrNick] || userIdOrNick;
    const aliases = new Set([userIdOrNick, mappedNick, mappedIdentity]);

    // 1) activeWhispersRef에서 해당 유저가 발신자(key)이거나 수신자(value)인 항목 모두 삭제
    Object.entries(activeWhispersRef.current).forEach(([senderKey, targetVal]) => {
      const senderDisplay = identityToNickMapRef.current[senderKey] || senderKey;
      const targetDisplay = targetVal ? identityToNickMapRef.current[targetVal] || targetVal : "";
      if (
        aliases.has(senderKey) ||
        aliases.has(senderDisplay) ||
        (targetVal && (aliases.has(targetVal) || aliases.has(targetDisplay)))
      ) {
        delete activeWhispersRef.current[senderKey];
      }
    });

    // 2) 내가 그 사람에게 음성 귓속말 중이었다면 즉시 귓속말 종료 및 전체 공개 브로드캐스트
    const myCurrentTarget = whisperingToRef.current;
    if (myCurrentTarget) {
      const myTargetDisplay = identityToNickMapRef.current[myCurrentTarget] || myCurrentTarget;
      const myTargetIdentity = nickToIdentityMapRef.current[myCurrentTarget] || myCurrentTarget;
      if (
        aliases.has(myCurrentTarget) ||
        aliases.has(myTargetDisplay) ||
        aliases.has(myTargetIdentity)
      ) {
        const myNick = cleanNickRef.current || cleanNick;
        const myIdentity = roomRef.current?.localParticipant?.identity || myNick;
        whisperingToRef.current = null;
        setWhisperingTo(null);
        delete activeWhispersRef.current[myNick];
        delete activeWhispersRef.current[myIdentity];
        applyMyTrackWhisperPermissions(null);
        broadcastData({
          type: "WHISPER_END",
          from: myNick,
          fromIdentity: myIdentity,
          to: myCurrentTarget,
        });
      }
    }

    applyAllAudioStates();
  };

  // 모든 원격 참가자 오디오 요소 음소거/볼륨/귓속말 차단 일괄 동기화 (대기자 및 닉네임 변경자 포함 완벽 적용)
  const applyAllAudioStates = () => {
    const room = roomRef.current;
    const myNick = cleanNickRef.current || cleanNick;
    const myIdentity = room?.localParticipant?.identity || myNick;
    const deafened = isDeafenedRef.current;
    const masterVol = masterVolumeRef.current;

    // 현재 방에 실제로 접속해 있는 유효 참가자 집합 생성 (퇴장한 유령 귓속말 타겟 자동 소거)
    const connectedSet = new Set<string>([myNick, myIdentity]);
    Object.values(slotsRef.current).forEach((slotNick) => {
      if (slotNick) connectedSet.add(slotNick);
    });
    if (room) {
      room.remoteParticipants.forEach((rp) => {
        connectedSet.add(rp.identity);
        const mapped = identityToNickMapRef.current[rp.identity];
        if (mapped) connectedSet.add(mapped);
      });
    }

    Object.entries(activeWhispersRef.current).forEach(([senderKey, targetVal]) => {
      if (!targetVal) {
        delete activeWhispersRef.current[senderKey];
        return;
      }
      const senderDisplay = identityToNickMapRef.current[senderKey] || senderKey;
      const targetDisplay = identityToNickMapRef.current[targetVal] || targetVal;
      const senderExists = connectedSet.has(senderKey) || connectedSet.has(senderDisplay);
      const targetExists = connectedSet.has(targetVal) || connectedSet.has(targetDisplay);
      if (room && (!senderExists || !targetExists)) {
        delete activeWhispersRef.current[senderKey];
      }
    });

    // 만약 내 귓속말 대상이 더 이상 방에 없다면 내 마이크 트랙 권한도 즉시 전체 공개로 복구
    if (whisperingToRef.current) {
      const t = whisperingToRef.current;
      const tDisplay = identityToNickMapRef.current[t] || t;
      if (room && !connectedSet.has(t) && !connectedSet.has(tDisplay)) {
        whisperingToRef.current = null;
        setWhisperingTo(null);
        delete activeWhispersRef.current[myNick];
        delete activeWhispersRef.current[myIdentity];
        applyMyTrackWhisperPermissions(null);
      }
    }

    const myWhisperTarget = whisperingToRef.current;
    const myWhisperTargetDisplay = myWhisperTarget
      ? identityToNickMapRef.current[myWhisperTarget] || myWhisperTarget
      : null;
    const myWhisperTargetIdentity = myWhisperTarget
      ? nickToIdentityMapRef.current[myWhisperTarget] || myWhisperTarget
      : null;

    let currentWhisperSenderToMe: string | null = null;
    let currentWhisperSenderIdentityToMe: string | null = null;
    Object.entries(activeWhispersRef.current).forEach(([senderKey, targetVal]) => {
      if (!targetVal) return;
      const senderDisplay = identityToNickMapRef.current[senderKey] || senderKey;
      const senderIdentity = nickToIdentityMapRef.current[senderKey] || senderKey;
      const targetDisplay = identityToNickMapRef.current[targetVal] || targetVal;
      if (targetVal === myNick || targetVal === myIdentity || targetDisplay === myNick) {
        // 만약 내가 귓속말 중인 상대방이 나에게도 귓속말 중이라면 상호 귓속말 매칭을 최우선으로 선택
        if (
          !currentWhisperSenderToMe ||
          senderDisplay === myWhisperTarget ||
          senderDisplay === myWhisperTargetDisplay ||
          senderKey === myWhisperTargetIdentity ||
          senderIdentity === myWhisperTargetIdentity
        ) {
          currentWhisperSenderToMe = senderDisplay;
          currentWhisperSenderIdentityToMe = senderIdentity;
        }
      }
    });
    setWhisperedBy(currentWhisperSenderToMe);

    // 나 <-> 상대방 상호 음성 귓속말 여부 판별
    const isMutualWhisper = Boolean(
      myWhisperTarget &&
        currentWhisperSenderToMe &&
        (currentWhisperSenderToMe === myWhisperTarget ||
          currentWhisperSenderToMe === myWhisperTargetDisplay ||
          currentWhisperSenderToMe === myWhisperTargetIdentity ||
          (currentWhisperSenderIdentityToMe &&
            (currentWhisperSenderIdentityToMe === myWhisperTarget ||
              currentWhisperSenderIdentityToMe === myWhisperTargetIdentity)))
    );

    const computeParticipantAudioState = (participantIdentity: string) => {
      const displayNick = identityToNickMapRef.current[participantIdentity] || participantIdentity;
      const whisperTarget =
        activeWhispersRef.current[displayNick] ||
        activeWhispersRef.current[participantIdentity] ||
        null;
      const whisperTargetDisplay = whisperTarget
        ? identityToNickMapRef.current[whisperTarget] || whisperTarget
        : null;

      const isWhisperingToSomeoneElse =
        Boolean(whisperTarget) &&
        whisperTarget !== myNick &&
        whisperTarget !== myIdentity &&
        whisperTargetDisplay !== myNick &&
        displayNick !== myNick &&
        participantIdentity !== myIdentity;

      const isMutualPartner =
        isMutualWhisper &&
        (displayNick === myWhisperTarget ||
          displayNick === myWhisperTargetDisplay ||
          participantIdentity === myWhisperTarget ||
          participantIdentity === myWhisperTargetIdentity ||
          (currentWhisperSenderIdentityToMe &&
            participantIdentity === currentWhisperSenderIdentityToMe));

      const userVol =
        volumeMapRef.current[displayNick] ??
        volumeMapRef.current[participantIdentity] ??
        100;
      const baseVol = Math.max(0, Math.min(1, (userVol / 100) * (masterVol / 100)));
      // 상호 귓속말 중일 때는 귓속말 상대방 외 다른 참가자들의 목소리가 배경에서 조용하게 들리도록 볼륨을 낮추고(15%), 종료 시 기존 볼륨으로 복구
      const computedVol = isMutualWhisper && !isMutualPartner ? baseVol * 0.15 : baseVol;
      const shouldMute = deafened || isWhisperingToSomeoneElse;
      return { shouldMute, computedVol };
    };

    // 1) LiveKit RemoteAudioTrack(WebAudio GainNode) 볼륨 동기화
    // iOS(아이폰)는 OS 정책상 HTMLAudioElement.volume 조절을 무시(항상 1.0 고정)하고 WebAudio GainNode만 동작하므로
    // Room 옵션의 webAudioMix: true와 함께 track.setVolume()으로 GainNode 볼륨을 직접 제어합니다.
    const webAudioManagedIdentities = new Set<string>();
    if (room) {
      const roomAudioCtx = (room as any).audioContext as AudioContext | undefined;
      if (roomAudioCtx && roomAudioCtx.state === "suspended") {
        roomAudioCtx.resume().catch(() => {});
      }
      room.remoteParticipants.forEach((participant) => {
        const { shouldMute, computedVol } = computeParticipantAudioState(participant.identity);
        const targetTrackVol = shouldMute ? 0 : computedVol;
        participant.audioTrackPublications.forEach((pub) => {
          const track = pub.track as any;
          if (track && track.kind === Track.Kind.Audio) {
            if (!track.audioContext && roomAudioCtx && typeof track.setAudioContext === "function") {
              try {
                track.setAudioContext(roomAudioCtx);
              } catch (e) {}
            }
            if (typeof track.setVolume === "function") {
              try {
                track.setVolume(targetTrackVol);
              } catch (e) {}
            }
            if (track.audioContext && track.gainNode && track.audioContext.state === "running") {
              webAudioManagedIdentities.add(participant.identity);
            }
          }
        });
      });
    }

    // 2) HTMLAudioElement 폴백 및 재생 상태 동기화
    Object.entries(audioElementsRef.current).forEach(([participantIdentity, el]) => {
      if (!el) return;
      const { shouldMute, computedVol } = computeParticipantAudioState(participantIdentity);
      if (webAudioManagedIdentities.has(participantIdentity)) {
        // WebAudio GainNode가 출력을 담당 중일 때 el.muted = false로 풀면 GainNode와 <audio>가 이중 재생되어 볼륨이 줄어들지 않음
        el.muted = true;
        el.volume = 0;
      } else if (shouldMute) {
        el.muted = true;
        el.volume = 0;
      } else {
        el.muted = false;
        el.volume = Math.max(0, Math.min(1, computedVol));
        if (el.paused) {
          el.play().catch(() => {});
        }
      }
    });
  };

  // 방 안의 모든 원격 참가자 오디오 트랙이 누락 없이 DOM에 연결되고 재생(play) 상태인지 점검 및 강제 복구
  // (1번 사람이 먼저 F5 누른 뒤 2번 사람이 F5 눌렀을 때, 2번 사람의 getUserMedia 활성화 직후 1번 사람의 오디오 트랙을 즉시 재생 복구)
  const ensureAllRemoteAudioPlaying = (forceVolumeSync = false) => {
    const room = roomRef.current;
    if (!room) return;
    try {
      room.startAudio().catch(() => {});
      const roomAudioCtx = (room as any).audioContext as AudioContext | undefined;
      if (roomAudioCtx && roomAudioCtx.state === "suspended") {
        roomAudioCtx.resume().catch(() => {});
      }
    } catch (e) {}

    let needsSync = forceVolumeSync;

    try {
      room.remoteParticipants.forEach((participant) => {
        participant.audioTrackPublications.forEach((pub) => {
          const track = pub.track;
          if (track && track.kind === Track.Kind.Audio) {
            const existingEl = audioElementsRef.current[participant.identity];
            const isAttachedToTrack = existingEl
              ? track.attachedElements.includes(existingEl)
              : false;
            if (!existingEl || !document.body.contains(existingEl) || !isAttachedToTrack) {
              if (existingEl) {
                try {
                  existingEl.remove();
                } catch (e) {}
              }
              const el = track.attach();
              el.autoplay = true;
              (el as any).playsInline = true;
              el.setAttribute("playsinline", "true");
              el.setAttribute("webkit-playsinline", "true");
              audioElementsRef.current[participant.identity] = el;
              if (selectedAudioDevice && "setSinkId" in el) {
                (el as any).setSinkId(selectedAudioDevice).catch(() => {});
              }
              document.body.appendChild(el);
              needsSync = true;
            }
          }
        });
      });
    } catch (e) {}

    if (needsSync) {
      applyAllAudioStates();
    }

    Object.values(audioElementsRef.current).forEach((el) => {
      if (el && el.paused && !el.muted) {
        el.play().catch(() => {});
      }
    });
  };

  useEffect(() => {
    if (!isJoined) return;
    const timer = setInterval(() => {
      ensureAllRemoteAudioPlaying();
    }, 4000);
    return () => clearInterval(timer);
  }, [isJoined, selectedAudioDevice]);

  // 비프 알림음 (신규 대기자 입장 시 맑은 딩동음 재생)
  // 알림음용 AudioContext는 하나만 재사용 (입장할 때마다 새로 만들면 안드로이드에서 오디오 스트림이 계속 쌓임)
  const dingAudioCtxRef = useRef<AudioContext | null>(null);
  const playDingSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      if (!dingAudioCtxRef.current || dingAudioCtxRef.current.state === "closed") {
        dingAudioCtxRef.current = new AudioContextClass();
      }
      const ctx = dingAudioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12); // E6

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.36);
    } catch (e) {}
  };

  // TTS 음성 재생 (신경망 Neural TTS 기본 남성 인준 보이스 및 6종 다중 보이스 지원, URL 링크는 읽지 않음)
  const speakText = (text: string, voiceOverride?: string) => {
    if (typeof window === "undefined") return;
    if (isDeafenedRef.current) return;
    try {
      // URL 링크(http, https, www 등)는 TTS 발화에서 완전히 제외
      const cleaned = text.replace(/(?:https?:\/\/|www\.)[^\s]+/gi, "").trim();
      if (!cleaned) return; // 링크만 있는 경우 발화 생략

      // 이전 재생 중인 오디오 및 브라우저 TTS 즉시 중단
      if (ttsAudioRef.current) {
        try {
          ttsAudioRef.current.pause();
          ttsAudioRef.current.currentTime = 0;
        } catch (e) {}
        ttsAudioRef.current = null;
      }
      if ("speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
        } catch (e) {}
      }

      const chosenVoice = voiceOverride || myTTSVoiceRef.current || "male_injoon";
      const ttsUrl = `/api/tts?text=${encodeURIComponent(cleaned)}&voice=${encodeURIComponent(chosenVoice)}`;
      const audio = new Audio(ttsUrl);
      audio.volume = Math.max(0, Math.min(1, masterVolumeRef.current / 100));
      if (selectedAudioDevice && "setSinkId" in audio) {
        (audio as any).setSinkId(selectedAudioDevice).catch(() => {});
      }
      ttsAudioRef.current = audio;

      const fallbackBrowserSpeak = () => {
        if (!("speechSynthesis" in window)) return;
        try {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(cleaned);
          utter.lang = "ko-KR";
          const isFemalePreset = chosenVoice.startsWith("female_");
          utter.pitch = isFemalePreset ? 1.15 : 0.75;
          utter.rate = 1.0;
          window.speechSynthesis.speak(utter);
        } catch (e) {}
      };

      audio.onerror = () => {
        fallbackBrowserSpeak();
      };
      audio.play().catch(() => {
        fallbackBrowserSpeak();
      });
    } catch (e) {}
  };

  // 모바일 화면 꺼짐 방지
  const requestWakeLock = async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
      }
    } catch (e) {}
  };

  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch (e) {}
  };

  // 모바일 브라우저 백그라운드 오디오 유지 (MediaSession + 초소형 무음 루프)
  const startBackgroundAudioKeepalive = () => {
    try {
      if (!silentAudioRef.current) {
        // 0.5초 초소형 무음 WAV Base64
        const silentWav =
          "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
        const el = new Audio(silentWav);
        el.loop = true;
        el.volume = 0.01;
        silentAudioRef.current = el;
      }
      silentAudioRef.current.play().catch(() => {});

      if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: "2040 웹 보이스룸",
          artist: selectedRoom === "subroom-1" ? "보이스룸 1" : "보이스룸 2",
          album: "실시간 음성 대화 중",
        });
        navigator.mediaSession.playbackState = "playing";
        navigator.mediaSession.setActionHandler("pause", () => {});
        navigator.mediaSession.setActionHandler("play", () => {
          if (silentAudioRef.current) silentAudioRef.current.play().catch(() => {});
        });
      }
    } catch (e) {}
  };

  const stopBackgroundAudioKeepalive = () => {
    try {
      if (silentAudioRef.current) {
        silentAudioRef.current.pause();
        silentAudioRef.current.currentTime = 0;
        silentAudioRef.current = null;
      }
      if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "none";
      }
    } catch (e) {}
  };

  // 오디오 출력 장치 목록 가져오기 (외부스피커/블루투스/기본)
  const loadAudioDevices = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputs = devices.filter((d) => d.kind === "audiooutput");
      setAudioDevices(outputs);
      if (outputs.length > 0 && !selectedAudioDevice) {
        setSelectedAudioDevice(outputs[0].deviceId);
      }
    } catch (e) {}
  };

  // 출력 장치 변경 적용
  const handleAudioDeviceChange = async (deviceId: string) => {
    setSelectedAudioDevice(deviceId);
    Object.values(audioElementsRef.current).forEach(async (el) => {
      try {
        if ("setSinkId" in el) {
          await (el as any).setSinkId(deviceId);
        }
      } catch (e) {
        console.log("setSinkId failed:", e);
      }
    });
  };

  // 룸 인원수 및 주제 주기적 갱신
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const res = await fetch("/api/rooms");
        if (res.ok) {
          const data = await res.json();
          setRoomCounts(data);
          if (data.topics) {
            setChannelTopics(data.topics);
          }
          if (data.topics && data.topics[selectedRoom] && !isJoined) {
            setRoomTopic(data.topics[selectedRoom]);
            roomTopicRef.current = data.topics[selectedRoom];
          }
        }
      } catch (e) {}
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 6000);
    return () => clearInterval(interval);
  }, [selectedRoom, isJoined]);

  const isUnloadingRef = useRef<boolean>(false);
  const isRestoringRef = useRef<boolean>(false);
  const isJoiningRef = useRef<boolean>(false);
  const isMicBusyRef = useRef<boolean>(false);

  // 탭 닫기/새로고침 시 마이크 하드웨어 트랙 및 룸 즉시 해제 (초록불 방지)
  useEffect(() => {
    const handleBeforeUnload = () => {
      isUnloadingRef.current = true;
      if (localTrackRef.current) {
        localTrackRef.current.stop();
      }
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (localTrackRef.current) {
        localTrackRef.current.stop();
        localTrackRef.current = null;
      }
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      stopBackgroundAudioKeepalive();
    };
  }, []);

  // 모바일 브라우저 백그라운드(홈화면 이동) 후 복귀 시 오디오 재생 복구
  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        Object.values(audioElementsRef.current).forEach((el) => {
          if (el.paused) {
            el.play().catch(() => {});
          }
        });
        if (silentAudioRef.current && silentAudioRef.current.paused) {
          silentAudioRef.current.play().catch(() => {});
        }
        if (roomRef.current && roomRef.current.state === "connected") {
          requestWakeLock();
          // 백그라운드 중 OS가 마이크를 끊었는데 LiveKit 자동 복구가 안 된 경우 다시 켜기
          setTimeout(() => {
            const track = localTrackRef.current;
            if (
              micDesiredRef.current &&
              track &&
              track.mediaStreamTrack?.readyState === "ended" &&
              document.visibilityState === "visible"
            ) {
              enableMyMicrophoneRef.current?.();
            }
          }, 1500);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // 카카오톡 인앱 브라우저 감지 시 스마트폰 기본 브라우저(크롬/사파리)로 자동 열기
  useEffect(() => {
    if (typeof window === "undefined") return;
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isKakao = /KAKAOTALK/i.test(userAgent);

    if (isKakao) {
      const currentUrl = window.location.href;
      // 사용자가 기기 설정에서 지정한 기본 브라우저(삼성인터넷/크롬/사파리)로 바로 열기
      window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(currentUrl)}`;
    }
  }, []);

  // F5 새로고침 자동 재접속 후 브라우저 자동재생 정책으로 음성이 막혀 있을 때, 화면 터치/클릭/마우스 이동/채팅 입력 즉시 음성 출력 잠금 해제
  useEffect(() => {
    if (typeof window === "undefined") return;
    const unlockRoomAudio = () => {
      ensureAllRemoteAudioPlaying();
    };
    window.addEventListener("pointerdown", unlockRoomAudio, { passive: true });
    window.addEventListener("pointermove", unlockRoomAudio, { passive: true });
    window.addEventListener("touchstart", unlockRoomAudio, { passive: true });
    window.addEventListener("keydown", unlockRoomAudio, { passive: true });
    window.addEventListener("click", unlockRoomAudio, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", unlockRoomAudio);
      window.removeEventListener("pointermove", unlockRoomAudio);
      window.removeEventListener("touchstart", unlockRoomAudio);
      window.removeEventListener("keydown", unlockRoomAudio);
      window.removeEventListener("click", unlockRoomAudio);
    };
  }, []);

  // 모바일 브라우저(아이폰 사파리, 삼성인터넷, 크롬 등) 상단 주소창/하단 툴바/키보드 높이 및 오프셋 동적 계산 (아이폰 키보드 검은 여백 버그 완벽 방지)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateHeight = () => {
      if (window.visualViewport) {
        const vh = window.visualViewport.height;
        const offsetTop = Math.max(0, window.visualViewport.offsetTop);
        document.documentElement.style.setProperty("--app-height", `${vh}px`);
        document.documentElement.style.setProperty("--app-top", `${offsetTop}px`);
      } else {
        document.documentElement.style.setProperty("--app-height", `${window.innerHeight}px`);
        document.documentElement.style.setProperty("--app-top", "0px");
      }
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
      if (isChatAtBottomRef.current && chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    window.addEventListener("orientationchange", updateHeight);
    window.addEventListener("scroll", updateHeight, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateHeight);
      window.visualViewport.addEventListener("scroll", updateHeight);
    }
    return () => {
      window.removeEventListener("resize", updateHeight);
      window.removeEventListener("orientationchange", updateHeight);
      window.removeEventListener("scroll", updateHeight);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", updateHeight);
        window.visualViewport.removeEventListener("scroll", updateHeight);
      }
    };
  }, []);

  const cleanNick = nickname.trim();
  const cleanNickRef = useRef<string>("");
  cleanNickRef.current = cleanNick;
  const pendingRestoreSlotRef = useRef<number | null>(null);
  const myDesiredSlotRef = useRef<number | null>(null);
  const hasExplicitlyLeftSlotRef = useRef<boolean>(false);
  const hasAutoJoinedRef = useRef<boolean>(false);

  const mySlotIndex = Object.keys(slots).find(
    (idx) => slots[Number(idx)] === cleanNick
  );
  const isSeated = mySlotIndex !== undefined;

  // 접속 중일 때 방/닉네임/착석 좌석/마이크/스킨/배경음 상태를 실시간 저장 (F5 새로고침 100% 유지 및 IP 고정)
  const persistSessionState = (overrides?: {
    isJoined?: boolean;
    room?: string;
    nickname?: string;
    slotIndex?: number | null;
    wasMuted?: boolean;
    skin?: string;
    effect?: BgEffectType;
    effectSpeed?: number;
  }) => {
    if (typeof window === "undefined") return;
    if (isUnloadingRef.current) return;
    if (isMockRef.current) return;
    const joined = overrides?.isJoined !== undefined ? overrides.isJoined : isJoined;
    const curNick = (overrides?.nickname !== undefined ? overrides.nickname : cleanNickRef.current || cleanNick).trim();
    const curRoom = overrides?.room !== undefined ? overrides.room : selectedRoom;
    const refSlotKey = Object.keys(slotsRef.current).find(
      (idx) => slotsRef.current[Number(idx)] === curNick
    );
    const curSlot =
      overrides?.slotIndex !== undefined
        ? overrides.slotIndex
        : myDesiredSlotRef.current !== null
        ? myDesiredSlotRef.current
        : refSlotKey !== undefined
        ? Number(refSlotKey)
        : mySlotIndex !== undefined
        ? Number(mySlotIndex)
        : pendingRestoreSlotRef.current;
    const curMuted = overrides?.wasMuted !== undefined ? overrides.wasMuted : isMutedRef.current;
    const curSkin = overrides?.skin !== undefined ? overrides.skin : currentSkinRef.current;
    const curEffect = overrides?.effect !== undefined ? overrides.effect : bgEffectRef.current;
    const curEffectSpeed = overrides?.effectSpeed !== undefined ? overrides.effectSpeed : bgEffectSpeedRef.current;

    if (joined && curNick) {
      try {
        const sessionPayload = JSON.stringify({
          isJoined: true,
          room: curRoom,
          nickname: curNick,
          slotIndex: curSlot,
          wasMuted: curMuted,
          skin: curSkin,
          effect: curEffect,
          effectSpeed: curEffectSpeed,
        });
        sessionStorage.setItem("voiceroom_active_session", sessionPayload);
        localStorage.setItem("voiceroom_active_session", sessionPayload);
        localStorage.setItem("voiceroom_last_nick", curNick);

        // 브라우저 URL 주소창에도 현재 방/닉네임/발화석 번호를 동기화하여 F5/강력새로고침 시에도 100% 유지
        const url = new URL(window.location.href);
        url.searchParams.set("joined", "1");
        url.searchParams.set("room", curRoom);
        url.searchParams.set("nick", curNick);
        if (curSlot !== null && curSlot !== undefined) {
          url.searchParams.set("slot", String(curSlot));
        } else {
          url.searchParams.delete("slot");
        }
        url.searchParams.set("muted", curMuted ? "1" : "0");
        window.history.replaceState(null, "", url.pathname + url.search);
      } catch (e) {}

      // 서버 IP 세션 스토어에도 1 IP 1 닉네임 및 현재 방/발화석 상태 동기화
      fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: curNick,
          room: curRoom,
          isJoined: true,
          slotIndex: curSlot,
        }),
      }).catch(() => {});
    }
  };

  useEffect(() => {
    if (isJoined && cleanNick) {
      persistSessionState();
    }
  }, [isJoined, selectedRoom, cleanNick, mySlotIndex, isMuted, currentSkin, bgEffect, bgEffectSpeed]);

  // 데이터 브로드캐스트 (움직이는 GIF 등 대용량 데이터는 WebRTC SCTP 한도 내 28KB 청크로 자동 분할 전송)
  const broadcastData = async (payload: any) => {
    if (!roomRef.current) return;
    try {
      const str = JSON.stringify(payload);
      const CHUNK_SIZE = 28000;
      const encoder = new TextEncoder();
      if (str.length <= CHUNK_SIZE) {
        await roomRef.current.localParticipant.publishData(encoder.encode(str), {
          reliable: true,
        });
      } else {
        const transferId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const totalChunks = Math.ceil(str.length / CHUNK_SIZE);
        for (let i = 0; i < totalChunks; i++) {
          if (!roomRef.current) break;
          const chunk = str.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          const packet = JSON.stringify({
            type: "__DATA_CHUNK__",
            id: transferId,
            idx: i,
            total: totalChunks,
            data: chunk,
          });
          await roomRef.current.localParticipant.publishData(encoder.encode(packet), {
            reliable: true,
          });
          if (i % 3 === 2) {
            await new Promise((r) => setTimeout(r, 10));
          }
        }
      }
    } catch (e) {}
  };

  // 실시간 로컬 마이크 발화 분석 (VAD) 및 발화 상태 브로드캐스트
  const broadcastSpeaking = (active: boolean) => {
    const curNick = cleanNickRef.current;
    setSpeakingMap((prev) => ({
      ...prev,
      [curNick]: active,
      ...(roomRef.current?.localParticipant ? { [roomRef.current.localParticipant.identity]: active } : {}),
    }));
    try {
      broadcastData({
        type: "SPEAKING_STATUS",
        identity: curNick,
        isSpeaking: active,
      });
    } catch (e) {}
  };

  const stopLocalVAD = () => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (vadAudioCtxRef.current && vadAudioCtxRef.current.state !== "closed") {
      try {
        vadAudioCtxRef.current.close();
      } catch (e) {}
      vadAudioCtxRef.current = null;
    }
    if (isMyVoiceActiveRef.current) {
      isMyVoiceActiveRef.current = false;
      setIsMyVoiceActive(false);
      broadcastSpeaking(false);
    }
  };

  const startLocalVAD = (track: LocalAudioTrack) => {
    stopLocalVAD();
    try {
      const mediaStreamTrack = track.mediaStreamTrack;
      if (!mediaStreamTrack) return;
      const stream = new MediaStream([mediaStreamTrack]);
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      vadAudioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);

      const buffer = new Float32Array(analyser.fftSize);
      let hangoverFrames = 0;

      const checkAudio = () => {
        if (!localTrackRef.current || isMutedRef.current) {
          if (isMyVoiceActiveRef.current) {
            isMyVoiceActiveRef.current = false;
            setIsMyVoiceActive(false);
            broadcastSpeaking(false);
          }
          return;
        }

        if (ctx.state === "suspended") {
          ctx.resume().catch(() => {});
        }

        analyser.getFloatTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i] * buffer[i];
        }
        const rms = Math.sqrt(sum / buffer.length);

        if (rms > 0.015) {
          hangoverFrames = 6; // ~300ms hangover
          if (!isMyVoiceActiveRef.current) {
            isMyVoiceActiveRef.current = true;
            setIsMyVoiceActive(true);
            broadcastSpeaking(true);
          }
        } else {
          if (hangoverFrames > 0) {
            hangoverFrames--;
          } else if (isMyVoiceActiveRef.current) {
            isMyVoiceActiveRef.current = false;
            setIsMyVoiceActive(false);
            broadcastSpeaking(false);
          }
        }
      };

      vadIntervalRef.current = setInterval(checkAudio, 50);
    } catch (e) {
      console.warn("VAD init warning:", e);
    }
  };

  // 방 안에서 닉네임 즉시 변경
  const handleRenameInRoom = async () => {
    const trimmed = newNickInput.trim();
    if (!trimmed) {
      setNickChangeError("닉네임을 입력해 주세요.");
      return;
    }
    if (trimmed === cleanNick) {
      setShowNickModal(false);
      return;
    }
    if (allParticipants.includes(trimmed)) {
      setNickChangeError("이미 사용 중인 닉네임입니다.");
      return;
    }

    const oldNick = cleanNick;
    setNickname(trimmed);

    // LiveKit identity <-> 닉네임 매핑 등록
    const originalIdentity = nickToIdentityMapRef.current[oldNick] || oldNick;
    registerNickMapping(originalIdentity, trimmed);
    if (roomRef.current?.localParticipant) {
      registerNickMapping(roomRef.current.localParticipant.identity, trimmed);
    }

    // 착석 중이면 슬롯 업데이트
    let wasSeated = false;
    const nextSlots = { ...slotsRef.current };
    Object.keys(nextSlots).forEach((k) => {
      if (nextSlots[Number(k)] === oldNick) {
        nextSlots[Number(k)] = trimmed;
        wasSeated = true;
      }
    });

    if (wasSeated) {
      updateSlots(nextSlots);
    }

    // 아바타 사진, 음소거 상태, 기기 정보도 새 닉네임으로 이전
    if (avatarMapRef.current[oldNick]) {
      updateAvatar(trimmed, avatarMapRef.current[oldNick]);
    }
    if (muteMapRef.current[oldNick] !== undefined) {
      updateMuteStatus(trimmed, muteMapRef.current[oldNick]);
    }
    updateDeviceStatus(trimmed, myDeviceRef.current);
    renamePlazaData(oldNick, trimmed);
    updateCharacter(trimmed, myCharacterRef.current);

    setAllParticipants((prev) =>
      prev.map((id) => (id === oldNick ? trimmed : id))
    );

    // 방 전체에 닉네임 변경 및 슬롯 동기화 브로드캐스트
    await broadcastData({
      type: "RENAME",
      oldNick,
      newNick: trimmed,
      slots: wasSeated ? nextSlots : undefined,
      nickMap: identityToNickMapRef.current,
      device: myDeviceRef.current,
    });

    persistSessionState({ nickname: trimmed });
    setShowNickModal(false);
  };

  // 슬롯 착석
  const handleTakeSlot = async (slotIdx: number) => {
    const myNick = cleanNickRef.current || cleanNick;
    if (!myNick || slotsRef.current[slotIdx]) return;
    const wasAlreadySeated = Object.values(slotsRef.current).includes(myNick);
    myDesiredSlotRef.current = slotIdx;
    hasExplicitlyLeftSlotRef.current = false;
    const nextSlots = { ...slotsRef.current };
    Object.keys(nextSlots).forEach((k) => {
      if (nextSlots[Number(k)] === myNick) {
        delete nextSlots[Number(k)];
      }
    });
    nextSlots[slotIdx] = myNick;
    updateSlots(nextSlots);
    const nextMutedState = wasAlreadySeated ? isMutedRef.current : false;
    updateMuteStatus(myNick, nextMutedState);
    updateDeviceStatus(myNick, myDeviceRef.current);
    persistSessionState({ slotIndex: slotIdx, wasMuted: nextMutedState });
    await broadcastData({
      type: "TAKE_SLOT",
      slotIndex: slotIdx,
      identity: myNick,
      avatar: avatarMapRef.current[myNick],
      isMuted: nextMutedState,
      device: myDeviceRef.current,
      character: myCharacterRef.current,
    });
    // 이미 착석 중이던 사용자가 자리만 옮긴 경우: 마이크를 재시작하지 않고 자리만 이동
    if (!wasAlreadySeated) {
      await enableMyMicrophone();
    }
  };

  // 슬롯 내려오기
  const handleLeaveSlot = async () => {
    const myNick = cleanNickRef.current || cleanNick;
    if (whisperingTo) {
      await handleStopWhisper();
    }
    myDesiredSlotRef.current = null;
    pendingRestoreSlotRef.current = null;
    hasExplicitlyLeftSlotRef.current = true;
    const nextSlots = { ...slotsRef.current };
    Object.keys(nextSlots).forEach((k) => {
      if (nextSlots[Number(k)] === myNick) {
        delete nextSlots[Number(k)];
      }
    });
    updateSlots(nextSlots);
    persistSessionState({ slotIndex: null, wasMuted: true });
    await broadcastData({
      type: "LEAVE_SLOT",
      identity: myNick,
    });
    await disableMyMicrophone();
  };

  // 마이크 오류를 사용자에게 보여줄 안내 문구 (안드로이드는 다른 앱이 마이크를 쓰고 있으면 NotReadableError)
  const describeMicError = (e: any): string => {
    const name = e?.name || "";
    if (name === "NotAllowedError" || name === "SecurityError") {
      return "마이크 권한이 꺼져 있어요.\n\n주소창 왼쪽 자물쇠(또는 설정) 아이콘 → 권한 → 마이크를 '허용'으로 바꾼 뒤 새로고침해 주세요.";
    }
    if (name === "NotReadableError" || name === "AbortError" || name === "TrackStartError") {
      return "다른 앱이 마이크를 사용 중이라 켤 수 없어요.\n\n카카오톡 보이스룸/통화, 녹음 앱 등을 종료한 뒤 마이크를 다시 켜 주세요.";
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") {
      return "사용할 수 있는 마이크를 찾지 못했어요. 이어폰/블루투스 연결 상태를 확인해 주세요.";
    }
    return "마이크를 켜지 못했어요. 잠시 후 다시 시도해 주세요.";
  };

  // 마이크를 켜두길 원하는 상태인지 (켜는 도중에 내려가기/음소거가 눌리면 false가 되어 켜기를 취소)
  const micDesiredRef = useRef<boolean>(false);

  // 마이크 켜기 (착석 시에만 호출). 실제로 켜졌으면 true
  const enableMyMicrophone = async (): Promise<boolean> => {
    if (!roomRef.current || isMicBusyRef.current) return false;
    isMicBusyRef.current = true;
    micDesiredRef.current = true;
    const myNick = cleanNickRef.current || cleanNick;
    try {
      if (localTrackRef.current) {
        try {
          await roomRef.current.localParticipant.unpublishTrack(localTrackRef.current);
          localTrackRef.current.stop();
        } catch (e) {}
        localTrackRef.current = null;
      }
      const audioTrack = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
      // 마이크 권한 대기 중에 퇴장/내려가기/음소거가 눌린 경우 켜지 않음
      if (!roomRef.current || !micDesiredRef.current) {
        audioTrack.stop();
        return false;
      }
      await roomRef.current.localParticipant.publishTrack(audioTrack);
      localTrackRef.current = audioTrack;

      // 백그라운드에서 끊긴 마이크를 LiveKit이 복귀 시 다시 잡으면 발화 감지도 새 트랙으로 재연결
      audioTrack.on(TrackEvent.Restarted, () => {
        if (localTrackRef.current === audioTrack && !isMutedRef.current) {
          startLocalVAD(audioTrack);
        }
      });
      // 화면을 보고 있는 중에 OS/다른 앱이 마이크를 가져가면 트랙이 끝나버림 → 한 번 다시 켜보고 안 되면 음소거로 표시
      audioTrack.on(TrackEvent.Ended, () => {
        if (localTrackRef.current !== audioTrack || !micDesiredRef.current) return;
        if (typeof document !== "undefined" && document.visibilityState === "hidden") return; // 백그라운드는 LiveKit이 복귀 시 자동 재연결
        setTimeout(async () => {
          if (localTrackRef.current !== audioTrack || !micDesiredRef.current) return;
          const ok = await enableMyMicrophone();
          if (!ok && micDesiredRef.current) {
            await disableMyMicrophone();
          }
        }, 1000);
      });
      if (whisperingToRef.current) {
        applyMyTrackWhisperPermissions(whisperingToRef.current);
      }
      setIsMuted(false);
      isMutedRef.current = false;
      startLocalVAD(audioTrack);
      updateMuteStatus(myNick, false);
      persistSessionState({ wasMuted: false });
      broadcastData({
        type: "MUTE_STATUS",
        identity: myNick,
        rawIdentity: roomRef.current?.localParticipant?.identity,
        isMuted: false,
      });

      // getUserMedia 활성화 직후 브라우저 오디오 자동재생 제한이 풀리므로 기존 방 참가자(먼저 F5 누른 사람 등)의 오디오 트랙을 즉시 재생 복구!
      ensureAllRemoteAudioPlaying();
      setTimeout(ensureAllRemoteAudioPlaying, 150);
      setTimeout(ensureAllRemoteAudioPlaying, 500);
      setTimeout(ensureAllRemoteAudioPlaying, 1200);
      return true;
    } catch (e) {
      console.error("Mic enable error:", e);
      // 착석 시 '마이크 켜짐'으로 먼저 알렸으므로, 실패하면 음소거 상태로 되돌려 다른 사람 화면과 맞춤
      isMicBusyRef.current = false;
      if (micDesiredRef.current) {
        await disableMyMicrophone();
        alert(describeMicError(e));
      }
      return false;
    } finally {
      isMicBusyRef.current = false;
    }
  };

  // 마운트 시 등록한 이벤트 핸들러에서도 최신 enableMyMicrophone을 호출하기 위한 참조
  const enableMyMicrophoneRef = useRef(enableMyMicrophone);
  enableMyMicrophoneRef.current = enableMyMicrophone;

  // 마이크 끄기 (대기자 상태로 내려오거나 음소거 시 하드웨어 스트림 완전 정지 -> 초록불 끄기)
  const disableMyMicrophone = async () => {
    micDesiredRef.current = false;
    if (!roomRef.current) return;
    const myNick = cleanNickRef.current || cleanNick;
    try {
      stopLocalVAD();
      if (localTrackRef.current) {
        await roomRef.current.localParticipant.unpublishTrack(localTrackRef.current);
        localTrackRef.current.stop(); // 하드웨어 마이크 스트림 완전 정지 -> 초록불 꺼짐
        localTrackRef.current = null;
      }
      setIsMuted(true);
      isMutedRef.current = true;
      updateMuteStatus(myNick, true);
      persistSessionState({ wasMuted: true });
      broadcastData({
        type: "MUTE_STATUS",
        identity: myNick,
        rawIdentity: roomRef.current?.localParticipant?.identity,
        isMuted: true,
      });
    } catch (e) {
      console.error("Mic disable error:", e);
    }
  };

  // 마이크 토글
  const toggleMute = async () => {
    if (!isSeated) return;
    if (isMuted) {
      await enableMyMicrophone();
    } else {
      await disableMyMicrophone();
    }
  };

  // 전체 소리 토글 (Deafen)
  const toggleDeafen = () => {
    const next = !isDeafened;
    setIsDeafened(next);
    isDeafenedRef.current = next;
    applyAllAudioStates();
  };

  // 마스터 볼륨 조절 (0% ~ 150%)
  const handleMasterVolumeChange = (val: number) => {
    setMasterVolume(val);
    masterVolumeRef.current = val;
    applyAllAudioStates();
  };

  // 사람별 볼륨 조절
  const handleVolumeChange = (identity: string, val: number) => {
    setVolumeMap((prev) => {
      const next = { ...prev, [identity]: val };
      volumeMapRef.current = next;
      return next;
    });
    applyAllAudioStates();
  };

  // 귓속말 시작 (해당 참가자에게만 내 목소리가 들리도록 서버 트랙 권한 및 클라이언트 음소거 이중 차단 활성화)
  const handleStartWhisper = async (targetNick: string) => {
    if (!isSeated) {
      alert("귓속말을 하려면 먼저 마이크 자리에 착석해야 합니다.");
      return;
    }
    if (targetNick === cleanNick) return;

    setWhisperingTo(targetNick);
    whisperingToRef.current = targetNick;
    const myIdentity = roomRef.current?.localParticipant?.identity || cleanNick;
    activeWhispersRef.current[cleanNick] = targetNick;
    activeWhispersRef.current[myIdentity] = targetNick;
    applyMyTrackWhisperPermissions(targetNick);
    applyAllAudioStates();

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;

    const sysMsg: ChatItem = {
      id: `whisper-${Date.now()}`,
      sender: "시스템",
      text: `🤫 [${targetNick}]님에게 귓속말을 시작했습니다. (대기자 포함 다른 사람에게는 내 목소리가 전혀 들리지 않습니다)`,
      time: timeStr,
      isSystem: true,
    };
    setMessages((prev) => [...prev, sysMsg]);
    scrollToBottom(true);

    await broadcastData({
      type: "WHISPER_START",
      from: cleanNick,
      fromIdentity: myIdentity,
      to: targetNick,
      toIdentity: nickToIdentityMapRef.current[targetNick] || targetNick,
    });
  };

  // 귓속말 종료 (모든 사람이 다시 내 목소리를 들을 수 있음)
  const handleStopWhisper = async () => {
    const prevTarget = whisperingToRef.current || whisperingTo;
    if (!prevTarget) return;
    setWhisperingTo(null);
    whisperingToRef.current = null;
    const myIdentity = roomRef.current?.localParticipant?.identity || cleanNick;
    delete activeWhispersRef.current[cleanNick];
    delete activeWhispersRef.current[myIdentity];
    applyMyTrackWhisperPermissions(null);
    applyAllAudioStates();

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;

    const sysMsg: ChatItem = {
      id: `whisper-end-${Date.now()}`,
      sender: "시스템",
      text: `🤫 [${prevTarget}]님과의 귓속말이 종료되었습니다. (모든 사람에게 다시 내 목소리가 들립니다)`,
      time: timeStr,
      isSystem: true,
    };
    setMessages((prev) => [...prev, sysMsg]);
    scrollToBottom(true);

    await broadcastData({
      type: "WHISPER_END",
      from: cleanNick,
      fromIdentity: myIdentity,
      to: prevTarget,
    });
  };

  // 채팅 전송 (대기 중인 붙여넣기 이미지 및 텍스트 전송, TTS/귓속말 지원)
  const sendMessage = async () => {
    const text = inputText.trim();
    const stagedImg = pendingChatImageRef.current || pendingChatImage;
    if (!text && !stagedImg) return;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;

    const senderNick = cleanNickRef.current || cleanNick;
    const whisperTo = chatWhisperTargetRef.current ?? chatWhisperTarget;

    const chatItem: ChatItem = {
      id: `${stagedImg ? "img" : "msg"}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sender: senderNick,
      text,
      time: timeStr,
      isTTS: text ? myTTSMode : false,
      ...(text && myTTSMode ? { ttsVoice: myTTSVoiceRef.current || myTTSVoice } : {}),
      ...(stagedImg ? { imageUrl: stagedImg } : {}),
      reactions: {},
      ...(whisperTo ? { whisperTo } : {}),
    };

    setMessages((prev) => [...prev, chatItem]);
    showChatBubble(chatItem);
    setInputText("");
    setPendingChatImage(null);
    pendingChatImageRef.current = null;
    if (viewModeRef.current === "plaza") {
      chatTextInputRef.current?.blur();
    }
    scrollToBottom(true);
    await broadcastData({ type: "CHAT_MESSAGE", chat: chatItem });

    // 내 기기에서도 읽어줌
    if (text && myTTSMode) {
      speakText(text, myTTSVoiceRef.current || myTTSVoice);
    }
  };

  // 내가 보낸 채팅/사진 보내기 취소 (방 전체 참가자 화면에서 즉시 삭제, 서버/DB 미저장)
  const handleDeleteMessage = async (msgId: string) => {
    const targetMsg = messages.find((m) => m.id === msgId);
    if (targetMsg?.imageUrl && selectedChatImage === targetMsg.imageUrl) {
      setSelectedChatImage(null);
    }
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    await broadcastData({
      type: "DELETE_MESSAGE",
      messageId: msgId,
    });
  };

  // 채팅/사진에 카톡 스타일 이모티콘 반응 추가/취소 (방 전체 실시간 동기화)
  const handleToggleReaction = async (msgId: string, emoji: string) => {
    const myNick = cleanNickRef.current || cleanNick;
    if (!myNick) return;

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m;
        const prevReactions = m.reactions ? { ...m.reactions } : {};
        const list = prevReactions[emoji] ? [...prevReactions[emoji]] : [];
        const idx = list.indexOf(myNick);
        if (idx >= 0) {
          list.splice(idx, 1);
        } else {
          list.push(myNick);
        }
        if (list.length === 0) {
          delete prevReactions[emoji];
        } else {
          prevReactions[emoji] = list;
        }
        return { ...m, reactions: prevReactions };
      })
    );
    setActiveReactionMsgId(null);
    scrollToBottom(false);

    await broadcastData({
      type: "TOGGLE_REACTION",
      messageId: msgId,
      emoji,
      identity: myNick,
    });
  };

  const chatWhisperTargetRef = useRef<string | null>(null);
  chatWhisperTargetRef.current = chatWhisperTarget;

  // 이미지 파일/클립보드 캡처 이미지를 리사이즈 및 경량화하여 미리보기 대기(stageOnly=true) 또는 즉시 전송 (움직이는 GIF는 원본 프레임 100% 보존, 서버/DB 일체 미저장)
  const processChatImageFile = (file: File | Blob, stageOnly: boolean = false) => {
    if (!file) return;
    setIsUploadingChatImage(true);
    setChatSizeMode((prev) => (prev === "closed" ? "half" : prev));

    const isGif =
      file.type === "image/gif" ||
      (file instanceof File && file.name.toLowerCase().endsWith(".gif"));

    const finalizeChatImage = (finalDataUrl: string) => {
      if (stageOnly) {
        setPendingChatImage(finalDataUrl);
        pendingChatImageRef.current = finalDataUrl;
        setIsUploadingChatImage(false);
        setTimeout(() => {
          chatTextInputRef.current?.focus();
        }, 30);
        return;
      }

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes()
      ).padStart(2, "0")}`;

      const senderNick = cleanNickRef.current || cleanNick;
      const whisperTo = chatWhisperTargetRef.current;

      const chatItem: ChatItem = {
        id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        sender: senderNick,
        text: "",
        time: timeStr,
        imageUrl: finalDataUrl,
        reactions: {},
        ...(whisperTo ? { whisperTo } : {}),
      };

      setMessages((prev) => [...prev, chatItem]);
      showChatBubble(chatItem);
      scrollToBottom(true);
      broadcastData({ type: "CHAT_MESSAGE", chat: chatItem });
      setIsUploadingChatImage(false);
    };

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      if (!rawDataUrl) {
        setIsUploadingChatImage(false);
        return;
      }

      // 움직이는 GIF는 캔버스 JPEG 변환을 거치지 않고 원본 GIF 데이터 URL 그대로 전송하여 애니메이션 보존
      if (isGif) {
        finalizeChatImage(rawDataUrl);
        return;
      }

      const img = new Image();
      img.onload = () => {
        try {
          // 최대 가로/세로 680px로 비율 유지 리사이즈 (데이터 채널 최적화 및 캡처 글씨 가독성 확보)
          const maxDim = 680;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            setIsUploadingChatImage(false);
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);

          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.7);
          finalizeChatImage(compressedDataUrl);
        } catch (err) {
          console.error("Chat image processing failed:", err);
          setIsUploadingChatImage(false);
        }
      };
      img.onerror = () => {
        setIsUploadingChatImage(false);
      };
      img.src = rawDataUrl;
    };
    reader.onerror = () => {
      setIsUploadingChatImage(false);
    };
    reader.readAsDataURL(file);
  };

  // 채팅창 사진 버튼 업로드 핸들러
  const handleChatImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processChatImageFile(file, false);
    e.target.value = "";
  };

  // 윈도우 캡처(Win+Shift+S 등) 후 클립보드 이미지 Ctrl+V 붙여넣기 -> 미리보기 표시 후 Enter 시 전송
  const extractImageFromClipboard = (clipboardData: DataTransfer | null): File | null => {
    if (!clipboardData) return null;
    if (clipboardData.items) {
      for (let i = 0; i < clipboardData.items.length; i++) {
        const item = clipboardData.items[i];
        if (item.type && item.type.startsWith("image/")) {
          const blob = item.getAsFile();
          if (blob) return blob;
        }
      }
    }
    if (clipboardData.files && clipboardData.files.length > 0) {
      for (let i = 0; i < clipboardData.files.length; i++) {
        const f = clipboardData.files[i];
        if (f.type && f.type.startsWith("image/")) {
          return f;
        }
      }
    }
    return null;
  };

  const handleChatPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const imgFile = extractImageFromClipboard(e.clipboardData);
    if (imgFile) {
      e.preventDefault();
      e.stopPropagation();
      processChatImageFile(imgFile, true);
    }
  };

  useEffect(() => {
    if (!isJoined || typeof window === "undefined") return;
    const handleGlobalPaste = (e: ClipboardEvent) => {
      if (e.defaultPrevented) return;
      const imgFile = extractImageFromClipboard(e.clipboardData);
      if (imgFile) {
        e.preventDefault();
        processChatImageFile(imgFile, true);
      }
    };
    window.addEventListener("paste", handleGlobalPaste);
    return () => {
      window.removeEventListener("paste", handleGlobalPaste);
    };
  }, [isJoined]);

  useEffect(() => {
    if (!isJoined || !pendingChatImage || typeof window === "undefined") return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === "Escape") {
        setPendingChatImage(null);
        pendingChatImageRef.current = null;
      } else if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        if (document.activeElement !== chatTextInputRef.current) {
          e.preventDefault();
          sendMessage();
        }
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [isJoined, pendingChatImage, inputText, chatWhisperTarget, myTTSMode]);

  // 룸 입장 (일반 입장 및 F5 새로고침 자동 복구 지원)
  const joinRoom = async (autoRestore?: {
    room: string;
    nickname: string;
    slotIndex: number | null;
    wasMuted: boolean;
    avatar?: string | null;
    skin?: string;
    effect?: BgEffectType;
  }) => {
    if (isJoiningRef.current) return;
    const targetRoom = autoRestore?.room || selectedRoom;
    const targetNick = (autoRestore?.nickname || cleanNickRef.current || cleanNick).trim();
    if (!targetNick) {
      setErrorMsg("닉네임을 입력해 주세요.");
      return;
    }

    isJoiningRef.current = true;
    if (autoRestore) {
      isRestoringRef.current = true;
      if (autoRestore.slotIndex !== null && autoRestore.slotIndex !== undefined) {
        pendingRestoreSlotRef.current = autoRestore.slotIndex;
        myDesiredSlotRef.current = autoRestore.slotIndex;
      } else {
        myDesiredSlotRef.current = null;
      }
    }
    cleanNickRef.current = targetNick;
    setErrorMsg("");
    setIsLoading(true);

    try {
      const detectedDev = detectLocalDevice();
      myDeviceRef.current = detectedDev;
      updateDeviceStatus(targetNick, detectedDev);

      const res = await fetch(
        `/api/token?room=${encodeURIComponent(
          targetRoom
        )}&username=${encodeURIComponent(targetNick)}&device=${encodeURIComponent(detectedDev)}`
      );
      const data = await res.json();
      if (!res.ok || !data.token) {
        throw new Error(data.error || "토큰 발급 실패");
      }
      livekitTokenRef.current = data.token;

      const room = new Room({
        adaptiveStream: false,
        dynacast: false,
        webAudioMix: false, // iOS/PC/Android 모두 브라우저 네이티브 WebRTC 지터 버퍼를 사용하는 <audio>로 통일하여 음성 끊김 및 버퍼 언더런 원천 방지
      });
      roomRef.current = room;

      room
        .on(RoomEvent.ParticipantConnected, (p) => {
          extractDeviceFromMetadata(p.identity, p.metadata);
          p.on(ParticipantEvent.IsSpeakingChanged, (speaking: boolean) => {
            const currentNick = identityToNickMapRef.current[p.identity] || p.identity;
            setSpeakingMap((prev) => ({
              ...prev,
              [p.identity]: speaking,
              [currentNick]: speaking,
            }));
          });
          setAllParticipants((prev) => {
            const updated = Array.from(new Set([...prev, p.identity]));
            return updated;
          });
          if (whisperingToRef.current) {
            applyMyTrackWhisperPermissions(whisperingToRef.current);
          }
          playDingSound();
          // 신규 입장자 TTS 알림 (기본 남성 인준 보이스 또는 내가 선택한 보이스로 발화)
          speakText(`${p.identity}님이 들어왔습니다.`, myTTSVoiceRef.current);
          // 기존에 착석자 또는 스킨/배경음/주제/귓속말/음소거/기기 상태가 설정되어 있을 때 신규 참여자에게 전체 정보 전달
          if (!isJoiningRef.current && !isRestoringRef.current) {
            broadcastData({
              type: "SYNC_SLOTS",
              slots: slotsRef.current,
              avatars: avatarMapRef.current,
              mutes: {
                ...muteMapRef.current,
                [cleanNickRef.current]: isMutedRef.current,
              },
              devices: {
                ...deviceMapRef.current,
                [cleanNickRef.current]: myDeviceRef.current,
              },
              skin: currentSkinRef.current,
              plazaSkin: plazaSkinRef.current,
              viewMode: viewModeRef.current,
              effect: bgEffectRef.current,
              effectSpeed: bgEffectSpeedRef.current,
              topic: roomTopicRef.current,
              nickMap: identityToNickMapRef.current,
              whispers: activeWhispersRef.current,
            });
          }
        })
        .on(RoomEvent.ParticipantDisconnected, (p) => {
          const disconnectedIdentity = p.identity;
          const disconnectedSid = p.sid;
          const mappedNick = identityToNickMapRef.current[disconnectedIdentity] || disconnectedIdentity;
          // F5 새로고침 시 beforeunload 연결 해제 후 재접속까지 약 0.5~2.5초가 소요되므로 3.5초 유예 후 재접속 여부 확인
          setTimeout(() => {
            if (!roomRef.current || roomRef.current !== room) return;
            const reconnected = Array.from(room.remoteParticipants.values()).some((rp) => {
              const rpNick = identityToNickMapRef.current[rp.identity] || rp.identity;
              return (
                (rp.identity === disconnectedIdentity || rpNick === mappedNick) &&
                rp.sid !== disconnectedSid
              );
            });
            if (reconnected) {
              return;
            }
            cleanupWhisperForUser(disconnectedIdentity);
            setAllParticipants((prev) =>
              prev.filter((id) => id !== disconnectedIdentity && id !== mappedNick)
            );
            updateSlots((prev) => {
              const next = { ...prev };
              Object.keys(next).forEach((k) => {
                if (next[Number(k)] === disconnectedIdentity || next[Number(k)] === mappedNick) {
                  delete next[Number(k)];
                }
              });
              return next;
            });
          }, 3500);
        })
        .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          setSpeakingMap((prev) => {
            const map: { [identity: string]: boolean } = {};
            speakers.forEach((s) => {
              map[s.identity] = true;
              const mappedNick = identityToNickMapRef.current[s.identity];
              if (mappedNick) map[mappedNick] = true;
            });
            if (isMyVoiceActiveRef.current || roomRef.current?.localParticipant?.isSpeaking) {
              map[cleanNickRef.current] = true;
              if (roomRef.current?.localParticipant) {
                map[roomRef.current.localParticipant.identity] = true;
              }
            }
            return map;
          });
        })
        .on(RoomEvent.TrackSubscribed, (track: Track, pub, participant) => {
          if (track.kind === Track.Kind.Audio) {
            if (audioElementsRef.current[participant.identity]) {
              try {
                audioElementsRef.current[participant.identity].remove();
              } catch (e) {}
            }
            const el = track.attach();
            el.autoplay = true;
            (el as any).playsInline = true;
            el.setAttribute("playsinline", "true");
            el.setAttribute("webkit-playsinline", "true");
            audioElementsRef.current[participant.identity] = el;
            if (selectedAudioDevice && "setSinkId" in el) {
              (el as any).setSinkId(selectedAudioDevice).catch(() => {});
            }
            document.body.appendChild(el);
            applyAllAudioStates();
            el.play().catch(() => {});
            room.startAudio().catch(() => {});
            setTimeout(() => ensureAllRemoteAudioPlaying(), 200);
          }
        })
        .on(RoomEvent.TrackUnsubscribed, (track: Track, pub, participant) => {
          const detached = track.detach();
          detached.forEach((el) => {
            el.remove();
            if (audioElementsRef.current[participant.identity] === el) {
              delete audioElementsRef.current[participant.identity];
            }
          });
        })
        .on(RoomEvent.DataReceived, (payload: Uint8Array, participant) => {
          try {
            const decoder = new TextDecoder();
            let msg = JSON.parse(decoder.decode(payload));
            if (msg.type === "__DATA_CHUNK__") {
              const { id, idx, total, data } = msg;
              if (!id || typeof idx !== "number" || typeof total !== "number") return;
              const now = Date.now();
              // 오래된 미완성 청크 정리 (60초 경과)
              Object.keys(dataChunkBufferRef.current).forEach((k) => {
                if (now - dataChunkBufferRef.current[k].createdAt > 60000) {
                  delete dataChunkBufferRef.current[k];
                }
              });
              if (!dataChunkBufferRef.current[id]) {
                dataChunkBufferRef.current[id] = {
                  chunks: new Array(total),
                  received: 0,
                  createdAt: now,
                };
              }
              const entry = dataChunkBufferRef.current[id];
              if (entry.chunks[idx] === undefined) {
                entry.chunks[idx] = data;
                entry.received += 1;
              }
              if (entry.received < total) {
                return;
              }
              const fullStr = entry.chunks.join("");
              delete dataChunkBufferRef.current[id];
              msg = JSON.parse(fullStr);
            }
            if (msg.type === "REQUEST_SLOTS") {
              if (msg.identity && msg.device) {
                updateDeviceStatus(msg.identity, msg.device);
              }
              // 신규 참가자의 동기화 요청 -> 현재 방 슬롯, 아바타, 음소거, 기기, 스킨, 배경음, 주제, 귓속말 정보 전달
              broadcastData({
                type: "SYNC_SLOTS",
                slots: slotsRef.current,
                avatars: avatarMapRef.current,
                mutes: {
                  ...muteMapRef.current,
                  [cleanNickRef.current]: isMutedRef.current,
                },
                devices: {
                  ...deviceMapRef.current,
                  [cleanNickRef.current]: myDeviceRef.current,
                },
                skin: currentSkinRef.current,
                effect: bgEffectRef.current,
                effectSpeed: bgEffectSpeedRef.current,
                topic: roomTopicRef.current,
                nickMap: identityToNickMapRef.current,
                whispers: activeWhispersRef.current,
                characters: {
                  ...characterMapRef.current,
                  ...(cleanNickRef.current ? { [cleanNickRef.current]: myCharacterRef.current } : {}),
                },
                positions: plazaPosMapRef.current,
              });
            } else if (msg.type === "TAKE_SLOT") {
              if (msg.slotIndex !== undefined && msg.identity) {
                const targetSlot = Number(msg.slotIndex);
                // 내가 이미 착석 중인 슬롯을 다른 참가자가 뺏으려 할 때 내 자리 수호 & 방어
                if (
                  slotsRef.current[targetSlot] === cleanNickRef.current &&
                  msg.identity !== cleanNickRef.current
                ) {
                  setTimeout(() => {
                    broadcastData({
                      type: "TAKE_SLOT",
                      slotIndex: targetSlot,
                      identity: cleanNickRef.current,
                      avatar: avatarMapRef.current[cleanNickRef.current],
                      isMuted: isMutedRef.current,
                      device: myDeviceRef.current,
                      character: myCharacterRef.current,
                    });
                  }, 80);
                  return;
                }
                updateSlots((prev) => {
                  const next = { ...prev };
                  Object.keys(next).forEach((k) => {
                    if (next[Number(k)] === msg.identity) delete next[Number(k)];
                  });
                  next[targetSlot] = msg.identity;

                  // 만약 내가 차지하려던 슬롯이 방금 다른 사람에게 선점되었거나, 스스로 대기석으로 내려가지 않았는데
                  // 착석 자리에서 밀려난 경우: 즉시 다음 빈 슬롯을 자동 확보하여 착석 (대기자 튕김 원천 방지)
                  const myNick = cleanNickRef.current;
                  if (
                    myNick &&
                    !hasExplicitlyLeftSlotRef.current &&
                    msg.identity !== myNick &&
                    (myDesiredSlotRef.current === targetSlot || !Object.values(next).includes(myNick))
                  ) {
                    const nextFree = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].find(
                      (i) => i !== targetSlot && !next[i]
                    );
                    if (nextFree !== undefined) {
                      myDesiredSlotRef.current = nextFree;
                      next[nextFree] = myNick;
                      persistSessionState({ slotIndex: nextFree, wasMuted: isMutedRef.current });
                      setTimeout(() => {
                        broadcastData({
                          type: "TAKE_SLOT",
                          slotIndex: nextFree,
                          identity: myNick,
                          avatar: avatarMapRef.current[myNick],
                          isMuted: isMutedRef.current,
                          device: myDeviceRef.current,
                          character: myCharacterRef.current,
                        });
                      }, 100);
                    }
                  }

                  return next;
                });
                if (msg.avatar) {
                  updateAvatar(msg.identity, msg.avatar);
                }
                if (typeof msg.isMuted === "boolean") {
                  updateMuteStatus(msg.identity, msg.isMuted);
                }
                if (msg.device) {
                  updateDeviceStatus(msg.identity, msg.device);
                }
                if (typeof msg.character === "string") {
                  updateCharacter(msg.identity, normalizeCharacterId(msg.character));
                }
              }
            } else if (msg.type === "LEAVE_SLOT") {
              if (msg.identity) {
                cleanupWhisperForUser(msg.identity);
                updateSlots((prev) => {
                  const next = { ...prev };
                  Object.keys(next).forEach((k) => {
                    if (next[Number(k)] === msg.identity) delete next[Number(k)];
                  });
                  return next;
                });
              }
            } else if (msg.type === "SYNC_SLOTS") {
              if (msg.nickMap) {
                Object.entries(msg.nickMap).forEach(([k, v]: [string, any]) => {
                  registerNickMapping(k, v);
                });
              }
              if (msg.slots && typeof msg.slots === "object") {
                // 기존 슬롯과 수신 슬롯을 병합하여 빈 SYNC_SLOTS 패킷이 기존 착석자들을 대기석으로 튕겨내지 않도록 보호
                const mergedSlots: { [key: number]: string } = { ...slotsRef.current };
                Object.entries(msg.slots).forEach(([slotKey, occupant]) => {
                  if (typeof occupant === "string" && occupant) {
                    Object.keys(mergedSlots).forEach((k) => {
                      if (mergedSlots[Number(k)] === occupant) {
                        delete mergedSlots[Number(k)];
                      }
                    });
                    mergedSlots[Number(slotKey)] = occupant;
                  }
                });
                const targetMySlot =
                  myDesiredSlotRef.current !== null
                    ? myDesiredSlotRef.current
                    : pendingRestoreSlotRef.current;
                if (targetMySlot !== null && cleanNickRef.current) {
                  // 만약 내가 차지하려던 슬롯이 이미 다른 사람에 의해 선점되어 있다면 충돌 회피 -> 다음 빈 슬롯 자동 선택
                  let actualSlot = targetMySlot;
                  if (mergedSlots[targetMySlot] && mergedSlots[targetMySlot] !== cleanNickRef.current) {
                    const fallbackSlot = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].find((i) => !mergedSlots[i]);
                    if (fallbackSlot !== undefined) {
                      actualSlot = fallbackSlot;
                      myDesiredSlotRef.current = fallbackSlot;
                    }
                  }
                  Object.keys(mergedSlots).forEach((k) => {
                    if (mergedSlots[Number(k)] === cleanNickRef.current) {
                      delete mergedSlots[Number(k)];
                    }
                  });
                  mergedSlots[actualSlot] = cleanNickRef.current;
                  persistSessionState({ slotIndex: actualSlot, wasMuted: isMutedRef.current });
                  setTimeout(() => {
                    broadcastData({
                      type: "TAKE_SLOT",
                      slotIndex: actualSlot,
                      identity: cleanNickRef.current,
                      avatar: avatarMapRef.current[cleanNickRef.current],
                      isMuted: isMutedRef.current,
                      device: myDeviceRef.current,
                      character: myCharacterRef.current,
                    });
                  }, 100);
                } else if (
                  !hasExplicitlyLeftSlotRef.current &&
                  cleanNickRef.current &&
                  !Object.values(mergedSlots).includes(cleanNickRef.current)
                ) {
                  // 스스로 대기석으로 내려가지 않은 신규 입장자인데 아직 착석하지 못한 경우 빈 슬롯 자동 배정
                  const autoSlot = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].find((i) => !mergedSlots[i]);
                  if (autoSlot !== undefined) {
                    myDesiredSlotRef.current = autoSlot;
                    mergedSlots[autoSlot] = cleanNickRef.current;
                    persistSessionState({ slotIndex: autoSlot, wasMuted: true });
                    setTimeout(() => {
                      broadcastData({
                        type: "TAKE_SLOT",
                        slotIndex: autoSlot,
                        identity: cleanNickRef.current,
                        avatar: avatarMapRef.current[cleanNickRef.current],
                        isMuted: isMutedRef.current,
                        device: myDeviceRef.current,
                        character: myCharacterRef.current,
                      });
                    }, 120);
                  }
                }
                updateSlots(mergedSlots);
              }
              if (msg.avatars && typeof msg.avatars === "object") {
                setAvatarMap((prev) => {
                  const next = { ...prev, ...msg.avatars };
                  avatarMapRef.current = next;
                  return next;
                });
              }
              if (msg.mutes && typeof msg.mutes === "object") {
                const nextMutes = { ...muteMapRef.current, ...msg.mutes };
                if (
                  (myDesiredSlotRef.current !== null || pendingRestoreSlotRef.current !== null) &&
                  cleanNickRef.current
                ) {
                  nextMutes[cleanNickRef.current] = isMutedRef.current;
                }
                muteMapRef.current = nextMutes;
                setMuteMap({ ...nextMutes });
              }
              if (msg.devices && typeof msg.devices === "object") {
                const nextDevices = { ...deviceMapRef.current, ...msg.devices };
                if (cleanNickRef.current) {
                  nextDevices[cleanNickRef.current] = myDeviceRef.current;
                }
                deviceMapRef.current = nextDevices;
                setDeviceMap({ ...nextDevices });
              }
              if (msg.whispers && typeof msg.whispers === "object") {
                activeWhispersRef.current = {
                  ...activeWhispersRef.current,
                  ...msg.whispers,
                };
              }
              applyAllAudioStates();
              if (whisperingToRef.current) {
                applyMyTrackWhisperPermissions(whisperingToRef.current);
              }
              if (msg.skin && SKINS.some((s) => s.id === msg.skin)) {
                setCurrentSkin(msg.skin);
                currentSkinRef.current = msg.skin;
              }
              if (isPlazaThemeId(msg.plazaSkin)) {
                setPlazaSkin(msg.plazaSkin);
                plazaSkinRef.current = msg.plazaSkin;
                try {
                  localStorage.setItem("voiceroom_plaza_skin", msg.plazaSkin);
                } catch (e) {}
              }
              if (msg.viewMode === "basic" || msg.viewMode === "plaza") {
                setViewMode(msg.viewMode);
                viewModeRef.current = msg.viewMode;
                try {
                  localStorage.setItem("voiceroom_view_mode", msg.viewMode);
                } catch (e) {}
              }
              if (msg.effect && BG_EFFECTS.some((ef) => ef.id === msg.effect)) {
                setBgEffect(msg.effect);
                bgEffectRef.current = msg.effect;
                try {
                  localStorage.setItem("voiceroom_bg_effect", msg.effect);
                } catch (e) {}
              }
              if (typeof msg.effectSpeed === "number" && msg.effectSpeed >= 20 && msg.effectSpeed <= 250) {
                setBgEffectSpeed(msg.effectSpeed);
                bgEffectSpeedRef.current = msg.effectSpeed;
                try {
                  localStorage.setItem("voiceroom_bg_effect_speed", String(msg.effectSpeed));
                } catch (e) {}
              }
              if (msg.topic && typeof msg.topic === "string") {
                setRoomTopic(msg.topic);
                roomTopicRef.current = msg.topic;
              }
              if (msg.characters && typeof msg.characters === "object") {
                const nextChars = { ...characterMapRef.current };
                Object.entries(msg.characters).forEach(([nick, ch]) => {
                  if (nick && typeof ch === "string") nextChars[nick] = normalizeCharacterId(ch);
                });
                if (cleanNickRef.current) nextChars[cleanNickRef.current] = myCharacterRef.current;
                characterMapRef.current = nextChars;
                setCharacterMap(nextChars);
              }
              if (msg.positions && typeof msg.positions === "object") {
                const nextPos = { ...plazaPosMapRef.current };
                Object.entries(msg.positions).forEach(([nick, mv]: [string, any]) => {
                  // 내 위치는 내가 가진 값을 유지, 다른 사람은 도착 지점 기준으로 배치
                  if (!nick || nick === cleanNickRef.current || !isPlazaMove(mv)) return;
                  if (nextPos[nick]) return;
                  nextPos[nick] = { x: mv.tx, y: mv.ty, tx: mv.tx, ty: mv.ty, ts: Date.now() };
                });
                plazaPosMapRef.current = nextPos;
                setPlazaPosMap(nextPos);
              }
            } else if (msg.type === "CHAR_SET") {
              if (msg.identity && typeof msg.character === "string") {
                updateCharacter(msg.identity, normalizeCharacterId(msg.character));
              }
            } else if (msg.type === "CHAR_MOVE") {
              if (msg.identity && msg.identity !== cleanNickRef.current && isPlazaMove(msg.move)) {
                updatePlazaPos(msg.identity, {
                  x: msg.move.x,
                  y: msg.move.y,
                  tx: msg.move.tx,
                  ty: msg.move.ty,
                  ts: Date.now(),
                });
              }
            } else if (msg.type === "ROOM_TOPIC") {
              // 방 주제 실시간 동기화
              if (msg.topic && typeof msg.topic === "string") {
                setRoomTopic(msg.topic);
                roomTopicRef.current = msg.topic;
              }
            } else if (msg.type === "ROOM_SKIN") {
              // 다른 참가자가 스킨을 변경했을 때 방 전체 동기화!
              if (msg.skin && SKINS.some((s) => s.id === msg.skin)) {
                setCurrentSkin(msg.skin);
                currentSkinRef.current = msg.skin;
                try {
                  localStorage.setItem("voiceroom_skin", msg.skin);
                } catch (e) {}
              }
            } else if (msg.type === "ROOM_PLAZA_SKIN") {
              // 다른 참가자가 캐릭터 광장 스킨을 변경했을 때 방 전체 동기화!
              if (isPlazaThemeId(msg.plazaSkin)) {
                setPlazaSkin(msg.plazaSkin);
                plazaSkinRef.current = msg.plazaSkin;
                try {
                  localStorage.setItem("voiceroom_plaza_skin", msg.plazaSkin);
                } catch (e) {}
              }
            } else if (msg.type === "ROOM_VIEW_MODE") {
              // 한 명이 모드를 변경하면 방 전체 참여자의 모드도 동시에 전환!
              if (msg.viewMode === "basic" || msg.viewMode === "plaza") {
                setViewMode(msg.viewMode);
                viewModeRef.current = msg.viewMode;
                try {
                  localStorage.setItem("voiceroom_view_mode", msg.viewMode);
                } catch (e) {}
              }
            } else if (msg.type === "ROOM_EFFECT") {
              // 다른 참가자가 배경 시각 효과 및 속도를 변경했을 때 방 전체 동기화!
              if (msg.effect && BG_EFFECTS.some((ef) => ef.id === msg.effect)) {
                setBgEffect(msg.effect);
                bgEffectRef.current = msg.effect;
                try {
                  localStorage.setItem("voiceroom_bg_effect", msg.effect);
                } catch (e) {}
              }
              if (typeof msg.speed === "number" && msg.speed >= 20 && msg.speed <= 250) {
                setBgEffectSpeed(msg.speed);
                bgEffectSpeedRef.current = msg.speed;
                try {
                  localStorage.setItem("voiceroom_bg_effect_speed", String(msg.speed));
                } catch (e) {}
              }
            } else if (msg.type === "PLAZA_POSE") {
              if (msg.identity) {
                const duration = msg.pose === "jump" ? 668 : 3400;
                if (msg.pose !== "sit" && msg.pose !== "lie") {
                  const startedAt = typeof msg.startedAt === "number" && Math.abs(Date.now() - msg.startedAt) < 5000 ? msg.startedAt : Date.now();
                  triggerPlazaPose(msg.identity, msg.pose || null, Math.max(1, duration - (Date.now() - startedAt)), { startedAt });
                }
              }
            } else if (msg.type === "INTERACT_ACTION") {
              if (msg.from && msg.to && (msg.actionType === "hug" || msg.actionType === "kiss")) {
                const startedAt = typeof msg.startedAt === "number" && Math.abs(Date.now() - msg.startedAt) < 5000 ? msg.startedAt : Date.now();
                const fromFacing: 1 | -1 = msg.fromFacing === -1 ? -1 : 1;
                const remaining = Math.max(1, 668 - (Date.now() - startedAt));
                triggerPlazaPose(msg.from, msg.actionType, remaining, { startedAt, role: "send", facing: fromFacing, partner: msg.to });
                triggerPlazaPose(msg.to, msg.actionType, remaining, { startedAt, role: "receive", facing: fromFacing === 1 ? -1 : 1, partner: msg.from });
                const now = new Date();
                const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
                const emoji = msg.actionType === "handshake" ? "🤝" : msg.actionType === "hug" ? "🫂" : "💋";
                const label = msg.actionType === "handshake" ? "악수했습니다! ✨" : msg.actionType === "hug" ? "따뜻하게 껴안았습니다! 💕" : "볼에 쪽! 뽀뽀했습니다! ❤️";
                const sysChat: ChatItem = {
                  id: `interact-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                  sender: "시스템",
                  text: `${emoji} [${msg.from}]님이 [${msg.to}]님과 ${label}`,
                  time: timeStr,
                  isSystem: true,
                };
                setMessages((prev) => [...prev, sysChat]);
                showChatBubble({
                  id: sysChat.id,
                  sender: msg.from,
                  text: `${emoji} ${label}`,
                  time: timeStr,
                });
              }
            } else if (msg.type === "SEAT_EMOTE") {
              // 좌석 간 감정표현 투사체 발사 수신!
              if (
                typeof msg.fromSlot === "number" &&
                typeof msg.toSlot === "number" &&
                typeof msg.emoteId === "string"
              ) {
                spawnFlyingEmote(
                  msg.fromSlot,
                  msg.toSlot,
                  msg.emoteId,
                  msg.fromNick || "",
                  msg.toNick || ""
                );
              }
            } else if (msg.type === "AVATAR_UPDATE") {
              if (msg.identity && msg.avatar) {
                updateAvatar(msg.identity, msg.avatar);
              }
            } else if (msg.type === "RENAME") {
              const { oldNick, newNick, slots: updatedSlots, nickMap, device } = msg;
              if (oldNick && newNick) {
                registerNickMapping(oldNick, newNick);
                renamePlazaData(oldNick, newNick);
                if (nickMap) {
                  Object.entries(nickMap).forEach(([k, v]: [string, any]) => {
                    registerNickMapping(k, v);
                  });
                }
                if (activeWhispersRef.current[oldNick]) {
                  activeWhispersRef.current[newNick] = activeWhispersRef.current[oldNick];
                  delete activeWhispersRef.current[oldNick];
                }
                Object.keys(activeWhispersRef.current).forEach((k) => {
                  if (activeWhispersRef.current[k] === oldNick) {
                    activeWhispersRef.current[k] = newNick;
                  }
                });
                if (whisperingToRef.current === oldNick) {
                  whisperingToRef.current = newNick;
                  setWhisperingTo(newNick);
                  applyMyTrackWhisperPermissions(newNick);
                }
                applyAllAudioStates();
                if (avatarMapRef.current[oldNick]) {
                  updateAvatar(newNick, avatarMapRef.current[oldNick]);
                }
                if (muteMapRef.current[oldNick] !== undefined) {
                  updateMuteStatus(newNick, muteMapRef.current[oldNick]);
                }
                if (device) {
                  updateDeviceStatus(newNick, device);
                } else if (deviceMapRef.current[oldNick]) {
                  updateDeviceStatus(newNick, deviceMapRef.current[oldNick]);
                }
                setAllParticipants((prev) =>
                  prev.map((id) => (id === oldNick ? newNick : id))
                );
                if (updatedSlots) {
                  updateSlots(updatedSlots);
                } else {
                  updateSlots((prev) => {
                    const next = { ...prev };
                    Object.keys(next).forEach((k) => {
                      if (next[Number(k)] === oldNick) next[Number(k)] = newNick;
                    });
                    return next;
                  });
                }
              }
            } else if (msg.type === "SPEAKING_STATUS") {
              if (msg.identity) {
                setSpeakingMap((prev) => ({
                  ...prev,
                  [msg.identity]: msg.isSpeaking,
                }));
              }
            } else if (msg.type === "MUTE_STATUS") {
              if (msg.identity) {
                updateMuteStatus(msg.identity, Boolean(msg.isMuted));
              }
              if (msg.rawIdentity) {
                updateMuteStatus(msg.rawIdentity, Boolean(msg.isMuted));
              }
            } else if (msg.type === "CHAT_MESSAGE") {
              if (
                msg.chat?.whisperTo &&
                msg.chat.whisperTo !== cleanNickRef.current &&
                msg.chat.sender !== cleanNickRef.current
              ) {
                return;
              }
              setMessages((prev) => [...prev, msg.chat]);
              showChatBubble(msg.chat);
              scrollToBottom(false);
              // 발신자가 TTS 모드로 보낸 메시지면 발신자가 지정한 목소리(또는 기본 남성 목소리)로 읽어줌!
              if (msg.chat.isTTS) {
                speakText(msg.chat.text, msg.chat.ttsVoice || myTTSVoiceRef.current);
              }
            } else if (msg.type === "DELETE_MESSAGE") {
              if (msg.messageId) {
                setMessages((prev) => {
                  const target = prev.find((m) => m.id === msg.messageId);
                  if (target?.imageUrl) {
                    setSelectedChatImage((cur) => (cur === target.imageUrl ? null : cur));
                  }
                  return prev.filter((m) => m.id !== msg.messageId);
                });
              }
            } else if (msg.type === "TOGGLE_REACTION") {
              const { messageId, emoji, identity } = msg;
              if (messageId && emoji && identity) {
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== messageId) return m;
                    const prevReactions = m.reactions ? { ...m.reactions } : {};
                    const list = prevReactions[emoji] ? [...prevReactions[emoji]] : [];
                    const idx = list.indexOf(identity);
                    if (idx >= 0) {
                      list.splice(idx, 1);
                    } else {
                      list.push(identity);
                    }
                    if (list.length === 0) {
                      delete prevReactions[emoji];
                    } else {
                      prevReactions[emoji] = list;
                    }
                    return { ...m, reactions: prevReactions };
                  })
                );
                scrollToBottom(false);
              }
            } else if (msg.type === "KICK_USER") {
              if (msg.chat) {
                setMessages((prev) => [...prev, msg.chat]);
              }
              if (msg.identity) {
                if (msg.identity === cleanNickRef.current) {
                  handleLeave(true);
                } else {
                  cleanupWhisperForUser(msg.identity);
                  setAllParticipants((prev) => prev.filter((id) => id !== msg.identity));
                  updateSlots((prev) => {
                    const next = { ...prev };
                    Object.keys(next).forEach((k) => {
                      if (next[Number(k)] === msg.identity) delete next[Number(k)];
                    });
                    return next;
                  });
                }
              }
            } else if (msg.type === "UNSEAT_USER") {
              if (msg.chat) {
                setMessages((prev) => [...prev, msg.chat]);
              }
              if (msg.identity) {
                cleanupWhisperForUser(msg.identity);
              }
              if (msg.identity === cleanNickRef.current) {
                myDesiredSlotRef.current = null;
                pendingRestoreSlotRef.current = null;
                persistSessionState({ slotIndex: null, wasMuted: true });
                if (whisperingToRef.current) {
                  whisperingToRef.current = null;
                  setWhisperingTo(null);
                  applyMyTrackWhisperPermissions(null);
                }
              }
              if (msg.identity) {
                updateSlots((prev) => {
                  const next = { ...prev };
                  Object.keys(next).forEach((k) => {
                    if (next[Number(k)] === msg.identity) delete next[Number(k)];
                  });
                  return next;
                });
              } else if (msg.slots) {
                updateSlots(msg.slots);
              }
              if (msg.identity === cleanNickRef.current) {
                // 내가 마이크 자리에서 내려졌을 때 마이크 끄기
                disableMyMicrophone();
              }
            } else if (msg.type === "WHISPER_START") {
              const { from, fromIdentity, to, toIdentity } = msg;
              if (from && to) {
                if (fromIdentity) {
                  registerNickMapping(fromIdentity, from);
                }
                if (toIdentity) {
                  registerNickMapping(toIdentity, to);
                }
                activeWhispersRef.current[from] = to;
                if (fromIdentity) {
                  activeWhispersRef.current[fromIdentity] = to;
                }
                const mappedIdentity = nickToIdentityMapRef.current[from];
                if (mappedIdentity) {
                  activeWhispersRef.current[mappedIdentity] = to;
                }
                applyAllAudioStates();
              }
            } else if (msg.type === "WHISPER_END") {
              const { from, fromIdentity } = msg;
              if (from) {
                delete activeWhispersRef.current[from];
                if (fromIdentity) {
                  delete activeWhispersRef.current[fromIdentity];
                }
                const mappedIdentity = nickToIdentityMapRef.current[from];
                if (mappedIdentity) {
                  delete activeWhispersRef.current[mappedIdentity];
                }
                Object.keys(activeWhispersRef.current).forEach((k) => {
                  if (identityToNickMapRef.current[k] === from) {
                    delete activeWhispersRef.current[k];
                  }
                });
                applyAllAudioStates();
              }
            }
          } catch (e) {}
        })
        .on(RoomEvent.Disconnected, async (reason?: DisconnectReason) => {
          if (isUnloadingRef.current) return;
          if (reason === DisconnectReason.DUPLICATE_IDENTITY) {
            // 같은 닉네임으로 다른 창/기기가 입장함: 자동 재입장하면 서로 계속 튕기므로 세션을 지우고 안내
            await handleLeave(true);
            setErrorMsg("같은 닉네임으로 다른 창이나 기기에서 입장해서 연결이 끊겼어요. 다른 닉네임으로 입장해 주세요.");
            return;
          }
          handleLeave(false);
        });

      await room.connect(data.wsUrl, data.token);
      roomRef.current = room;

      registerNickMapping(room.localParticipant.identity, targetNick);
      ensureAllRemoteAudioPlaying();

      // 저장된 내 아바타 사진 복원
      let mySavedAvatar: string | null = autoRestore?.avatar || avatarMapRef.current[targetNick] || null;
      if (!mySavedAvatar && typeof window !== "undefined") {
        try {
          mySavedAvatar = localStorage.getItem("voiceroom_my_avatar");
        } catch (e) {}
      }
      if (mySavedAvatar) {
        updateAvatar(targetNick, mySavedAvatar);
      }

      // 로컬 및 기존 참가자 발화 감지 이벤트 연결
      room.localParticipant.on(ParticipantEvent.IsSpeakingChanged, (speaking: boolean) => {
        setSpeakingMap((prev) => ({
          ...prev,
          [room.localParticipant.identity]: speaking,
          [cleanNickRef.current]: speaking,
        }));
      });
      room.remoteParticipants.forEach((p) => {
        extractDeviceFromMetadata(p.identity, p.metadata);
        p.on(ParticipantEvent.IsSpeakingChanged, (speaking: boolean) => {
          const currentNick = identityToNickMapRef.current[p.identity] || p.identity;
          setSpeakingMap((prev) => ({
            ...prev,
            [p.identity]: speaking,
            [currentNick]: speaking,
          }));
        });
      });

      const initialParts: string[] = [targetNick];
      room.remoteParticipants.forEach((p) => initialParts.push(p.identity));
      setAllParticipants(Array.from(new Set(initialParts)));

      setIsJoined(true);
      requestWakeLock();
      startBackgroundAudioKeepalive();
      loadAudioDevices();

      // 배경 효과 및 상태 준비 완료

      // 방 접속 후 기존 참가자들에게 현재 슬롯 동기화 요청 및 내 착석 정보 전달
      const syncAfterJoin = () => {
        ensureAllRemoteAudioPlaying();
        broadcastData({
          type: "REQUEST_SLOTS",
          identity: cleanNickRef.current,
          device: myDeviceRef.current,
          nickMap: identityToNickMapRef.current,
        });
        updateCharacter(cleanNickRef.current, myCharacterRef.current);
        broadcastData({
          type: "CHAR_SET",
          identity: cleanNickRef.current,
          character: myCharacterRef.current,
        });
        if (mySavedAvatar) {
          broadcastData({
            type: "AVATAR_UPDATE",
            identity: cleanNickRef.current,
            avatar: mySavedAvatar,
          });
        }
        const currentSlots = slotsRef.current;
        let activeSlot =
          myDesiredSlotRef.current !== null
            ? myDesiredSlotRef.current
            : autoRestore && autoRestore.slotIndex !== null && autoRestore.slotIndex !== undefined
            ? autoRestore.slotIndex
            : null;
        const myNick = cleanNickRef.current;
        // 내 희망 슬롯이 이미 다른 참가자에게 선점되었거나 아직 미착석 상태인 경우 즉시 빈 슬롯 자동 확보
        if (
          myNick &&
          !hasExplicitlyLeftSlotRef.current &&
          (activeSlot === null || activeSlot === undefined || (currentSlots[activeSlot] && currentSlots[activeSlot] !== myNick) || !Object.values(currentSlots).includes(myNick))
        ) {
          const nextEmpty = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].find((i) => !currentSlots[i]);
          if (nextEmpty !== undefined) {
            activeSlot = nextEmpty;
            myDesiredSlotRef.current = nextEmpty;
          }
        }
        if (activeSlot !== null && myNick) {
          updateSlots((prev) => ({ ...prev, [activeSlot]: myNick }));
          updateMuteStatus(myNick, isMutedRef.current);
          updateDeviceStatus(myNick, myDeviceRef.current);
          broadcastData({
            type: "TAKE_SLOT",
            slotIndex: activeSlot,
            identity: myNick,
            avatar: mySavedAvatar || avatarMapRef.current[myNick],
            isMuted: isMutedRef.current,
            device: myDeviceRef.current,
            character: myCharacterRef.current,
          });
          broadcastData({
            type: "MUTE_STATUS",
            identity: myNick,
            rawIdentity: room.localParticipant.identity,
            isMuted: isMutedRef.current,
          });
        }
      };

      setTimeout(syncAfterJoin, 250);
      setTimeout(syncAfterJoin, 800);
      if (autoRestore && autoRestore.slotIndex !== null && autoRestore.slotIndex !== undefined) {
        setTimeout(syncAfterJoin, 1500);
      }

      // 신규 입장 또는 F5 새로고침 복구 시: 비어 있는 발화석 자동 착석 (10석 중 빈 자리 자동 배정)
      let targetSlotToTake: number | null = null;
      if (autoRestore && autoRestore.slotIndex !== null && autoRestore.slotIndex !== undefined) {
        targetSlotToTake = autoRestore.slotIndex;
      } else {
        // 일반 입장 시: 현재 방의 첫 번째 빈 발화석(0~9) 자동 탐색하여 즉시 착석
        const emptySlot = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].find((i) => !slotsRef.current[i]);
        if (emptySlot !== undefined) {
          targetSlotToTake = emptySlot;
        }
      }

      if (targetSlotToTake !== null) {
        myDesiredSlotRef.current = targetSlotToTake;
        pendingRestoreSlotRef.current = targetSlotToTake;
        hasExplicitlyLeftSlotRef.current = false;
        setTimeout(() => {
          pendingRestoreSlotRef.current = null;
        }, 6000);

        const restoredSlots = { ...slotsRef.current, [targetSlotToTake]: targetNick };
        updateSlots(restoredSlots);

        persistSessionState({
          isJoined: true,
          room: targetRoom,
          nickname: targetNick,
          slotIndex: targetSlotToTake,
          wasMuted: autoRestore ? autoRestore.wasMuted : true,
        });

        if (autoRestore && !autoRestore.wasMuted) {
          await enableMyMicrophone();
        } else {
          setIsMuted(true);
          isMutedRef.current = true;
          updateMuteStatus(targetNick, true);
        }
      } else {
        // 모든 발화석(10석)이 꽉 찬 경우에만 대기자석으로 배정
        myDesiredSlotRef.current = null;
        setIsMuted(true);
        isMutedRef.current = true;
        persistSessionState({
          isJoined: true,
          room: targetRoom,
          nickname: targetNick,
          slotIndex: null,
          wasMuted: true,
        });
      }

      isRestoringRef.current = false;
      ensureAllRemoteAudioPlaying();
    } catch (err: any) {
      isRestoringRef.current = false;
      const rawMsg = err?.message || "";
      if (typeof rawMsg === "string" && (rawMsg.includes("websocket") || rawMsg.includes("signal connection"))) {
        setErrorMsg("⚠️ LiveKit 음성 클라우드 서버의 무료 제공 시간(Connection Minutes)이 한도 초과되었습니다. LiveKit 콘솔(cloud.livekit.io)에서 프로젝트를 갱신하거나 새 키로 교체해 주세요.");
      } else {
        setErrorMsg(rawMsg || "보이스룸 접속에 실패했습니다.");
      }
    } finally {
      isJoiningRef.current = false;
      setIsLoading(false);
    }
  };

  const handleLeave = async (clearSession: boolean = true) => {
    const myNick = cleanNickRef.current || cleanNick;
    if (clearSession && typeof window !== "undefined") {
      myDesiredSlotRef.current = null;
      pendingRestoreSlotRef.current = null;
      isRestoringRef.current = false;
      try {
        sessionStorage.removeItem("voiceroom_active_session");
        localStorage.removeItem("voiceroom_active_session");
        const url = new URL(window.location.href);
        url.searchParams.delete("joined");
        url.searchParams.delete("slot");
        url.searchParams.delete("muted");
        window.history.replaceState(null, "", url.pathname + url.search);
      } catch (e) {}
      fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave" }),
      }).catch(() => {});
      if (roomRef.current && myNick) {
        try {
          await broadcastData({ type: "LEAVE_SLOT", identity: myNick });
        } catch (e) {}
      }
    }
    micDesiredRef.current = false;
    stopLocalVAD();
    if (whisperingTo) {
      await handleStopWhisper();
    }
    if (roomRef.current) {
      try {
        await roomRef.current.disconnect();
      } catch (e) {}
      roomRef.current = null;
    }
    if (localTrackRef.current) {
      localTrackRef.current.stop();
      localTrackRef.current = null;
    }
    Object.values(audioElementsRef.current).forEach((el) => el.remove());
    audioElementsRef.current = {};
    releaseWakeLock();
    stopBackgroundAudioKeepalive();
    if (clearSession) {
      setEmotePickerTarget(null);
      setIsJoined(false);
      updateSlots({});
      setMessages([]);
      setAllParticipants([]);
      setRoomTopic("소그룹 대화");
      roomTopicRef.current = "소그룹 대화";
    }
  };

  // URL 파라미터 파싱, 저장된 설정 불러오기 및 F5 새로고침 시 방/발화석 즉시 자동 복구 (닉네임 창 깜빡임 없음 + 1 IP 1 닉네임)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get("room");
      const nickParam = params.get("nick") || params.get("nickname");
      const joinedParam = params.get("joined");
      const slotParam = params.get("slot");
      const mutedParam = params.get("muted");

      // 로컬 UI 점검용 목업 (localhost + ?mock=plaza 에서만 동작, LiveKit 미접속)
      const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
      if (isLocalHost && params.get("mock") === "plaza") {
        isMockRef.current = true;
        const me = "나/90/서울";
        const others: [string, CharacterId][] = [
          ["민수/88/부산", "cute_male_v2"],
          ["지연/95/인천", "cute_male_v2"],
          ["헬창/91/대구", "strong_male_v2"],
          ["코딩왕/93/판교", "cute_male_v2"],
          ["강남/89/서울", "strong_male_v2"],
        ];
        setNickname(me);
        cleanNickRef.current = me;
        updateSlots({ 0: me, 1: others[0][0], 2: others[1][0], 4: others[2][0], 6: others[3][0], 8: others[4][0] });
        myDesiredSlotRef.current = 0;
        const chars: { [nick: string]: CharacterId } = {};
        others.forEach(([n, c]) => (chars[n] = c));
        characterMapRef.current = chars;
        setCharacterMap(chars);
        setAllParticipants([me, ...others.map((o) => o[0]), "대기손님/97/광주", "구경꾼/85/수원"]);
        setSpeakingMap({ [others[1][0]]: true });
        setMuteMap({ [others[3][0]]: true });
        const demoChats: ChatItem[] = [
          { id: "m1", sender: others[0][0], text: "광장 모드 신기하네요 ㅋㅋ", time: "21:01" },
          { id: "m2", sender: others[1][0], text: "캐릭터 귀엽다 🥰", time: "21:02" },
        ];
        setMessages(demoChats);
        setTimeout(() => demoChats.forEach((c) => showChatBubble(c)), 300);
        setIsJoined(true);
        let step = 0;
        setInterval(() => {
          step += 1;
          const pts = [
            { x: 0.3, y: 0.5 },
            { x: 0.7, y: 0.75 },
            { x: 0.5, y: 0.9 },
          ];
          const t = pts[step % pts.length];
          const prev = plazaPosMapRef.current[others[0][0]];
          updatePlazaPos(others[0][0], {
            x: prev?.tx ?? 0.33,
            y: prev?.ty ?? 0.55,
            tx: t.x,
            ty: t.y,
            ts: Date.now(),
          });
          if (step % 2 === 0) {
            showChatBubble({ id: `demo-${step}`, sender: others[2][0], text: "오늘 하체 했습니다 💪", time: "21:03" });
          }
        }, 3500);
        return;
      }

      let initialRoom = "subroom-1";
      if (roomParam && ROOM_OPTIONS.some((r) => r.id === roomParam)) {
        initialRoom = roomParam;
        setSelectedRoom(roomParam);
      }

      let initialNick = "";
      let savedSkin: string | null = null;
      let savedEffect: BgEffectType | null = null;
      let savedAvatar: string | null = null;
      try {
        savedSkin = localStorage.getItem("voiceroom_skin");
        if (savedSkin && SKINS.some((s) => s.id === savedSkin)) {
          setCurrentSkin(savedSkin);
          currentSkinRef.current = savedSkin;
        }
        savedEffect = localStorage.getItem("voiceroom_bg_effect") as BgEffectType | null;
        if (savedEffect && BG_EFFECTS.some((ef) => ef.id === savedEffect)) {
          setBgEffect(savedEffect);
          bgEffectRef.current = savedEffect;
        }
        const savedEffectSpeed = localStorage.getItem("voiceroom_bg_effect_speed");
        if (savedEffectSpeed) {
          const sp = parseInt(savedEffectSpeed, 10);
          if (!isNaN(sp) && sp >= 20 && sp <= 250) {
            setBgEffectSpeed(sp);
            bgEffectSpeedRef.current = sp;
          }
        }
        savedAvatar = localStorage.getItem("voiceroom_my_avatar");
        const savedLastNick = localStorage.getItem("voiceroom_last_nick");
        if (savedLastNick) {
          initialNick = savedLastNick;
        }
      } catch (e) {}

      if (nickParam) {
        initialNick = nickParam;
      } else if (!initialNick) {
        initialNick = generateRandomNickname();
      }
      setNickname(initialNick);
      cleanNickRef.current = initialNick.trim();

      const triggerImmediateRestore = (restoreOpts: {
        room: string;
        nickname: string;
        slotIndex: number | null;
        wasMuted: boolean;
        skin?: string;
        effect?: BgEffectType;
      }) => {
        if (hasAutoJoinedRef.current) return;
        hasAutoJoinedRef.current = true;
        isRestoringRef.current = true;

        setSelectedRoom(restoreOpts.room);
        setNickname(restoreOpts.nickname);
        cleanNickRef.current = restoreOpts.nickname;

        if (restoreOpts.skin && SKINS.some((s) => s.id === restoreOpts.skin)) {
          setCurrentSkin(restoreOpts.skin);
          currentSkinRef.current = restoreOpts.skin;
        }
        if (restoreOpts.effect && BG_EFFECTS.some((ef) => ef.id === restoreOpts.effect)) {
          setBgEffect(restoreOpts.effect);
          bgEffectRef.current = restoreOpts.effect;
        }
        if (savedAvatar) {
          updateAvatar(restoreOpts.nickname, savedAvatar);
        }

        // 닉네임 입력 화면이 0.1초도 뜨지 않도록 즉시 방 내부 및 발화석 UI 활성화
        setIsJoined(true);
        setAllParticipants([restoreOpts.nickname]);
        if (restoreOpts.slotIndex !== null) {
          myDesiredSlotRef.current = restoreOpts.slotIndex;
          pendingRestoreSlotRef.current = restoreOpts.slotIndex;
          updateSlots({ [restoreOpts.slotIndex]: restoreOpts.nickname });
          setIsMuted(restoreOpts.wasMuted);
          isMutedRef.current = restoreOpts.wasMuted;
        } else {
          myDesiredSlotRef.current = null;
          setIsMuted(true);
          isMutedRef.current = true;
        }

        joinRoom({
          room: restoreOpts.room,
          nickname: restoreOpts.nickname,
          slotIndex: restoreOpts.slotIndex,
          wasMuted: restoreOpts.wasMuted,
          avatar: savedAvatar,
          skin: restoreOpts.skin,
          effect: restoreOpts.effect,
        });
      };

      // 1단계: 브라우저 sessionStorage / localStorage 또는 URL 쿼리(?joined=1)로 F5 새로고침 즉시 복구
      try {
        const rawSession =
          sessionStorage.getItem("voiceroom_active_session") ||
          localStorage.getItem("voiceroom_active_session");
        if (rawSession && !hasAutoJoinedRef.current) {
          const parsed = JSON.parse(rawSession);
          if (parsed && parsed.isJoined && parsed.nickname) {
            const restoreRoom =
              roomParam && ROOM_OPTIONS.some((r) => r.id === roomParam)
                ? roomParam
                : parsed.room || initialRoom;
            const restoreNick = (nickParam || parsed.nickname).trim();
            const restoreSlotIdx =
              slotParam !== null && slotParam !== "" && !isNaN(Number(slotParam))
                ? Number(slotParam)
                : parsed.slotIndex !== undefined && parsed.slotIndex !== null
                ? Number(parsed.slotIndex)
                : null;
            const restoreWasMuted =
              mutedParam !== null ? mutedParam === "1" : Boolean(parsed.wasMuted);

            triggerImmediateRestore({
              room: restoreRoom,
              nickname: restoreNick,
              slotIndex: restoreSlotIdx,
              wasMuted: restoreWasMuted,
              skin: parsed.skin || savedSkin || undefined,
              effect: parsed.effect || savedEffect || undefined,
            });
          }
        } else if (joinedParam === "1" && initialNick && !hasAutoJoinedRef.current) {
          const restoreSlotIdx =
            slotParam !== null && slotParam !== "" && !isNaN(Number(slotParam))
              ? Number(slotParam)
              : null;
          const restoreWasMuted = mutedParam === "1";
          triggerImmediateRestore({
            room: initialRoom,
            nickname: initialNick.trim(),
            slotIndex: restoreSlotIdx,
            wasMuted: restoreWasMuted,
            skin: savedSkin || undefined,
            effect: savedEffect || undefined,
          });
        }
      } catch (e) {}

      // 2단계: 서버 IP 기반 1-IP-1-닉네임 조회 및 세션 복구 폴백
      fetch("/api/session")
        .then((r) => r.json())
        .then((data) => {
          if (data?.ip) {
            setMyIpAddress(data.ip);
          }
          if (data?.session?.nickname) {
            const ipNick = String(data.session.nickname).trim();
            if (ipNick) {
              try {
                localStorage.setItem("voiceroom_last_nick", ipNick);
              } catch (e) {}
              if (!hasAutoJoinedRef.current && !nickParam) {
                setNickname(ipNick);
                cleanNickRef.current = ipNick;
              }
              // 만약 스토리지가 비어있었는데 IP 세션이 활성 상태라면 즉시 방/발화석 복구
              const isRecent =
                typeof data.session.updatedAt === "number" &&
                Date.now() - data.session.updatedAt < 2 * 60 * 60 * 1000;
              if (!hasAutoJoinedRef.current && data.session.isJoined && isRecent) {
                const restoreRoom =
                  data.session.room && ROOM_OPTIONS.some((r) => r.id === data.session.room)
                    ? data.session.room
                    : initialRoom;
                const restoreSlot =
                  data.session.slotIndex !== undefined && data.session.slotIndex !== null
                    ? Number(data.session.slotIndex)
                    : null;
                triggerImmediateRestore({
                  room: restoreRoom,
                  nickname: ipNick,
                  slotIndex: restoreSlot,
                  wasMuted: false,
                  skin: savedSkin || undefined,
                  effect: savedEffect || undefined,
                });
              }
            }
          }
        })
        .catch(() => {});
    }
  }, []);

  // 채팅창 사진 목록 및 확대 모달 이전/다음 이동 헬퍼
  const imageMessages = messages.filter((m) => Boolean(m.imageUrl));
  const currentImageIndex = selectedChatImage
    ? imageMessages.findIndex((m) => m.imageUrl === selectedChatImage)
    : -1;

  const goPrevImage = () => {
    if (currentImageIndex > 0) {
      setSelectedChatImage(imageMessages[currentImageIndex - 1].imageUrl || null);
    }
  };

  const goNextImage = () => {
    if (currentImageIndex >= 0 && currentImageIndex < imageMessages.length - 1) {
      setSelectedChatImage(imageMessages[currentImageIndex + 1].imageUrl || null);
    }
  };

  useEffect(() => {
    setImageZoom(1);
    setImagePan({ x: 0, y: 0 });
    setImageDragMode("zoom");
    if (!selectedChatImage) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        goPrevImage();
      } else if (e.key === "ArrowRight") {
        goNextImage();
      } else if (e.key === "Escape") {
        setSelectedChatImage(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedChatImage, currentImageIndex, imageMessages.length]);

  const startImageMouseDrag = (
    e: React.MouseEvent,
    forceMode?: "zoom" | "pan"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const activeMode =
      forceMode ||
      (e.button === 2 || e.button === 1 || e.shiftKey ? "pan" : imageDragMode);
    const startX = e.clientX;
    const startY = e.clientY;
    const startScale = imageZoom;
    const startPanX = imagePan.x;
    const startPanY = imagePan.y;
    didDragImageRef.current = false;
    setIsDraggingImage(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        didDragImageRef.current = true;
      }
      if (activeMode === "pan") {
        setImagePan({
          x: startPanX + dx,
          y: startPanY + dy,
        });
      } else {
        const dist = Math.hypot(dx, dy);
        // 1배율(기본) 상태에서 드래그 시작 시에는 어느 방향으로 당겨도 즉시 확대되도록 지원,
        // 이미 확대된 상태에서는 우측/아래 드래그 시 추가 확대, 좌측/위 드래그 시 축소
        const sign = startScale <= 1.02 ? (dx < -35 && dy < -35 ? -1 : 1) : dx + dy >= 0 ? 1 : -1;
        const nextScale = Math.max(
          0.5,
          Math.min(5.0, Number((startScale + (sign * dist) / 120).toFixed(2)))
        );
        setImageZoom(nextScale);
        if (nextScale <= 1.02) {
          setImagePan({ x: 0, y: 0 });
        }
      }
    };

    const handleMouseUp = () => {
      setIsDraggingImage(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      setTimeout(() => {
        didDragImageRef.current = false;
      }, 80);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // 대기자 명단 및 신규 입장 감지 알림음
  // 대기자 명단 (착석자 제외)
  const seatedIdentities = new Set<string>();
  Object.values(slots).forEach((nick) => {
    if (nick) {
      seatedIdentities.add(nick);
      const rawId = nickToIdentityMapRef.current[nick];
      if (rawId) seatedIdentities.add(rawId);
    }
  });
  const waitingList = Array.from(
    new Set(
      allParticipants
        .map((id) => identityToNickMapRef.current[id] || id)
        .filter((nick) => nick && !seatedIdentities.has(nick))
    )
  );

  // WASD 이동 중 Enter 키를 누르면 채팅 입력창으로 즉시 포커스 이동
  useEffect(() => {
    if (!isJoined) return;
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
      const targetEl = e.target as HTMLElement | null;
      if (targetEl) {
        const tTag = targetEl.tagName;
        if (tTag === "INPUT" || tTag === "TEXTAREA" || tTag === "SELECT" || tTag === "BUTTON" || targetEl.isContentEditable) {
          return;
        }
      }
      const active = document.activeElement as HTMLElement | null;
      if (active) {
        const tag = active.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || active.isContentEditable) {
          return;
        }
      }
      if (
        showTopicModal ||
        showNickModal ||
        Boolean(kickTarget) ||
        Boolean(unseatTarget) ||
        showModeModal ||
        showSkinModal ||
        showEffectModal ||
        Boolean(emotePickerTarget) ||
        showVolumeModal ||
        showTermsModal ||
        showMyEmotePicker
      ) {
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (chatSizeMode === "closed") {
          setChatSizeMode("half");
          setTimeout(() => {
            chatTextInputRef.current?.focus();
          }, 40);
        } else {
          chatTextInputRef.current?.focus();
        }
        return;
      }

      if (isPlaza && isSeated) {
        if (e.key === " " || e.code === "Space") {
          e.preventDefault();
          if (!e.repeat) handleMyPlazaPose("jump");
          return;
        }
      }
    };
    window.addEventListener("keydown", onGlobalKeyDown);
    return () => window.removeEventListener("keydown", onGlobalKeyDown);
  }, [
    isJoined,
    chatSizeMode,
    showTopicModal,
    showNickModal,
    kickTarget,
    unseatTarget,
    showModeModal,
    showSkinModal,
    showEffectModal,
    emotePickerTarget,
    showVolumeModal,
    showTermsModal,
  ]);

  const activeSkinObj = isJoined ? SKINS.find((s) => s.id === currentSkin) : null;

  // 캐릭터 모드 (광장): 발화석 착석자 = 캐릭터
  const isPlaza = isJoined && viewMode === "plaza";
  const firstEmptySlot = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].find((i) => !slots[i]);
  const plazaActors: PlazaActor[] = isPlaza
    ? Object.entries(slots)
        .filter(([, occ]) => Boolean(occ))
        .map(([k, occupant]) => {
          const idx = Number(k);
          const isMe = occupant === cleanNick;
          const occupantIdentity = nickToIdentityMapRef.current[occupant] || occupant;
          const isSpeaking = isMe
            ? Boolean(
                isMyVoiceActive ||
                  speakingMap[occupant] ||
                  (roomRef.current?.localParticipant && speakingMap[roomRef.current.localParticipant.identity])
              )
            : Boolean(speakingMap[occupant] || speakingMap[occupantIdentity]);
          const hitState = hitSlotMap[idx];
          return {
            slotIdx: idx,
            nick: occupant,
            character: isMe ? myCharacter : characterMap[occupant] || DEFAULT_CHARACTER,
            move: plazaPosMap[occupant],
            isMe,
            isSpeaking,
            isMuted: isMe ? isMuted : Boolean(muteMap[occupant] ?? muteMap[occupantIdentity]),
            isWhisper: Boolean(whisperedBy === occupant || (isMe && whisperingTo) || whisperingTo === occupant),
            pose: poseMap[occupant] || null,
            poseInfo: poseInfoMap[occupant],
            bubble: bubbleMap[occupant],
            deviceIcon: renderDeviceIcon(occupant, "w-2.5 h-2.5 md:w-3 md:h-3"),
            hitClass: hitState
              ? hitState.shakeType === "punch"
                ? "animate-emote-punch"
                : hitState.shakeType === "love"
                ? "animate-emote-love"
                : "animate-emote-laugh"
              : "",
          };
        })
    : [];

  return (
    <div
      style={{
        top: "var(--app-top, 0px)",
        height: "var(--app-height, 100dvh)",
        maxHeight: "var(--app-height, 100dvh)",
        backgroundImage: activeSkinObj?.bg ? `url(${activeSkinObj.bg})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      className="fixed left-0 right-0 w-full overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans text-xs select-none"
    >
      {/* 배경 스킨 은은한 오버레이 (블러 제거하여 원본 그림 선명하게 노출) */}
      {activeSkinObj?.bg && (
        <div className="absolute inset-0 bg-black/25 pointer-events-none z-0" />
      )}

      {/* 배경 시각 효과 캔버스 (눈, 비, 수증기, 비누방울, 별 떨어지기 등) */}
      {isJoined && <BackgroundEffectCanvas effect={bgEffect} speed={bgEffectSpeed} />}

      {/* 좌석 간 날아가는 감정표현 투사체 & 폭발 오버레이 */}
      {isJoined && <FlyingEmoteOverlay flights={activeFlights} />}

      {/* 1. 상단 헤더 (기본 접힘, 펼치면 아랫줄에 출력/볼륨 등장) */}
      <header className="border-b border-white/10 bg-slate-950/75 backdrop-blur-md px-3 md:px-6 py-1.5 md:py-2.5 shrink-0 z-20 relative flex flex-col gap-1.5 transition-all">
        {/* 1번째 줄: 접혀있거나 펼쳐져있거나 항상 동일한 레이아웃 (화면 깨짐 방지) */}
        <div className="flex items-center justify-between max-w-6xl w-full mx-auto">
          <div className="flex items-center gap-1.5 md:gap-2.5 font-bold text-slate-200 text-[11px] md:text-sm min-w-0 mr-1">
            <Radio className="w-3.5 h-3.5 md:w-4 md:h-4 text-indigo-400 animate-pulse shrink-0" />
            <span className="shrink-0 text-white font-bold">2040</span>
            {isJoined ? (
              <span
                className="text-[9px] md:text-xs bg-slate-800 text-slate-300 px-1.5 md:px-2.5 py-0.5 rounded font-semibold truncate max-w-[110px] md:max-w-[320px] border border-white/10"
                title={roomTopic}
              >
                {roomTopic}
              </span>
            ) : (
              <span className="text-[10px] md:text-xs text-slate-400 font-normal">보이스룸</span>
            )}
          </div>
          <div className="flex items-center gap-1 md:gap-2 shrink-0">
            {isJoined && (
              <button
                type="button"
                onClick={() => setShowModeModal(true)}
                className={`px-2 md:px-3 py-0.5 md:py-1 rounded border flex items-center justify-center text-[11px] md:text-xs transition-all ${
                  viewMode === "plaza"
                    ? "bg-amber-500/20 border-amber-400 text-amber-200 font-semibold shadow-sm shadow-amber-500/20"
                    : "bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-white/10"
                }`}
                title="화면 모드 / 캐릭터 선택"
              >
                <span className="md:hidden leading-none">🎮</span>
                <span className="hidden md:inline">모드</span>
              </button>
            )}
            {isJoined && (
              <button
                type="button"
                onClick={() => setShowEffectModal(true)}
                className={`px-2 md:px-3 py-0.5 md:py-1 rounded border flex items-center justify-center text-[11px] md:text-xs transition-all ${
                  bgEffect !== "off"
                    ? "bg-cyan-500/20 border-cyan-400 text-cyan-200 font-semibold shadow-sm shadow-cyan-500/20"
                    : "bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-white/10"
                }`}
                title="배경 시각 효과"
              >
                <span className="md:hidden leading-none">
                  {bgEffect === "off"
                    ? "✨"
                    : BG_EFFECTS.find((ef) => ef.id === bgEffect)?.icon || "✨"}
                </span>
                <span className="hidden md:inline">
                  {bgEffect === "off"
                    ? "효과"
                    : BG_EFFECTS.find((ef) => ef.id === bgEffect)?.name.split(" ")[0] || "효과"}
                </span>
              </button>
            )}
            {isJoined && (
              <button
                type="button"
                onClick={() => setShowSkinModal(true)}
                className="px-2 md:px-3 py-0.5 md:py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-white/10 flex items-center justify-center text-[11px] md:text-xs"
                title="배경 스킨"
              >
                <span className="md:hidden leading-none">🎨</span>
                <span className="hidden md:inline">스킨</span>
              </button>
            )}
            {isJoined && (
              <>
                <button
                  onClick={() => handleLeave(true)}
                  className="px-2 md:px-3 py-0.5 md:py-1 rounded bg-rose-600/85 hover:bg-rose-600 text-white font-medium flex items-center justify-center text-[11px] md:text-xs"
                  title="나가기"
                >
                  <span className="md:hidden leading-none">🚪</span>
                  <span className="hidden md:inline">나가기</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsHeaderCollapsed((prev) => !prev)}
                  className="p-1 md:p-1.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-white/10"
                  title={isHeaderCollapsed ? "방 설정 펼치기" : "방 설정 접기"}
                >
                  {isHeaderCollapsed ? (
                    <ChevronDown className="w-3 h-3 md:w-4 md:h-4" />
                  ) : (
                    <ChevronUp className="w-3 h-3 md:w-4 md:h-4" />
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* 2번째 줄: 펼쳤을 때 방 주제 변경 및 오디오 출력 장치/볼륨 표시 */}
        {isJoined && !isHeaderCollapsed && (
          <div className="pt-1.5 border-t border-white/10 space-y-1.5 text-[10px] md:text-xs max-w-6xl w-full mx-auto">
            {/* 방 주제 표시 및 변경 버튼 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0 mr-2">
                <span className="text-slate-400 font-medium shrink-0">방 주제:</span>
                <span className="text-slate-200 font-bold truncate">{roomTopic}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNewTopicInput(roomTopic);
                  setShowTopicModal(true);
                }}
                className="flex items-center gap-1 px-2.5 md:px-3 py-0.5 md:py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 font-medium shrink-0"
                title="방 주제 변경"
              >
                <Pencil className="w-3 h-3 md:w-3.5 md:h-3.5 text-slate-300" />
                <span>주제 변경</span>
              </button>
            </div>

            {/* 오디오 출력 장치 및 볼륨 조절 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">출력장치:</span>
                {audioDevices.length > 0 ? (
                  <select
                    value={selectedAudioDevice}
                    onChange={(e) => handleAudioDeviceChange(e.target.value)}
                    className="bg-slate-800 text-[10px] md:text-xs text-slate-200 border border-white/10 rounded px-1.5 md:px-2.5 py-0.5 md:py-1 focus:outline-none max-w-[130px] md:max-w-[240px] truncate"
                    title="출력 장치 선택"
                  >
                    {audioDevices.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId}>
                        {d.label
                          ? d.label.length > 18
                            ? d.label.slice(0, 18) + ".."
                            : d.label
                          : `출력 ${i + 1}`}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-slate-500">기본 스피커</span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowVolumeModal(true)}
                className="flex items-center gap-1 px-2.5 md:px-3 py-0.5 md:py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 font-medium shrink-0"
                title="볼륨 조절"
              >
                <Sliders className="w-3 h-3 md:w-3.5 md:h-3.5 text-slate-300" />
                <span>개별 볼륨</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 2. 메인 컨텐츠 (모바일: 세로형 / PC: 좌측 참여자 · 우측 채팅내역 가로 분할형) */}
      <main
        className={`flex-1 overflow-hidden w-full mx-auto flex flex-col justify-center relative z-10 ${
          isJoined && isPlaza
            ? "max-w-full p-1.5 md:p-3"
            : isJoined
            ? "p-3 max-w-lg md:max-w-6xl md:px-6 md:py-4"
            : "p-3 max-w-lg"
        }`}
      >
        {!isJoined ? (
          /* ================= 입장 화면 (모던 글래스모피즘) ================= */
          <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4 my-auto max-h-full overflow-y-auto shadow-2xl shadow-black/80 relative">
            {/* 카드 상단 로고 & 타이틀 */}
            <div className="text-center pb-0.5">
              <h1 className="text-base md:text-lg font-bold text-white tracking-tight">2040 웹 보이스룸</h1>
              <p className="text-[11px] md:text-xs text-slate-400 mt-0.5">자유롭게 참여하는 실시간 음성 채널</p>
            </div>

            {/* 채널 선택 */}
            <div>
              <div className="flex items-center justify-between mb-2 px-0.5">
                <span className="text-[11px] md:text-xs font-semibold text-slate-300">채널 선택</span>
                
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {ROOM_OPTIONS.map((r) => {
                  const isSel = selectedRoom === r.id;
                  const count = roomCounts[r.id] ?? 0;
                  const topic = channelTopics[r.id] || r.desc;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRoom(r.id)}
                      className={`py-4 px-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between min-h-[78px] ${
                        isSel
                          ? "bg-indigo-950/50 border-indigo-500/90 text-white shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-500/40"
                          : "bg-slate-950/40 border-white/5 text-slate-400 hover:border-white/15 hover:bg-slate-950/60"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <span className={`font-bold text-sm md:text-base truncate mr-1.5 ${isSel ? "text-indigo-200" : "text-slate-200"}`} title={topic}>
                          {topic}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] md:text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {count}명
                        </span>
                      </div>
                      <div className={`text-[11px] md:text-xs truncate w-full ${isSel ? "text-indigo-300/80" : "text-slate-400"}`}>
                        {r.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 닉네임 입력 */}
            <div>
              <div className="flex items-center justify-between mb-1.5 px-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] md:text-xs font-semibold text-slate-300">닉네임</span>
                  <span className="text-[9px] md:text-[10px] bg-indigo-950/70 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.2 rounded-full font-medium">
                    1 IP · 1 닉네임 고정
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setNickname(generateRandomNickname())}
                  className="text-[10px] md:text-xs text-indigo-400 hover:text-indigo-300 font-medium active:scale-95 flex items-center gap-1 transition-colors"
                >
                  <span>🎲</span>
                  <span>랜덤 재추첨</span>
                </button>
              </div>
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="카톡 닉네임 (닉/출생년도/지역)"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={25}
                  className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/40 transition-all"
                />
              </div>

            </div>

            {errorMsg && (
              <div className="text-[11px] md:text-xs text-rose-400 bg-rose-950/30 border border-rose-800/40 p-2.5 rounded-xl">
                {errorMsg}
              </div>
            )}

            {/* 입장하기 버튼 */}
            <button
              type="button"
              onClick={() => joinRoom()}
              disabled={isLoading}
              className="w-full py-3 rounded-xl font-bold text-xs md:text-sm bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/35 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span>접속 중...</span>
              ) : (
                <>
                  <Headphones className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span>보이스룸 입장하기</span>
                </>
              )}
            </button>

            {/* 안전 고지 배너 & 약관 링크 */}
            <div className="pt-2 border-t border-white/5 space-y-2 text-[10px] md:text-xs">


              <div className="flex items-center justify-center gap-3 text-[10px] md:text-xs text-slate-500 pt-0.5">
                <button
                  type="button"
                  onClick={() => setShowTermsModal(true)}
                  className="hover:text-slate-300 transition-colors"
                >
                  이용안내 및 수칙
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => setShowTermsModal(true)}
                  className="hover:text-slate-300 transition-colors"
                >
                  개인정보 처리방침
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ================= 방 내부 UI (모바일: 상하 배치 / PC: 좌측 참여자 · 우측 채팅 가로 배치) ================= */
          <div
            className={
              isPlaza
                ? "flex-1 relative overflow-hidden rounded-xl border border-white/10"
                : "flex-1 flex flex-col md:flex-row md:items-stretch justify-start md:justify-between gap-2 md:gap-5 overflow-hidden"
            }
          >
            {/* 캐릭터 모드: 2.5D 광장 씬 (대기자석/채팅은 위에 떠 있는 패널) */}
            {isPlaza && (
              <div className="absolute inset-0 z-0">
                <PlazaScene
                  actors={plazaActors}
                  theme={plazaSkin}
                  onMyMove={handleMyPlazaMove}
                  interactionRequest={pendingInteraction}
                  onInteractionReady={handleInteractionReady}
                  onInteractionCancel={cancelPendingInteraction}
                  onActorClick={(actor) => {
                    if (actor.isMe) {
                      setShowMyEmotePicker(true);
                    } else {
                      setEmotePickerTarget({ slotIdx: actor.slotIdx, occupant: actor.nick });
                    }
                  }}
                  registerActorEl={(slotIdx, el) => {
                    slotElementsRef.current[slotIdx] = el;
                  }}
                  hint={
                    plazaActors.length === 0
                      ? "아직 발화석에 아무도 없어요 · 자리에 앉으면 캐릭터가 등장해요"
                      : undefined
                  }
                />
              </div>
            )}

            {/* 1. 귓속말 상단 알림 배너 */}
            {whisperingTo && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 bg-stone-900/95 border-2 border-purple-500 text-purple-200 px-3.5 py-1.5 md:py-2 rounded-lg flex items-center justify-between shadow-2xl gap-3 max-w-[92vw] pointer-events-auto">
                <span className="text-[11px] md:text-xs font-bold flex items-center gap-1.5 truncate">
                  {whisperedBy === whisperingTo ? (
                    <>
                      🤫 <span className="text-white">{whisperingTo} &lt;-&gt; 나 상호 귓속말중</span>
                      {myDevice !== "ios" && (
                        <span className="text-[9.5px] md:text-[11px] text-purple-300 font-normal">(다른 사람 볼륨 50%)</span>
                      )}
                    </>
                  ) : (
                    <>
                      🤫 <span className="text-white">[{whisperingTo}]</span>님에게 귓속말 중 (비밀 대화)
                    </>
                  )}
                </span>
                <button
                  type="button"
                  onClick={handleStopWhisper}
                  className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-amber-200 border border-amber-600/50 font-bold text-[10px] md:text-xs shadow shrink-0"
                >
                  귓속말 종료
                </button>
              </div>
            )}

            {whisperedBy && whisperedBy !== whisperingTo && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 bg-stone-900/95 border-2 border-purple-500 text-purple-200 px-3.5 py-1.5 md:py-2 rounded-lg flex items-center justify-between shadow-2xl gap-3 max-w-[92vw] pointer-events-auto">
                <span className="text-[11px] md:text-xs font-bold flex items-center gap-1.5 truncate">
                  🤫 <span className="text-white">[{whisperedBy}]</span>님이 나에게 귓속말 중...
                </span>
                {isSeated && (
                  <button
                    type="button"
                    onClick={() => handleStartWhisper(whisperedBy)}
                    className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] md:text-xs shadow shrink-0"
                  >
                    답하기
                  </button>
                )}
              </div>
            )}

            {/* 숨겨진 갤러리 사진 업로드 input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />

            {/* 2. 우측 하단 실시간 채팅창 (기존 높이의 1/2 크기 고정, 열기/닫기 버튼 제거) */}
            <div className="fixed bottom-2 right-2 md:bottom-3 md:right-3 w-[300px] md:w-[340px] lg:w-[370px] h-[250px] md:h-[310px] lg:h-[340px] flex flex-col z-20 pointer-events-none [&>*]:pointer-events-auto">
              <div className="rpg-frame flex-1 min-h-0 flex flex-col overflow-hidden p-2 md:p-2.5 shadow-2xl">
                {/* 채팅 헤더 */}
                <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-amber-700/40 shrink-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MessageSquare className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-[11px] md:text-xs font-bold text-amber-200 shrink-0">실시간 채팅</span>
                    <span className="text-[10px] text-amber-300 font-semibold shrink-0">({messages.length})</span>
                  </div>
                </div>
              {/* 채팅 목록 스크롤 영역 (스크롤이 맨 아래에 있을 때만 자동 스크롤, 블러 없는 투명 배경) */}
              <div
                ref={chatScrollRef}
                onScroll={handleChatScroll}
                onClick={() => activeReactionMsgId && setActiveReactionMsgId(null)}
                className="flex-1 overflow-y-auto space-y-1 md:space-y-1.5 pr-1 md:pr-1.5 py-1 md:py-1.5 min-h-0 bg-transparent rounded-lg px-2 md:px-3 my-0.5 md:my-1 relative"
              >
                {messages.length === 0 ? (
                  <div className="text-center text-[10px] md:text-xs lg:text-sm text-slate-200 py-6 md:py-12 [text-shadow:_0_1px_3px_rgb(0_0_0_/_95%)]">
                    채팅이나 사진을 보내면 실시간으로 전송됩니다. (닉네임 클릭 시 1:1 귓속말 가능)
                  </div>
                ) : (
                  (() => {
                    const groupedMessages: Array<{
                      key: string;
                      sender: string;
                      isSystem: boolean;
                      whisperTo?: string;
                      items: ChatItem[];
                    }> = [];

                    messages.forEach((m) => {
                      const prevGroup = groupedMessages[groupedMessages.length - 1];
                      if (
                        !m.isSystem &&
                        prevGroup &&
                        !prevGroup.isSystem &&
                        prevGroup.sender === m.sender &&
                        (prevGroup.whisperTo || "") === (m.whisperTo || "")
                      ) {
                        prevGroup.items.push(m);
                      } else {
                        groupedMessages.push({
                          key: m.id,
                          sender: m.sender,
                          isSystem: Boolean(m.isSystem),
                          whisperTo: m.whisperTo,
                          items: [m],
                        });
                      }
                    });

                    return groupedMessages.map((group) => {
                      if (group.isSystem) {
                        const sysMsg = group.items[0];
                        return (
                          <div
                            key={sysMsg.id}
                            className="text-[11px] md:text-xs lg:text-[13px] leading-tight break-all [text-shadow:_0_1px_3px_rgb(0_0_0_/_95%)] bg-rose-950/40 border border-rose-500/30 text-rose-200 px-2 md:px-2.5 py-0.5 md:py-1 rounded my-0.5 font-medium flex items-center justify-between"
                          >
                            <span>{renderMessageWithLinks(sysMsg.text)}</span>
                            <span className="text-[9px] md:text-[11px] text-rose-300/70 ml-1.5 shrink-0">{sysMsg.time}</span>
                          </div>
                        );
                      }

                      const isMine = group.sender === cleanNick;
                      const isWhisperMsg = Boolean(group.whisperTo);
                      const senderAvatar = avatarMap[group.sender];

                      return (
                        <div
                          key={group.key}
                          className={`group/card text-[11px] md:text-[13.5px] lg:text-sm leading-snug md:leading-snug break-all [text-shadow:_0_1px_3px_rgb(0_0_0_/_95%)] relative rounded-lg px-2 md:px-3 py-1 md:py-1.5 transition-colors ${
                            isWhisperMsg
                              ? "bg-fuchsia-950/35 hover:bg-fuchsia-950/55 border border-fuchsia-500/40"
                              : "bg-black/20 hover:bg-black/35 border border-white/10"
                          }`}
                        >
                          {/* 카톡 스타일 상단 발신자 닉네임 헤더 (연속 채팅 시 맨 위에 1회만 표시) */}
                          <div className="flex items-center justify-between gap-1 mb-0.5 md:mb-1">
                            <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
                              {senderAvatar ? (
                                <img
                                  src={senderAvatar}
                                  alt={group.sender}
                                  className="w-4 h-4 md:w-6 md:h-6 rounded-full object-cover border border-white/25 shrink-0"
                                />
                              ) : (
                                <span
                                  className={`w-4 h-4 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[8.5px] md:text-xs font-bold shrink-0 border ${
                                    isWhisperMsg
                                      ? "bg-fuchsia-700/70 text-fuchsia-100 border-fuchsia-400/50"
                                      : isMine
                                      ? "bg-indigo-600/80 text-white border-indigo-400/50"
                                      : "bg-slate-800 text-indigo-200 border-white/15"
                                  }`}
                                >
                                  {group.sender.slice(0, 1)}
                                </span>
                              )}

                              {renderDeviceIcon(group.sender, "w-2.5 h-2.5 md:w-3.5 md:h-3.5")}
                              <span
                                onClick={() => {
                                  if (!isMine && group.sender) {
                                    setChatWhisperTarget((prev) => (prev === group.sender ? null : group.sender));
                                  }
                                }}
                                className={`font-bold text-[11px] md:text-[13.5px] lg:text-sm truncate ${
                                  isWhisperMsg
                                    ? "text-fuchsia-300"
                                    : isMine
                                    ? "text-sky-300"
                                    : "text-indigo-300 cursor-pointer hover:underline"
                                }`}
                                title={!isMine ? `${group.sender}님에게 1:1 귓속말 보내기` : undefined}
                              >
                                {group.sender}
                              </span>

                              {isWhisperMsg && (
                                <span
                                  onClick={() => {
                                    const replyTarget = isMine ? group.whisperTo! : group.sender;
                                    if (replyTarget && replyTarget !== cleanNick) {
                                      setChatWhisperTarget(replyTarget);
                                    }
                                  }}
                                  className="inline-flex items-center gap-0.5 text-[9px] md:text-[11px] bg-fuchsia-600/40 text-fuchsia-200 border border-fuchsia-400/50 px-1.5 md:px-2 py-0.2 rounded-full font-bold cursor-pointer hover:bg-fuchsia-600/60 shrink-0"
                                  title="클릭하여 귓속말 답장하기"
                                >
                                  🤫 {isMine ? `${group.whisperTo}님에게 귓속말` : `${group.sender}님의 귓속말`}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 해당 발신자의 연속 대화 내용 목록 */}
                          <div className="space-y-0.5 md:space-y-1 pl-1 md:pl-1.5">
                            {group.items.map((m, idx) => {
                              const reactionEntries = m.reactions
                                ? Object.entries(m.reactions).filter(([, list]) => list && list.length > 0)
                                : [];
                              const isLastInTimeStreak =
                                idx === group.items.length - 1 || group.items[idx + 1]?.time !== m.time;
                              const isActionVisible =
                                hoveredMsgId === m.id || activeReactionMsgId === m.id;

                              return (
                                <div
                                  key={m.id}
                                  onClick={() => {
                                    // 모바일 터치 시에도 액션 아이콘 바 토글 지원
                                    setHoveredMsgId((prev) => (prev === m.id ? null : m.id));
                                  }}
                                  className={`group/msg relative rounded px-1 -mx-1 py-0.2 hover:bg-white/[0.04] transition-colors ${
                                    idx > 0 ? "pt-0.5 md:pt-1 border-t border-white/[0.06]" : ""
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1.5">
                                    <div className="min-w-0 flex-1 flex items-center flex-wrap gap-1 md:gap-1.5">
                                      {m.text && (
                                        <span className="text-slate-100 leading-snug md:leading-snug break-all">{renderMessageWithLinks(m.text)}</span>
                                      )}
                                      {m.isTTS && (
                                        <span className="text-[8px] md:text-[10px] bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 px-1 md:px-1.5 py-0.1 rounded font-semibold">
                                          TTS
                                        </span>
                                      )}

                                      {/* 마우스 오버(또는 터치) 시 나타나는 카톡 스타일 미니 아이콘 캡슐 (↳ 귓속말 / ☺+ 반응 / 🗑 삭제) */}
                                      <div
                                        onClick={(e) => e.stopPropagation()}
                                        className={`inline-flex items-center gap-1 md:gap-1.5 bg-slate-700/90 border border-white/15 rounded-md px-1.5 md:px-2 py-0.5 shadow-md transition-opacity ${
                                          isActionVisible
                                            ? "opacity-100 pointer-events-auto"
                                            : "opacity-0 pointer-events-none group-hover/msg:opacity-100 group-hover/msg:pointer-events-auto"
                                        }`}
                                      >
                                        {/* 상대방 글: ↳ 귓속말 답장 아이콘 */}
                                        {!isMine && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setChatWhisperTarget((prev) =>
                                                prev === group.sender ? null : group.sender
                                              );
                                            }}
                                            className={`p-0.5 rounded hover:bg-slate-600/80 transition-colors ${
                                              chatWhisperTarget === group.sender
                                                ? "text-fuchsia-300"
                                                : "text-slate-200 hover:text-white"
                                            }`}
                                            title={`${group.sender}님에게 1:1 귓속말`}
                                          >
                                            <CornerDownRight className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                          </button>
                                        )}

                                        {/* ☺+ 공감 반응 아이콘 */}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const nextId = activeReactionMsgId === m.id ? null : m.id;
                                            setActiveReactionMsgId(nextId);
                                            if (
                                              nextId &&
                                              (isChatAtBottomRef.current ||
                                                m.id === messages[messages.length - 1]?.id)
                                            ) {
                                              scrollToBottom(true);
                                            }
                                          }}
                                          className={`p-0.5 rounded hover:bg-slate-600/80 transition-colors ${
                                            activeReactionMsgId === m.id
                                              ? "text-amber-300"
                                              : "text-slate-200 hover:text-amber-200"
                                          }`}
                                          title="공감 이모티콘 반응"
                                        >
                                          <SmilePlus className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                        </button>

                                        {/* 내 글: 🗑 보내기 취소(삭제) 아이콘 */}
                                        {isMine && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteMessage(m.id);
                                            }}
                                            className="p-0.5 rounded text-slate-200 hover:text-rose-300 hover:bg-slate-600/80 transition-colors"
                                            title="보내기 취소 (삭제)"
                                          >
                                            <Trash2 className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {isLastInTimeStreak && (
                                      <span className="text-[9px] md:text-[11px] text-slate-400 shrink-0 ml-1 self-end">
                                        {m.time}
                                      </span>
                                    )}
                                  </div>

                                  {/* 사진 메시지 렌더링 (스크롤이 맨 아래에 있을 때만 자동 스크롤) */}
                                  {m.imageUrl && (
                                    <div className="mt-1 md:mt-1.5">
                                      <img
                                        src={m.imageUrl}
                                        alt="전송된 사진"
                                        onLoad={() => scrollToBottom(false)}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedChatImage(m.imageUrl!);
                                        }}
                                        className="max-h-48 md:max-h-64 max-w-[220px] md:max-w-[300px] rounded-lg object-cover border border-white/20 shadow-md cursor-pointer hover:opacity-95 hover:scale-[1.01] active:scale-95 transition-all"
                                      />
                                      <span className="text-[8.5px] md:text-[10.5px] text-slate-400 block mt-0.5 select-none">
                                        🔍 클릭하여 크게 보기 {isMine && "· 마우스 오버 시 삭제 가능"}
                                      </span>
                                    </div>
                                  )}

                                  {/* 카톡 스타일 이모티콘 반응 선택 팝오버 */}
                                  {activeReactionMsgId === m.id && (
                                    <div
                                      ref={(el) => {
                                        if (el) {
                                          el.scrollIntoView({ block: "nearest", behavior: "smooth" });
                                          if (
                                            isChatAtBottomRef.current &&
                                            chatScrollRef.current
                                          ) {
                                            chatScrollRef.current.scrollTop =
                                              chatScrollRef.current.scrollHeight;
                                          }
                                        }
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="mt-1.5 inline-flex items-center gap-1 md:gap-1.5 bg-slate-900/95 border border-indigo-500/40 rounded-full px-2 md:px-3 py-1 md:py-1.5 shadow-xl z-20"
                                    >
                                      {REACTION_EMOJIS.map((emoji) => {
                                        const reactedByMe = m.reactions?.[emoji]?.includes(cleanNick);
                                        return (
                                          <button
                                            key={emoji}
                                            type="button"
                                            onClick={() => handleToggleReaction(m.id, emoji)}
                                            className={`text-sm md:text-base px-1.5 py-0.5 rounded-full hover:scale-125 active:scale-95 transition-transform ${
                                              reactedByMe ? "bg-indigo-600/40 ring-1 ring-indigo-400" : "hover:bg-slate-800"
                                            }`}
                                            title={`${emoji} 반응 남기기`}
                                          >
                                            {emoji}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* 남겨진 이모티콘 반응 뱃지 목록 */}
                                  {reactionEntries.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-1 md:gap-1.5 mt-1 md:mt-1.5">
                                      {reactionEntries.map(([emoji, users]) => {
                                        const reactedByMe = users.includes(cleanNick);
                                        return (
                                          <button
                                            key={emoji}
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleToggleReaction(m.id, emoji);
                                            }}
                                            className={`inline-flex items-center gap-1 px-1.5 md:px-2 py-0.5 rounded-full text-[10px] md:text-xs border transition-all active:scale-95 ${
                                              reactedByMe
                                                ? "bg-indigo-600/35 border-indigo-400 text-indigo-100 font-bold shadow-sm"
                                                : "bg-slate-950/70 border-white/15 text-slate-300 hover:border-white/30"
                                            }`}
                                            title={`반응한 사람: ${users.join(", ")}`}
                                          >
                                            <span>{emoji}</span>
                                            <span className="text-[9px] md:text-[11px]">{users.length}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* 위로 스크롤 중 새 메시지가 왔을 때 뜨는 플로팅 알림 버튼 */}
              {hasUnreadBelow && (
                <button
                  type="button"
                  onClick={() => scrollToBottom(true)}
                  className="mx-auto mb-1 px-3 md:px-4 py-1 md:py-1.5 rounded-full bg-indigo-600/95 hover:bg-indigo-500 text-white font-bold text-[10px] md:text-xs shadow-lg border border-indigo-300/40 flex items-center gap-1 animate-bounce shrink-0"
                >
                  <span>⬇</span>
                  <span>아래 새 대화 보기</span>
                </button>
              )}

              {/* 채팅 귓속말 대상 선택 바 (인원이 많아도 우측에 잘리지 않도록 자동 줄바꿈 + 세로 스크롤 지원) */}
              {showWhisperPicker && (
                <div className="pb-1.5 pt-1.5 px-1 border-t border-white/10 flex flex-wrap items-center gap-1.5 max-h-28 md:max-h-36 overflow-y-auto shrink-0">
                  <span className="text-[9.5px] md:text-xs text-fuchsia-300 font-bold shrink-0">🤫 귓속말 대상:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setChatWhisperTarget(null);
                      setShowWhisperPicker(false);
                    }}
                    className={`px-2 md:px-2.5 py-0.5 md:py-1 rounded-full text-[9.5px] md:text-xs border shrink-0 transition-all ${
                      !chatWhisperTarget
                        ? "bg-indigo-600 text-white border-indigo-400 font-bold"
                        : "bg-slate-900 text-slate-300 border-white/15 hover:text-white"
                    }`}
                  >
                    전체 공개
                  </button>
                  {allParticipants
                    .filter((p) => p !== cleanNick)
                    .map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setChatWhisperTarget(p);
                          setShowWhisperPicker(false);
                        }}
                        className={`px-2 md:px-2.5 py-0.5 md:py-1 rounded-full text-[9.5px] md:text-xs border shrink-0 transition-all ${
                          chatWhisperTarget === p
                            ? "bg-fuchsia-600 text-white border-fuchsia-400 font-bold"
                            : "bg-slate-900 text-slate-300 border-white/15 hover:border-fuchsia-400/50 hover:text-fuchsia-200"
                        }`}
                      >
                        🤫 {p}
                      </button>
                    ))}
                  {allParticipants.filter((p) => p !== cleanNick).length === 0 && (
                    <span className="text-[9.5px] md:text-xs text-slate-500">방에 다른 참가자가 없습니다</span>
                  )}
                </div>
              )}

              {/* 현재 귓속말 대상 표시 배너 */}
              {chatWhisperTarget && (
                <div className="mb-1 px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg bg-fuchsia-950/75 border border-fuchsia-500/50 flex items-center justify-between text-[10px] md:text-xs text-fuchsia-200 shrink-0">
                  <span className="font-bold truncate">
                    🤫 [{chatWhisperTarget}]님에게만 보이는 1:1 귓속말 모드 (채팅/사진)
                  </span>
                  <button
                    type="button"
                    onClick={() => setChatWhisperTarget(null)}
                    className="ml-2 px-1.5 md:px-2 py-0.2 md:py-0.5 rounded bg-fuchsia-800/80 hover:bg-fuchsia-700 text-white text-[9px] md:text-[11px] font-bold shrink-0"
                  >
                    전체로 전환 ✕
                  </button>
                </div>
              )}

              {/* Ctrl+V 붙여넣기 이미지 미리보기 (Enter 또는 전송 버튼을 누르면 전송) */}
              {pendingChatImage && (
                <div className="mb-1.5 p-2 rounded-xl bg-slate-900/90 border border-indigo-400/50 flex items-center justify-between gap-2.5 shadow-lg shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={pendingChatImage}
                      alt="붙여넣은 이미지 미리보기"
                      onClick={() => setSelectedChatImage(pendingChatImage)}
                      className="h-14 md:h-16 w-auto max-w-[110px] rounded-lg object-cover border border-white/20 cursor-pointer hover:opacity-90 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-[11px] md:text-xs font-bold text-indigo-200 truncate">
                        📷 클립보드 이미지 준비됨
                      </div>
                      <div className="text-[10px] md:text-[11px] text-slate-300 truncate">
                        Enter 키 또는 전송 버튼을 누르면 보내집니다 (ESC 취소)
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingChatImage(null);
                      pendingChatImageRef.current = null;
                    }}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-rose-600/80 text-slate-300 hover:text-white text-[10px] md:text-xs font-bold border border-white/10 shrink-0 transition-colors"
                    title="붙여넣은 이미지 취소"
                  >
                    ✕ 취소
                  </button>
                </div>
              )}

              {/* 하단 채팅 입력창 */}
              <div className="flex items-center gap-1 md:gap-1.5 pt-1 md:pt-2 border-t border-white/10 shrink-0">
                <input
                  ref={chatFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleChatImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => chatFileInputRef.current?.click()}
                  disabled={isUploadingChatImage}
                  className="p-1.5 md:p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 flex items-center justify-center shrink-0 transition-colors"
                  title="사진 올리기 (클립보드 캡처 후 Ctrl+V 붙여넣기도 가능 · 서버 미저장)"
                >
                  {isUploadingChatImage ? (
                    <span className="w-3.5 h-3.5 md:w-4 md:h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin inline-block" />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5 md:w-4 md:h-4 text-indigo-300" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowWhisperPicker((prev) => !prev)}
                  className={`px-2 md:px-2.5 py-1.5 md:py-2 rounded-lg border flex items-center gap-0.5 md:gap-1 shrink-0 text-[10px] md:text-xs font-bold transition-colors ${
                    chatWhisperTarget
                      ? "bg-fuchsia-600/85 hover:bg-fuchsia-600 text-white border-fuchsia-400"
                      : "bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-white/10"
                  }`}
                  title="채팅 귓속말 대상 선택"
                >
                  <span>🤫</span>
                  <span className="max-w-[48px] md:max-w-[72px] truncate">
                    {chatWhisperTarget ? chatWhisperTarget : "귓속말"}
                  </span>
                </button>
                <input
                  ref={chatTextInputRef}
                  type="text"
                  placeholder={
                    pendingChatImage
                      ? "Enter를 누르면 사진이 전송됩니다 (메시지 함께 입력 가능)..."
                      : chatWhisperTarget
                      ? `🤫 ${chatWhisperTarget}님에게 비밀 귓속말 (Ctrl+V 캡처 첨부 가능)...`
                      : myTTSMode
                      ? "입력한 글을 모두에게 음성으로 읽어줍니다..."
                      : "채팅 입력 (Ctrl+V로 캡처 이미지 첨부 후 Enter 전송)..."
                  }
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onPaste={handleChatPaste}
                  onFocus={() => {
                    setTimeout(() => {
                      if (window.scrollY !== 0) window.scrollTo(0, 0);
                    }, 50);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      e.stopPropagation();
                      if (pendingChatImage) {
                        setPendingChatImage(null);
                        pendingChatImageRef.current = null;
                      } else {
                        e.currentTarget.blur();
                      }
                      return;
                    }
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      e.stopPropagation();
                      if (inputText.trim() || pendingChatImageRef.current || pendingChatImage) {
                        sendMessage();
                      }
                      const inputEl = e.currentTarget;
                      inputEl.blur();
                      setTimeout(() => {
                        inputEl.blur();
                      }, 15);
                    }
                  }}
                  className={`flex-1 bg-black/30 border rounded-lg px-2.5 md:px-3.5 py-1.5 md:py-2 text-xs md:text-sm text-white placeholder-slate-300 focus:outline-none min-w-0 [text-shadow:_0_1px_2px_rgb(0_0_0_/_90%)] ${
                    pendingChatImage
                      ? "border-indigo-400 focus:border-indigo-300"
                      : chatWhisperTarget
                      ? "border-fuchsia-500/70 focus:border-fuchsia-400"
                      : "border-white/20 focus:border-indigo-400"
                  }`}
                />
                <button
                  type="button"
                  onClick={sendMessage}
                  className={`p-1.5 md:p-2 rounded-lg text-white font-bold shrink-0 ${
                    chatWhisperTarget
                      ? "bg-fuchsia-600 hover:bg-fuchsia-500"
                      : "bg-indigo-600 hover:bg-indigo-500"
                  }`}
                >
                  <Send className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </button>
              </div>
              </div>
            </div>

            {/* 3. 하단 메인 핫바 (대기자 1줄 + 발화석 10칸 + 메인 액션 버튼 일체형) */}
            <div className="fixed bottom-2 left-2 right-2 md:bottom-3 md:left-3 md:right-auto xl:left-1/2 xl:-translate-x-1/2 z-30 w-auto md:w-full md:max-w-[630px] lg:max-w-[700px] px-0 md:px-2 pointer-events-none [&>*]:pointer-events-auto">
              <div className="rpg-frame p-2 md:p-2.5 flex flex-col gap-1.5 shadow-2xl">
                {/* 0층: 대기자 명단 (발화석 위 1줄 일체형 컴팩트 바) */}
                <div className="flex items-center justify-between gap-2 pb-1 border-b border-amber-800/40 text-[10px] md:text-[11px] min-w-0">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
                    <span className="text-amber-400 font-bold shrink-0">📜 대기자 ({waitingList.length}명)</span>
                    <span className="text-amber-700/60 shrink-0">|</span>
                    <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap scrollbar-none flex-1 min-w-0">
                      {waitingList.length === 0 ? (
                        <span className="text-stone-400 italic text-[10px]">대기자가 없습니다.</span>
                      ) : (
                        waitingList.map((id) => (
                          <span
                            key={id}
                            onClick={() => {
                              if (id === cleanNick) {
                                setNewNickInput(cleanNick);
                                setNickChangeError("");
                                setShowNickModal(true);
                              } else {
                                setKickTarget(id);
                              }
                            }}
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9.5px] md:text-[10.5px] border shrink-0 cursor-pointer active:scale-95 transition-all ${
                              id === cleanNick
                                ? "bg-amber-900/60 border-amber-500 text-amber-200 font-bold"
                                : "bg-stone-900/80 border-stone-700 text-stone-200 hover:border-amber-500"
                            }`}
                            title={id === cleanNick ? "클릭하여 닉네임 변경" : "클릭하여 유령 사용자 정리 / 내보내기"}
                          >
                            {renderDeviceIcon(id, "w-2.5 h-2.5")}
                            <span>{id}</span>
                            {id === cleanNick ? "(나 ✏️)" : <span className="text-[8.5px] text-stone-400 hover:text-rose-400 ml-0.5">✕</span>}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                  <span className="text-[9px] text-amber-200/60 shrink-0 hidden sm:inline">
                    {!isSeated ? "빈자리 클릭: 착석" : "클릭: 상호작용"}
                  </span>
                </div>

                {/* 1층: 발화석 10칸 (모바일 2줄 5개 / PC 1줄 10개) */}
                <div className="grid grid-cols-5 md:grid-cols-10 gap-1 md:gap-1.5">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((idx) => {
                    const occupant = slots[idx];
                    const isOccupied = Boolean(occupant);
                    const isMeOnSlot = occupant === cleanNick;
                    const occupantIdentity = nickToIdentityMapRef.current[occupant] || occupant;
                    const isSpeaking =
                      isOccupied &&
                      (isMeOnSlot
                        ? Boolean(
                            isMyVoiceActive ||
                            speakingMap[occupant] ||
                            speakingMap[cleanNick] ||
                            (roomRef.current?.localParticipant && speakingMap[roomRef.current.localParticipant.identity])
                          )
                        : Boolean(speakingMap[occupant] || speakingMap[occupantIdentity]));
                    const isUserMuted =
                      isOccupied &&
                      (isMeOnSlot
                        ? isMuted
                        : Boolean(muteMap[occupant] ?? muteMap[occupantIdentity]));
                    const customAvatar = occupant ? avatarMap[occupant] : null;
                    const isWhisperingToThis = Boolean(occupant && whisperingTo === occupant);
                    const isWhisperingFromThis = Boolean(occupant && whisperedBy === occupant);
                    const isMyWhisperSlot = Boolean(isMeOnSlot && whisperingTo);
                    const isSlotWhisperHighlighted = isWhisperingFromThis || isMyWhisperSlot;
                    const isSlotGreenHighlighted = !isSlotWhisperHighlighted && (isWhisperingToThis || isSpeaking);
                    const canSendEmoteToThis = Boolean(isSeated && isOccupied && !isMeOnSlot);
                    const hitState = hitSlotMap[idx];
                    const hitAnimClass = hitState
                      ? hitState.shakeType === "punch"
                        ? "animate-emote-punch ring-2 ring-orange-400"
                        : hitState.shakeType === "love"
                        ? "animate-emote-love ring-2 ring-pink-400"
                        : "animate-emote-laugh ring-2 ring-amber-300"
                      : "";

                    return (
                      <div
                        key={idx}
                        ref={(el) => {
                          slotElementsRef.current[idx] = el;
                        }}
                        onClick={() => {
                          if (!isOccupied) {
                            handleTakeSlot(idx);
                          } else if (canSendEmoteToThis && occupant) {
                            setEmotePickerTarget({ slotIdx: idx, occupant });
                          } else if (isMeOnSlot) {
                            fileInputRef.current?.click();
                          }
                        }}
                        title={
                          !isOccupied
                            ? `${idx + 1}번 자리 착석 (마이크 ON)`
                            : canSendEmoteToThis
                            ? `${occupant}님 상호작용 (귓속말/감정표현/내리기)`
                            : `${occupant} (나)`
                        }
                        className={`rpg-slot relative flex flex-col items-center justify-between p-1 rounded-lg h-14 md:h-16 cursor-pointer select-none ${hitAnimClass} ${
                          isSlotWhisperHighlighted
                            ? "rpg-slot-whisper"
                            : isSlotGreenHighlighted
                            ? "rpg-slot-active"
                            : isOccupied
                            ? "border-amber-600/70"
                            : "border-stone-700/60 opacity-80 hover:opacity-100"
                        }`}
                      >
                        {/* 슬롯 번호 */}
                        <span className={`text-[8.5px] md:text-[9.5px] font-black leading-none self-start ${
                          isOccupied ? "text-amber-400" : "text-stone-500"
                        }`}>
                          {idx + 1}
                        </span>

                        {isOccupied ? (
                          <>
                            <div className="relative my-auto">
                              {customAvatar ? (
                                <img
                                  src={customAvatar}
                                  alt={occupant}
                                  className={`w-5 h-5 md:w-6 md:h-6 rounded-full object-cover ${
                                    isSlotWhisperHighlighted
                                      ? "ring-2 ring-purple-400 animate-pulse"
                                      : isSlotGreenHighlighted
                                      ? "ring-2 ring-emerald-400 animate-pulse"
                                      : isMeOnSlot
                                      ? "ring-1.5 ring-amber-400"
                                      : "ring-1 ring-stone-400"
                                  }`}
                                />
                              ) : (
                                <div
                                  className={`w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center font-bold text-[8px] md:text-[9.5px] ${
                                    isSlotWhisperHighlighted
                                      ? "bg-purple-600 text-white ring-2 ring-purple-400 animate-pulse"
                                      : isSlotGreenHighlighted
                                      ? "bg-emerald-500 text-white ring-2 ring-emerald-400 animate-pulse"
                                      : isMeOnSlot
                                      ? "bg-amber-600 text-white ring-1.5 ring-amber-400 font-extrabold"
                                      : "bg-stone-700 text-stone-200"
                                  }`}
                                >
                                  {occupant.slice(0, 2)}
                                </div>
                              )}
                              {isUserMuted && (
                                <MicOff className="w-2.5 h-2.5 text-rose-400 absolute -top-1 -right-1 drop-shadow" />
                              )}
                            </div>
                            <span className="text-[8px] md:text-[9.5px] font-semibold text-stone-200 truncate w-full text-center leading-tight">
                              {occupant}
                            </span>
                          </>
                        ) : (
                          <div className="my-auto flex flex-col items-center justify-center text-stone-500 hover:text-amber-400 transition-colors">
                            <span className="text-sm md:text-base font-light leading-none">+</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 2층: 메인 액션 버튼 핫바 */}
                <div className="flex items-center justify-between gap-1 flex-wrap pt-1 border-t border-amber-800/40">
                  <div className="flex items-center gap-1 md:gap-1.5 flex-wrap">
                    {/* 마이크 ON/OFF */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.currentTarget.blur();
                        toggleMute();
                      }}
                      className={`rpg-btn px-2 md:px-2.5 py-1 rounded text-[10px] md:text-xs font-bold flex items-center gap-1 ${
                        !isMuted ? "rpg-btn-success" : ""
                      }`}
                      title="마이크 켜기/끄기"
                    >
                      {isMuted ? (
                        <MicOff className="w-3 h-3 text-rose-400 shrink-0" />
                      ) : (
                        <Mic className={`w-3 h-3 text-white shrink-0 ${isMyVoiceActive ? "animate-pulse text-emerald-200" : ""}`} />
                      )}
                      <span>{isMuted ? "마이크 OFF" : "마이크 ON"}</span>
                    </button>

                    {/* 소리 ON/OFF */}
                    <button
                      type="button"
                      onClick={toggleDeafen}
                      className={`rpg-btn px-2 md:px-2.5 py-1 rounded text-[10px] md:text-xs font-bold flex items-center gap-1 ${
                        isDeafened ? "rpg-btn-danger" : ""
                      }`}
                      title="전체 소리 끄기/켜기"
                    >
                      {isDeafened ? <VolumeX className="w-3 h-3 text-rose-300" /> : <Volume2 className="w-3 h-3 text-amber-300" />}
                      <span>{isDeafened ? "소리 OFF" : "소리 ON"}</span>
                    </button>

                    {/* 캐릭터 변경 */}
                    {isPlaza && (
                      <button
                        type="button"
                        onClick={() => setShowModeModal(true)}
                        className="rpg-btn px-2 md:px-2.5 py-1 rounded text-[10px] md:text-xs font-bold flex items-center gap-1"
                        title="내 캐릭터 바꾸기"
                      >
                        <span>👤 캐릭터</span>
                      </button>
                    )}

                    {/* 사진 업로드 */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rpg-btn px-2 md:px-2.5 py-1 rounded text-[10px] md:text-xs font-bold flex items-center gap-1"
                      title="갤러리에서 내 아바타 사진 선택"
                    >
                      <span>🖼️ 사진</span>
                    </button>

                    {/* 닉네임 변경 */}
                    <button
                      type="button"
                      onClick={() => {
                        setNewNickInput(cleanNick);
                        setNickChangeError("");
                        setShowNickModal(true);
                      }}
                      className="rpg-btn px-2 md:px-2.5 py-1 rounded text-[10px] md:text-xs font-bold flex items-center gap-1"
                      title="닉네임 변경"
                    >
                      <span>✏️ 닉변경</span>
                    </button>

                    {/* 내려가기 (착석 중일 때만) */}
                    {isSeated && (
                      <button
                        type="button"
                        onClick={handleLeaveSlot}
                        className="rpg-btn hover:text-rose-300 px-2 md:px-2.5 py-1 rounded text-[10px] md:text-xs font-bold flex items-center gap-1"
                        title="발화석에서 대기석으로 내려가기"
                      >
                        <span>⬇️ 내려가기</span>
                      </button>
                    )}
                  </div>

                  {/* ⚙️ 통합 설정 버튼 */}
                  <button
                    type="button"
                    onClick={() => setShowSettingsModal(true)}
                    className="rpg-btn-primary px-2.5 md:px-3 py-1 rounded text-[10px] md:text-xs font-extrabold flex items-center gap-1 shadow-md ml-auto"
                    title="게임 옵션 및 TTS / 모드 / 효과 설정"
                  >
                    <Settings className="w-3.5 h-3.5 text-amber-200" />
                    <span>⚙️ 설정</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 채팅 이미지 확대 모달 (마우스 드래그 확대/이동, 휠 줌, 좌우 사진 넘기기 및 GIF 애니메이션 지원) */}
      {selectedChatImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-2 md:p-4 overflow-hidden"
          onClick={() => {
            if (didDragImageRef.current) return;
            setSelectedChatImage(null);
          }}
          onContextMenu={(e) => {
            if (isDraggingImage) e.preventDefault();
          }}
          onWheel={(e) => {
            e.stopPropagation();
            const delta = e.deltaY < 0 ? 0.25 : -0.25;
            setImageZoom((prev) => {
              const next = Math.max(0.5, Math.min(5.0, Number((prev + delta).toFixed(2))));
              if (next <= 1.02) setImagePan({ x: 0, y: 0 });
              return next;
            });
          }}
          onTouchStart={(e) => {
            if (imageZoom > 1.05) return;
            lightboxTouchStartXRef.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            if (imageZoom > 1.05 || lightboxTouchStartXRef.current === null) return;
            const endX = e.changedTouches[0]?.clientX ?? lightboxTouchStartXRef.current;
            const diff = endX - lightboxTouchStartXRef.current;
            lightboxTouchStartXRef.current = null;
            if (diff > 45) {
              goPrevImage();
            } else if (diff < -45) {
              goNextImage();
            }
          }}
        >
          <div
            className="relative max-w-[95vw] max-h-[94vh] w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 상단 컨트롤 바: 보낸 사람 정보 / 마우스 드래그 확대·이동 컨트롤 / 사진 삭제 / 닫기 */}
            <div className="w-full max-w-3xl flex flex-wrap items-center justify-between pb-2.5 gap-2 z-30">
              <div className="flex items-center gap-1.5 md:gap-2 min-w-0 flex-wrap">
                {currentImageIndex >= 0 && imageMessages[currentImageIndex] && (
                  <span className="text-xs font-bold text-indigo-200 bg-slate-900/90 border border-white/15 px-2.5 py-1 rounded-full truncate">
                    📷 {imageMessages[currentImageIndex].sender} ({imageMessages[currentImageIndex].time})
                    {imageMessages.length > 1 && ` · ${currentImageIndex + 1} / ${imageMessages.length}`}
                  </span>
                )}

                {/* 마우스 드래그 모드 전환 & 배율 조절 바 */}
                <div className="flex items-center gap-1 bg-slate-900/90 border border-indigo-500/40 rounded-full px-2 py-0.5 shadow-lg">
                  <button
                    type="button"
                    onClick={() => setImageDragMode("zoom")}
                    className={`px-2 py-0.5 rounded-full text-[10px] md:text-xs font-bold transition-colors ${
                      imageDragMode === "zoom"
                        ? "bg-indigo-600 text-white"
                        : "text-slate-300 hover:text-white"
                    }`}
                    title="이미지를 마우스로 잡고 드래그하면 크기가 확대/축소됩니다"
                  >
                    🔍 드래그 확대
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageDragMode("pan")}
                    className={`px-2 py-0.5 rounded-full text-[10px] md:text-xs font-bold transition-colors ${
                      imageDragMode === "pan"
                        ? "bg-indigo-600 text-white"
                        : "text-slate-300 hover:text-white"
                    }`}
                    title="확대된 이미지를 마우스로 잡고 드래그하여 위치를 이동합니다"
                  >
                    ✋ 드래그 이동
                  </button>
                  <span className="text-[10px] md:text-xs font-mono text-indigo-300 font-bold px-1">
                    {Math.round(imageZoom * 100)}%
                  </span>
                  <input
                    type="range"
                    min="0.5"
                    max="5"
                    step="0.05"
                    value={imageZoom}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setImageZoom(val);
                      if (val <= 1.02) setImagePan({ x: 0, y: 0 });
                    }}
                    className="w-14 md:w-20 accent-indigo-400 h-1 bg-slate-700 rounded cursor-pointer"
                    title="드래그하여 배율 조절 (50% ~ 500%)"
                  />
                  {(imageZoom !== 1 || imagePan.x !== 0 || imagePan.y !== 0) && (
                    <button
                      type="button"
                      onClick={() => {
                        setImageZoom(1);
                        setImagePan({ x: 0, y: 0 });
                      }}
                      className="px-1.5 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-[10px] text-amber-300 font-bold border border-white/10"
                      title="원래 크기로 초기화 (100%)"
                    >
                      100%
                    </button>
                  )}
                </div>

                {(() => {
                  const matchedMsg = messages.find((m) => m.imageUrl === selectedChatImage);
                  if (matchedMsg && matchedMsg.sender === cleanNick) {
                    return (
                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(matchedMsg.id)}
                        className="text-rose-200 hover:text-white bg-rose-600/80 hover:bg-rose-600 px-2.5 py-1 rounded-full border border-rose-400/40 text-[11px] font-bold flex items-center gap-1 shadow-lg transition-colors shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>보내기 취소</span>
                      </button>
                    );
                  }
                  return null;
                })()}
              </div>
              <button
                type="button"
                onClick={() => setSelectedChatImage(null)}
                className="text-white/80 hover:text-white bg-slate-800/80 hover:bg-slate-700 p-1.5 rounded-full border border-white/10 transition-colors shrink-0"
                title="닫기"
              >
                ✕
              </button>
            </div>

            {/* 중앙 이미지 및 좌우 이전/다음 화살표 버튼 */}
            <div className="relative w-full flex items-center justify-center min-h-[45vh] max-h-[78vh]">
              {currentImageIndex > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goPrevImage();
                  }}
                  className="absolute left-1 sm:left-4 z-30 p-2 rounded-full bg-slate-900/85 hover:bg-indigo-600 text-white border border-white/20 shadow-xl active:scale-95 transition-all"
                  title="이전 사진 (←)"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}

              <div
                onMouseDown={(e) => startImageMouseDrag(e)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (imageZoom > 1.05) {
                    setImageZoom(1);
                    setImagePan({ x: 0, y: 0 });
                  } else {
                    setImageZoom(2.2);
                  }
                }}
                style={{
                  transform: `translate(${imagePan.x}px, ${imagePan.y}px) scale(${imageZoom})`,
                  transformOrigin: "center center",
                  transition: isDraggingImage ? "none" : "transform 0.12s ease-out",
                }}
                className={`relative inline-flex items-center justify-center z-20 ${
                  imageDragMode === "pan"
                    ? isDraggingImage
                      ? "cursor-grabbing"
                      : "cursor-grab"
                    : "cursor-nwse-resize"
                }`}
                title="마우스로 잡고 드래그하여 확대/축소 (더블클릭: 2.2배 확대/원복, 우클릭 드래그: 위치 이동)"
              >
                <img
                  src={selectedChatImage}
                  alt="확대 사진"
                  draggable={false}
                  className="max-h-[74vh] max-w-[90vw] rounded-xl object-contain shadow-2xl border border-white/20 select-none pointer-events-none"
                />
                {/* 우측 하단 모서리 드래그 확대 핸들 */}
                <div
                  onMouseDown={(e) => startImageMouseDrag(e, "zoom")}
                  className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded-md bg-black/75 border border-indigo-400/60 text-[10px] text-indigo-200 font-bold cursor-nwse-resize select-none shadow-md hover:bg-indigo-600/80 hover:text-white transition-colors"
                  title="여기를 마우스로 잡고 당기면 사진이 확대됩니다"
                >
                  ↘ 드래그 확대
                </div>
              </div>

              {currentImageIndex >= 0 && currentImageIndex < imageMessages.length - 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goNextImage();
                  }}
                  className="absolute right-1 sm:right-4 z-30 p-2 rounded-full bg-slate-900/85 hover:bg-indigo-600 text-white border border-white/20 shadow-xl active:scale-95 transition-all"
                  title="다음 사진 (→)"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* 하단 이전/다음 네비게이션 컨트롤 */}
            {imageMessages.length > 1 && (
              <div className="mt-3 flex items-center gap-3 bg-slate-900/85 border border-white/15 px-4 py-1.5 rounded-full shadow-lg z-30">
                <button
                  type="button"
                  disabled={currentImageIndex <= 0}
                  onClick={goPrevImage}
                  className="flex items-center gap-1 text-xs font-bold text-slate-200 hover:text-white disabled:opacity-30 transition-opacity"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>이전 사진</span>
                </button>
                <span className="text-xs font-mono text-indigo-300 font-bold px-2 border-x border-white/10">
                  {currentImageIndex + 1} / {imageMessages.length}
                </span>
                <button
                  type="button"
                  disabled={currentImageIndex >= imageMessages.length - 1}
                  onClick={goNextImage}
                  className="flex items-center gap-1 text-xs font-bold text-slate-200 hover:text-white disabled:opacity-30 transition-opacity"
                >
                  <span>다음 사진</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="mt-2 text-center text-[11px] text-slate-300 bg-black/50 px-3 py-1 rounded-full z-30">
              💡 사진을 <strong>마우스로 잡고 드래그</strong>하거나 <strong>휠 스크롤</strong>로 최대 500%까지 확대할 수 있습니다 (우클릭 드래그 또는 &apos;✋ 드래그 이동&apos;으로 위치 이동 · 더블클릭 원복)
            </div>
          </div>
        </div>
      )}

      {/* 볼륨 조절 모달 */}
      {showVolumeModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 w-full max-w-xs space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-xs text-white flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                음량 및 스피커 볼륨 조절
              </span>
              <button
                onClick={() => setShowVolumeModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* 전체 수신 마스터 볼륨 (0% ~ 150% 부스트 지원) */}
            <div className="bg-slate-950/80 p-2.5 rounded-lg border border-indigo-500/30 space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-indigo-200 flex items-center gap-1 text-[11px]">
                  전체 수신 음량 (마스터)
                </span>
                <span className="text-indigo-400 font-bold text-xs">{masterVolume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="150"
                value={masterVolume}
                onChange={(e) => handleMasterVolumeChange(Number(e.target.value))}
                className="w-full accent-indigo-400 h-1.5 bg-slate-800 rounded cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-slate-400">
                <span>0% (음소거)</span>
                <span>100% (기본)</span>
                <span>150% (증폭)</span>
              </div>
            </div>

            <div className="pt-1">
              <div className="text-[10px] font-bold text-slate-400 mb-1.5">참여자별 개별 볼륨</div>
              <div className="space-y-2.5 max-h-48 overflow-y-auto pr-0.5">
                {allParticipants
                  .filter((id) => id !== cleanNick)
                  .map((id) => {
                    const vol = volumeMap[id] ?? 100;
                    return (
                      <div key={id} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-300 truncate max-w-[140px]">{id}</span>
                          <span className="text-indigo-400 font-bold">{vol}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={vol}
                          onChange={(e) => handleVolumeChange(id, Number(e.target.value))}
                          className="w-full accent-indigo-500 h-1 bg-slate-800 rounded"
                        />
                      </div>
                    );
                  })}
                {allParticipants.filter((id) => id !== cleanNick).length === 0 && (
                  <div className="text-center text-slate-400 py-3 text-[11px]">
                    다른 참가자가 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 닉네임 변경 모달 */}
      {showNickModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xs w-full p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-white">방 안에서 닉네임 변경</span>
              <button
                type="button"
                onClick={() => setShowNickModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-slate-400">새 닉네임</span>
                <button
                  type="button"
                  onClick={() => setNewNickInput(generateRandomNickname())}
                  className="text-[9px] text-indigo-400 hover:text-indigo-300 font-medium active:scale-95"
                >
                  🎲 랜덤 재추첨
                </button>
              </div>
              <input
                type="text"
                value={newNickInput}
                onChange={(e) => setNewNickInput(e.target.value)}
                maxLength={25}
                placeholder="카톡 닉네임 (닉/출생년도/지역)"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
              {nickChangeError && (
                <div className="text-[10px] text-rose-400 mt-1">{nickChangeError}</div>
              )}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowNickModal(false)}
                className="flex-1 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-800 text-[11px]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleRenameInRoom}
                className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px]"
              >
                변경하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 배경 스킨 선택 모달 (캐릭터 모드일 때는 광장 전용 2.5D 배경 스킨 표시) */}
      
      {/* ⚙️ 통합 게임 설정 모달 (TTS / 모드 / 효과 / 스킨 / 오디오 / 나가기) */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="rpg-frame w-full max-w-md p-4 space-y-4 shadow-2xl relative border-2 border-amber-600">
            {/* 헤더 */}
            <div className="flex items-center justify-between border-b border-amber-800/60 pb-2">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-amber-200">보이스룸 게임 설정</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="text-stone-400 hover:text-white p-1 rounded-md text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-[72vh] overflow-y-auto pr-1 scrollbar-thin">
              {/* 1. TTS 음성 읽기 설정 */}
              <div className="rpg-slot p-3 rounded-lg space-y-2">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  🎙️ 채팅 TTS 음성 읽기
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-stone-300">내 채팅 음성 읽기</span>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={myTTSMode}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setMyTTSMode(checked);
                        if (checked) {
                          speakText("티티에스가 켜졌습니다.", myTTSVoiceRef.current);
                        }
                      }}
                      className="rounded bg-stone-800 border-amber-700 text-amber-500 w-4 h-4"
                    />
                    <span className={`text-xs font-bold ${myTTSMode ? "text-amber-400" : "text-stone-400"}`}>
                      {myTTSMode ? "TTS ON" : "TTS OFF"}
                    </span>
                  </label>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-stone-300">목소리 선택</span>
                  <select
                    value={myTTSVoice}
                    onChange={(e) => handleSelectTTSVoice(e.target.value)}
                    className="bg-stone-900 text-amber-200 border border-amber-700/60 rounded px-2 py-1 text-xs font-semibold focus:outline-none"
                  >
                    {TTS_VOICE_OPTIONS.map((v) => (
                      <option key={v.id} value={v.id} className="bg-stone-900 text-white">
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 2. 화면 모드 & 비주얼 */}
              <div className="rpg-slot p-3 rounded-lg space-y-2">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  🎮 화면 모드 & 비주얼
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSettingsModal(false);
                      setShowModeModal(true);
                    }}
                    className="rpg-btn py-2 px-1 text-xs font-bold rounded flex flex-col items-center gap-1"
                  >
                    <span className="text-base">🎮</span>
                    <span>모드/캐릭터</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSettingsModal(false);
                      setShowEffectModal(true);
                    }}
                    className="rpg-btn py-2 px-1 text-xs font-bold rounded flex flex-col items-center gap-1"
                  >
                    <span className="text-base">✨</span>
                    <span>배경 효과</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSettingsModal(false);
                      setShowSkinModal(true);
                    }}
                    className="rpg-btn py-2 px-1 text-xs font-bold rounded flex flex-col items-center gap-1"
                  >
                    <span className="text-base">🎨</span>
                    <span>광장 스킨</span>
                  </button>
                </div>
              </div>

              {/* 3. 오디오 출력장치 & 볼륨 조절 */}
              <div className="rpg-slot p-3 rounded-lg space-y-2">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  🔊 사운드 & 볼륨 조절
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-stone-300">출력 장치</span>
                  {audioDevices.length > 0 ? (
                    <select
                      value={selectedAudioDevice}
                      onChange={(e) => handleAudioDeviceChange(e.target.value)}
                      className="bg-stone-900 text-xs text-stone-200 border border-amber-700/60 rounded px-2 py-1 max-w-[160px] truncate"
                    >
                      {audioDevices.map((d, i) => (
                        <option key={d.deviceId || i} value={d.deviceId}>
                          {d.label ? (d.label.length > 16 ? d.label.slice(0, 16) + ".." : d.label) : `출력 ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-stone-400">기본 스피커</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowSettingsModal(false);
                    setShowVolumeModal(true);
                  }}
                  className="w-full rpg-btn py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  <span>참가자 개별 볼륨 조절창 열기</span>
                </button>
              </div>

              {/* 4. 방 주제 변경 & 나가기 */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowSettingsModal(false);
                    setNewTopicInput(roomTopic);
                    setShowTopicModal(true);
                  }}
                  className="flex-1 rpg-btn py-2 rounded text-xs font-bold flex items-center justify-center gap-1"
                >
                  <Pencil className="w-3 h-3 text-amber-400" />
                  <span>방 주제 변경</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSettingsModal(false);
                    handleLeave(true);
                  }}
                  className="flex-1 rpg-btn-danger py-2 rounded text-xs font-bold flex items-center justify-center gap-1"
                >
                  <span>🚪 방 나가기</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSkinModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowSkinModal(false)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-xl max-w-xs w-full p-4 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-xs text-white flex items-center gap-1.5">
                {isPlaza ? "캐릭터 광장 스킨 선택" : "배경 스킨 선택"}
              </span>
              <button
                type="button"
                onClick={() => setShowSkinModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 gap-1.5 max-h-[60vh] overflow-y-auto pr-1">
              {isPlaza
                ? PLAZA_THEMES.map((t) => {
                    const isSel = plazaSkin === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => selectPlazaSkin(t.id)}
                        className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all ${
                          isSel
                            ? "bg-amber-500/20 border-amber-400 text-white shadow-sm shadow-amber-500/20"
                            : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                        }`}
                      >
                        <span className="text-2xl">{t.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-xs flex items-center justify-between">
                            <span>{t.name}</span>
                            {isSel && (
                              <span className="text-[10px] text-amber-300 font-semibold">적용 중</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate mt-0.5">{t.desc}</div>
                        </div>
                      </button>
                    );
                  })
                : SKINS.map((s) => {
                    const isSel = currentSkin === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => selectSkin(s.id)}
                        className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all ${
                          isSel
                            ? "bg-indigo-600/20 border-indigo-500 text-white shadow-sm shadow-indigo-500/20"
                            : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                        }`}
                      >
                        <span className="text-2xl">{s.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-xs flex items-center justify-between">
                            <span>{s.name}</span>
                            {isSel && (
                              <span className="text-[10px] text-indigo-400 font-semibold">적용 중</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate mt-0.5">{s.desc}</div>
                        </div>
                      </button>
                    );
                  })}
            </div>
          </div>
        </div>
      )}

      {/* 화면 모드 & 캐릭터 선택 모달 (모드는 내 화면에만 적용, 캐릭터는 방 전체에 공유) */}
      {showModeModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowModeModal(false)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-4 space-y-3 shadow-2xl max-h-full overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-xs text-white flex items-center gap-1.5">
                <Gamepad2 className="w-3.5 h-3.5 text-amber-400" />
                화면 모드 선택
              </span>
              <button
                type="button"
                onClick={() => setShowModeModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "basic" as ViewMode, icon: "🪑", name: "기본 모드", desc: "발화석 10칸 + 채팅" },
                { id: "plaza" as ViewMode, icon: "🧍", name: "캐릭터 모드", desc: "광장을 걸어다니는 캐릭터" },
              ].map((m) => {
                const isSel = viewMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelectViewMode(m.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      isSel
                        ? "bg-amber-500/15 border-amber-400 ring-1 ring-amber-400/40"
                        : "bg-slate-950/60 border-white/10 hover:border-white/25"
                    }`}
                  >
                    <div className="text-lg leading-none">{m.icon}</div>
                    <div className={`mt-1 text-xs font-bold ${isSel ? "text-amber-200" : "text-slate-200"}`}>{m.name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{m.desc}</div>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400 -mt-1">모드를 변경하면 방 전체 참여자의 화면이 함께 전환되며 다같이 움직여요.</p>

            <div className="border-t border-slate-800 pt-2.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-200">내 캐릭터</span>
                <span className="text-[10px] text-amber-300 font-semibold">
                  {CHARACTER_STYLES.find((c) => c.id === myCharacter)?.name}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {CHARACTER_STYLES.map((c) => {
                  const isSel = myCharacter === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectCharacter(c.id)}
                      title={c.desc}
                      className={`flex flex-col items-center rounded-xl border px-1 pt-1.5 pb-1 transition-all active:scale-95 ${
                        isSel
                          ? "bg-amber-500/15 border-amber-400 ring-1 ring-amber-400/40"
                          : "bg-slate-950/60 border-white/10 hover:border-white/25"
                      }`}
                    >
                      <CharacterSprite id={c.id} className="w-11 h-14" />
                      <span className={`text-[10px] font-bold mt-0.5 ${isSel ? "text-amber-200" : "text-slate-300"}`}>{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowModeModal(false)}
              className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
            >
              완료
            </button>
          </div>
        </div>
      )}

      {/* 배경 시각 효과 선택 모달 */}
      {showEffectModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowEffectModal(false)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xs w-full p-4 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-xs text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                배경 시각 효과 선택
              </span>
              <button
                type="button"
                onClick={() => setShowEffectModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* 배경 효과 속도 조절 슬라이더 (방 전체 동시 적용) */}
            <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-300 flex items-center gap-1 font-semibold">
                  <Sliders className="w-3 h-3 text-cyan-400" />
                  효과 속도 조절
                </span>
                <span className="font-bold text-cyan-300 font-mono text-[11px]">
                  {(bgEffectSpeed / 100).toFixed(1)}x ({bgEffectSpeed}%)
                </span>
              </div>
              <input
                type="range"
                min="20"
                max="250"
                step="10"
                value={bgEffectSpeed}
                onChange={(e) => handleBgEffectSpeedChange(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <div className="grid grid-cols-4 gap-1">
                {[
                  { label: "느리게", val: 50 },
                  { label: "보통", val: 100 },
                  { label: "빠르게", val: 150 },
                  { label: "초고속", val: 220 },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => handleBgEffectSpeedChange(preset.val)}
                    className={`py-1 rounded text-[10px] font-semibold border transition-all ${
                      bgEffectSpeed === preset.val
                        ? "bg-cyan-500/20 border-cyan-400 text-cyan-200"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="text-[9.5px] text-slate-400 leading-tight">
                방 전체 참여자에게 선택한 효과와 속도가 동시에 적용됩니다.
              </div>
            </div>

            <div className="grid grid-cols-1 gap-1.5 max-h-[48vh] overflow-y-auto pr-1">
              {BG_EFFECTS.map((item) => {
                const isSel = bgEffect === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectBgEffect(item.id)}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${
                      isSel
                        ? "bg-cyan-500/15 border-cyan-400/80 text-white shadow-sm shadow-cyan-500/20"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <span className="text-2xl shrink-0">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs flex items-center justify-between">
                        <span className={isSel ? "text-cyan-300" : "text-slate-200"}>
                          {item.name}
                        </span>
                        <div className="flex items-center gap-1">
                          {item.badge && item.id !== "off" && (
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                                isSel
                                  ? "bg-cyan-400/20 text-cyan-300"
                                  : "bg-slate-800 text-slate-400"
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                          {isSel && (
                            <span className="text-[10px] text-cyan-400 font-semibold ml-1">
                              ● 적용 중
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate mt-0.5">
                        {item.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 본인 캐릭터 클릭 시 감정표현 & 모션 선택 팝업 */}
      {showMyEmotePicker && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowMyEmotePicker(false)}
        >
          <div
            className="bg-slate-900/95 border border-amber-500/40 rounded-2xl max-w-xs w-full p-4 space-y-3 shadow-2xl shadow-amber-500/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-bold text-xs text-white truncate">
                  ✨ <span className="text-amber-300">내 캐릭터</span> 감정표현 선택
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowMyEmotePicker(false)}
                className="text-slate-400 hover:text-white text-sm shrink-0 ml-2"
              >
                ✕
              </button>
            </div>

            {/* 개인 솔로 액션 (정면 점프) */}
            <div>
              <div className="text-[10px] font-semibold text-emerald-300 mb-1.5 flex items-center justify-between">
                <span>솔로 액션 (단축키: Space)</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowMyEmotePicker(false);
                    handleMyPlazaPose("jump");
                  }}
                  className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl bg-slate-800/90 hover:bg-amber-950/50 border border-amber-500/30 hover:border-amber-400 text-xs transition-all active:scale-95"
                >
                  <span className="text-xl">🦘</span>
                  <span className="text-[10px] font-bold text-slate-200">점프 (Space)</span>
                </button>
              </div>
            </div>

            {/* 1. 캐릭터 전신 모션 (감정표현) */}
            <div>
              <div className="text-[10px] font-semibold text-amber-200/80 mb-1.5">
                이모지 감정표현
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleQuickEmote("😆", "laugh")}
                  className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl bg-slate-800/90 hover:bg-amber-950/50 border border-amber-500/30 hover:border-amber-400 text-xs transition-all active:scale-95"
                >
                  <span className="text-xl">😆</span>
                  <span className="text-[9.5px] font-bold text-slate-200">웃기</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickEmote("😭", "sad")}
                  className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl bg-slate-800/90 hover:bg-blue-950/50 border border-blue-500/30 hover:border-blue-400 text-xs transition-all active:scale-95"
                >
                  <span className="text-xl">😭</span>
                  <span className="text-[9.5px] font-bold text-slate-200">슬픔</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickEmote("👋", "wave")}
                  className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl bg-slate-800/90 hover:bg-emerald-950/50 border border-emerald-500/30 hover:border-emerald-400 text-xs transition-all active:scale-95"
                >
                  <span className="text-xl">👋</span>
                  <span className="text-[9.5px] font-bold text-slate-200">인사</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickEmote("🗣️", "talk")}
                  className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl bg-slate-800/90 hover:bg-indigo-950/50 border border-indigo-500/30 hover:border-indigo-400 text-xs transition-all active:scale-95"
                >
                  <span className="text-xl">🗣️</span>
                  <span className="text-[9.5px] font-bold text-slate-200">수다</span>
                </button>
              </div>
            </div>

            {/* 2. 빠른 이모지 리액션 (말풍선 팝업) */}
            <div className="pt-1.5 border-t border-slate-800">
              <div className="text-[10px] font-semibold text-slate-400 mb-1.5">
                말풍선 리액션
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {["❤️", "👍", "🔥", "👏", "🎉", "😮", "☕", "💯", "⭐", "💤"].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleQuickEmote(emoji)}
                    className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 border border-white/10 hover:border-white/30 text-lg flex items-center justify-center transition-all active:scale-90"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 캐릭터 / 좌석 클릭 메뉴 모달 (귓속말 · 개별 음소거 · 대기석 내리기 · 감정표현 발사) */}
      {emotePickerTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={() => setEmotePickerTarget(null)}
        >
          <div
            className="bg-slate-900/95 border border-pink-500/40 rounded-2xl max-w-xs w-full p-4 space-y-3 shadow-2xl shadow-pink-500/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-bold text-xs text-white truncate">
                  <span className="text-pink-400">[{emotePickerTarget.occupant}]</span>님 메뉴
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEmotePickerTarget(null)}
                className="text-slate-400 hover:text-white text-sm shrink-0 ml-2"
              >
                ✕
              </button>
            </div>

            {/* 1. 귓속말 / 개별 음소거 / 대기석 내리기 빠른 실행 버튼 */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const target = emotePickerTarget.occupant;
                  setEmotePickerTarget(null);
                  if (whisperingTo === target) {
                    handleStopWhisper();
                  } else {
                    handleStartWhisper(target);
                  }
                }}
                className={`py-2 px-2.5 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                  whisperingTo === emotePickerTarget.occupant
                    ? "bg-purple-600 text-white border-purple-400 shadow-sm shadow-purple-500/30"
                    : "bg-slate-950/80 hover:bg-slate-800 text-purple-200 border-purple-500/30"
                }`}
              >
                <span>🤫</span>
                <span>{whisperingTo === emotePickerTarget.occupant ? "음성 귓속말 종료" : "음성 귓속말"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const target = emotePickerTarget.occupant;
                  setEmotePickerTarget(null);
                  setChatWhisperTarget(target);
                  if (chatSizeMode === "closed") {
                    setChatSizeMode("half");
                  }
                  setTimeout(() => chatTextInputRef.current?.focus(), 50);
                }}
                className="py-2 px-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 text-fuchsia-200 border border-fuchsia-500/30 text-[11px] font-bold flex items-center justify-center gap-1 transition-all"
              >
                <span>💬</span>
                <span>채팅 귓속말</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const target = emotePickerTarget.occupant;
                  const curVol = volumeMap[target] ?? 100;
                  handleVolumeChange(target, curVol === 0 ? 100 : 0);
                }}
                className={`py-2 px-2.5 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                  (volumeMap[emotePickerTarget.occupant] ?? 100) === 0
                    ? "bg-rose-600/30 text-rose-200 border-rose-400"
                    : "bg-slate-950/80 hover:bg-slate-800 text-slate-200 border-slate-800"
                }`}
              >
                <span>{(volumeMap[emotePickerTarget.occupant] ?? 100) === 0 ? "🔊" : "🔇"}</span>
                <span>{(volumeMap[emotePickerTarget.occupant] ?? 100) === 0 ? "상대 음소거 해제" : "상대 소리 끄기"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const target = emotePickerTarget.occupant;
                  setEmotePickerTarget(null);
                  setUnseatTarget(target);
                }}
                className="py-2 px-2.5 rounded-xl bg-slate-950/80 hover:bg-rose-950/60 text-slate-300 hover:text-rose-200 border border-slate-800 hover:border-rose-500/40 text-[11px] font-bold flex items-center justify-center gap-1 transition-all"
              >
                <span>⬇️</span>
                <span>대기석 내리기</span>
              </button>
            </div>

            {/* 2. 캐릭터 2인 상호작용 (악수 · 껴안기 · 뽀뽀) */}
            {isPlaza && isSeated && (
              <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                <div className="text-[10px] font-semibold text-pink-300 flex items-center justify-between">
                  <span>💞 캐릭터 상호작용 (다가가서 함께 연출)</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">

                  <button
                    type="button"
                    onClick={() => handleTriggerInteraction(emotePickerTarget.occupant, "hug")}
                    className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl bg-slate-800/90 hover:bg-pink-950/60 border border-pink-500/40 hover:border-pink-400 text-xs transition-all active:scale-95"
                  >
                    <span className="text-xl">🫂</span>
                    <span className="text-[10px] font-bold text-pink-200">껴안기</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTriggerInteraction(emotePickerTarget.occupant, "kiss")}
                    className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl bg-slate-800/90 hover:bg-rose-950/60 border border-rose-500/40 hover:border-rose-400 text-xs transition-all active:scale-95"
                  >
                    <span className="text-xl">💋</span>
                    <span className="text-[10px] font-bold text-rose-200">뽀뽀하기</span>
                  </button>
                </div>
              </div>
            )}

            {/* 3. 감정표현 발사 그리드 (착석 중일 때 활성화) */}
            {isSeated && mySlotIndex !== undefined ? (
              <>
                <div className="text-[10px] font-semibold text-slate-400 pt-1 border-t border-slate-800/80">
                  감정표현 날리기
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {SEAT_EMOTES.map((emote) => (
                    <button
                      key={emote.id}
                      type="button"
                      onClick={async () => {
                        const fromSlot = Number(mySlotIndex);
                        const toSlot = emotePickerTarget.slotIdx;
                        const toNick = emotePickerTarget.occupant;
                        setEmotePickerTarget(null);
                        spawnFlyingEmote(fromSlot, toSlot, emote.id, cleanNick, toNick);
                        await broadcastData({
                          type: "SEAT_EMOTE",
                          fromSlot,
                          toSlot,
                          emoteId: emote.id,
                          fromNick: cleanNick,
                          toNick,
                        });
                      }}
                      className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-pink-400/60 transition-all hover:scale-105 active:scale-95 group"
                    >
                      <span className="text-2xl group-hover:animate-bounce">{emote.emoji}</span>
                      <span className="text-[10px] font-semibold text-slate-300 group-hover:text-white">
                        {emote.label}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-center text-slate-400">
                  아이콘을 누르면 내 캐릭터에서 상대 캐릭터로 날아갑니다!
                </div>
              </>
            ) : (
              <div className="text-[10px] text-center text-slate-400 pt-1 border-t border-slate-800/80">
                마이크 자리에 앉으면 음성 귓속말과 감정표현 날리기도 사용할 수 있어요.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 방 주제 변경 모달 */}
      {showTopicModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xs w-full p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-xs text-white flex items-center gap-1.5">
                <Pencil className="w-3.5 h-3.5 text-indigo-400" />
                방 주제 변경
              </span>
              <button
                type="button"
                onClick={() => setShowTopicModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 mb-1.5">
                방 참가자 모두에게 실시간으로 보여집니다.
              </div>
              <input
                type="text"
                value={newTopicInput}
                onChange={(e) => setNewTopicInput(e.target.value)}
                maxLength={30}
                placeholder="예: 편하게 수다 떨어요, 주말 계획 공유"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUpdateTopic();
                }}
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowTopicModal(false)}
                className="flex-1 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-800 text-[11px]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleUpdateTopic}
                className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px]"
              >
                변경하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 유령 사용자 정리 / 내보내기 확인 모달 */}
      {kickTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xs w-full p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-xs text-white flex items-center gap-1.5">
                🧹 유령 사용자 정리 / 내보내기
              </span>
              <button
                type="button"
                onClick={() => setKickTarget(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>
            <div className="text-[11px] text-slate-300 space-y-1.5">
              <p>
                <span className="font-bold text-indigo-300">[{kickTarget}]</span> 님을 대기자 명단에서 정리(내보내기)하시겠습니까?
              </p>
              <p className="text-[10px] text-slate-400">
                실행 시 채팅창에{" "}
                <span className="text-rose-300 font-semibold">
                  &apos;[{kickTarget}]님을 [{cleanNick}]님이 내보냈습니다&apos;
                </span>{" "}
                기록이 실시간으로 남습니다.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setKickTarget(null)}
                className="flex-1 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-800 text-[11px]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => handleKickParticipant(kickTarget)}
                className="flex-1 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px]"
              >
                정리하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 착석자 대기석으로 내리기 확인 모달 */}
      {unseatTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xs w-full p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                <DownCircleIcon className="w-3.5 h-3.5 text-indigo-400" />
                대기석으로 내리기
              </span>
              <button
                type="button"
                onClick={() => setUnseatTarget(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>
            <div className="text-[11px] text-slate-300 space-y-1.5">
              <p>
                <span className="font-bold text-indigo-300">[{unseatTarget}]</span> 님을 마이크 자리에서 대기석으로 내리시겠습니까?
              </p>
              <p className="text-[10px] text-slate-400">
                잠수 중이거나 마이크를 켜둔 참가자를 대기실로 안전하게 이동시킵니다. (퇴장되지 않으며 듣기와 채팅은 유지됩니다)
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setUnseatTarget(null)}
                className="flex-1 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-800 text-[11px]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => handleUnseatParticipant(unseatTarget)}
                className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px]"
              >
                대기석으로 내리기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 이용안내 및 개인정보처리방침 모달 */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-4 space-y-3 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 shrink-0">
              <span className="font-bold text-xs text-white flex items-center gap-1.5">
                🛡️ 이용안내 및 개인정보처리방침
              </span>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 text-[11px] text-slate-300 pr-1 leading-relaxed">
              {/* 섹션 1: 서비스 개요 */}
              <div>
                <h4 className="font-bold text-indigo-300 text-xs mb-1">1. 서비스 개요 및 목적</h4>
                <p className="text-slate-400 text-[10px]">
                  본 웹 보이스룸은 2040 카카오톡 오픈채팅방 구성원 간의 자유롭고 편안한 실시간 음성 소통을 위해 제공되는 비영리 통신 매개 플랫폼입니다.
                </p>
              </div>

              {/* 섹션 2: 통신비밀보호법 및 무단 녹음 금지 */}
              <div>
                <h4 className="font-bold text-rose-300 text-xs mb-1">2. 무단 녹음 및 유포 엄격 금지</h4>
                <p className="text-slate-400 text-[10px]">
                  「통신비밀보호법」 제3조 및 제14조에 따라, <strong>대화 참여자 전원의 동의 없는 음성 녹음, 화면 캡처·녹화 및 외부 무단 유포 행위는 법률에 의해 엄격히 금지</strong>됩니다. 위반 시 민·형사상 처벌 대상이 될 수 있습니다.
                </p>
              </div>

              {/* 섹션 3: 건전한 이용 규칙 및 제재 */}
              <div>
                <h4 className="font-bold text-amber-300 text-xs mb-1">3. 건전한 이용 수칙 및 제재 규정</h4>
                <p className="text-slate-400 text-[10px] mb-1">
                  모든 참여자는 서로 존중하며 대화해야 합니다. 아래 행위 적발 시 사전 경고 없이 <strong>강제 퇴장(KICK) 및 접속 차단</strong> 조치가 진행됩니다:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-[9px] text-slate-400 pl-1">
                  <li>성적 수치심을 유발하는 음란·성희롱 발언 (성폭력처벌법 제13조 통매음)</li>
                  <li>욕설, 비하, 패드립, 인신공격, 모욕, 명예훼손 발언</li>
                  <li>개인 신상정보 유포, 금전 요구, 사기, 불법 광고/스팸</li>
                  <li>타인의 원활한 대화를 방해하는 고의적 소음 송출</li>
                </ul>
              </div>

              {/* 섹션 4: 음성 및 사진 미저장 원칙 */}
              <div>
                <h4 className="font-bold text-emerald-300 text-xs mb-1">4. 음성 및 채팅 사진 미저장 원칙 (No-Log)</h4>
                <p className="text-slate-400 text-[10px]">
                  본 서비스는 WebRTC 실시간 미디어 및 데이터 스트리밍 방식을 사용하며, <strong>서버나 DB에 이용자의 음성 대화 내용 및 채팅창 사진을 일체 저장하지 않습니다.</strong> 모든 데이터는 참가자 간 실시간 송수신 후 즉시 메모리에서 영구 소멸하며, 발신자가 보내기 취소를 누르면 참가자 화면에서도 즉시 삭제됩니다.
                </p>
              </div>

              {/* 섹션 5: 개인정보 처리방침 */}
              <div>
                <h4 className="font-bold text-indigo-300 text-xs mb-1">5. 간이 개인정보 처리방침</h4>
                <p className="text-slate-400 text-[10px] mb-1">
                  서비스는 최소한의 기술적 정보만을 임시 처리합니다:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-[9px] text-slate-400 pl-1">
                  <li><strong>수집 항목</strong>: 이용자가 임의 입력한 닉네임, 프로필 이미지, 서비스 접속 IP 로그 (1 IP · 1 닉네임 고정 및 중복 방지용)</li>
                  <li><strong>이용 목적</strong>: 실시간 보이스룸 채널 연결 및 불량/유령 사용자 제재</li>
                  <li><strong>보유 기간</strong>: 음성/채팅/사진 내용은 브라우저 세션 종료 시 즉시 소멸하며 서버나 DB에 영구 보관되지 않습니다.</li>
                </ul>
              </div>

              {/* 섹션 6: 운영자 면책 조항 */}
              <div>
                <h4 className="font-bold text-slate-300 text-xs mb-1">6. 운영자 면책 조항 (Disclaimer)</h4>
                <p className="text-slate-400 text-[10px]">
                  본 서비스는 실시간 통신 매개 공간만을 제공하며, 이용자가 발언하거나 발생시킨 대화 내용, 분쟁, 법적 책임은 전적으로 발언 당사자에게 있습니다. 운영자는 이용자 간의 분쟁으로 발생한 손해에 대해 법적 책임을 지지 않습니다.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
              >
                확인 및 닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("VoiceRoom uncaught render error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="max-w-md w-full bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="text-4xl">✨</div>
            <h2 className="text-base font-bold text-slate-100">2040 웹 보이스룸 복구</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              최신 그래픽 에셋 동기화 중 오류가 감지되었습니다.<br />
              아래 버튼을 누르면 캐시를 정리하고 안전하게 재접속합니다.
            </p>
            <div className="text-[11px] text-slate-400 font-mono bg-black/50 p-2.5 rounded-lg text-left break-all max-h-24 overflow-y-auto">
              {this.state.error?.message || "최신 에셋 동기화 진행"}
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem("voiceroom_active_session");
                    localStorage.removeItem("voiceroom_plaza_skin");
                    localStorage.removeItem("voiceroom_view_mode");
                    sessionStorage.clear();
                  } catch (e) {}
                  window.location.href = window.location.pathname;
                }}
                className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-xs text-white shadow-lg transition"
              >
                대화방 초기화 후 접속
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold text-xs border border-white/10 transition"
              >
                새로고침
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function VoiceRoomPage() {
  return (
    <ErrorBoundary>
      <VoiceRoomContent />
    </ErrorBoundary>
  );
}
