import { NextRequest, NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { roomTopics } from "../topic_store";

export async function POST(req: NextRequest) {
  try {
    const { room, topic } = await req.json();
    if (!room || !topic) {
      return NextResponse.json({ error: "Missing room or topic" }, { status: 400 });
    }

    const cleanTopic = String(topic).trim().slice(0, 50);
    roomTopics[room] = cleanTopic;

    const apiKey = (process.env.LIVEKIT_API_KEY || "").trim();
    const apiSecret = (process.env.LIVEKIT_API_SECRET || "").trim();
    const rawWsUrl = (process.env.LIVEKIT_URL || "").trim();
    const wsUrl = rawWsUrl.split(/\s+/)[0] || "wss://kakao-voiceroom-9i3462w4.livekit.cloud";
    const httpUrl = wsUrl.replace("wss://", "https://").replace("ws://", "http://");

    if (apiKey && apiSecret) {
      try {
        const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);
        try {
          await roomService.updateRoomMetadata(room, JSON.stringify({ topic: cleanTopic }));
        } catch (e) {
          // LiveKit에 방이 아직 등록되지 않은 경우 생성하며 메타데이터 영구 보관
          await roomService.createRoom({
            name: room,
            metadata: JSON.stringify({ topic: cleanTopic }),
            emptyTimeout: 86400 * 7,
          });
        }
      } catch (e) {
        console.error("LiveKit metadata save error:", e);
      }
    }

    return NextResponse.json({ ok: true, topic: cleanTopic });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
