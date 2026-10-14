"use client";

import { useState, useEffect, useRef } from "react";
import {
  Room,
  RoomEvent,
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
}

const ROOM_OPTIONS = [
  { id: "subroom-1", name: "보이스룸 1", desc: "자유 수다방" },
  { id: "subroom-2", name: "보이스룸 2", desc: "소그룹 대화" },
];

const ADJECTIVES = [
  "귀여운", "포근한", "상큼한", "달콤한", "활기찬",
  "용감한", "행복한", "즐거운", "따뜻한", "빛나는",
  "씩씩한", "차분한", "맑은", "유쾌한", "설레는",
  "산뜻한", "친절한", "시원한", "멋진", "당당한",
  "센스있는", "개구쟁이"
];

const NOUNS = [
  "강아지", "고양이", "햄스터", "다람쥐", "토끼",
  "판다", "곰돌이", "호랑이", "아기사자", "여우",
  "수달", "돌고래", "물개", "펭귄", "아기새",
  "병아리", "오리", "사슴", "알파카", "코알라",
  "미어캣", "너구리", "북극곰", "아기양"
];

const generateRandomNickname = () => {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return `${adj}${noun}${num}`;
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
    { id: "default", name: "기본 다크", icon: "🌙", desc: "깔끔한 슬레이트", bg: "" },
    { id: "onsen", name: "온천 남탕", icon: "♨️", desc: "귀여운 일본 온천", bg: "/skins/onsen.jpg" },
    { id: "cafe", name: "프린스 카페", icon: "☕", desc: "화사한 미소년 살롱", bg: "/skins/cafe.jpg" },
  ];
  const [currentSkin, setCurrentSkin] = useState<string>("default");
  const currentSkinRef = useRef<string>("default");
  const [showSkinModal, setShowSkinModal] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(true);
  const [isChatCollapsed, setIsChatCollapsed] = useState(true);

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

  // 사람별 개별 볼륨 ({ [identity]: 0 ~ 100 })
  const [volumeMap, setVolumeMap] = useState<{ [identity: string]: number }>({});
  const [showVolumeModal, setShowVolumeModal] = useState(false);

  // 참여자 목록 (전체)
  const [allParticipants, setAllParticipants] = useState<string[]>([]);
  const prevWaitingListRef = useRef<string[]>([]);

  // 채팅 상태
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [inputText, setInputText] = useState("");
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const roomRef = useRef<Room | null>(null);
  const localTrackRef = useRef<LocalAudioTrack | null>(null);
  const audioElementsRef = useRef<{ [identity: string]: HTMLAudioElement }>({});
  const wakeLockRef = useRef<any>(null);

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

  // TTS 음성 재생 (내 기기 또는 상대방 기기에서 텍스트를 읽어줌)
  const speakText = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "ko-KR";
      utter.rate = 1.05;
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

  // 룸 인원수 주기적 갱신
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const res = await fetch("/api/rooms");
        if (res.ok) {
          const data = await res.json();
          setRoomCounts(data);
        }
      } catch (e) {}
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 6000);
    return () => clearInterval(interval);
  }, []);

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
    };
  }, []);

  // 카카오톡 인앱 브라우저 감지 시 스마트폰 기본 브라우저(크롬/사파리)로 자동 열기
  useEffect(() => {
    if (typeof window === "undefined") return;
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isKakao = /KAKAOTALK/i.test(userAgent);

    if (isKakao) {
      const currentUrl = window.location.href;
      if (/android/i.test(userAgent)) {
        // 안드로이드: 크롬 인텐트로 강제 호출
        const cleanUrl = currentUrl.replace(/https?:\/\//i, "");
        window.location.href = `intent://${cleanUrl}#Intent;scheme=https;package=com.android.chrome;end`;
      } else if (/iphone|ipad|ipod/i.test(userAgent)) {
        // 아이폰: 사파리 외부 브라우저 호출 스킴
        window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(currentUrl)}`;
      }
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
    await enableMyMicrophone();
  };

  // 슬롯 내려오기
  const handleLeaveSlot = async () => {
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

  // 사람별 볼륨 조절
  const handleVolumeChange = (identity: string, val: number) => {
    setVolumeMap((prev) => ({ ...prev, [identity]: val }));
    const el = audioElementsRef.current[identity];
    if (el) {
      el.volume = Math.max(0, Math.min(1, val / 100));
    }
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
          setAllParticipants((prev) => {
            const updated = Array.from(new Set([...prev, p.identity]));
            return updated;
          });
          playDingSound();
          // 기존에 착석자 또는 스킨이 설정되어 있을 때 신규 참여자에게 전체 정보 전달
          broadcastData({
            type: "SYNC_SLOTS",
            slots: slotsRef.current,
            avatars: avatarMapRef.current,
            skin: currentSkinRef.current,
          });
        })
        .on(RoomEvent.ParticipantDisconnected, (p) => {
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
          const map: { [identity: string]: boolean } = {};
          speakers.forEach((s) => {
            map[s.identity] = true;
          });
          setSpeakingMap(map);
        })
        .on(RoomEvent.TrackSubscribed, (track: Track, pub, participant) => {
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach();
            audioElementsRef.current[participant.identity] = el;
            const currentVol = volumeMap[participant.identity] ?? 100;
            el.volume = currentVol / 100;
            el.muted = isDeafened;
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
              // 신규 참가자의 동기화 요청 -> 현재 방 슬롯, 아바타, 스킨 정보 전달
              broadcastData({
                type: "SYNC_SLOTS",
                slots: slotsRef.current,
                avatars: avatarMapRef.current,
                skin: currentSkinRef.current,
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
            }
          } catch (e) {}
        })
        .on(RoomEvent.Disconnected, () => {
          handleLeave();
        });

      await room.connect(data.wsUrl, data.token);
      roomRef.current = room;

      const initialParts: string[] = [cleanNick];
      room.remoteParticipants.forEach((p) => initialParts.push(p.identity));
      setAllParticipants(Array.from(new Set(initialParts)));

      setIsJoined(true);
      setIsMuted(true);
      requestWakeLock();
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
    setIsJoined(false);
    updateSlots({});
    setMessages([]);
    setAllParticipants([]);
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
  const seatedIdentities = new Set(Object.values(slots));
  const waitingList = allParticipants.filter((id) => !seatedIdentities.has(id));

  useEffect(() => {
    if (!isJoined) return;
    const prev = prevWaitingListRef.current;
    // 이전 대기자에 없던 새로운 사람이 추가되었고 내가 아닌 경우 알림음
    const newlyAdded = waitingList.filter(
      (id) => !prev.includes(id) && id !== cleanNick
    );
    if (newlyAdded.length > 0 && prev.length > 0) {
      playDingSound();
    }
    prevWaitingListRef.current = waitingList;
  }, [waitingList, isJoined, cleanNick]);

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
          <div className="flex items-center gap-1.5 font-bold text-slate-200 text-[11px]">
            <Radio className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span>2040 보이스룸</span>
            <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1 py-0.2 rounded font-semibold">
              {ROOM_OPTIONS.find((r) => r.id === selectedRoom)?.name}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {isJoined && (
              <button
                type="button"
                onClick={() => setShowSkinModal(true)}
                className="px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-white/10 flex items-center gap-1 text-[10px]"
                title="배경 스킨"
              >
                <Palette className="w-3 h-3 text-pink-400" />
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
                  title={isHeaderCollapsed ? "오디오 설정 펼치기" : "오디오 설정 접기"}
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

        {/* 2번째 줄: 펼쳤을 때만 바로 아랫줄에 오디오 출력 장치 및 볼륨 버튼 표시 */}
        {isJoined && !isHeaderCollapsed && (
          <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[10px]">
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
              onClick={() => setShowVolumeModal(true)}
              className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 font-medium"
              title="볼륨 조절"
            >
              <Sliders className="w-3 h-3 text-indigo-400" />
              <span>개별 볼륨</span>
            </button>
          </div>
        )}
      </header>

      {/* 2. 메인 컨텐츠 (모바일 세로 100% 꽉 채우기 - 스크롤 없음) */}
      <main className="flex-1 overflow-hidden max-w-lg w-full mx-auto p-2 flex flex-col justify-center">
        {!isJoined ? (
          /* ================= 입장 화면 (컴팩트 가로형) ================= */
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3.5 my-auto max-h-full overflow-y-auto shadow-xl">
            <div>
              <div className="text-[11px] font-semibold text-slate-400 mb-1.5">채널 선택</div>
              <div className="grid grid-cols-2 gap-2">
                {ROOM_OPTIONS.map((r) => {
                  const isSel = selectedRoom === r.id;
                  const count = roomCounts[r.id] ?? 0;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRoom(r.id)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        isSel
                          ? "bg-indigo-600/20 border-indigo-500 text-white shadow-sm shadow-indigo-500/20"
                          : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="font-bold text-xs truncate">{r.name}</div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                        <span>{r.desc}</span>
                        <span className="font-bold text-emerald-400">● {count}명</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-slate-400">닉네임</span>
                <button
                  type="button"
                  onClick={() => setNickname(generateRandomNickname())}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium active:scale-95 flex items-center gap-1"
                >
                  🎲 랜덤 재추첨
                </button>
              </div>
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="카톡 닉네임 (닉/나이/지역)"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={25}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 pr-16 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setNickname(generateRandomNickname())}
                  className="absolute right-1.5 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 active:scale-95 border border-slate-700 font-medium"
                >
                  랜덤
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="text-[11px] text-rose-400 bg-rose-950/30 border border-rose-800/40 p-2 rounded">
                {errorMsg}
              </div>
            )}

            <button
              type="button"
              onClick={joinRoom}
              disabled={isLoading}
              className="w-full py-2.5 rounded-lg font-bold text-xs bg-gradient-to-r from-indigo-500 to-rose-500 text-white shadow hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
            >
              {isLoading ? "접속 중..." : "보이스룸 입장하기"}
            </button>
          </div>
        ) : (
          /* ================= 방 내부 UI (상단 슬롯 + 대기자 + 하단 접이식 채팅창) ================= */
          <div className="flex-1 flex flex-col justify-between gap-2 overflow-hidden">
            {/* 상단 묶음: 발화석 + 대기자 명단 */}
            <div className="flex flex-col gap-2 shrink-0">
              {/* A. 1~6번 발화석 (고정 높이 컴팩트 2줄, 반투명 글래스) */}
              <div className="bg-slate-900/40 backdrop-blur-sm border border-white/10 rounded-xl p-2 shrink-0 shadow-lg z-10 relative">
              <div className="flex items-center justify-between mb-1.5 px-0.5">
                <span className="text-[11px] font-bold text-slate-200 [text-shadow:_0_1px_2px_rgb(0_0_0_/_80%)]">
                  🎙️ 발화석 (1~6번)
                </span>
                <span className="text-[10px] text-slate-300 [text-shadow:_0_1px_2px_rgb(0_0_0_/_80%)]">
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

                  return (
                    <div
                      key={idx}
                      onClick={() => !isOccupied && handleTakeSlot(idx)}
                      className={`relative flex flex-col items-center justify-center p-1 rounded-lg border transition-all h-14 ${
                        isOccupied
                          ? isSpeaking
                            ? "border-emerald-400 bg-emerald-950/60 shadow-sm shadow-emerald-500/30"
                            : "border-white/15 bg-slate-950/60"
                          : "border-dashed border-white/20 hover:border-indigo-400/60 bg-slate-950/30 cursor-pointer"
                      }`}
                    >
                      <span className="absolute top-1 left-1.5 text-[9px] font-bold text-slate-300 [text-shadow:_0_1px_2px_rgb(0_0_0_/_80%)]">
                        #{idx + 1}
                      </span>

                      {isOccupied ? (
                        <>
                          <div className="relative">
                            {customAvatar ? (
                              <img
                                src={customAvatar}
                                alt={occupant}
                                className={`w-6 h-6 rounded-full object-cover ${
                                  isSpeaking
                                    ? "ring-2 ring-emerald-400 animate-pulse"
                                    : "ring-1 ring-slate-400"
                                }`}
                              />
                            ) : (
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[9px] ${
                                  isSpeaking
                                    ? "bg-emerald-500 text-white ring-2 ring-emerald-400 animate-pulse"
                                    : "bg-slate-800 text-slate-200"
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
                                className="absolute -bottom-1 -right-1 bg-indigo-600 hover:bg-indigo-500 text-white p-0.5 rounded-full shadow"
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
                            <span className="absolute top-1 right-1 text-rose-400 drop-shadow">
                              <MicOff className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </>
                      ) : (
                        <div className="text-center">
                          <span className="text-slate-300 text-sm leading-none">+</span>
                          <div className="text-[9px] text-slate-300 [text-shadow:_0_1px_2px_rgb(0_0_0_/_80%)]">착석</div>
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
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-bold text-[11px] ${
                        isMuted
                          ? "bg-rose-600 text-white"
                          : "bg-emerald-600 text-white"
                      }`}
                    >
                      {isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                      <span>{isMuted ? "마이크 켜기" : "마이크 OFF"}</span>
                    </button>
                    <button
                      onClick={toggleDeafen}
                      className={`p-1 rounded-md border ${
                        isDeafened
                          ? "bg-rose-600/30 border-rose-600 text-rose-200"
                          : "bg-slate-800/80 border-white/10 text-slate-200"
                      }`}
                      title="전체 소리 끄기/켜기"
                    >
                      {isDeafened ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1 text-[10px] text-indigo-200 hover:text-white px-2 py-1 rounded bg-slate-800/80 border border-white/15"
                      title="갤러리에서 내 아바타 사진 선택"
                    >
                      <Camera className="w-3 h-3 text-indigo-400" />
                      <span>사진</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewNickInput(cleanNick);
                        setNickChangeError("");
                        setShowNickModal(true);
                      }}
                      className="flex items-center gap-1 text-[10px] text-slate-200 hover:text-white px-2 py-1 rounded bg-slate-800/80 border border-white/15"
                      title="닉네임 변경"
                    >
                      <Pencil className="w-2.5 h-2.5 text-indigo-400" />
                      <span>닉변경</span>
                    </button>
                  </div>
                  <button
                    onClick={handleLeaveSlot}
                    className="flex items-center gap-1 text-[10px] text-rose-200 hover:text-white px-2 py-1 rounded bg-rose-950/60 border border-rose-800/50"
                  >
                    <ArrowDownCircle className="w-3 h-3 text-rose-400" />
                    <span>내려가기</span>
                  </button>
                </div>
              )}
            </div>

            {/* B. 대기자 명단 (반투명 글래스) */}
            <div className="bg-slate-900/40 backdrop-blur-sm border border-white/10 rounded-xl p-2 shrink-0 shadow-lg z-10 relative">
              <div className="flex items-center justify-between mb-1 px-0.5">
                <span className="text-[10px] font-bold text-slate-200 [text-shadow:_0_1px_2px_rgb(0_0_0_/_80%)]">
                  👥 대기자 ({waitingList.length}명)
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
                        }
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border shrink-0 ${
                        id === cleanNick
                          ? "bg-indigo-950/80 border-indigo-400 text-indigo-200 font-bold cursor-pointer active:scale-95 shadow-sm"
                          : "bg-slate-950/60 border-white/15 text-slate-200 [text-shadow:_0_1px_2px_rgb(0_0_0_/_80%)]"
                      }`}
                      title={id === cleanNick ? "터치하여 닉네임 변경" : undefined}
                    >
                      <span>{id}</span>
                      {id === cleanNick && "(나 ✏️)"}
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
                      <span className="font-semibold text-indigo-300">{messages[messages.length - 1].sender}:</span> {messages[messages.length - 1].text}
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
                      <div key={m.id} className="text-[11px] leading-snug break-all [text-shadow:_0_1px_2px_rgb(0_0_0_/_90%)]">
                        <span className="font-bold text-indigo-300">{m.sender}: </span>
                        <span className="text-slate-100">{m.text}</span>
                        {m.isTTS && (
                          <span className="ml-1 text-[8px] bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 px-1 py-0.1 rounded font-semibold">
                            TTS
                          </span>
                        )}
                        <span className="text-[9px] text-slate-400 ml-1.5">{m.time}</span>
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
              <span className="font-bold text-xs text-white">사람별 스피커 볼륨 조절</span>
              <button
                onClick={() => setShowVolumeModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2.5 max-h-60 overflow-y-auto">
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
            <div className="grid grid-cols-1 gap-2">
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
    </div>
  );
}
