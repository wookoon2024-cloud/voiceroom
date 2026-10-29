import { NextRequest, NextResponse } from "next/server";
import { TokenVerifier } from "livekit-server-sdk";
import { getLiveKitConfig, getRoomService, isAllowedRoom } from "../../../lib/livekit";

export async function POST(req: NextRequest) {
  try {
    const { room, identity } = await req.json();
    if (!isAllowedRoom(room) || !identity) {
      return NextResponse.json({ error: "Missing or invalid room/identity" }, { status: 400 });
    }

    const cfg = getLiveKitConfig();
    if (!cfg) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    // 내보내기는 해당 방에 실제로 입장한 사람(그 방용 LiveKit 토큰 보유자)만 가능
    const authHeader = req.headers.get("authorization") || "";
    const callerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!callerToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      const grants = await new TokenVerifier(cfg.apiKey, cfg.apiSecret).verify(callerToken);
      if (grants.video?.room !== room || !grants.video?.roomJoin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } catch (e) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await getRoomService(cfg).removeParticipant(room, String(identity));

    return NextResponse.json({ ok: true, removed: identity });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
