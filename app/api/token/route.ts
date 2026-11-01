import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { getClientIp, ipSessionStore } from "../topic_store";
import { getLiveKitConfig, getRoomService, isAllowedRoom } from "../../../lib/livekit";

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

  // 같은 방에 같은 닉네임이 이미 접속 중이면 거부 (LiveKit은 identity가 같으면 먼저 들어온 사람을 끊어버림)
  // 같은 IP는 본인 새로고침/재접속으로 보고 허용 (남아있는 유령 연결을 교체)
  try {
    const existing = await getRoomService(cfg).listParticipants(room);
    const sameNick = existing.find((p) => p.identity === username);
    if (sameNick) {
      let ownerIp = "";
      try {
        ownerIp = JSON.parse(sameNick.metadata || "{}").ip || "";
      } catch (e) {}
      if (ownerIp !== clientIp) {
        return NextResponse.json(
          { error: `'${username}' 닉네임은 이미 이 방에서 사용 중이에요. 다른 닉네임으로 입장해 주세요.` },
          { status: 409 }
        );
      }
    }
  } catch (e) {
    // 방이 아직 없거나 조회 실패 시에는 입장을 막지 않음
  }
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
