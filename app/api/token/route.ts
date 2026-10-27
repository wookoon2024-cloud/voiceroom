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

  const apiKey = (process.env.LIVEKIT_API_KEY || "APIr5gr9btSo4Xc").trim();
  const apiSecret = (process.env.LIVEKIT_API_SECRET || "YFer9mLPNk1w5ifNker7eU4pewYM0E20DwfgAcA47vjA").trim();
  const rawWsUrl = (process.env.LIVEKIT_URL || "wss://kakao-voiceroom-b1s6gu0b.livekit.cloud").trim();
  // 줄바꿈이나 중복 붙여넣기된 URL 정제
  const wsUrl = rawWsUrl.split(/\s+/)[0] || "wss://kakao-voiceroom-b1s6gu0b.livekit.cloud";

  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const clientIp = getClientIp(req);
  const slotIndex =
    slotParam !== null && slotParam !== "" && !isNaN(Number(slotParam))
      ? Number(slotParam)
      : ipSessionStore[clientIp]?.slotIndex ?? null;

  // IP별 닉네임 및 현재 접속 상태 저장 (유효한 IP인 경우에만 기록)
  if (clientIp && clientIp !== "unknown") {
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
  }

  const rawDevice = req.nextUrl.searchParams.get("device");
  const ua = req.headers.get("user-agent") || "";
  const detectedDevice: "ios" | "android" | "pc" =
    rawDevice === "ios" || rawDevice === "android" || rawDevice === "pc"
      ? rawDevice
      : /iPhone|iPad|iPod/i.test(ua)
      ? "ios"
      : /Android/i.test(ua)
      ? "android"
      : "pc";

  const at = new AccessToken(apiKey, apiSecret, {
    identity: username,
    name: username,
    metadata: JSON.stringify({ ip: clientIp, device: detectedDevice }),
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
