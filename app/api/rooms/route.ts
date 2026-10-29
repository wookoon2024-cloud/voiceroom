import { NextResponse } from "next/server";
import { roomTopics } from "../topic_store";
import { ALLOWED_ROOMS, getLiveKitConfig, getRoomService } from "../../../lib/livekit";

export const dynamic = "force-dynamic";

export async function GET() {
  const counts: Record<string, number> = {};
  const participants: Record<string, string[]> = {};
  const topics: Record<string, string> = {};
  for (const name of ALLOWED_ROOMS) {
    counts[name] = 0;
    participants[name] = [];
    topics[name] = roomTopics[name] || "소그룹 대화";
  }

  const cfg = getLiveKitConfig();
  if (!cfg) {
    return NextResponse.json({ ok: false, error: "Server misconfigured", ...counts, participants, topics }, { status: 503 });
  }

  try {
    const roomService = getRoomService(cfg);
    const rooms = await roomService.listRooms([...ALLOWED_ROOMS]);
    for (const r of rooms) {
      if (r.name && counts[r.name] !== undefined) {
        counts[r.name] = r.numParticipants || 0;
        if (r.metadata) {
          try {
            const meta = JSON.parse(r.metadata);
            if (meta.topic) {
              topics[r.name] = meta.topic;
              roomTopics[r.name] = meta.topic;
            }
          } catch (e) {}
        }
        if (counts[r.name] > 0) {
          try {
            const parts = await roomService.listParticipants(r.name);
            participants[r.name] = parts.map((p) => p.name || p.identity).filter(Boolean);
          } catch (e) {}
        }
      }
    }
  } catch (e) {
    // 조회 실패를 0명으로 응답하면 봇이 세션 종료로 오인하므로 실패임을 명시
    console.error("LiveKit listRooms error:", e);
    return NextResponse.json({ ok: false, error: "LiveKit unavailable", ...counts, participants, topics }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    ...counts,
    participants,
    topics,
  });
}
