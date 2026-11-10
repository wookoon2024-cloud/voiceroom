import { RoomServiceClient } from "livekit-server-sdk";

// 웹 보이스룸에서 사용하는 LiveKit 방 목록 (토큰 발급/주제/내보내기 모두 이 목록만 허용)
export const ALLOWED_ROOMS = ["subroom-1", "subroom-2"] as const;

export function isAllowedRoom(room: unknown): room is string {
  return typeof room === "string" && (ALLOWED_ROOMS as readonly string[]).includes(room);
}

export interface LiveKitConfig {
  apiKey: string;
  apiSecret: string;
  wsUrl: string;
  httpUrl: string;
}

const DEFAULT_LIVEKIT_URL = "wss://kakao-nrjhpdsv.livekit.cloud";
const DEFAULT_LIVEKIT_API_KEY = "APId5uQ8BvXUh4Q";
const DEFAULT_LIVEKIT_API_SECRET = "OYs2KRsY85DB7eNLaeiPPzeY79RpXalFdyS96ZswYc6B";

export function getLiveKitConfig(): LiveKitConfig | null {
  const envUrl = (process.env.LIVEKIT_URL || "").trim().split(/\s+/)[0] || "";
  const isOldProject =
    envUrl.includes("opentalk-k3xml7x3") || envUrl.includes("kakao-voiceroom-b1s6gu0b");

  const wsUrl = !envUrl || isOldProject ? DEFAULT_LIVEKIT_URL : envUrl;
  const apiKey =
    !process.env.LIVEKIT_API_KEY || isOldProject
      ? DEFAULT_LIVEKIT_API_KEY
      : process.env.LIVEKIT_API_KEY.trim();
  const apiSecret =
    !process.env.LIVEKIT_API_SECRET || isOldProject
      ? DEFAULT_LIVEKIT_API_SECRET
      : process.env.LIVEKIT_API_SECRET.trim();

  if (!apiKey || !apiSecret || !/^wss:\/\//i.test(wsUrl)) return null;

  const httpUrl = wsUrl.replace("wss://", "https://").replace("ws://", "http://");
  return { apiKey, apiSecret, wsUrl, httpUrl };
}

export function getRoomService(cfg: LiveKitConfig): RoomServiceClient {
  return new RoomServiceClient(cfg.httpUrl, cfg.apiKey, cfg.apiSecret);
}
