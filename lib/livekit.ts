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

// LiveKit 접속 정보 (Vercel 환경변수 우선 적용, 한도 초과된 이전 키 자동 대체)
export function getLiveKitConfig(): LiveKitConfig | null {
  let apiKey = (process.env.LIVEKIT_API_KEY || "").trim();
  let apiSecret = (process.env.LIVEKIT_API_SECRET || "").trim();
  let wsUrl = (process.env.LIVEKIT_URL || "").trim().split(/\s+/)[0] || "";

  // 한도 초과된 이전 프로젝트(kakao-voiceroom)이거나 환경변수가 없을 경우 신규 정상 프로젝트(opentalk) 자동 적용
  if (!wsUrl || wsUrl.includes("kakao-voiceroom") || !apiKey || !apiSecret) {
    wsUrl = "wss://opentalk-k3xml7x3.livekit.cloud";
    apiKey = "APIS6wjiKRByWaL";
    apiSecret = "lgb05KEjylokYTwG3SMt9PYmcJZfQySnhhx4XJzYdgS";
  }

  // wss:// -> https://
  const httpUrl = wsUrl.replace("wss://", "https://").replace("ws://", "http://");
  return { apiKey, apiSecret, wsUrl, httpUrl };
}

export function getRoomService(cfg: LiveKitConfig): RoomServiceClient {
  return new RoomServiceClient(cfg.httpUrl, cfg.apiKey, cfg.apiSecret);
}
