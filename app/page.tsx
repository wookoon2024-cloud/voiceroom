"use client";

import { useState, useEffect, useRef } from "react";
import {
  Room,
  RoomEvent,
  ParticipantEvent,
  Track,
  createLocalAudioTrack,
  LocalAudioTrack,
  setLogLevel,
  LogLevel,
} from "livekit-client";
import {
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
} from "lucide-react";
import { ASMR_LIST, ASMRType, getASMRSynthesizer } from "@/lib/asmr";

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
  isSystem?: boolean;
  imageUrl?: string;
  reactions?: { [emoji: string]: string[] };
  whisperTo?: string;
}

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

export default function VoiceRoomPage() {
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
  const [errorMsg, setErrorMsg] = useState("");

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
  const [showSkinModal, setShowSkinModal] = useState(false);
  const [asmrType, setAsmrType] = useState<ASMRType>("off");
  const asmrTypeRef = useRef<ASMRType>("off");
  const [asmrVolume, setAsmrVolume] = useState<number>(25);
  const asmrVolumeRef = useRef<number>(25);
  const [showAsmrModal, setShowAsmrModal] = useState<boolean>(false);
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
        headers: { "Content-Type": "application/json" },
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

  // ASMR 배경음 선택 및 볼륨 조절 함수 (방 전체 실시간 동기화)
  const selectASMR = async (type: ASMRType) => {
    setAsmrType(type);
    asmrTypeRef.current = type;
    try {
      localStorage.setItem("voiceroom_asmr_type", type);
    } catch (e) {}
    const synth = getASMRSynthesizer();
    synth.setVolume(asmrVolumeRef.current / 100);
    await synth.setType(type);
    await broadcastData({ type: "ROOM_ASMR", asmr: type });
  };

  const handleAsmrVolumeChange = (newVol: number) => {
    setAsmrVolume(newVol);
    asmrVolumeRef.current = newVol;
    try {
      localStorage.setItem("voiceroom_asmr_vol", newVol.toString());
    } catch (e) {}
    getASMRSynthesizer().setVolume(newVol / 100);
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

    const reader = new FileReader();
    reader.onload = (event) => {
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
      img.src = event.target?.result as string;
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

  // 참가자 기기 종류 (ios: 아이폰 / android: 안드로이드 / pc: PC)
  type DeviceType = "ios" | "android" | "pc";
  const detectLocalDevice = (): DeviceType => {
    if (typeof navigator === "undefined") return "pc";
    const ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
      return "ios";
    }
    if (/Android/i.test(ua)) {
      return "android";
    }
    return "pc";
  };

  const myDeviceRef = useRef<DeviceType>(detectLocalDevice());
  const [deviceMap, setDeviceMap] = useState<{ [identity: string]: DeviceType }>({});
  const deviceMapRef = useRef<{ [identity: string]: DeviceType }>({});

  useEffect(() => {
    myDeviceRef.current = detectLocalDevice();
  }, []);

  const updateDeviceStatus = (identity: string, device?: string) => {
    if (!identity || (device !== "ios" && device !== "android" && device !== "pc")) return;
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
      if (parsed?.device === "ios" || parsed?.device === "android" || parsed?.device === "pc") {
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
  const playDingSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
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

  // TTS 음성 재생 (한국어 남성 목소리 우선 선택 및 중저음 피치 적용, URL 링크는 읽지 않음)
  const speakText = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      // URL 링크(http, https, www 등)는 TTS 발화에서 완전히 제외
      const cleaned = text.replace(/(?:https?:\/\/|www\.)[^\s]+/gi, "").trim();
      if (!cleaned) return; // 링크만 있는 경우 발화 생략

      window.speechSynthesis.cancel(); // 이전 발화 취소 후 즉시 재생
      const utter = new SpeechSynthesisUtterance(cleaned);
      utter.lang = "ko-KR";
      utter.rate = 1.0;
      utter.pitch = 0.8; // 남성 중저음 톤

      const voices = window.speechSynthesis.getVoices();
      const koreanVoices = voices.filter(
        (v) => v.lang.includes("ko") || v.lang.includes("KR")
      );
      const maleVoice = koreanVoices.find((v) =>
        /male|남성|injoon|인준|minho|민호|david|seung|jun/i.test(v.name)
      );

      if (maleVoice) {
        utter.voice = maleVoice;
      } else if (koreanVoices.length > 0) {
        utter.voice = koreanVoices[0];
      }

      window.speechSynthesis.speak(utter);
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
    asmr?: ASMRType;
  }) => {
    if (typeof window === "undefined") return;
    if (isUnloadingRef.current) return;
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
    const curAsmr = overrides?.asmr !== undefined ? overrides.asmr : asmrTypeRef.current;

    if (joined && curNick) {
      try {
        const sessionPayload = JSON.stringify({
          isJoined: true,
          room: curRoom,
          nickname: curNick,
          slotIndex: curSlot,
          wasMuted: curMuted,
          skin: curSkin,
          asmr: curAsmr,
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
  }, [isJoined, selectedRoom, cleanNick, mySlotIndex, isMuted, currentSkin, asmrType]);

  // 데이터 브로드캐스트
  const broadcastData = async (payload: any) => {
    if (!roomRef.current) return;
    try {
      const str = JSON.stringify(payload);
      const encoder = new TextEncoder();
      await roomRef.current.localParticipant.publishData(encoder.encode(str), {
        reliable: true,
      });
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

  // 마이크 켜기 (착석 시에만 호출)
  const enableMyMicrophone = async () => {
    if (!roomRef.current || isMicBusyRef.current) return;
    isMicBusyRef.current = true;
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
      if (!roomRef.current) {
        audioTrack.stop();
        return;
      }
      await roomRef.current.localParticipant.publishTrack(audioTrack);
      localTrackRef.current = audioTrack;
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
    } catch (e) {
      console.error("Mic enable error:", e);
    } finally {
      isMicBusyRef.current = false;
    }
  };

  // 마이크 끄기 (대기자 상태로 내려오거나 음소거 시 하드웨어 스트림 완전 정지 -> 초록불 끄기)
  const disableMyMicrophone = async () => {
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
      ...(stagedImg ? { imageUrl: stagedImg } : {}),
      reactions: {},
      ...(whisperTo ? { whisperTo } : {}),
    };

    setMessages((prev) => [...prev, chatItem]);
    setInputText("");
    setPendingChatImage(null);
    pendingChatImageRef.current = null;
    scrollToBottom(true);
    await broadcastData({ type: "CHAT_MESSAGE", chat: chatItem });

    // 내 기기에서도 읽어줌
    if (text && myTTSMode) {
      speakText(text);
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

  // 이미지 파일/클립보드 캡처 이미지를 리사이즈 및 경량화하여 미리보기 대기(stageOnly=true) 또는 즉시 전송 (서버/DB 일체 미저장)
  const processChatImageFile = (file: File | Blob, stageOnly: boolean = false) => {
    if (!file) return;
    setIsUploadingChatImage(true);
    setChatSizeMode((prev) => (prev === "closed" ? "half" : prev));

    const reader = new FileReader();
    reader.onload = (event) => {
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

          if (stageOnly) {
            setPendingChatImage(compressedDataUrl);
            pendingChatImageRef.current = compressedDataUrl;
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
            imageUrl: compressedDataUrl,
            reactions: {},
            ...(whisperTo ? { whisperTo } : {}),
          };

          setMessages((prev) => [...prev, chatItem]);
          scrollToBottom(true);
          broadcastData({ type: "CHAT_MESSAGE", chat: chatItem });
        } catch (err) {
          console.error("Chat image processing failed:", err);
        } finally {
          setIsUploadingChatImage(false);
        }
      };
      img.onerror = () => {
        setIsUploadingChatImage(false);
      };
      img.src = event.target?.result as string;
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
    asmr?: ASMRType;
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
          // 신규 입장자 TTS 알림
          speakText(`${p.identity}님이 들어왔습니다.`);
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
              asmr: asmrTypeRef.current,
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
            const msg = JSON.parse(decoder.decode(payload));
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
                asmr: asmrTypeRef.current,
                topic: roomTopicRef.current,
                nickMap: identityToNickMapRef.current,
                whispers: activeWhispersRef.current,
              });
            } else if (msg.type === "TAKE_SLOT") {
              if (msg.slotIndex !== undefined && msg.identity) {
                updateSlots((prev) => {
                  const next = { ...prev };
                  Object.keys(next).forEach((k) => {
                    if (next[Number(k)] === msg.identity) delete next[Number(k)];
                  });
                  next[Number(msg.slotIndex)] = msg.identity;
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
                  Object.keys(mergedSlots).forEach((k) => {
                    if (mergedSlots[Number(k)] === cleanNickRef.current) {
                      delete mergedSlots[Number(k)];
                    }
                  });
                  mergedSlots[targetMySlot] = cleanNickRef.current;
                  if (msg.slots[targetMySlot] !== cleanNickRef.current) {
                    setTimeout(() => {
                      broadcastData({
                        type: "TAKE_SLOT",
                        slotIndex: targetMySlot,
                        identity: cleanNickRef.current,
                        avatar: avatarMapRef.current[cleanNickRef.current],
                        isMuted: isMutedRef.current,
                        device: myDeviceRef.current,
                      });
                    }, 100);
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
              if (msg.asmr && msg.asmr !== "off" && ASMR_LIST.some((a) => a.id === msg.asmr)) {
                if (msg.asmr !== asmrTypeRef.current) {
                  setAsmrType(msg.asmr);
                  asmrTypeRef.current = msg.asmr;
                  try {
                    localStorage.setItem("voiceroom_asmr_type", msg.asmr);
                  } catch (e) {}
                  const synth = getASMRSynthesizer();
                  synth.setVolume(asmrVolumeRef.current / 100);
                  synth.setType(msg.asmr);
                }
              }
              if (msg.topic && typeof msg.topic === "string") {
                setRoomTopic(msg.topic);
                roomTopicRef.current = msg.topic;
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
            } else if (msg.type === "ROOM_ASMR") {
              // 다른 참가자가 ASMR 배경음을 변경했을 때 방 전체 동기화!
              if (msg.asmr && ASMR_LIST.some((a) => a.id === msg.asmr)) {
                setAsmrType(msg.asmr);
                asmrTypeRef.current = msg.asmr;
                try {
                  localStorage.setItem("voiceroom_asmr_type", msg.asmr);
                } catch (e) {}
                const synth = getASMRSynthesizer();
                synth.setVolume(asmrVolumeRef.current / 100);
                synth.setType(msg.asmr);
              }
            } else if (msg.type === "AVATAR_UPDATE") {
              if (msg.identity && msg.avatar) {
                updateAvatar(msg.identity, msg.avatar);
              }
            } else if (msg.type === "RENAME") {
              const { oldNick, newNick, slots: updatedSlots, nickMap, device } = msg;
              if (oldNick && newNick) {
                registerNickMapping(oldNick, newNick);
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
              scrollToBottom(false);
              // 발신자가 TTS 모드로 보낸 메시지면 수신자 기기에서 음성으로 읽어줌!
              if (msg.chat.isTTS) {
                speakText(msg.chat.text);
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
        .on(RoomEvent.Disconnected, () => {
          if (isUnloadingRef.current) return;
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

      // 저장되어 있던 ASMR 배경음이 켜져 있었다면 재시작
      if (asmrTypeRef.current !== "off") {
        const synth = getASMRSynthesizer();
        synth.setVolume(asmrVolumeRef.current / 100);
        synth.setType(asmrTypeRef.current);
      }

      // 방 접속 후 기존 참가자들에게 현재 슬롯 동기화 요청 및 내 착석 정보 전달
      const syncAfterJoin = () => {
        ensureAllRemoteAudioPlaying();
        broadcastData({
          type: "REQUEST_SLOTS",
          identity: cleanNickRef.current,
          device: myDeviceRef.current,
          nickMap: identityToNickMapRef.current,
        });
        if (mySavedAvatar) {
          broadcastData({
            type: "AVATAR_UPDATE",
            identity: cleanNickRef.current,
            avatar: mySavedAvatar,
          });
        }
        const activeSlot =
          myDesiredSlotRef.current !== null
            ? myDesiredSlotRef.current
            : autoRestore && autoRestore.slotIndex !== null && autoRestore.slotIndex !== undefined
            ? autoRestore.slotIndex
            : null;
        if (activeSlot !== null) {
          updateSlots((prev) => ({ ...prev, [activeSlot]: cleanNickRef.current }));
          updateMuteStatus(cleanNickRef.current, isMutedRef.current);
          updateDeviceStatus(cleanNickRef.current, myDeviceRef.current);
          broadcastData({
            type: "TAKE_SLOT",
            slotIndex: activeSlot,
            identity: cleanNickRef.current,
            avatar: mySavedAvatar || avatarMapRef.current[cleanNickRef.current],
            isMuted: isMutedRef.current,
            device: myDeviceRef.current,
          });
          broadcastData({
            type: "MUTE_STATUS",
            identity: cleanNickRef.current,
            rawIdentity: room.localParticipant.identity,
            isMuted: isMutedRef.current,
          });
        }
      };

      setTimeout(syncAfterJoin, 250);
      if (autoRestore && autoRestore.slotIndex !== null && autoRestore.slotIndex !== undefined) {
        setTimeout(syncAfterJoin, 1500);
      }

      // F5 새로고침 전 발화석에 착석 중이었다면 자동으로 그 자리에 즉시 복귀
      if (autoRestore && autoRestore.slotIndex !== null && autoRestore.slotIndex !== undefined) {
        const restoreIdx = autoRestore.slotIndex;
        myDesiredSlotRef.current = restoreIdx;
        pendingRestoreSlotRef.current = restoreIdx;
        setTimeout(() => {
          pendingRestoreSlotRef.current = null;
        }, 6000);

        const restoredSlots = { ...slotsRef.current, [restoreIdx]: targetNick };
        updateSlots(restoredSlots);

        persistSessionState({
          isJoined: true,
          room: targetRoom,
          nickname: targetNick,
          slotIndex: restoreIdx,
          wasMuted: autoRestore.wasMuted,
        });

        if (!autoRestore.wasMuted) {
          await enableMyMicrophone();
        } else {
          setIsMuted(true);
          isMutedRef.current = true;
          updateMuteStatus(targetNick, true);
        }
      } else {
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
      setErrorMsg(err.message || "보이스룸 접속에 실패했습니다.");
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
    getASMRSynthesizer().stop();
    if (clearSession) {
      setAsmrType("off");
      asmrTypeRef.current = "off";
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

      let initialRoom = "subroom-1";
      if (roomParam && ROOM_OPTIONS.some((r) => r.id === roomParam)) {
        initialRoom = roomParam;
        setSelectedRoom(roomParam);
      }

      let initialNick = "";
      let savedSkin: string | null = null;
      let savedAsmrType: ASMRType | null = null;
      let savedAvatar: string | null = null;
      try {
        savedSkin = localStorage.getItem("voiceroom_skin");
        if (savedSkin && SKINS.some((s) => s.id === savedSkin)) {
          setCurrentSkin(savedSkin);
          currentSkinRef.current = savedSkin;
        }
        savedAsmrType = localStorage.getItem("voiceroom_asmr_type") as ASMRType | null;
        if (savedAsmrType && ASMR_LIST.some((a) => a.id === savedAsmrType)) {
          setAsmrType(savedAsmrType);
          asmrTypeRef.current = savedAsmrType;
        }
        const savedAsmrVol = localStorage.getItem("voiceroom_asmr_vol");
        if (savedAsmrVol) {
          const v = parseInt(savedAsmrVol, 10);
          if (!isNaN(v) && v >= 0 && v <= 100) {
            setAsmrVolume(v);
            asmrVolumeRef.current = v;
            getASMRSynthesizer().setVolume(v / 100);
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
        asmr?: ASMRType;
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
        if (restoreOpts.asmr && ASMR_LIST.some((a) => a.id === restoreOpts.asmr)) {
          setAsmrType(restoreOpts.asmr);
          asmrTypeRef.current = restoreOpts.asmr;
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
          asmr: restoreOpts.asmr,
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
              asmr: parsed.asmr || savedAsmrType || undefined,
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
            asmr: savedAsmrType || undefined,
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
                  asmr: savedAsmrType || undefined,
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

  // 대기자 명단 및 신규 입장 감지 알림음
  // 대기자 명단 (착석자 제외)
  const seatedIdentities = new Set(Object.values(slots));
  const waitingList = allParticipants.filter((id) => !seatedIdentities.has(id));

  const activeSkinObj = isJoined ? SKINS.find((s) => s.id === currentSkin) : null;

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
                onClick={() => setShowSkinModal(true)}
                className="px-2 md:px-3 py-0.5 md:py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-white/10 flex items-center gap-1 text-[10px] md:text-xs"
                title="배경 스킨"
              >
                <Palette className="w-3 h-3 md:w-3.5 md:h-3.5 text-slate-300" />
                <span>스킨</span>
              </button>
            )}
            {isJoined && (
              <button
                type="button"
                onClick={() => setShowAsmrModal(true)}
                className={`px-2 md:px-3 py-0.5 md:py-1 rounded border flex items-center gap-1 text-[10px] md:text-xs transition-all ${
                  asmrType !== "off"
                    ? "bg-amber-500/20 border-amber-400 text-amber-300 font-semibold shadow-sm shadow-amber-500/20"
                    : "bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-white/10"
                }`}
                title="배경음 (ASMR)"
              >
                {asmrType === "fireplace" && <Flame className="w-3 h-3 md:w-3.5 md:h-3.5 text-amber-400 animate-pulse" />}
                {asmrType === "rain" && <CloudRain className="w-3 h-3 md:w-3.5 md:h-3.5 text-sky-400 animate-pulse" />}
                {asmrType === "snow" && <Snowflake className="w-3 h-3 md:w-3.5 md:h-3.5 text-cyan-300 animate-pulse" />}
                {asmrType === "cafe" && <Coffee className="w-3 h-3 md:w-3.5 md:h-3.5 text-amber-300 animate-pulse" />}
                {asmrType === "waves" && <Waves className="w-3 h-3 md:w-3.5 md:h-3.5 text-teal-400 animate-pulse" />}
                {asmrType === "off" && <Music className="w-3 h-3 md:w-3.5 md:h-3.5 text-slate-400" />}
                <span>
                  {asmrType === "off"
                    ? "ASMR"
                    : (ASMR_LIST.find((a) => a.id === asmrType)?.emoji || "🎧") +
                      " " +
                      (ASMR_LIST.find((a) => a.id === asmrType)?.name.replace(" 소리", "") || "ASMR")}
                </span>
              </button>
            )}
            {isJoined && (
              <>
                <button
                  onClick={() => handleLeave(true)}
                  className="px-2 md:px-3 py-0.5 md:py-1 rounded bg-rose-600/85 hover:bg-rose-600 text-white font-medium flex items-center gap-1 text-[10px] md:text-xs"
                >
                  <PhoneOff className="w-2.5 h-2.5 md:w-3.5 md:h-3.5" />
                  <span>나가기</span>
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
        className={`flex-1 overflow-hidden w-full mx-auto p-3 flex flex-col justify-center relative z-10 ${
          isJoined ? "max-w-lg md:max-w-6xl md:px-6 md:py-4" : "max-w-lg"
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
                <span className="text-[10px] md:text-xs text-slate-500">대화방을 터치하세요</span>
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
                      <div className="flex items-center justify-between w-full mb-2">
                        <span className={`font-bold text-sm md:text-base ${isSel ? "text-indigo-200" : "text-slate-200"}`}>
                          {r.name}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] md:text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {count}명
                        </span>
                      </div>
                      <div className={`text-[11px] md:text-xs truncate w-full ${isSel ? "text-slate-300" : "text-slate-500"}`} title={topic}>
                        {topic}
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
              <p className="text-[10px] md:text-xs text-slate-500 mt-1 px-1">
                예: 홍길동/94/서울 (동일 IP에서는 설정한 1개의 닉네임이 자동 유지되며 중복 접속이 방지됩니다)
              </p>
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
              <div className="bg-slate-950/40 border border-white/5 rounded-xl px-3.5 py-2.5 text-slate-400">
                <div className="text-[10px] md:text-xs leading-tight text-slate-400">
                  <span className="text-slate-300 font-semibold">완전 익명 & 암호화 음성/사진 채널</span>
                  <span className="block text-[9px] md:text-[11px] text-slate-500 mt-0.5">음성 및 채팅 사진은 DB나 서버에 절대 남지 않으며 실시간 전송 후 즉시 소멸합니다. (No-Log)</span>
                </div>
              </div>

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
          <div className="flex-1 flex flex-col md:flex-row md:items-stretch justify-start md:justify-between gap-2 md:gap-5 overflow-hidden">
            {/* 좌측 영역 (PC) / 상단 묶음 (모바일): 발화석 + 대기자 명단 */}
            <div className="flex flex-col gap-2 md:gap-3.5 shrink-0 md:w-[46%] lg:w-[45%] md:h-full md:overflow-hidden">
              {/* 귓속말 상태 알림 배너 */}
              {whisperingTo && (
                <div className="bg-slate-900/90 border border-purple-500/50 text-purple-200 px-3 py-1.5 md:py-2 rounded-xl flex items-center justify-between shadow-lg shrink-0">
                  <span className="text-[11px] md:text-xs font-bold flex items-center gap-1.5">
                    {whisperedBy === whisperingTo ? (
                      <>
                        🤫 <span className="text-white">{whisperingTo} &lt;-&gt; 나 상호 귓속말중</span>
                        <span className="text-[9.5px] md:text-[11px] text-purple-300 font-normal">(다른 사람 볼륨 50%)</span>
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
                    className="px-2 md:px-2.5 py-0.5 md:py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/15 font-bold text-[10px] md:text-xs shadow shrink-0"
                  >
                    귓속말 종료
                  </button>
                </div>
              )}

              {whisperedBy && whisperedBy !== whisperingTo && (
                <div className="bg-slate-900/90 border border-purple-500/50 text-purple-200 px-3 py-1.5 md:py-2 rounded-xl flex items-center justify-between shadow-lg shrink-0">
                  <span className="text-[11px] md:text-xs font-bold flex items-center gap-1.5">
                    🤫 <span className="text-white">[{whisperedBy}]</span>님이 나에게 귓속말 중...
                  </span>
                  {isSeated && (
                    <button
                      type="button"
                      onClick={() => handleStartWhisper(whisperedBy)}
                      className="px-2 md:px-2.5 py-0.5 md:py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] md:text-xs shadow shrink-0"
                    >
                      답하기
                    </button>
                  )}
                </div>
              )}

              {/* A. 1~10번 발화석 (1줄당 5개씩 총 2줄, 반투명 글래스) */}
              <div className="bg-slate-900/40 backdrop-blur-sm border border-white/10 rounded-xl p-1.5 md:p-3.5 shrink-0 shadow-lg z-10 relative">
                <div className="flex items-center justify-between mb-1 md:mb-2.5 px-0.5">
                  <span className="text-[11px] md:text-sm font-bold text-slate-200 [text-shadow:_0_1px_2px_rgb(0_0_0_/_80%)]">
                    발화석 (10석)
                  </span>
                  <span className="text-[9.5px] md:text-xs text-slate-400 [text-shadow:_0_1px_2px_rgb(0_0_0_/_80%)]">
                    빈자리 클릭 시 착석 (마이크 ON)
                  </span>
                </div>

                {/* 숨겨진 갤러리 사진 업로드 input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />

                <div className="grid grid-cols-5 gap-1 md:gap-2.5">
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
                    // 내가 A에게 일방 귓속말 시: 나는 보라색 테두리, A는 초록색 테두리 / 상호 귓속말(A도 나에게 귓속말) 시: 둘 다 보라색 테두리
                    const isSlotWhisperHighlighted = isWhisperingFromThis || isMyWhisperSlot;
                    const isSlotGreenHighlighted = !isSlotWhisperHighlighted && (isWhisperingToThis || isSpeaking);

                    return (
                      <div
                        key={idx}
                        onClick={() => !isOccupied && handleTakeSlot(idx)}
                        className={`relative flex flex-col items-center justify-center p-0.5 md:p-1.5 rounded-lg md:rounded-xl transition-all h-14 md:h-24 lg:h-28 min-w-0 ${
                          isOccupied
                            ? isSlotWhisperHighlighted
                              ? "border-2 border-purple-400 bg-slate-800 shadow-md shadow-purple-500/25 ring-2 ring-purple-400/40"
                              : isSlotGreenHighlighted
                              ? "border-2 border-emerald-400 bg-slate-800 shadow-md shadow-emerald-500/25 ring-2 ring-emerald-400/30"
                              : "border border-slate-600/90 bg-slate-800/95 shadow-md"
                            : "border-2 border-dashed border-slate-700/60 bg-slate-950/25 hover:border-slate-500 hover:bg-slate-900/30 cursor-pointer"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 md:top-1 left-1 md:left-1.5 text-[8.5px] md:text-xs font-bold leading-none ${
                            isOccupied ? "text-slate-300 font-extrabold" : "text-slate-500"
                          }`}
                        >
                          {idx + 1}
                        </span>

                        {isOccupied ? (
                          <>
                            <div className="relative mt-0.5 md:mt-1">
                              {customAvatar ? (
                                <img
                                  src={customAvatar}
                                  alt={occupant}
                                  className={`w-5 h-5 md:w-10 md:h-10 lg:w-11 lg:h-11 rounded-full object-cover ${
                                    isSlotWhisperHighlighted
                                      ? "ring-2 ring-purple-400 animate-pulse"
                                      : isSlotGreenHighlighted
                                      ? "ring-2 ring-emerald-400 animate-pulse"
                                      : "ring-1 ring-slate-400"
                                  }`}
                                />
                              ) : (
                                <div
                                  className={`w-5 h-5 md:w-10 md:h-10 lg:w-11 lg:h-11 rounded-full flex items-center justify-center font-bold text-[8px] md:text-xs lg:text-sm ${
                                    isSlotWhisperHighlighted
                                      ? "bg-purple-600 text-white ring-2 ring-purple-400 animate-pulse font-extrabold"
                                      : isSlotGreenHighlighted
                                      ? "bg-emerald-500 text-white ring-2 ring-emerald-400 animate-pulse"
                                      : "bg-slate-700 text-slate-200"
                                  }`}
                                >
                                  {occupant.slice(0, 2)}
                                </div>
                              )}

                              {isMeOnSlot && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    fileInputRef.current?.click();
                                  }}
                                  className="absolute -bottom-1 -right-1 bg-slate-700 hover:bg-slate-600 text-white p-0.5 md:p-1 rounded-full shadow border border-white/20"
                                  title="갤러리 사진 선택"
                                >
                                  <Camera className="w-2 h-2 md:w-3 md:h-3" />
                                </button>
                              )}
                            </div>

                            <div className="flex items-center justify-center gap-0.5 md:gap-1 w-full mt-0.5 md:mt-1.5 px-0.5 min-w-0">
                              {renderDeviceIcon(occupant, "w-2 h-2 md:w-3 md:h-3")}
                              <span className="text-[8px] md:text-xs lg:text-[13px] font-semibold text-slate-100 truncate [text-shadow:_0_1px_2px_rgb(0_0_0_/_90%)]">
                                {occupant}
                              </span>
                            </div>
                            {isUserMuted && (
                              <span className={`absolute top-0.5 md:top-1 ${!isMeOnSlot ? "right-3.5 md:right-6" : "right-0.5 md:right-1"} text-rose-400 drop-shadow`}>
                                <MicOff className="w-2 h-2 md:w-3.5 md:h-3.5" />
                              </span>
                            )}
                            {!isMeOnSlot && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setUnseatTarget(occupant);
                                  }}
                                  className="absolute top-0.5 md:top-1 right-0.5 md:right-1 text-slate-400 hover:text-white p-0.5 md:p-1 rounded bg-slate-900/80 hover:bg-slate-800 border border-white/10 flex items-center justify-center transition-colors"
                                  title="대기석으로 내리기"
                                >
                                  <DownCircleIcon className="w-2 h-2 md:w-3 md:h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isWhisperingToThis) {
                                      handleStopWhisper();
                                    } else {
                                      handleStartWhisper(occupant);
                                    }
                                  }}
                                  className={`absolute bottom-0.5 md:bottom-1 right-0.5 md:right-1 px-0.5 md:px-1 py-0 rounded text-[7px] md:text-[10px] font-bold border flex items-center transition-all shadow-sm ${
                                    isWhisperingToThis || isWhisperingFromThis
                                      ? "bg-purple-600 text-white border-purple-400 animate-pulse font-black"
                                      : "bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border-white/15"
                                  }`}
                                  title={isWhisperingToThis ? "음성 귓속말 종료" : `${occupant}님에게 음성 귓속말`}
                                >
                                  <span>🤫</span>
                                </button>
                              </>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center justify-center text-slate-500 hover:text-slate-400 transition-colors">
                            <span className="text-lg md:text-2xl leading-none font-light">+</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 착석자 제어 패널 */}
                {isSeated && (
                  <div className="mt-2 md:mt-3 pt-1.5 md:pt-2.5 border-t border-white/10 flex items-center justify-between flex-wrap gap-1.5">
                    <div className="flex items-center gap-1.5 md:gap-2">
                      <button
                        onClick={toggleMute}
                        className={`flex items-center gap-1 md:gap-1.5 px-2.5 md:px-3.5 py-1 md:py-1.5 rounded-md md:rounded-lg font-bold text-[11px] md:text-xs lg:text-sm transition-all ${
                          isMuted
                            ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/15"
                            : isMyVoiceActive
                            ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/30 ring-2 ring-emerald-400/50"
                            : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm"
                        }`}
                      >
                        {isMuted ? (
                          <MicOff className="w-3 h-3 md:w-4 md:h-4 text-rose-400" />
                        ) : (
                          <Mic className={`w-3 h-3 md:w-4 md:h-4 text-white ${isMyVoiceActive ? "animate-pulse text-emerald-200" : ""}`} />
                        )}
                        <span>{isMuted ? "마이크 켜기" : "마이크 OFF"}</span>
                      </button>
                      <button
                        onClick={toggleDeafen}
                        className={`p-1 md:p-1.5 rounded-md md:rounded-lg border transition-colors ${
                          isDeafened
                            ? "bg-rose-600 hover:bg-rose-500 text-white border-rose-500"
                            : "bg-slate-800 hover:bg-slate-700 border-white/15 text-slate-300"
                        }`}
                        title="전체 소리 끄기/켜기"
                      >
                        {isDeafened ? <VolumeX className="w-3 h-3 md:w-4 md:h-4" /> : <Volume2 className="w-3 h-3 md:w-4 md:h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1 text-[10px] md:text-xs text-slate-300 hover:text-white px-2 md:px-2.5 py-1 md:py-1.5 rounded md:rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/15 transition-colors"
                        title="갤러리에서 내 아바타 사진 선택"
                      >
                        <Camera className="w-3 h-3 md:w-3.5 md:h-3.5 text-slate-300" />
                        <span>사진</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewNickInput(cleanNick);
                          setNickChangeError("");
                          setShowNickModal(true);
                        }}
                        className="flex items-center gap-1 text-[10px] md:text-xs text-slate-300 hover:text-white px-2 md:px-2.5 py-1 md:py-1.5 rounded md:rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/15 transition-colors"
                        title="닉네임 변경"
                      >
                        <Pencil className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 text-slate-300" />
                        <span>닉변경</span>
                      </button>
                    </div>
                    <button
                      onClick={handleLeaveSlot}
                      className="flex items-center gap-1 text-[10px] md:text-xs text-slate-300 hover:text-rose-300 px-2 md:px-2.5 py-1 md:py-1.5 rounded md:rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/15 transition-colors"
                    >
                      <DownCircleIcon className="w-3 h-3 md:w-3.5 md:h-3.5 text-slate-400" />
                      <span>내려가기</span>
                    </button>
                  </div>
                )}
              </div>

              {/* B. 대기자 명단 (블러 없는 완전 투명 배경) */}
              <div className="bg-transparent border border-white/15 rounded-xl p-2 md:p-3.5 shrink-0 md:flex-1 md:min-h-0 md:flex md:flex-col z-10 relative">
                <div className="flex items-center justify-between mb-1 md:mb-2 px-0.5 shrink-0">
                  <span className="text-[10px] md:text-sm font-bold text-slate-100 [text-shadow:_0_1px_3px_rgb(0_0_0_/_95%)]">
                    대기자 ({waitingList.length}명)
                  </span>
                  {!isSeated && (
                    <span className="text-[9px] md:text-xs text-indigo-300 [text-shadow:_0_1px_3px_rgb(0_0_0_/_95%)] font-medium">
                      상단 빈자리 클릭 시 마이크 켜짐
                    </span>
                  )}
                </div>
                <div className="flex items-center md:items-start gap-1.5 md:gap-2 overflow-x-auto md:overflow-y-auto md:overflow-x-hidden whitespace-nowrap md:whitespace-normal md:flex-wrap md:content-start py-0.5 scrollbar-none">
                  {waitingList.length === 0 ? (
                    <span className="text-[10px] md:text-xs text-slate-200 [text-shadow:_0_1px_3px_rgb(0_0_0_/_95%)]">대기자가 없습니다.</span>
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
                        className={`inline-flex items-center gap-1 px-2 md:px-3 py-0.5 md:py-1 rounded md:rounded-lg text-[10px] md:text-xs lg:text-[13px] border shrink-0 cursor-pointer active:scale-95 transition-all ${
                          id === cleanNick
                            ? "bg-indigo-950/75 border-indigo-400 text-indigo-200 font-bold shadow-sm"
                            : "bg-black/30 border-white/20 text-slate-100 hover:border-rose-400/50 [text-shadow:_0_1px_3px_rgb(0_0_0_/_95%)]"
                        }`}
                        title={id === cleanNick ? "클릭하여 닉네임 변경" : "클릭하여 유령 사용자 정리 / 내보내기"}
                      >
                        {renderDeviceIcon(id, "w-2.5 h-2.5 md:w-3 md:h-3")}
                        <span>{id}</span>
                        {id === cleanNick ? "(나 ✏️)" : <span className="text-[9px] md:text-xs text-slate-300 hover:text-rose-400 ml-0.5">✕</span>}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* 우측 영역 (PC) / 하단 영역 (모바일): 실시간 채팅 & 내 채팅 TTS (블러 없는 투명 배경 + 드롭박스 크기 조절) */}
            <div className="flex-1 min-w-0 min-h-0 md:h-full w-full flex flex-col justify-start z-10 relative overflow-hidden">
              {chatSizeMode === "closed" ? (
                /* 완전 닫힌 상태: 한 줄 투명 바 */
                <div className="w-full min-w-0 overflow-hidden bg-transparent border border-white/20 rounded-xl p-2 md:p-3 shrink-0 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setChatSizeMode("half");
                      setTimeout(() => scrollToBottom(true), 50);
                    }}
                    className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden text-left hover:opacity-90 active:scale-[0.99]"
                  >
                    <MessageSquare className="w-3.5 h-3.5 md:w-4 md:h-4 text-indigo-400 shrink-0" />
                    <span className="font-bold text-[11px] md:text-sm text-slate-100 shrink-0 [text-shadow:_0_1px_3px_rgb(0_0_0_/_95%)]">
                      채팅창
                    </span>
                    <span className="text-[10px] md:text-xs text-indigo-300 font-semibold shrink-0 [text-shadow:_0_1px_3px_rgb(0_0_0_/_95%)]">
                      ({messages.length})
                    </span>
                    {messages.length > 0 ? (
                      <span className="text-[10px] md:text-xs text-slate-200 truncate flex-1 min-w-0 ml-1 [text-shadow:_0_1px_3px_rgb(0_0_0_/_95%)]">
                        {messages[messages.length - 1].isSystem ? (
                          <span className="text-rose-300 font-semibold">{messages[messages.length - 1].text}</span>
                        ) : (
                          <>
                            {messages[messages.length - 1].whisperTo && (
                              <span className="text-fuchsia-300 font-bold mr-1">🤫[귓속말]</span>
                            )}
                            <span className="font-semibold text-indigo-300">{messages[messages.length - 1].sender}:</span>{" "}
                            {messages[messages.length - 1].imageUrl
                              ? (messages[messages.length - 1].text ? `📷 [사진] ${messages[messages.length - 1].text}` : "📷 [사진]")
                              : messages[messages.length - 1].text}
                          </>
                        )}
                      </span>
                    ) : (
                      <span className="text-[10px] md:text-xs text-slate-300 truncate flex-1 min-w-0 ml-1 [text-shadow:_0_1px_3px_rgb(0_0_0_/_95%)]">클릭하여 채팅 열기</span>
                    )}
                  </button>

                  <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                    <label className="flex items-center gap-1 cursor-pointer text-[9px] md:text-xs select-none bg-black/35 border border-white/20 px-1.5 md:px-2.5 py-0.5 md:py-1 rounded-full shrink-0">
                      <input
                        type="checkbox"
                        checked={myTTSMode}
                        onChange={(e) => setMyTTSMode(e.target.checked)}
                        className="rounded bg-slate-800 border-slate-700 text-indigo-500 focus:ring-0 w-2.5 h-2.5 md:w-3.5 md:h-3.5"
                      />
                      <span className={myTTSMode ? "text-indigo-300 font-bold" : "text-slate-300"}>
                        TTS {myTTSMode ? "ON" : "OFF"}
                      </span>
                    </label>
                    <select
                      value={chatSizeMode}
                      onChange={(e) => {
                        const nextMode = e.target.value as "full" | "half" | "closed";
                        setChatSizeMode(nextMode);
                        if (nextMode !== "closed") {
                          setTimeout(() => scrollToBottom(true), 50);
                        }
                      }}
                      className="bg-slate-900/85 hover:bg-slate-800 text-slate-100 border border-white/20 rounded-lg px-2 md:px-2.5 py-0.5 md:py-1 text-[10px] md:text-xs font-semibold focus:outline-none focus:border-indigo-400 cursor-pointer shrink-0"
                      title="채팅창 크기 선택"
                    >
                      <option value="full" className="bg-slate-900 text-white">완전열기</option>
                      <option value="half" className="bg-slate-900 text-white">반열기</option>
                      <option value="closed" className="bg-slate-900 text-white">완전닫기</option>
                    </select>
                  </div>
                </div>
              ) : (
                /* 펼쳐진 채팅창 (full: 전체 열림 / half: 반 정도로 줄임, 블러 없는 완전 투명 배경) */
                <div
                  className={`${
                    chatSizeMode === "half"
                      ? "h-[26dvh] md:h-[48%] shrink-0"
                      : "flex-1 min-h-0 md:h-full"
                  } w-full min-w-0 bg-transparent border border-white/15 rounded-xl p-2 md:p-3.5 flex flex-col overflow-hidden transition-all z-10 relative`}
                >
                  <div className="flex items-center justify-between gap-2 pb-1.5 md:pb-2.5 border-b border-white/15 shrink-0 min-w-0">
                    <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
                      <MessageSquare className="w-3 h-3 md:w-4 md:h-4 text-indigo-400 shrink-0" />
                      <span className="text-[11px] md:text-sm font-bold text-slate-100 shrink-0 [text-shadow:_0_1px_3px_rgb(0_0_0_/_95%)]">채팅창</span>
                      <span className="text-[10px] md:text-xs text-indigo-300 font-semibold ml-0.5 shrink-0 [text-shadow:_0_1px_3px_rgb(0_0_0_/_95%)]">({messages.length})</span>
                    </div>

                    <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                      {/* 내 채팅 TTS 모드 ON/OFF */}
                      <label className="flex items-center gap-1 md:gap-1.5 cursor-pointer text-[9.5px] md:text-xs select-none bg-black/35 border border-white/20 px-2 md:px-3 py-0.5 md:py-1 rounded-full shrink-0">
                        <input
                          type="checkbox"
                          checked={myTTSMode}
                          onChange={(e) => setMyTTSMode(e.target.checked)}
                          className="rounded bg-slate-800 border-slate-700 text-indigo-500 focus:ring-0 w-2.5 h-2.5 md:w-3.5 md:h-3.5"
                        />
                        <span className={myTTSMode ? "text-indigo-300 font-bold" : "text-slate-200"}>
                          TTS {myTTSMode ? "ON" : "OFF"}
                        </span>
                      </label>

                      {/* 채팅창 크기 조절 드롭박스 (완전열기 / 반열기 / 완전닫기) */}
                      <select
                        value={chatSizeMode}
                        onChange={(e) => {
                          const nextMode = e.target.value as "full" | "half" | "closed";
                          setChatSizeMode(nextMode);
                          if (nextMode !== "closed") {
                            setTimeout(() => scrollToBottom(true), 50);
                          }
                        }}
                        className="bg-slate-900/85 hover:bg-slate-800 text-slate-100 border border-white/20 rounded-lg px-2 md:px-2.5 py-0.5 md:py-1 text-[10px] md:text-xs font-semibold focus:outline-none focus:border-indigo-400 cursor-pointer shrink-0"
                        title="채팅창 크기 선택"
                      >
                        <option value="full" className="bg-slate-900 text-white">완전열기</option>
                        <option value="half" className="bg-slate-900 text-white">반열기</option>
                        <option value="closed" className="bg-slate-900 text-white">완전닫기</option>
                      </select>
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
                    if (e.key === "Escape" && pendingChatImage) {
                      e.preventDefault();
                      setPendingChatImage(null);
                      pendingChatImageRef.current = null;
                      return;
                    }
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      sendMessage();
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
              )}
            </div>
          </div>
        )}
      </main>

      {/* 채팅 이미지 확대 모달 (좌우 이전/다음 사진 넘기기 및 스와이프 지원) */}
      {selectedChatImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-3"
          onClick={() => setSelectedChatImage(null)}
          onTouchStart={(e) => {
            lightboxTouchStartXRef.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            if (lightboxTouchStartXRef.current === null) return;
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
            className="relative max-w-lg max-h-[90vh] w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 상단 바: 보낸 사람 정보 / 사진 삭제 / 닫기 */}
            <div className="w-full flex items-center justify-between pb-2 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {currentImageIndex >= 0 && imageMessages[currentImageIndex] && (
                  <span className="text-xs font-bold text-indigo-200 bg-slate-900/80 border border-white/10 px-2.5 py-1 rounded-full truncate">
                    📷 {imageMessages[currentImageIndex].sender} ({imageMessages[currentImageIndex].time})
                    {imageMessages.length > 1 && ` · ${currentImageIndex + 1} / ${imageMessages.length}`}
                  </span>
                )}
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
            <div className="relative w-full flex items-center justify-center">
              {currentImageIndex > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goPrevImage();
                  }}
                  className="absolute left-1 sm:left-2 z-20 p-2 rounded-full bg-slate-900/85 hover:bg-indigo-600 text-white border border-white/20 shadow-xl active:scale-95 transition-all"
                  title="이전 사진 (←)"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}

              <img
                src={selectedChatImage}
                alt="확대 사진"
                className="max-h-[72vh] max-w-full rounded-xl object-contain shadow-2xl border border-white/15 select-none"
              />

              {currentImageIndex >= 0 && currentImageIndex < imageMessages.length - 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goNextImage();
                  }}
                  className="absolute right-1 sm:right-2 z-20 p-2 rounded-full bg-slate-900/85 hover:bg-indigo-600 text-white border border-white/20 shadow-xl active:scale-95 transition-all"
                  title="다음 사진 (→)"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* 하단 이전/다음 네비게이션 컨트롤 */}
            {imageMessages.length > 1 && (
              <div className="mt-3 flex items-center gap-3 bg-slate-900/85 border border-white/15 px-4 py-1.5 rounded-full shadow-lg">
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

            <div className="mt-2 text-center text-[11px] text-slate-400">
              {imageMessages.length > 1
                ? "좌우 버튼이나 스와이프로 이전·다음 사진을 볼 수 있습니다."
                : "사진을 닫으려면 배경을 터치하거나 ✕ 버튼을 누르세요."}
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

      {/* 배경 스킨 선택 모달 */}
      {showSkinModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xs w-full p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-xs text-white flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-pink-400" />
                배경 스킨 선택
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
              {SKINS.map((s) => {
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

      {/* 배경음 (ASMR) 선택 모달 */}
      {showAsmrModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xs w-full p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-xs text-white flex items-center gap-1.5">
                <Headphones className="w-3.5 h-3.5 text-amber-400" />
                배경음 (ASMR) 설정
              </span>
              <button
                type="button"
                onClick={() => setShowAsmrModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* 볼륨 조절 슬라이더 */}
            <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 flex items-center gap-1 font-medium">
                  <Volume2 className="w-3 h-3 text-amber-400" />
                  배경음 볼륨
                </span>
                <span className="font-bold text-amber-300 font-mono text-[11px]">
                  {asmrVolume}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={asmrVolume}
                onChange={(e) => handleAsmrVolumeChange(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="text-[9.5px] text-slate-400 leading-tight">
                방 전체에 같은 배경음이 공유되며, 볼륨은 내 기기에서 자유롭게 조절할 수 있어요.
              </div>
            </div>

            {/* 사운드 선택 목록 */}
            <div className="grid grid-cols-1 gap-1.5 max-h-[50vh] overflow-y-auto pr-1">
              {ASMR_LIST.map((item) => {
                const isSel = asmrType === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectASMR(item.id)}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${
                      isSel
                        ? "bg-amber-500/15 border-amber-500/80 text-white shadow-sm shadow-amber-500/20"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <span className="text-2xl shrink-0">{item.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs flex items-center justify-between">
                        <span className={isSel ? "text-amber-300" : "text-slate-200"}>
                          {item.name}
                        </span>
                        <div className="flex items-center gap-1">
                          {item.badge && item.id !== "off" && (
                            <span
                              className={`text-[9px] px-1 py-0.2 rounded font-medium ${
                                isSel
                                  ? "bg-amber-400/20 text-amber-300"
                                  : "bg-slate-800 text-slate-400"
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                          {isSel && (
                            <span className="text-[10px] text-amber-400 font-semibold ml-1">
                              ● 재생 중
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

            <button
              type="button"
              onClick={() => setShowAsmrModal(false)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-medium transition-colors"
            >
              닫기
            </button>
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
