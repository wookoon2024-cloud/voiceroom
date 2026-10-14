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

  // 슬롯 (1~8번) 상태: { [slotIndex (0~7)]: "identity" }
  const [slots, setSlots] = useState<{ [key: number]: string }>({});
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

  // URL 파라미터 파싱
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
      }
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

  // 슬롯 착석
  const handleTakeSlot = async (slotIdx: number) => {
    if (slots[slotIdx]) return;
    const nextSlots = { ...slots };
    Object.keys(nextSlots).forEach((k) => {
      if (nextSlots[Number(k)] === cleanNick) {
        delete nextSlots[Number(k)];
      }
    });
    nextSlots[slotIdx] = cleanNick;
    setSlots(nextSlots);
    await broadcastData({ type: "SYNC_SLOTS", slots: nextSlots });
    await enableMyMicrophone();
  };

  // 슬롯 내려오기
  const handleLeaveSlot = async () => {
    const nextSlots = { ...slots };
    Object.keys(nextSlots).forEach((k) => {
      if (nextSlots[Number(k)] === cleanNick) {
        delete nextSlots[Number(k)];
      }
    });
    setSlots(nextSlots);
    await broadcastData({ type: "SYNC_SLOTS", slots: nextSlots });
    await disableMyMicrophone();
  };

  // 마이크 켜기
  const enableMyMicrophone = async () => {
    if (!roomRef.current) return;
    try {
      if (!localTrackRef.current) {
        const audioTrack = await createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });
        await roomRef.current.localParticipant.publishTrack(audioTrack);
        localTrackRef.current = audioTrack;
      } else {
        await roomRef.current.localParticipant.setMicrophoneEnabled(true);
      }
      setIsMuted(false);
      setMuteMap((prev) => ({ ...prev, [cleanNick]: false }));
      broadcastData({ type: "MUTE_STATUS", identity: cleanNick, isMuted: false });
    } catch (e) {}
  };

  // 마이크 끄기
  const disableMyMicrophone = async () => {
    if (!roomRef.current) return;
    try {
      if (localTrackRef.current) {
        await roomRef.current.localParticipant.setMicrophoneEnabled(false);
      }
      setIsMuted(true);
      setMuteMap((prev) => ({ ...prev, [cleanNick]: true }));
      broadcastData({ type: "MUTE_STATUS", identity: cleanNick, isMuted: true });
    } catch (e) {}
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
      speakText(`${cleanNick}: ${text}`);
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
          broadcastData({ type: "SYNC_SLOTS", slots });
        })
        .on(RoomEvent.ParticipantDisconnected, (p) => {
          setAllParticipants((prev) => prev.filter((id) => id !== p.identity));
          setSlots((prev) => {
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
            if (msg.type === "SYNC_SLOTS") {
              setSlots(msg.slots || {});
            } else if (msg.type === "MUTE_STATUS") {
              setMuteMap((prev) => ({
                ...prev,
                [msg.identity]: msg.isMuted,
              }));
            } else if (msg.type === "CHAT_MESSAGE") {
              setMessages((prev) => [...prev, msg.chat]);
              // 발신자가 TTS 모드로 보낸 메시지면 수신자 기기에서 음성으로 읽어줌!
              if (msg.chat.isTTS) {
                speakText(`${msg.chat.sender}: ${msg.chat.text}`);
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
    setSlots({});
    setMessages([]);
    setAllParticipants([]);
  };

  // 자동 스크롤
  useEffect(() => {
    if (chatScrollRef.current) {
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

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans text-xs select-none">
      {/* 1. 상단 컴팩트 헤더 */}
      <header className="border-b border-slate-800 bg-slate-900/95 px-3 py-2 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-1.5 font-bold text-slate-200">
          <Radio className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          <span>2040 보이스룸</span>
          <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1 py-0.2 rounded font-semibold">
            {ROOM_OPTIONS.find((r) => r.id === selectedRoom)?.name}
          </span>
        </div>
        {isJoined && (
          <div className="flex items-center gap-1.5">
            {/* 스피커 모드 (외부스피커/블루투스) */}
            {audioDevices.length > 0 && (
              <select
                value={selectedAudioDevice}
                onChange={(e) => handleAudioDeviceChange(e.target.value)}
                className="bg-slate-800 text-[10px] text-slate-200 border border-slate-700 rounded px-1.5 py-1 focus:outline-none"
                title="출력 장치 선택"
              >
                {audioDevices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label ? (d.label.length > 10 ? d.label.slice(0, 10) + ".." : d.label) : `출력 ${i + 1}`}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => setShowVolumeModal(true)}
              className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              title="볼륨 조절"
            >
              <Sliders className="w-3 h-3 text-indigo-400" />
              <span>볼륨</span>
            </button>
            <button
              onClick={handleLeave}
              className="flex items-center gap-1 px-2 py-1 rounded bg-rose-600/80 hover:bg-rose-600 text-white font-medium"
            >
              <PhoneOff className="w-3 h-3" />
              <span>나가기</span>
            </button>
          </div>
        )}
      </header>

      {/* 2. 메인 컨텐츠 (모바일 세로 100% 꽉 채우기 - 스크롤 없음) */}
      <main className="flex-1 overflow-hidden max-w-lg w-full mx-auto p-2 flex flex-col">
        {!isJoined ? (
          /* ================= 입장 화면 (컴팩트 가로형) ================= */
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-4 my-auto shadow-xl">
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
                          ? "bg-indigo-600/20 border-indigo-500 text-white"
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
              <div className="text-[11px] font-semibold text-slate-400 mb-1.5">닉네임</div>
              <input
                type="text"
                placeholder="카톡 닉네임 (닉/나이/지역)"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={25}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
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
          /* ================= 방 내부 UI (상단 슬롯 + 대기자 + 하단 채팅창 딱 맞춤) ================= */
          <div className="flex-1 flex flex-col gap-2 overflow-hidden">
            {/* A. 1~8번 발화석 (고정 높이) */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2 shrink-0 shadow-sm">
              <div className="flex items-center justify-between mb-1.5 px-0.5">
                <span className="text-[11px] font-bold text-slate-300">
                  🎙️ 발화석 (1~8번)
                </span>
                <span className="text-[10px] text-slate-400">
                  빈자리 터치 시 착석 (마이크 ON)
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((idx) => {
                  const occupant = slots[idx];
                  const isOccupied = Boolean(occupant);
                  const isSpeaking = isOccupied && speakingMap[occupant];
                  const isUserMuted = isOccupied && muteMap[occupant];
                  const isMeOnSlot = occupant === cleanNick;

                  return (
                    <div
                      key={idx}
                      onClick={() => !isOccupied && handleTakeSlot(idx)}
                      className={`relative flex flex-col items-center justify-center p-1.5 rounded-lg border transition-all h-16 ${
                        isOccupied
                          ? isSpeaking
                            ? "border-emerald-400 bg-emerald-950/40 shadow-sm shadow-emerald-500/30"
                            : "border-slate-700 bg-slate-950"
                          : "border-dashed border-slate-800 hover:border-indigo-500/60 bg-slate-950/40 cursor-pointer"
                      }`}
                    >
                      <span className="absolute top-1 left-1.5 text-[9px] font-bold text-slate-400">
                        #{idx + 1}
                      </span>

                      {isOccupied ? (
                        <>
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] ${
                              isSpeaking
                                ? "bg-emerald-500 text-white ring-2 ring-emerald-400 animate-pulse"
                                : "bg-slate-800 text-slate-200"
                            }`}
                          >
                            {occupant.slice(0, 2)}
                          </div>
                          <span className="text-[9px] font-medium text-slate-200 truncate w-full text-center mt-0.5 px-0.5">
                            {occupant} {isMeOnSlot && "(나)"}
                          </span>
                          {isUserMuted && (
                            <span className="absolute top-1 right-1 text-rose-400">
                              <MicOff className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </>
                      ) : (
                        <div className="text-center">
                          <span className="text-slate-400 text-sm leading-none">+</span>
                          <div className="text-[9px] text-slate-400">착석</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 착석자 제어 패널 */}
              {isSeated && (
                <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between">
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
                          ? "bg-rose-600/20 border-rose-600 text-rose-300"
                          : "bg-slate-800 border-slate-700 text-slate-300"
                      }`}
                      title="전체 소리 끄기/켜기"
                    >
                      {isDeafened ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                    </button>
                  </div>
                  <button
                    onClick={handleLeaveSlot}
                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800/60"
                  >
                    <ArrowDownCircle className="w-3 h-3 text-rose-400" />
                    <span>내려가기</span>
                  </button>
                </div>
              )}
            </div>

            {/* B. 대기자 명단 (높이 44px 컴팩트) */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2 shrink-0">
              <div className="flex items-center justify-between mb-1 px-0.5">
                <span className="text-[10px] font-bold text-slate-300">
                  👥 대기자 ({waitingList.length}명)
                </span>
                {!isSeated && (
                  <span className="text-[9px] text-indigo-400">
                    상단 빈자리 터치 시 마이크 켜짐
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap py-0.5 scrollbar-none">
                {waitingList.length === 0 ? (
                  <span className="text-[10px] text-slate-500">대기자가 없습니다.</span>
                ) : (
                  waitingList.map((id) => (
                    <span
                      key={id}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border shrink-0 ${
                        id === cleanNick
                          ? "bg-indigo-950/60 border-indigo-500 text-indigo-200 font-bold"
                          : "bg-slate-950 border-slate-800 text-slate-300"
                      }`}
                    >
                      <span>{id}</span>
                      {id === cleanNick && "(나)"}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* C. 실시간 채팅 & 내 채팅 TTS 음성 읽어주기 (남은 세로 영역 100% 채움) */}
            <div className="flex-1 min-h-0 bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-300">
                  <MessageSquare className="w-3 h-3 text-indigo-400" />
                  <span>채팅창</span>
                </div>
                {/* 내 채팅 TTS 모드 ON/OFF */}
                <label className="flex items-center gap-1.5 cursor-pointer text-[10px] select-none bg-indigo-950/40 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                  <input
                    type="checkbox"
                    checked={myTTSMode}
                    onChange={(e) => setMyTTSMode(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-indigo-500 focus:ring-0 w-3 h-3"
                  />
                  <span className={myTTSMode ? "text-indigo-300 font-bold" : "text-slate-400"}>
                    내 채팅 TTS 읽어주기 {myTTSMode ? "ON" : "OFF"}
                  </span>
                </label>
              </div>

              {/* 채팅 목록 스크롤 영역 */}
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto space-y-1.5 pr-1 py-1.5 min-h-0">
                {messages.length === 0 ? (
                  <div className="text-center text-[10px] text-slate-500 py-6">
                    채팅을 입력하면 실시간으로 전송됩니다.
                  </div>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className="text-[11px] leading-snug break-all">
                      <span className="font-semibold text-indigo-300">{m.sender}: </span>
                      <span className="text-slate-200">{m.text}</span>
                      {m.isTTS && (
                        <span className="ml-1 text-[8px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1 py-0.1 rounded">
                          TTS
                        </span>
                      )}
                      <span className="text-[9px] text-slate-500 ml-1.5">{m.time}</span>
                    </div>
                  ))
                )}
              </div>

              {/* 하단 채팅 입력창 (세로 100% 핏으로 화면 밖으로 밀리지 않고 항상 노출) */}
              <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-800 shrink-0">
                <input
                  type="text"
                  placeholder={myTTSMode ? "입력한 글을 모두에게 음성으로 읽어줍니다..." : "대기자도 자유롭게 채팅 가능..."}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
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
    </div>
  );
}
