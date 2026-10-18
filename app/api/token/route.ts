import { NextRequest, NextResponse } from "next/server";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { getClientIp, ipSessionStore } from "../topic_store";

export async function GET(req: NextRequest) {
  const room = req.nextUrl.searchParams.get("room");
  const username = req.nextUrl.searchParams.get("username");
  const slotParam = req.nextUrl.searchParams.get("slot");

  if (!room) {
    return NextResponse.json({ error: 'Missing "room" query parameter' }, { status: 400 });
  }
  if (!username) {
    return NextResponse.json({ error: 'Missing "username" query parameter' }, { status: 400 });
  }

  const apiKey = (process.env.LIVEKIT_API_KEY || "").trim();
  const apiSecret = (process.env.LIVEKIT_API_SECRET || "").trim();
  const rawWsUrl = (process.env.LIVEKIT_URL || "").trim();
  // 줄바꿈이나 중복 붙여넣기된 URL 정제
  const wsUrl = rawWsUrl.split(/\s+/)[0] || "wss://kakao-voiceroom-9i3462w4.livekit.cloud";

  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const clientIp = getClientIp(req);
  const slotIndex =
    slotParam !== null && slotParam !== "" && !isNaN(Number(slotParam))
      ? Number(slotParam)
      : ipSessionStore[clientIp]?.slotIndex ?? null;

  // 동일 IP에서 이전에 다른 닉네임(랜덤 동물 닉네임 등)으로 남아있는 유령 세션이 있다면 자동 정리 (1 IP = 1 닉네임 보장)
  try {
    const httpUrl = wsUrl.replace("wss://", "https://").replace("ws://", "http://");
    const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);
    const participants = await roomService.listParticipants(room);
    for (const p of participants) {
      if (p.identity && p.identity !== username && p.metadata) {
        try {
          const meta = JSON.parse(p.metadata);
          if (meta.ip && meta.ip === clientIp) {
            await roomService.removeParticipant(room, p.identity);
          }
        } catch (e) {}
      }
    }
  } catch (e) {}

  // IP별 닉네임 및 현재 접속 상태 저장
  ipSessionStore[clientIp] = {
    ip: clientIp,
    nickname: username,
    room,
    slotIndex,
    wasMuted: ipSessionStore[clientIp]?.wasMuted ?? false,
    isJoined: true,
    skin: ipSessionStore[clientIp]?.skin,
    asmr: ipSessionStore[clientIp]?.asmr,
    updatedAt: Date.now(),
  };

  const at = new AccessToken(apiKey, apiSecret, {
    identity: username,
    name: username,
    metadata: JSON.stringify({ ip: clientIp }),
  });

  at.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });

  const token = await at.toJwt();

  return NextResponse.json({ token, wsUrl, ip: clientIp });
}
