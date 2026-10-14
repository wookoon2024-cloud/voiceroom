import { NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";

export async function GET() {
  const apiKey = (process.env.LIVEKIT_API_KEY || "").trim();
  const apiSecret = (process.env.LIVEKIT_API_SECRET || "").trim();
  const rawWsUrl = (process.env.LIVEKIT_URL || "").trim();
  const wsUrl = rawWsUrl.split(/\s+/)[0] || "wss://kakao-voiceroom-9i3462w4.livekit.cloud";

  // wss:// -> https://
  const httpUrl = wsUrl.replace("wss://", "https://").replace("ws://", "http://");

  const counts: Record<string, number> = {
    "subroom-1": 0,
    "subroom-2": 0,
  };

  try {
    const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);
    const rooms = await roomService.listRooms(["subroom-1", "subroom-2"]);
    for (const r of rooms) {
      if (r.name && counts[r.name] !== undefined) {
        counts[r.name] = r.numParticipants || 0;
      }
    }
  } catch (e) {
    // 조회 실패 시 기본 0
  }

  return NextResponse.json(counts);
}
