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

  let apiKey = (process.env.LIVEKIT_API_KEY || "").trim();
  let apiSecret = (process.env.LIVEKIT_API_SECRET || "").trim();
  let rawWsUrl = (process.env.LIVEKIT_URL || "").trim();

  // 이전 만료된 라이브킷 키가 Vercel 환경변수에 남아있는 경우 신규 키로 자동 교체
  if (!rawWsUrl || rawWsUrl.includes("kakao-voiceroom-9i3462w4")) {
    rawWsUrl = "wss://kakao-voiceroom-b1s6gu0b.livekit.cloud";
    apiKey = "APIr5gr9btSo4Xc";
    apiSecret = "YFer9mLPNk1w5ifNker7eU4pewYM0E20DwfgAcA47vjA";
  }
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
