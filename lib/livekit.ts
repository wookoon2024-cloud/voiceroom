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

// LiveKit 접속 정보는 Vercel 환경변수(LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET)에서만 읽음
export function getLiveKitConfig(): LiveKitConfig | null {
  const apiKey = (process.env.LIVEKIT_API_KEY || "").trim();
  const apiSecret = (process.env.LIVEKIT_API_SECRET || "").trim();
  const wsUrl = (process.env.LIVEKIT_URL || "").trim().split(/\s+/)[0] || "";
  if (!apiKey || !apiSecret || !wsUrl) {
    console.error("LiveKit env missing: LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET");
    return null;
  }
  // wss:// -> https://
  const httpUrl = wsUrl.replace("wss://", "https://").replace("ws://", "http://");
  return { apiKey, apiSecret, wsUrl, httpUrl };
}

export function getRoomService(cfg: LiveKitConfig): RoomServiceClient {
  return new RoomServiceClient(cfg.httpUrl, cfg.apiKey, cfg.apiSecret);
}
