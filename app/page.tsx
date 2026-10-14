"use client";

import { useState, useEffect, useRef } from "react";
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  Participant,
  Track,
  createLocalAudioTrack,
  LocalAudioTrack,
} from "livekit-client";
import {
  Mic,
  MicOff,
  PhoneOff,
  Users,
  Volume2,
  VolumeX,
  Radio,
  Sparkles,
  Info,
} from "lucide-react";

interface ParticipantState {
  identity: string;
  isSpeaking: boolean;
  isMuted: boolean;
}

const ROOM_OPTIONS = [
  { id: "subroom-1", name: "🎙️ 서브 보이스룸 1", desc: "자유 수다 & 소통방" },
  { id: "subroom-2", name: "🎧 서브 보이스룸 2", desc: "소그룹 & 심야 대화방" },
];

export default function VoiceRoomPage() {
  const [selectedRoom, setSelectedRoom] = useState("subroom-1");
  const [nickname, setNickname] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [participants, setParticipants] = useState<ParticipantState[]>([]);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);
  const localTrackRef = useRef<LocalAudioTrack | null>(null);
  const wakeLockRef = useRef<any>(null);

  // 모바일 화면 꺼짐 방지 (Wake Lock)
  const requestWakeLock = async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
      }
    } catch (err) {
      console.log("Wake Lock not supported or rejected:", err);
    }
  };

  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch (err) {}
  };

  // URL 파라미터에서 닉네임과 룸 자동 로드 (예: ?room=subroom-1&nick=홍길동)
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

  const updateParticipantsList = (currentRoom: Room) => {
    const list: ParticipantState[] = [];
    const local = currentRoom.localParticipant;
    if (local) {
      list.push({
        identity: local.identity,
        isSpeaking: local.isSpeaking,
        isMuted: !local.isMicrophoneEnabled,
      });
    }
    currentRoom.remoteParticipants.forEach((p) => {
      list.push({
        identity: p.identity,
        isSpeaking: p.isSpeaking,
        isMuted: !p.isMicrophoneEnabled,
      });
    });
    setParticipants(list);
  };

  const joinRoom = async () => {
    const cleanNick = nickname.trim();
    if (!cleanNick) {
      setErrorMsg("닉네임을 입력해 주세요.");
      return;
    }
    setErrorMsg("");
    setIsLoading(true);

    try {
      // 1. 토큰 요청
      const res = await fetch(
        `/api/token?room=${encodeURIComponent(selectedRoom)}&username=${encodeURIComponent(cleanNick)}`
      );
      const data = await res.json();
      if (!res.ok || !data.token) {
        throw new Error(data.error || "토큰 발급에 실패했습니다.");
      }

      // 2. LiveKit 룸 생성 및 연결
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // 이벤트 리스너 등록
      room
        .on(RoomEvent.ParticipantConnected, () => updateParticipantsList(room))
        .on(RoomEvent.ParticipantDisconnected, () => updateParticipantsList(room))
        .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          if (speakers.length > 0) {
            setActiveSpeaker(speakers[0].identity);
          } else {
            setActiveSpeaker(null);
          }
          updateParticipantsList(room);
        })
        .on(RoomEvent.TrackSubscribed, (track: Track) => {
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach();
            document.body.appendChild(el);
          }
        })
        .on(RoomEvent.TrackUnsubscribed, (track: Track) => {
          track.detach().forEach((el) => el.remove());
        })
        .on(RoomEvent.Disconnected, () => {
          handleLeave();
        });

      await room.connect(data.wsUrl, data.token);

      // 마이크 트랙 생성 및 전송
      const audioTrack = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
      await room.localParticipant.publishTrack(audioTrack);
      localTrackRef.current = audioTrack;
      roomRef.current = room;

      setIsJoined(true);
      setIsMuted(false);
      updateParticipantsList(room);
      requestWakeLock();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "보이스룸 접속 중 오류가 발생했습니다. 마이크 권한을 확인해 주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMute = async () => {
    if (!roomRef.current) return;
    const nextState = !isMuted;
    try {
      await roomRef.current.localParticipant.setMicrophoneEnabled(!nextState);
      setIsMuted(nextState);
      updateParticipantsList(roomRef.current);
    } catch (e) {
      console.error("Mute toggle failed", e);
    }
  };

  const toggleDeafen = () => {
    const next = !isDeafened;
    setIsDeafened(next);
    // 모든 수신 오디오 엘리먼트 음소거 제어
    const audioElements = document.querySelectorAll("audio");
    audioElements.forEach((a) => {
      a.muted = next;
    });
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
    releaseWakeLock();
    setIsJoined(false);
    setParticipants([]);
    setActiveSpeaker(null);
  };

  const currentRoomInfo = ROOM_OPTIONS.find((r) => r.id === selectedRoom) || ROOM_OPTIONS[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* 헤더 */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50 px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-rose-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Radio className="w-4 h-4 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
              2040 오픈 서브 보이스룸
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                LIVE
              </span>
            </h1>
          </div>
        </div>
        {isJoined && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>통화 연결 중</span>
          </div>
        )}
      </header>

      {/* 메인 컨텐츠 영역 */}
      <main className="flex-1 max-w-lg w-full mx-auto p-4 flex flex-col justify-center">
        {!isJoined ? (
          /* 방 선택 및 입장 화면 */
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-sm space-y-6">
            <div className="text-center space-y-1.5">
              <div className="inline-flex p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-2 text-indigo-400">
                <Sparkles className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-white">서브 보이스룸에 참여하세요</h2>
              <p className="text-xs text-slate-400">
                카카오톡 메인 보이스룸 외에 자유롭게 소통할 수 있는 웹 음성 채널입니다.
              </p>
            </div>

            {/* 방 선택 */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">채널 선택</label>
              <div className="grid grid-cols-1 gap-2.5">
                {ROOM_OPTIONS.map((r) => {
                  const isSel = selectedRoom === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRoom(r.id)}
                      className={`text-left p-3.5 rounded-xl border transition-all ${
                        isSel
                          ? "bg-indigo-600/15 border-indigo-500 text-white shadow-md shadow-indigo-500/10"
                          : "bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                      }`}
                    >
                      <div className="text-sm font-semibold">{r.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{r.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 닉네임 입력 */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">내 닉네임</label>
              <input
                type="text"
                placeholder="카톡 닉네임을 입력하세요 (예: 닉/나이/지역)"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={30}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {errorMsg && (
              <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800/60 rounded-xl p-3">
                {errorMsg}
              </div>
            )}

            <button
              type="button"
              onClick={joinRoom}
              disabled={isLoading}
              className="w-full py-3.5 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-indigo-500 via-indigo-600 to-rose-500 text-white shadow-lg shadow-indigo-500/25 hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Mic className="w-4 h-4" />
              {isLoading ? "마이크 연결 중..." : "마이크 켜고 입장하기"}
            </button>

            {/* 모바일 팁 */}
            <div className="flex items-start gap-2 bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 text-[11px] text-slate-400 leading-relaxed">
              <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>
                <strong>안내:</strong> 백그라운드나 화면이 꺼진 상태에서도 끊김 없이 대화하시려면 
                <strong> 크롬(Chrome) 또는 사파리(Safari)</strong> 브라우저로 열어주세요.
              </span>
            </div>
          </div>
        ) : (
          /* 통화 중 화면 (디스코드 스타일) */
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-sm flex flex-col space-y-6">
            {/* 현재 방 제목 & 참여자 수 */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white">{currentRoomInfo.name}</h3>
                <p className="text-xs text-slate-400">{currentRoomInfo.desc}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-full">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                <span>{participants.length}명 대화 중</span>
              </div>
            </div>

            {/* 참여자 그리드 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 min-h-[220px] max-h-[360px] overflow-y-auto pr-1">
              {participants.map((p) => {
                const isMe = p.identity === nickname.trim();
                const isSpeaking = activeSpeaker === p.identity || p.isSpeaking;

                return (
                  <div
                    key={p.identity}
                    className={`relative p-3.5 rounded-xl flex flex-col items-center justify-center gap-2 border transition-all ${
                      isSpeaking
                        ? "border-emerald-400 bg-emerald-950/30 shadow-lg shadow-emerald-500/20"
                        : "border-slate-800 bg-slate-950/60"
                    }`}
                  >
                    {/* 아바타 원형 */}
                    <div
                      className={`w-14 h-14 rounded-full flex items-center justify-center text-base font-bold transition-transform ${
                        isSpeaking
                          ? "ring-4 ring-emerald-400 ring-offset-2 ring-offset-slate-900 scale-105 bg-emerald-600 text-white"
                          : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {p.identity.slice(0, 2)}
                    </div>

                    {/* 닉네임 */}
                    <div className="text-center w-full">
                      <div className="text-xs font-semibold text-slate-200 truncate px-1">
                        {p.identity} {isMe && "(나)"}
                      </div>
                    </div>

                    {/* 음소거 뱃지 */}
                    {p.isMuted && (
                      <span className="absolute top-2 right-2 p-1 rounded-full bg-rose-500/20 text-rose-400">
                        <MicOff className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 하단 제어 컨트롤 바 */}
            <div className="flex items-center justify-center gap-4 pt-2">
              {/* 마이크 Mute 버튼 */}
              <button
                type="button"
                onClick={toggleMute}
                className={`p-3.5 rounded-full transition-all shadow-md active:scale-95 flex items-center justify-center ${
                  isMuted
                    ? "bg-rose-600 text-white shadow-rose-600/30"
                    : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                }`}
                title={isMuted ? "마이크 켜기" : "마이크 음소거"}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-emerald-400" />}
              </button>

              {/* 듣기 Deafen 버튼 */}
              <button
                type="button"
                onClick={toggleDeafen}
                className={`p-3.5 rounded-full transition-all shadow-md active:scale-95 flex items-center justify-center ${
                  isDeafened
                    ? "bg-rose-600 text-white shadow-rose-600/30"
                    : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                }`}
                title={isDeafened ? "소리 켜기" : "모두 음소거"}
              >
                {isDeafened ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5 text-slate-200" />}
              </button>

              {/* 방 나가기 버튼 */}
              <button
                type="button"
                onClick={handleLeave}
                className="p-3.5 rounded-full bg-rose-600 text-white shadow-lg shadow-rose-600/30 hover:bg-rose-700 active:scale-95 transition-all flex items-center justify-center"
                title="통화 종료"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="py-3 text-center text-[11px] text-slate-600">
        2040 Open Voice Room System • Powered by LiveKit
      </footer>
    </div>
  );
}
