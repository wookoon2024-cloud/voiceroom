import { NextRequest, NextResponse } from "next/server";
import { DataPacket_Kind, TokenVerifier } from "livekit-server-sdk";
import { getLiveKitConfig, getRoomService, isAllowedRoom } from "@/lib/livekit";
import { askExaone, type NpcMessage } from "@/lib/exaone";
import type { NpcReply } from "@/lib/npc-packets";

export const runtime = "nodejs";
export const maxDuration = 60;
const requests = new Map<string, { count: number; until: number }>();
function allow(key: string, max: number) {
  const now = Date.now();
  for (const [k, v] of requests) if (v.until < now) requests.delete(k);
  const current = requests.get(key) ?? { count: 0, until: now + 60_000 };
  if (current.count >= max) return false;
  current.count++; requests.set(key, current); return true;
}
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get("origin");
    if (origin && origin !== req.nextUrl.origin) return json({ error: "허용되지 않은 요청입니다." }, 403);
    const raw = await req.text();
    if (raw.length > 12_000) return json({ error: "질문이 너무 길어요." }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: "질문 형식이 올바르지 않아요." }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "질문 형식이 올바르지 않아요." }, 400);
    const { room, prompt, history = [] } = body;
    if (!isAllowedRoom(room) || typeof prompt !== "string" || !prompt.trim() || prompt.length > 500 || !Array.isArray(history) || history.length > 8
      || history.some((m: NpcMessage) => !m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string" || m.content.length > 600)) {
      return json({ error: "질문은 500자 이내로 입력해 주세요." }, 400);
    }
    const cfg = getLiveKitConfig();
    const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!cfg || !token) return json({ error: "방에 입장한 뒤 다시 시도해 주세요." }, 401);
    let identity: string;
    try {
      const claims = await new TokenVerifier(cfg.apiKey, cfg.apiSecret).verify(token);
      if (claims.video?.room !== room || !claims.video.roomJoin || !claims.sub) return json({ error: "현재 방에서만 대화할 수 있어요." }, 403);
      identity = claims.sub;
      await getRoomService(cfg).getParticipant(room, identity);
    } catch { return json({ error: "방 연결을 확인한 뒤 다시 시도해 주세요." }, 401); }
    if (!allow(`${room}:${identity}`, 8) || !allow(room, 24)) return json({ error: "잠시 쉬었다가 다시 말을 걸어 주세요." }, 429);
    const text = await askExaone([...history, { role: "user", content: prompt.trim() }], req.signal);
    const reply: NpcReply = { type: "NPC_REPLY", id: crypto.randomUUID(), room, text, asker: identity, sentAt: Date.now() };
    let shared = true;
    try { await getRoomService(cfg).sendData(room, new TextEncoder().encode(JSON.stringify(reply)), DataPacket_Kind.RELIABLE, {}); }
    catch { shared = false; }
    return json({ reply, shared });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const message = code === "NOT_CONFIGURED" ? "루미가 아직 준비 중이에요. 잠시 후 다시 시도해 주세요."
      : code === "RATE_LIMIT" ? "지금 질문이 많아요. 잠시 후 다시 시도해 주세요."
      : "답변을 받지 못했어요. 잠시 후 다시 시도해 주세요.";
    return json({ error: message }, code === "NOT_CONFIGURED" ? 503 : code === "RATE_LIMIT" ? 429 : 502);
  }
}
