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

    try {
      const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);
      await roomService.updateRoomMetadata(room, JSON.stringify({ topic: cleanTopic }));
    } catch (e) {
      // Room might not exist yet if empty, in-memory topic store covers it
    }

    return NextResponse.json({ ok: true, topic: cleanTopic });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
