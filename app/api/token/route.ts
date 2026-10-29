import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { getClientIp, ipSessionStore } from "../topic_store";
import { getLiveKitConfig, isAllowedRoom } from "../../../lib/livekit";

export async function GET(req: NextRequest) {
  const room = req.nextUrl.searchParams.get("room");
  const rawUsername = req.nextUrl.searchParams.get("username");
  const slotParam = req.nextUrl.searchParams.get("slot");

  if (!isAllowedRoom(room)) {
    return NextResponse.json({ error: 'Missing or invalid "room" query parameter' }, { status: 400 });
  }
  const username = (rawUsername || "").trim();
  if (!username || username.length > 30) {
    return NextResponse.json({ error: "닉네임은 1~30자로 입력해 주세요." }, { status: 400 });
  }

  const cfg = getLiveKitConfig();
  if (!cfg) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const { apiKey, apiSecret, wsUrl } = cfg;

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
