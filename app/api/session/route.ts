import { NextRequest, NextResponse } from "next/server";
import { getClientIp, ipSessionStore } from "../topic_store";

const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 최대 2시간 경과 시 자동 파기

function purgeExpiredSessions() {
  const now = Date.now();
  for (const key of Object.keys(ipSessionStore)) {
    const item = ipSessionStore[key];
    if (!item || now - (item.updatedAt || 0) > SESSION_TTL_MS) {
      delete ipSessionStore[key];
    }
  }
}

export async function GET(req: NextRequest) {
  purgeExpiredSessions();
  const clientIp = getClientIp(req);
  // 공용 와이파이 등 동일 IP 환경에서 타인의 닉네임/방 정보가 노출되지 않도록 session은 반환하지 않음
  return NextResponse.json({
    ip: clientIp,
    session: null,
  });
}

export async function POST(req: NextRequest) {
  try {
    purgeExpiredSessions();
    const clientIp = getClientIp(req);
    if (!clientIp || clientIp === "unknown") {
      return NextResponse.json({ ok: true, ip: clientIp, session: null });
    }
    const body = await req.json();
    const { action, nickname, room, slotIndex, wasMuted, skin, asmr } = body;

    const prev = ipSessionStore[clientIp];

    if (action === "leave") {
      // 퇴장 시 메모리에서 즉시 파기 (불필요한 IP-닉네임 보관 방지)
      delete ipSessionStore[clientIp];
      return NextResponse.json({ ok: true, ip: clientIp, session: null });
    }

    // action === "save"
    const cleanNick = (nickname || prev?.nickname || "").trim();
    if (cleanNick) {
      ipSessionStore[clientIp] = {
        ip: clientIp,
        nickname: cleanNick,
        room: room || prev?.room || "subroom-1",
        slotIndex: slotIndex !== undefined ? slotIndex : (prev?.slotIndex ?? null),
        wasMuted: wasMuted !== undefined ? Boolean(wasMuted) : (prev?.wasMuted ?? false),
        isJoined: body.isJoined !== undefined ? Boolean(body.isJoined) : true,
        skin: skin || prev?.skin,
        asmr: asmr || prev?.asmr,
        updatedAt: Date.now(),
      };
    }

    return NextResponse.json({
      ok: true,
      ip: clientIp,
      session: ipSessionStore[clientIp] || null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}
