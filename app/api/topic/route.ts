import { NextRequest, NextResponse } from "next/server";
import { roomTopics } from "../topic_store";
import { getLiveKitConfig, getRoomService, isAllowedRoom } from "../../../lib/livekit";

export async function POST(req: NextRequest) {
  try {
    const { room, topic } = await req.json();
    if (!isAllowedRoom(room) || !topic) {
      return NextResponse.json({ error: "Missing or invalid room/topic" }, { status: 400 });
    }

    const cleanTopic = String(topic).trim().slice(0, 50);
    if (!cleanTopic) {
      return NextResponse.json({ error: "Empty topic" }, { status: 400 });
    }
    roomTopics[room] = cleanTopic;

    const cfg = getLiveKitConfig();
    if (cfg) {
      try {
        const roomService = getRoomService(cfg);
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
