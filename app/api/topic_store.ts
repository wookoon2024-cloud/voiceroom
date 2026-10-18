import { NextRequest } from "next/server";

export const roomTopics: Record<string, string> = {
  "subroom-1": "소그룹 대화",
  "subroom-2": "소그룹 대화",
};

export interface IpSessionData {
  ip: string;
  nickname: string;
  room: string;
  slotIndex: number | null;
  wasMuted: boolean;
  isJoined: boolean;
  skin?: string;
  asmr?: string;
  updatedAt: number;
}

// 서버 전역(globalThis)에 IP별 닉네임 및 세션 상태 유지
const globalForStore = globalThis as unknown as {
  ipSessionStore?: Record<string, IpSessionData>;
};

export const ipSessionStore: Record<string, IpSessionData> =
  globalForStore.ipSessionStore || (globalForStore.ipSessionStore = {});

export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "local-ip";
}
