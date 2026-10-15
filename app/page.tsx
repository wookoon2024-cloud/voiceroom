"use client";

import { useState, useEffect, useRef } from "react";
import {
  Room,
  RoomEvent,
  ParticipantEvent,
  Track,
  createLocalAudioTrack,
  LocalAudioTrack,
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
  ArrowDownCircle,
  Radio,
  Speaker,
  Headphones,
  Pencil,
  Palette,
  Camera,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

interface ChatItem {
  id: string;
  sender: string;
  text: string;
  time: string;
  isTTS?: boolean;
  isSystem?: boolean;
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
    { id: "cafe", name: "프린스 카페", icon: "☕", desc: "설레는 꽃미남 집사 카페", bg: "/skins/cafe.jpg" },
    { id: "rain", name: "비 오는 날 우산", icon: "☔", desc: "설레는 한 우산 아래", bg: "/skins/rain.jpg" },
    { id: "library", name: "노을빛 도서관", icon: "📚", desc: "속삭이는 스터디 데이트", bg: "/skins/library.jpg" },
    { id: "pool", name: "별빛 루프탑 라운지", icon: "✨", desc: "도심 야경 속 낭만 데이트", bg: "/skins/pool.jpg" },
    { id: "onsen", name: "온천 남탕", icon: "♨️", desc: "귀여운 일본 온천", bg: "/skins/onsen.jpg" },
  ];
  const [currentSkin, setCurrentSkin] = useState<string>("default");
  const currentSkinRef = useRef<string>("default");
  const [showSkinModal, setShowSkinModal] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(true);
  const [isChatCollapsed, setIsChatCollapsed] = useState(true);

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

  // 오디오 출력 장치 (스피커/이어폰/블루투스)
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>("");

  // 사람별 개별 볼륨 ({ [identity]: 0 ~ 100 }) 및 전체 수신 마스터 볼륨 (0 ~ 150)
  const [volumeMap, setVolumeMap] = useState<{ [identity: string]: number }>({});
  const [masterVolume, setMasterVolume] = useState<number>(100);
  const masterVolumeRef = useRef<number>(100);
  const [showVolumeModal, setShowVolumeModal] = useState(false);

  // 참여자 목록 (전체)
  const [allParticipants, setAllParticipants] = useState<string[]>([]);

  // 채팅 상태
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [inputText, setInputText] = useState("");
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const roomRef = useRef<Room | null>(null);
  const localTrackRef = useRef<LocalAudioTrack | null>(null);
  const audioElementsRef = useRef<{ [identity: string]: HTMLAudioElement }>({});
  const wakeLockRef = useRef<any>(null);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);

  // 귓속말 상태 (내가 귓속말 중인 대상 / 나에게 귓속말 중인 발신자)
  const [whisperingTo, setWhisperingTo] = useState<string | null>(null);
  const [whisperedBy, setWhisperedBy] = useState<string | null>(null);
  const activeWhispersRef = useRef<{ [fromNick: string]: string }>({});

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

  // 탭 닫기/새로고침 시 마이크 하드웨어 트랙 및 룸 즉시 해제 (초록불 방지)
  useEffect(() => {
    const handleBeforeUnload = () => {
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

  // 모바일 브라우저(삼성인터넷, 크롬 등) 상단 주소창/하단 툴바/키보드 높이 동적 계산
  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateHeight = () => {
      const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      document.documentElement.style.setProperty("--app-height", `${vh}px`);
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    window.addEventListener("orientationchange", updateHeight);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateHeight);
      window.visualViewport.addEventListener("scroll", updateHeight);
    }
    return () => {
      window.removeEventListener("resize", updateHeight);
      window.removeEventListener("orientationchange", updateHeight);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", updateHeight);
        window.visualViewport.removeEventListener("scroll", updateHeight);
      }
    };
  }, []);

  // URL 파라미터 파싱 및 기본 랜덤 닉네임 설정 & 저장된 스킨 불러오기
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get("room");
      const nickParam = params.get("nick") || params.get("nickname");
      if (roomParam && ROOM_OPTIONS.some((r) => r.id === roomParam)) {
        setSelectedRoom(roomParam);
      }
      if (nickParam) {
        setNickname(nickParam);
      } else {
        setNickname(generateRandomNickname());
      }
      try {
        const savedSkin = localStorage.getItem("voiceroom_skin");
        if (savedSkin && SKINS.some((s) => s.id === savedSkin)) {
          setCurrentSkin(savedSkin);
        }
      } catch (e) {}
    }
  }, []);

  const cleanNick = nickname.trim();
  const mySlotIndex = Object.keys(slots).find(
    (idx) => slots[Number(idx)] === cleanNick
  );
  const isSeated = mySlotIndex !== undefined;

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

    // 아바타 사진도 새 닉네임으로 이전
    if (avatarMapRef.current[oldNick]) {
      updateAvatar(trimmed, avatarMapRef.current[oldNick]);
    }

    setAllParticipants((prev) =>
      prev.map((id) => (id === oldNick ? trimmed : id))
    );

    // 방 전체에 닉네임 변경 및 슬롯 동기화 브로드캐스트
    await broadcastData({
      type: "RENAME",
      oldNick,
      newNick: trimmed,
      slots: wasSeated ? nextSlots : undefined,
    });

    setShowNickModal(false);
  };

  // 슬롯 착석
  const handleTakeSlot = async (slotIdx: number) => {
    if (slotsRef.current[slotIdx]) return;
    const wasAlreadySeated = Object.values(slotsRef.current).includes(cleanNick);
    const nextSlots = { ...slotsRef.current };
    Object.keys(nextSlots).forEach((k) => {
      if (nextSlots[Number(k)] === cleanNick) {
        delete nextSlots[Number(k)];
      }
    });
    nextSlots[slotIdx] = cleanNick;
    updateSlots(nextSlots);
    await broadcastData({
      type: "SYNC_SLOTS",
      slots: nextSlots,
      avatars: avatarMapRef.current,
    });
    // 이미 착석 중이던 사용자가 자리만 옮긴 경우: 마이크를 재시작하지 않고 자리만 이동
    if (!wasAlreadySeated) {
      await enableMyMicrophone();
    }
  };

  // 슬롯 내려오기
  const handleLeaveSlot = async () => {
    if (whisperingTo) {
      await handleStopWhisper();
    }
    const nextSlots = { ...slotsRef.current };
    Object.keys(nextSlots).forEach((k) => {
      if (nextSlots[Number(k)] === cleanNick) {
        delete nextSlots[Number(k)];
      }
    });
    updateSlots(nextSlots);
    await broadcastData({
      type: "SYNC_SLOTS",
      slots: nextSlots,
      avatars: avatarMapRef.current,
    });
    await disableMyMicrophone();
  };

  // 마이크 켜기 (착석 시에만 호출)
  const enableMyMicrophone = async () => {
    if (!roomRef.current) return;
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
      await roomRef.current.localParticipant.publishTrack(audioTrack);
      localTrackRef.current = audioTrack;
      setIsMuted(false);
      setMuteMap((prev) => ({ ...prev, [cleanNick]: false }));
      broadcastData({ type: "MUTE_STATUS", identity: cleanNick, isMuted: false });
    } catch (e) {
      console.error("Mic enable error:", e);
    }
  };

  // 마이크 끄기 (대기자 상태로 내려오거나 음소거 시 하드웨어 스트림 완전 정지 -> 초록불 끄기)
  const disableMyMicrophone = async () => {
    if (!roomRef.current) return;
    try {
      if (localTrackRef.current) {
        await roomRef.current.localParticipant.unpublishTrack(localTrackRef.current);
        localTrackRef.current.stop(); // 하드웨어 마이크 스트림 완전 정지 -> 초록불 꺼짐
        localTrackRef.current = null;
      }
      setIsMuted(true);
      setMuteMap((prev) => ({ ...prev, [cleanNick]: true }));
      broadcastData({ type: "MUTE_STATUS", identity: cleanNick, isMuted: true });
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
    Object.values(audioElementsRef.current).forEach((el) => {
      el.muted = next;
    });
  };

  // 마스터 볼륨 조절 (0% ~ 150%)
  const handleMasterVolumeChange = (val: number) => {
    setMasterVolume(val);
    masterVolumeRef.current = val;
    Object.entries(audioElementsRef.current).forEach(([id, el]) => {
      const userVol = volumeMap[id] ?? 100;
      el.volume = Math.max(0, Math.min(1, (userVol / 100) * (val / 100)));
    });
  };

  // 사람별 볼륨 조절
  const handleVolumeChange = (identity: string, val: number) => {
    setVolumeMap((prev) => ({ ...prev, [identity]: val }));
    const el = audioElementsRef.current[identity];
    if (el) {
      el.volume = Math.max(0, Math.min(1, (val / 100) * (masterVolumeRef.current / 100)));
    }
  };

  // 귓속말 시작 (해당 참가자에게만 내 목소리가 들리도록 활성화)
  const handleStartWhisper = async (targetNick: string) => {
    if (!isSeated) {
      alert("귓속말을 하려면 먼저 마이크 자리에 착석해야 합니다.");
      return;
    }
    if (targetNick === cleanNick) return;

    setWhisperingTo(targetNick);
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;

    const sysMsg: ChatItem = {
      id: `whisper-${Date.now()}`,
      sender: "시스템",
      text: `🤫 [${targetNick}]님에게 귓속말을 시작했습니다. (다른 사람에게는 내 목소리가 들리지 않습니다)`,
      time: timeStr,
      isSystem: true,
    };
    setMessages((prev) => [...prev, sysMsg]);

    await broadcastData({
      type: "WHISPER_START",
      from: cleanNick,
      to: targetNick,
    });
  };

  // 귓속말 종료 (모든 사람이 다시 내 목소리를 들을 수 있음)
  const handleStopWhisper = async () => {
    if (!whisperingTo) return;
    const prevTarget = whisperingTo;
    setWhisperingTo(null);

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

    await broadcastData({
      type: "WHISPER_END",
      from: cleanNick,
      to: prevTarget,
    });
  };

  // 채팅 전송 (내가 TTS 모드이면 isTTS: true로 전송하여 모든 사람에게 소리로 읽어줌)
  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text) return;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;

    const chatItem: ChatItem = {
      id: Math.random().toString(),
      sender: cleanNick,
      text,
      time: timeStr,
      isTTS: myTTSMode,
    };

    setMessages((prev) => [...prev, chatItem]);
    setInputText("");
    await broadcastData({ type: "CHAT_MESSAGE", chat: chatItem });

    // 내 기기에서도 읽어줌
    if (myTTSMode) {
      speakText(text);
    }
  };

  // 룸 입장
  const joinRoom = async () => {
    if (!cleanNick) {
      setErrorMsg("닉네임을 입력해 주세요.");
      return;
    }
    setErrorMsg("");
    setIsLoading(true);

    try {
      const res = await fetch(
        `/api/token?room=${encodeURIComponent(
          selectedRoom
        )}&username=${encodeURIComponent(cleanNick)}`
      );
      const data = await res.json();
      if (!res.ok || !data.token) {
        throw new Error(data.error || "토큰 발급 실패");
      }

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      room
        .on(RoomEvent.ParticipantConnected, (p) => {
          p.on(ParticipantEvent.IsSpeakingChanged, (speaking: boolean) => {
            setSpeakingMap((prev) => ({ ...prev, [p.identity]: speaking }));
          });
          setAllParticipants((prev) => {
            const updated = Array.from(new Set([...prev, p.identity]));
            return updated;
          });
          playDingSound();
          // 신규 입장자 TTS 알림
          speakText(`${p.identity}님이 들어왔습니다.`);
          // 기존에 착석자 또는 스킨/주제가 설정되어 있을 때 신규 참여자에게 전체 정보 전달
          broadcastData({
            type: "SYNC_SLOTS",
            slots: slotsRef.current,
            avatars: avatarMapRef.current,
            skin: currentSkinRef.current,
            topic: roomTopicRef.current,
          });
        })
        .on(RoomEvent.ParticipantDisconnected, (p) => {
          delete activeWhispersRef.current[p.identity];
          setWhisperedBy((prev) => (prev === p.identity ? null : prev));
          setWhisperingTo((prev) => (prev === p.identity ? null : prev));
          setAllParticipants((prev) => prev.filter((id) => id !== p.identity));
          updateSlots((prev) => {
            const next = { ...prev };
            Object.keys(next).forEach((k) => {
              if (next[Number(k)] === p.identity) delete next[Number(k)];
            });
            return next;
          });
        })
        .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          setSpeakingMap((prev) => {
            const map: { [identity: string]: boolean } = {};
            speakers.forEach((s) => {
              map[s.identity] = true;
            });
            if (roomRef.current?.localParticipant?.isSpeaking) {
              map[cleanNick] = true;
            }
            return map;
          });
        })
        .on(RoomEvent.TrackSubscribed, (track: Track, pub, participant) => {
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach();
            audioElementsRef.current[participant.identity] = el;
            const currentVol = volumeMap[participant.identity] ?? 100;
            el.volume = Math.max(0, Math.min(1, (currentVol / 100) * (masterVolumeRef.current / 100)));
            const isWhisperingOther =
              Boolean(activeWhispersRef.current[participant.identity]) &&
              activeWhispersRef.current[participant.identity] !== cleanNick;
            el.muted = isDeafened || isWhisperingOther;
            if (selectedAudioDevice && "setSinkId" in el) {
              (el as any).setSinkId(selectedAudioDevice).catch(() => {});
            }
            document.body.appendChild(el);
          }
        })
        .on(RoomEvent.TrackUnsubscribed, (track: Track, pub, participant) => {
          track.detach().forEach((el) => el.remove());
          delete audioElementsRef.current[participant.identity];
        })
        .on(RoomEvent.DataReceived, (payload: Uint8Array, participant) => {
          try {
            const decoder = new TextDecoder();
            const msg = JSON.parse(decoder.decode(payload));
            if (msg.type === "REQUEST_SLOTS") {
              // 신규 참가자의 동기화 요청 -> 현재 방 슬롯, 아바타, 스킨, 주제 정보 전달
              broadcastData({
                type: "SYNC_SLOTS",
                slots: slotsRef.current,
                avatars: avatarMapRef.current,
                skin: currentSkinRef.current,
                topic: roomTopicRef.current,
              });
            } else if (msg.type === "SYNC_SLOTS") {
              if (msg.slots && Object.keys(msg.slots).length > 0) {
                updateSlots(msg.slots);
              }
              if (msg.avatars && typeof msg.avatars === "object") {
                setAvatarMap((prev) => {
                  const next = { ...prev, ...msg.avatars };
                  avatarMapRef.current = next;
                  return next;
                });
              }
              if (msg.skin && SKINS.some((s) => s.id === msg.skin)) {
                setCurrentSkin(msg.skin);
                currentSkinRef.current = msg.skin;
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
              }
            } else if (msg.type === "AVATAR_UPDATE") {
              if (msg.identity && msg.avatar) {
                updateAvatar(msg.identity, msg.avatar);
              }
            } else if (msg.type === "RENAME") {
              const { oldNick, newNick, slots: updatedSlots } = msg;
              if (oldNick && newNick) {
                if (avatarMapRef.current[oldNick]) {
                  updateAvatar(newNick, avatarMapRef.current[oldNick]);
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
            } else if (msg.type === "MUTE_STATUS") {
              setMuteMap((prev) => ({
                ...prev,
                [msg.identity]: msg.isMuted,
              }));
            } else if (msg.type === "CHAT_MESSAGE") {
              setMessages((prev) => [...prev, msg.chat]);
              // 발신자가 TTS 모드로 보낸 메시지면 수신자 기기에서 음성으로 읽어줌!
              if (msg.chat.isTTS) {
                speakText(msg.chat.text);
              }
            } else if (msg.type === "KICK_USER") {
              if (msg.chat) {
                setMessages((prev) => [...prev, msg.chat]);
              }
              if (msg.identity) {
                if (msg.identity === cleanNick) {
                  handleLeave();
                } else {
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
              if (msg.slots) {
                updateSlots(msg.slots);
              } else if (msg.identity) {
                updateSlots((prev) => {
                  const next = { ...prev };
                  Object.keys(next).forEach((k) => {
                    if (next[Number(k)] === msg.identity) delete next[Number(k)];
                  });
                  return next;
                });
              }
              if (msg.identity === cleanNick) {
                // 내가 마이크 자리에서 내려졌을 때 마이크 끄기
                disableMyMicrophone();
              }
            } else if (msg.type === "WHISPER_START") {
              const { from, to } = msg;
              if (from && to) {
                activeWhispersRef.current[from] = to;
                if (cleanNick === to) {
                  // 내가 귓속말 수신 대상인 경우: 발신자 음성은 정상 청취
                  setWhisperedBy(from);
                  if (audioElementsRef.current[from]) {
                    audioElementsRef.current[from].muted = isDeafened;
                  }
                } else if (cleanNick !== from) {
                  // 제3자인 경우: 발신자의 음성을 음소거하여 귓속말 비밀 보장
                  if (audioElementsRef.current[from]) {
                    audioElementsRef.current[from].muted = true;
                  }
                }
              }
            } else if (msg.type === "WHISPER_END") {
              const { from } = msg;
              if (from) {
                delete activeWhispersRef.current[from];
                setWhisperedBy((prev) => (prev === from ? null : prev));
                if (audioElementsRef.current[from]) {
                  audioElementsRef.current[from].muted = isDeafened;
                }
              }
            }
          } catch (e) {}
        })
        .on(RoomEvent.Disconnected, () => {
          handleLeave();
        });

      await room.connect(data.wsUrl, data.token);
      roomRef.current = room;

      // 로컬 및 기존 참가자 발화 감지 이벤트 연결
      room.localParticipant.on(ParticipantEvent.IsSpeakingChanged, (speaking: boolean) => {
        setSpeakingMap((prev) => ({ ...prev, [cleanNick]: speaking }));
      });
      room.remoteParticipants.forEach((p) => {
        p.on(ParticipantEvent.IsSpeakingChanged, (speaking: boolean) => {
          setSpeakingMap((prev) => ({ ...prev, [p.identity]: speaking }));
        });
      });

      const initialParts: string[] = [cleanNick];
      room.remoteParticipants.forEach((p) => initialParts.push(p.identity));
      setAllParticipants(Array.from(new Set(initialParts)));

      setIsJoined(true);
      setIsMuted(true);
      requestWakeLock();
      startBackgroundAudioKeepalive();
      loadAudioDevices();

      // 방 접속 후 기존 참가자들에게 현재 슬롯 동기화 요청
      setTimeout(() => {
        broadcastData({ type: "REQUEST_SLOTS" });
      }, 600);
    } catch (err: any) {
      setErrorMsg(err.message || "보이스룸 접속에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeave = async () => {
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
    setIsJoined(false);
    updateSlots({});
    setMessages([]);
    setAllParticipants([]);
    setRoomTopic("소그룹 대화");
    roomTopicRef.current = "소그룹 대화";
  };

  // 자동 스크롤
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    } else if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 대기자 명단 및 신규 입장 감지 알림음
  // 대기자 명단 (착석자 제외)
  const seatedIdentities = new Set(Object.values(slots));
  const waitingList = allParticipants.filter((id) => !seatedIdentities.has(id));

  const activeSkinObj = isJoined ? SKINS.find((s) => s.id === currentSkin) : null;

  return (
    <div
      style={{
        height: "var(--app-height, 100dvh)",
        maxHeight: "var(--app-height, 100dvh)",
        backgroundImage: activeSkinObj?.bg ? `url(${activeSkinObj.bg})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      className="fixed inset-0 w-full overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans text-xs select-none relative"
    >
      {/* 배경 스킨 은은한 오버레이 (블러 제거하여 원본 그림 선명하게 노출) */}
      {activeSkinObj?.bg && (
        <div className="absolute inset-0 bg-black/25 pointer-events-none z-0" />
      )}

      {/* 1. 상단 헤더 (기본 접힘, 펼치면 아랫줄에 출력/볼륨 등장) */}
      <header className="border-b border-white/10 bg-slate-950/75 backdrop-blur-md px-3 py-1.5 shrink-0 z-20 relative flex flex-col gap-1.5 transition-all">
        {/* 1번째 줄: 접혀있거나 펼쳐져있거나 항상 동일한 레이아웃 (화면 깨짐 방지) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-slate-200 text-[11px] min-w-0 mr-1">
            <Radio className="w-3.5 h-3.5 text-indigo-400 animate-pulse shrink-0" />
            <span className="shrink-0 text-white font-bold">2040</span>
            {isJoined ? (
              <span
                className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-semibold truncate max-w-[110px] border border-white/10"
                title={roomTopic}
              >
                {roomTopic}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 font-normal">보이스룸</span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isJoined && (
              <button
                type="button"
                onClick={() => setShowSkinModal(true)}
                className="px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-white/10 flex items-center gap-1 text-[10px]"
                title="배경 스킨"
              >
                <Palette className="w-3 h-3 text-slate-300" />
                <span>스킨</span>
              </button>
            )}
            {isJoined && (
              <>
                <button
                  onClick={handleLeave}
                  className="px-2 py-0.5 rounded bg-rose-600/85 hover:bg-rose-600 text-white font-medium flex items-center gap-1 text-[10px]"
                >
                  <PhoneOff className="w-2.5 h-2.5" />
                  <span>나가기</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsHeaderCollapsed((prev) => !prev)}
                  className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-white/10"
                  title={isHeaderCollapsed ? "방 설정 펼치기" : "방 설정 접기"}
                >
                  {isHeaderCollapsed ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronUp className="w-3 h-3" />
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* 2번째 줄: 펼쳤을 때 방 주제 변경 및 오디오 출력 장치/볼륨 표시 */}
        {isJoined && !isHeaderCollapsed && (
          <div className="pt-1.5 border-t border-white/10 space-y-1.5 text-[10px]">
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
                className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 font-medium shrink-0"
                title="방 주제 변경"
              >
                <Pencil className="w-3 h-3 text-slate-300" />
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
                    className="bg-slate-800 text-[10px] text-slate-200 border border-white/10 rounded px-1.5 py-0.5 focus:outline-none max-w-[130px] truncate"
                    title="출력 장치 선택"
                  >
                    {audioDevices.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId}>
                        {d.label
                          ? d.label.length > 12
                            ? d.label.slice(0, 12) + ".."
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
                className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 font-medium shrink-0"
                title="볼륨 조절"
              >
                <Sliders className="w-3 h-3 text-slate-300" />
                <span>개별 볼륨</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 2. 메인 컨텐츠 (모바일 세로 100% 꽉 채우기 - 스크롤 없음) */}
      <main className="flex-1 overflow-hidden max-w-lg w-full mx-auto p-3 flex flex-col justify-center relative z-10">
        {!isJoined ? (
          /* ================= 입장 화면 (모던 글래스모피즘) ================= */
          <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4 my-auto max-h-full overflow-y-auto shadow-2xl shadow-black/80 relative">
            {/* 카드 상단 로고 & 타이틀 */}
            <div className="text-center pb-0.5">
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-2 shadow-inner">
                <Radio className="w-5 h-5 text-indigo-400 animate-pulse" />
              </div>
              <h1 className="text-sm font-bold text-white tracking-tight">2040 웹 보이스룸</h1>
              <p className="text-[11px] text-slate-400 mt-0.5">자유롭게 참여하는 실시간 음성 채널</p>
            </div>

            {/* 채널 선택 */}
            <div>
              <div className="flex items-center justify-between mb-2 px-0.5">
                <span className="text-[11px] font-semibold text-slate-300">채널 선택</span>
                <span className="text-[10px] text-slate-500">대화방을 터치하세요</span>
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
                      className={`p-3 rounded-xl border text-left transition-all relative ${
                        isSel
                          ? "bg-indigo-950/40 border-indigo-500/80 text-white shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500/30"
                          : "bg-slate-950/40 border-white/5 text-slate-400 hover:border-white/15 hover:bg-slate-950/60"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-bold text-xs ${isSel ? "text-indigo-200" : "text-slate-200"}`}>
                          {r.name}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {count}명
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate" title={topic}>
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
                <span className="text-[11px] font-semibold text-slate-300">닉네임</span>
                <button
                  type="button"
                  onClick={() => setNickname(generateRandomNickname())}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium active:scale-95 flex items-center gap-1 transition-colors"
                >
                  <span>🎲</span>
                  <span>랜덤 재추첨</span>
                </button>
              </div>
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="카톡 닉네임 (닉/나이/지역)"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={25}
                  className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/40 transition-all"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1 px-1">예: 홍길동/94/서울, 피치 89 경기</p>
            </div>

            {errorMsg && (
              <div className="text-[11px] text-rose-400 bg-rose-950/30 border border-rose-800/40 p-2.5 rounded-xl">
                {errorMsg}
              </div>
            )}

            {/* 입장하기 버튼 */}
            <button
              type="button"
              onClick={joinRoom}
              disabled={isLoading}
              className="w-full py-3 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/35 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span>접속 중...</span>
              ) : (
                <>
                  <Headphones className="w-3.5 h-3.5" />
                  <span>보이스룸 입장하기</span>
                </>
              )}
            </button>

            {/* 안전 고지 배너 & 약관 링크 */}
            <div className="pt-2 border-t border-white/5 space-y-2 text-[10px]">
              <div className="flex items-center gap-2.5 bg-slate-950/40 border border-white/5 rounded-xl px-3 py-2 text-slate-400">
                <span className="text-base shrink-0">🛡️</span>
                <div className="text-[10px] leading-tight text-slate-400">
                  <span className="text-slate-300 font-semibold">완전 익명 & 암호화 음성 채널</span>
                  <span className="block text-[9px] text-slate-500 mt-0.5">대화 내용은 서버에 절대 녹음·저장되지 않습니다. (No-Log)</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 text-[10px] text-slate-500 pt-0.5">
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
          /* ================= 방 내부 UI (상단 슬롯 + 대기자 + 하단 접이식 채팅창) ================= */
          <div className="flex-1 flex flex-col justify-between gap-2 overflow-hidden">
            {/* 상단 묶음: 발화석 + 대기자 명단 */}
            <div className="flex flex-col gap-2 shrink-0">
              {/* 귓속말 상태 알림 배너 */}
              {whisperingTo && (
                <div className="bg-slate-900/90 border border-indigo-500/40 text-indigo-200 px-3 py-1.5 rounded-xl flex items-center justify-between shadow-lg shrink-0">
                  <span className="text-[11px] font-bold flex items-center gap-1.5">
                    🤫 <span className="text-white">[{whisperingTo}]</span>님에게 귓속말 중 (비밀 대화)
                  </span>
                  <button
                    type="button"
                    onClick={handleStopWhisper}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/15 font-bold text-[10px] shadow"
                  >
                    귓속말 종료
                  </button>
                </div>
              )}

              {whisperedBy && !whisperingTo && (
                <div className="bg-slate-900/90 border border-indigo-500/40 text-indigo-200 px-3 py-1.5 rounded-xl flex items-center justify-between shadow-lg shrink-0">
                  <span className="text-[11px] font-bold flex items-center gap-1.5">
                    🤫 <span className="text-white">[{whisperedBy}]</span>님이 나에게 귓속말 중...
                  </span>
                  {isSeated && (
                    <button
                      type="button"
                      onClick={() => handleStartWhisper(whisperedBy)}
                      className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] shadow"
                    >
                      답하기
                    </button>
                  )}
                </div>
              )}

              {/* A. 1~6번 발화석 (고정 높이 컴팩트 2줄, 반투명 글래스) */}
              <div className="bg-slate-900/40 backdrop-blur-sm border border-white/10 rounded-xl p-2 shrink-0 shadow-lg z-10 relative">
              <div className="flex items-center justify-between mb-1.5 px-0.5">
                <span className="text-[11px] font-bold text-slate-200 [text-shadow:_0_1px_2px_rgb(0_0_0_/_80%)]">
                  발화석
                </span>
                <span className="text-[10px] text-slate-400 [text-shadow:_0_1px_2px_rgb(0_0_0_/_80%)]">
                  빈자리 터치 시 착석 (마이크 ON)
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

              <div className="grid grid-cols-3 gap-1.5">
                {[0, 1, 2, 3, 4, 5].map((idx) => {
                  const occupant = slots[idx];
                  const isOccupied = Boolean(occupant);
                  const isSpeaking = isOccupied && speakingMap[occupant];
                  const isUserMuted = isOccupied && muteMap[occupant];
                  const isMeOnSlot = occupant === cleanNick;
                  const customAvatar = occupant ? avatarMap[occupant] : null;
                  const isWhisperingToThis = Boolean(occupant && whisperingTo === occupant);
                  const isWhisperingFromThis = Boolean(occupant && whisperedBy === occupant);

                  return (
                    <div
                      key={idx}
                      onClick={() => !isOccupied && handleTakeSlot(idx)}
                      className={`relative flex flex-col items-center justify-center p-1 rounded-lg transition-all h-14 ${
                        isOccupied
                          ? isWhisperingToThis || isWhisperingFromThis
                            ? "border-2 border-indigo-400 bg-slate-800 shadow-md ring-2 ring-indigo-400/40"
                            : isSpeaking
                            ? "border-2 border-emerald-400 bg-slate-800 shadow-md shadow-emerald-500/25 ring-2 ring-emerald-400/30"
                            : "border border-slate-600/90 bg-slate-800/95 shadow-md"
                          : "border-2 border-dashed border-slate-700/60 bg-slate-950/25 hover:border-slate-500 hover:bg-slate-900/30 cursor-pointer"
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1.5 text-[10px] font-bold ${
                          isOccupied ? "text-slate-300 font-extrabold" : "text-slate-500"
                        }`}
                      >
                        {idx + 1}
                      </span>

                      {isOccupied ? (
                        <>
                          <div className="relative">
                            {customAvatar ? (
                              <img
                                src={customAvatar}
                                alt={occupant}
                                className={`w-6 h-6 rounded-full object-cover ${
                                  isWhisperingToThis || isWhisperingFromThis
                                    ? "ring-2 ring-indigo-400 animate-pulse"
                                    : isSpeaking
                                    ? "ring-2 ring-emerald-400 animate-pulse"
                                    : "ring-1 ring-slate-400"
                                }`}
                              />
                            ) : (
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[9px] ${
                                  isWhisperingToThis || isWhisperingFromThis
                                    ? "bg-indigo-600 text-white ring-2 ring-indigo-400 animate-pulse font-extrabold"
                                    : isSpeaking
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
                                className="absolute -bottom-1 -right-1 bg-slate-700 hover:bg-slate-600 text-white p-0.5 rounded-full shadow border border-white/20"
                                title="갤러리 사진 선택"
                              >
                                <Camera className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>

                          <span className="text-[9px] font-semibold text-slate-100 truncate w-full text-center mt-0.5 px-0.5 [text-shadow:_0_1px_2px_rgb(0_0_0_/_90%)]">
                            {occupant} {isMeOnSlot && "(나)"}
                          </span>
                          {isUserMuted && (
                            <span className={`absolute top-1 ${!isMeOnSlot ? "right-4" : "right-1"} text-rose-400 drop-shadow`}>
                              <MicOff className="w-2.5 h-2.5" />
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
                                className="absolute top-1 right-1 text-slate-400 hover:text-white p-0.5 rounded bg-slate-900/80 hover:bg-slate-800 border border-white/10 flex items-center justify-center transition-colors"
                                title="대기석으로 내리기"
                              >
                                <ArrowDownCircle className="w-2.5 h-2.5" />
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
                                className={`absolute bottom-0.5 right-1 px-1 py-0.2 rounded text-[8px] font-bold border flex items-center gap-0.5 transition-all shadow-sm ${
                                  isWhisperingToThis || isWhisperingFromThis
                                    ? "bg-indigo-600 text-white border-indigo-400 animate-pulse font-black"
                                    : "bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border-white/15"
                                }`}
                                title={isWhisperingToThis ? "귓속말 종료" : `${occupant}님에게 귓속말`}
                              >
                                <span>🤫</span>
                                <span>{isWhisperingToThis ? "귓속말중" : "귓속말"}</span>
                              </button>
                            </>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center justify-center text-slate-500 hover:text-slate-400 transition-colors">
                          <span className="text-xl leading-none font-light">+</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 착석자 제어 패널 */}
              {isSeated && (
                <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={toggleMute}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-bold text-[11px] transition-colors ${
                        isMuted
                          ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/15"
                          : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm"
                      }`}
                    >
                      {isMuted ? <MicOff className="w-3 h-3 text-rose-400" /> : <Mic className="w-3 h-3 text-white" />}
                      <span>{isMuted ? "마이크 켜기" : "마이크 OFF"}</span>
                    </button>
                    <button
                      onClick={toggleDeafen}
                      className={`p-1 rounded-md border transition-colors ${
                        isDeafened
                          ? "bg-rose-600 hover:bg-rose-500 text-white border-rose-500"
                          : "bg-slate-800 hover:bg-slate-700 border-white/15 text-slate-300"
                      }`}
                      title="전체 소리 끄기/켜기"
                    >
                      {isDeafened ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1 text-[10px] text-slate-300 hover:text-white px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-white/15 transition-colors"
                      title="갤러리에서 내 아바타 사진 선택"
                    >
                      <Camera className="w-3 h-3 text-slate-300" />
                      <span>사진</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewNickInput(cleanNick);
                        setNickChangeError("");
                        setShowNickModal(true);
                      }}
                      className="flex items-center gap-1 text-[10px] text-slate-300 hover:text-white px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-white/15 transition-colors"
                      title="닉네임 변경"
                    >
                      <Pencil className="w-2.5 h-2.5 text-slate-300" />
                      <span>닉변경</span>
                    </button>
                  </div>
                  <button
                    onClick={handleLeaveSlot}
                    className="flex items-center gap-1 text-[10px] text-slate-300 hover:text-rose-300 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-white/15 transition-colors"
                  >
                    <ArrowDownCircle className="w-3 h-3 text-slate-400" />
                    <span>내려가기</span>
                  </button>
                </div>
              )}
            </div>

            {/* B. 대기자 명단 (반투명 글래스) */}
            <div className="bg-slate-900/40 backdrop-blur-sm border border-white/10 rounded-xl p-2 shrink-0 shadow-lg z-10 relative">
              <div className="flex items-center justify-between mb-1 px-0.5">
                <span className="text-[10px] font-bold text-slate-200 [text-shadow:_0_1px_2px_rgb(0_0_0_/_80%)]">
                  대기자 ({waitingList.length}명)
                </span>
                {!isSeated && (
                  <span className="text-[9px] text-indigo-300 [text-shadow:_0_1px_2px_rgb(0_0_0_/_80%)] font-medium">
                    상단 빈자리 터치 시 마이크 켜짐
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap py-0.5 scrollbar-none">
                {waitingList.length === 0 ? (
                  <span className="text-[10px] text-slate-400">대기자가 없습니다.</span>
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
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border shrink-0 cursor-pointer active:scale-95 transition-all ${
                        id === cleanNick
                          ? "bg-indigo-950/80 border-indigo-400 text-indigo-200 font-bold shadow-sm"
                          : "bg-slate-950/60 border-white/15 text-slate-200 hover:border-rose-400/50 [text-shadow:_0_1px_2px_rgb(0_0_0_/_80%)]"
                      }`}
                      title={id === cleanNick ? "터치하여 닉네임 변경" : "터치하여 유령 사용자 정리 / 내보내기"}
                    >
                      <span>{id}</span>
                      {id === cleanNick ? "(나 ✏️)" : <span className="text-[9px] text-slate-400 hover:text-rose-400 ml-0.5">✕</span>}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* C. 실시간 채팅 & 내 채팅 TTS (접힘/펼침 지원, 기본 접힌 상태) */}
            {isChatCollapsed ? (
              /* 접힌 상태: 바닥에 위치한 컴팩트 바 (배경 이미지가 시원하게 노출됨) */
              <div className="bg-slate-900/40 backdrop-blur-sm border border-white/10 rounded-xl p-2 shrink-0 shadow-lg z-10 relative flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsChatCollapsed(false)}
                  className="flex items-center gap-1.5 flex-1 min-w-0 text-left hover:opacity-90 active:scale-[0.99]"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="font-bold text-[11px] text-slate-200 shrink-0 [text-shadow:_0_1px_2px_rgb(0_0_0_/_80%)]">
                    채팅창
                  </span>
                  <span className="text-[10px] text-indigo-300 font-semibold shrink-0">
                    ({messages.length})
                  </span>
                  {messages.length > 0 ? (
                    <span className="text-[10px] text-slate-300 truncate ml-1 [text-shadow:_0_1px_2px_rgb(0_0_0_/_90%)]">
                      {messages[messages.length - 1].isSystem ? (
                        <span className="text-rose-300 font-semibold">{messages[messages.length - 1].text}</span>
                      ) : (
                        <>
                          <span className="font-semibold text-indigo-300">{messages[messages.length - 1].sender}:</span> {messages[messages.length - 1].text}
                        </>
                      )}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 ml-1">터치하여 채팅 열기</span>
                  )}
                </button>

                <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
                  <label className="flex items-center gap-1 cursor-pointer text-[9px] select-none bg-slate-950/60 border border-white/15 px-1.5 py-0.5 rounded-full">
                    <input
                      type="checkbox"
                      checked={myTTSMode}
                      onChange={(e) => setMyTTSMode(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 text-indigo-500 focus:ring-0 w-2.5 h-2.5"
                    />
                    <span className={myTTSMode ? "text-indigo-300 font-bold" : "text-slate-400"}>
                      TTS {myTTSMode ? "ON" : "OFF"}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsChatCollapsed(false)}
                    className="flex items-center gap-0.5 px-2 py-0.5 rounded bg-indigo-600/80 hover:bg-indigo-600 text-white font-medium text-[10px]"
                  >
                    <span>열기</span>
                    <ChevronUp className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : (
              /* 펼쳐진 상태: 남은 세로 영역 100% 채움 */
              <div className="flex-1 min-h-0 bg-slate-900/40 backdrop-blur-sm border border-white/10 rounded-xl p-2.5 flex flex-col overflow-hidden shadow-lg z-10 relative">
                <div className="flex items-center justify-between pb-1.5 border-b border-white/10 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="w-3 h-3 text-indigo-400" />
                    <span className="text-[11px] font-bold text-slate-200 [text-shadow:_0_1px_2px_rgb(0_0_0_/_80%)]">채팅창</span>
                    <span className="text-[10px] text-indigo-300 font-semibold ml-0.5">({messages.length})</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* 내 채팅 TTS 모드 ON/OFF */}
                    <label className="flex items-center gap-1.5 cursor-pointer text-[10px] select-none bg-slate-950/60 border border-white/15 px-2 py-0.5 rounded-full">
                      <input
                        type="checkbox"
                        checked={myTTSMode}
                        onChange={(e) => setMyTTSMode(e.target.checked)}
                        className="rounded bg-slate-800 border-slate-700 text-indigo-500 focus:ring-0 w-3 h-3"
                      />
                      <span className={myTTSMode ? "text-indigo-300 font-bold" : "text-slate-300"}>
                        내 채팅 TTS 읽어주기 {myTTSMode ? "ON" : "OFF"}
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setIsChatCollapsed(true)}
                      className="flex items-center gap-0.5 px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-white/10 text-[10px]"
                      title="채팅창 접기"
                    >
                      <span>접기</span>
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* 채팅 목록 스크롤 영역 (반투명 어두운 배경) */}
                <div ref={chatScrollRef} className="flex-1 overflow-y-auto space-y-1.5 pr-1 py-1.5 min-h-0 bg-slate-950/30 rounded-lg px-2 my-1 border border-white/5">
                  {messages.length === 0 ? (
                    <div className="text-center text-[10px] text-slate-400 py-6 [text-shadow:_0_1px_2px_rgb(0_0_0_/_80%)]">
                      채팅을 입력하면 실시간으로 전송됩니다.
                    </div>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m.id}
                        className={`text-[11px] leading-snug break-all [text-shadow:_0_1px_2px_rgb(0_0_0_/_90%)] ${
                          m.isSystem
                            ? "bg-rose-950/50 border border-rose-500/30 text-rose-200 px-2 py-1 rounded my-1 font-medium flex items-center justify-between"
                            : ""
                        }`}
                      >
                        {m.isSystem ? (
                          <>
                            <span>{renderMessageWithLinks(m.text)}</span>
                            <span className="text-[9px] text-rose-300/70 ml-1.5 shrink-0">{m.time}</span>
                          </>
                        ) : (
                          <>
                            <span className="font-bold text-indigo-300">{m.sender}: </span>
                            <span className="text-slate-100">{renderMessageWithLinks(m.text)}</span>
                            {m.isTTS && (
                              <span className="ml-1 text-[8px] bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 px-1 py-0.1 rounded font-semibold">
                                TTS
                              </span>
                            )}
                            <span className="text-[9px] text-slate-400 ml-1.5">{m.time}</span>
                          </>
                        )}
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* 하단 채팅 입력창 */}
                <div className="flex items-center gap-1.5 pt-1.5 border-t border-white/10 shrink-0">
                  <input
                    type="text"
                    placeholder={myTTSMode ? "입력한 글을 모두에게 음성으로 읽어줍니다..." : "대기자도 자유롭게 채팅 가능..."}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    className="flex-1 bg-slate-950/70 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-400"
                  />
                  <button
                    type="button"
                    onClick={sendMessage}
                    className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

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
                placeholder="카톡 닉네임 (닉/나이/지역)"
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
                <ArrowDownCircle className="w-3.5 h-3.5 text-indigo-400" />
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

              {/* 섹션 4: 음성 미저장 원칙 */}
              <div>
                <h4 className="font-bold text-emerald-300 text-xs mb-1">4. 음성 데이터 미저장 원칙 (No-Log)</h4>
                <p className="text-slate-400 text-[10px]">
                  본 서비스는 WebRTC 실시간 미디어 스트리밍 방식을 사용하며, <strong>서버에 이용자의 음성 대화 내용을 일체 녹음·도청·저장하지 않습니다.</strong> 음성 데이터는 참가자 간 실시간 송수신 후 즉시 메모리에서 영구 소멸합니다.
                </p>
              </div>

              {/* 섹션 5: 개인정보 처리방침 */}
              <div>
                <h4 className="font-bold text-indigo-300 text-xs mb-1">5. 간이 개인정보 처리방침</h4>
                <p className="text-slate-400 text-[10px] mb-1">
                  서비스는 최소한의 기술적 정보만을 임시 처리합니다:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-[9px] text-slate-400 pl-1">
                  <li><strong>수집 항목</strong>: 이용자가 임의 입력한 닉네임, 프로필 이미지, 서비스 접속 IP 로그</li>
                  <li><strong>이용 목적</strong>: 실시간 보이스룸 채널 연결 및 불량/유령 사용자 제재</li>
                  <li><strong>보유 기간</strong>: 음성/채팅 내용은 브라우저 세션 종료 시 즉시 소멸하며 서버에 영구 보관되지 않습니다.</li>
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
