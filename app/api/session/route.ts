import { NextRequest, NextResponse } from "next/server";
import { getClientIp, ipSessionStore } from "../topic_store";

export async function GET(req: NextRequest) {
  const clientIp = getClientIp(req);
  const session = ipSessionStore[clientIp] || null;
  return NextResponse.json({
    ip: clientIp,
    session,
  });
}

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const body = await req.json();
    const { action, nickname, room, slotIndex, wasMuted, skin, asmr } = body;

    const prev = ipSessionStore[clientIp];

    if (action === "leave") {
      if (prev) {
        ipSessionStore[clientIp] = {
          ...prev,
          nickname: nickname || prev.nickname,
          isJoined: false,
          slotIndex: null,
          updatedAt: Date.now(),
        };
      } else if (nickname) {
        ipSessionStore[clientIp] = {
          ip: clientIp,
          nickname,
          room: room || "subroom-1",
          slotIndex: null,
          wasMuted: true,
          isJoined: false,
          updatedAt: Date.now(),
        };
      }
      return NextResponse.json({ ok: true, ip: clientIp, session: ipSessionStore[clientIp] });
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
