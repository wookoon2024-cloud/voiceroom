import { NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { roomTopics } from "../topic_store";

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

  const topics: Record<string, string> = {
    "subroom-1": roomTopics["subroom-1"] || "소그룹 대화",
    "subroom-2": roomTopics["subroom-2"] || "소그룹 대화",
  };

  try {
    const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);
    const rooms = await roomService.listRooms(["subroom-1", "subroom-2"]);
    for (const r of rooms) {
      if (r.name && counts[r.name] !== undefined) {
        counts[r.name] = r.numParticipants || 0;
        if (r.metadata) {
          try {
            const meta = JSON.parse(r.metadata);
            if (meta.topic) {
              topics[r.name] = meta.topic;
              roomTopics[r.name] = meta.topic;
            }
          } catch (e) {}
        }
      }
    }
  } catch (e) {
    // 조회 실패 시 기본값 유지
  }

  return NextResponse.json({
    "subroom-1": counts["subroom-1"],
    "subroom-2": counts["subroom-2"],
    topics,
  });
}
