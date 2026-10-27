import { NextRequest, NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";

export async function POST(req: NextRequest) {
  try {
    const { room, identity } = await req.json();
    if (!room || !identity) {
      return NextResponse.json({ error: "Missing room or identity" }, { status: 400 });
    }

    let apiKey = (process.env.LIVEKIT_API_KEY || "").trim();
    let apiSecret = (process.env.LIVEKIT_API_SECRET || "").trim();
    let rawWsUrl = (process.env.LIVEKIT_URL || "").trim();

    if (!rawWsUrl || rawWsUrl.includes("kakao-voiceroom-9i3462w4")) {
      rawWsUrl = "wss://kakao-voiceroom-b1s6gu0b.livekit.cloud";
      apiKey = "APIr5gr9btSo4Xc";
      apiSecret = "YFer9mLPNk1w5ifNker7eU4pewYM0E20DwfgAcA47vjA";
    }
    const wsUrl = rawWsUrl.split(/\s+/)[0] || "wss://kakao-voiceroom-b1s6gu0b.livekit.cloud";
    const httpUrl = wsUrl.replace("wss://", "https://").replace("ws://", "http://");

    const client = new RoomServiceClient(httpUrl, apiKey, apiSecret);
    await client.removeParticipant(room, identity);

    return NextResponse.json({ ok: true, removed: identity });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
