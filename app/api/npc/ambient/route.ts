import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { DataPacket_Kind, TokenVerifier } from "livekit-server-sdk";
import { getLiveKitConfig, getRoomService, isAllowedRoom } from "@/lib/livekit";
import { ambientState, callsLumi, isNpcUtterance, npcLeader, NPC_AMBIENT_ATTRIBUTE, type NpcAmbientState, type NpcUtterance } from "@/lib/npc-ambient";
import { askExaone, ExaoneRateLimitError, NPC_AMBIENT_PROMPT } from "@/lib/exaone";
import { isNpcReply, type NpcReply, type NpcQuestion } from "@/lib/npc-packets";
import { maskPersonalInfo, hasPublicContent } from "@/lib/npc-privacy";
import { isSocialAction } from "@/lib/social-actions";
import { quickNpcReply } from "@/lib/npc-quick-replies";

export const runtime = "nodejs";
export const maxDuration = 150;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const signature = (reply: NpcReply, secret: string) => createHmac("sha256", secret).update(JSON.stringify(reply)).digest("hex");

export async function POST(req: NextRequest) {
  try {
    if (req.headers.get("origin") && req.headers.get("origin") !== req.nextUrl.origin) return json({ error: "허용되지 않은 요청입니다." }, 403);
    const raw = await req.text();
    if (raw.length > 18_000) return json({ error: "대화 기록이 너무 길어요." }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: "잘못된 요청입니다." }, 400); }
    if (!body || !isAllowedRoom(body.room)) return json({ error: "방을 확인해 주세요." }, 400);
    const { room, action } = body, cfg = getLiveKitConfig();
    const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!cfg || !token) return json({ error: "방에 입장한 뒤 이용해 주세요." }, 401);
    const service = getRoomService(cfg);
    let identity: string;
    try {
      const claims = await new TokenVerifier(cfg.apiKey, cfg.apiSecret).verify(token);
      if (!claims.sub || claims.video?.room !== room || !claims.video?.roomJoin) return json({ error: "현재 방에서만 이용할 수 있어요." }, 403);
      identity = claims.sub;
      await service.getParticipant(room, identity);
    } catch { return json({ error: "방 연결을 확인해 주세요." }, 401); }

    const read = async () => {
      const rooms = await service.listRooms([room]), metadata = rooms[0]?.metadata || "{}";
      let data: Record<string, unknown> = {};
      try { const parsed = JSON.parse(metadata); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) data = parsed; } catch { /* Empty metadata. */ }
      return { data, state: ambientState(metadata) };
    };
    const write = async (state: NpcAmbientState, configure = false) => {
      const current = await read();
      const next = { ...state, ...(!configure ? { enabled: current.state.enabled, tts: current.state.tts } : {}),
        lastReplyAt: Math.max(state.lastReplyAt, current.state.lastReplyAt), lastAttemptAt: Math.max(state.lastAttemptAt, current.state.lastAttemptAt), updatedAt: Math.max(Date.now(), current.state.updatedAt + 1) };
      if (!next.enabled) delete next.lease;
      await service.updateRoomMetadata(room, JSON.stringify({ ...current.data, npcAmbient: next }));
      return next;
    };
    if (action === "register") {
      await service.updateParticipant(room, identity, { attributes: { [NPC_AMBIENT_ATTRIBUTE]: "1" } });
      return json({ state: (await read()).state });
    }
    if (action === "configure") {
      if (typeof body.enabled !== "boolean" || typeof body.tts !== "boolean") return json({ error: "설정을 확인해 주세요." }, 400);
      const state = { ...(await read()).state, enabled: body.enabled, tts: body.tts };
      if (!state.enabled) delete state.lease;
      return json({ state: await write(state, true) });
    }
    if (action === "reaction") {
      if (!isSocialAction(body.socialAction)) return json({ error: "상호작용을 확인해 주세요." }, 400);
      let state = (await read()).state;
      if (!state.enabled) return json({ skip: "disabled", state });
      state = await write({ ...state, lastReplyAt: Date.now(), lease: undefined });
      if (!state.enabled) return json({ skip: "disabled", state });
      const reactions = { hug: "포근하네요. 같이 편하게 쉬어가요.", kiss: "반가운 마음 잘 받았어요.", punch: "앗, 장난은 살살 해주세요!", highfive: "짝! 호흡이 잘 맞네요.", handshake: "만나서 반가워요. 앞으로 잘 지내봐요.", pat: "다정하게 대해주셔서 고마워요.", gift: "고마워요! 마음만으로도 기분이 좋아지네요.", dance: "좋아요, 함께 신나게 춤춰봐요!" };
      const reply: NpcReply = { type: "NPC_REPLY", id: crypto.randomUUID(), room, asker: identity, text: reactions[body.socialAction as keyof typeof reactions], sentAt: Date.now(), ambient: true, tts: state.tts };
      await service.sendData(room, new TextEncoder().encode(JSON.stringify(reply)), DataPacket_Kind.RELIABLE, {});
      return json({ reply, state });
    }
    const participants = await service.listParticipants(room);
    if (npcLeader(participants) !== identity) return json({ skip: "not-leader" }, 409);
    let { state } = await read();
    if (!state.enabled) return json({ skip: "disabled", state });
    const now = Date.now();
    if (action === "publish") {
      const reply = body.reply;
      if (!isNpcReply(reply) || !reply.ambient || reply.room !== room || reply.asker !== identity || Math.abs(now - reply.sentAt) > 75_000 || typeof body.signature !== "string") return json({ error: "발언을 확인해 주세요." }, 400);
      const expected = Buffer.from(signature(reply, cfg.apiSecret)), received = Buffer.from(body.signature);
      if (expected.length !== received.length || !timingSafeEqual(expected, received)) return json({ error: "유효하지 않은 발언입니다." }, 403);
      if (state.lease?.id !== reply.id || state.lease.owner !== identity || state.lease.until < now) return json({ skip: "expired", state });
      state = { ...state, lastReplyAt: now, lease: undefined };
      state = await write(state);
      if (!state.enabled) return json({ skip: "disabled", state });
      const published = { ...reply, sentAt: now, tts: state.tts };
      await service.sendData(room, new TextEncoder().encode(JSON.stringify(published)), DataPacket_Kind.RELIABLE, {});
      return json({ reply: published, state });
    }
    if (action !== "turn") return json({ error: "잘못된 요청입니다." }, 400);
    const context: NpcUtterance[] = body.context, freshIds: string[] = body.freshIds;
    const members = new Set(participants.map(p => p.identity));
    if (!Array.isArray(context) || !context.length || context.length > 12 || context.some(e => !isNpcUtterance(e) || e.room !== room || !members.has(e.speaker) || Math.abs(now - e.sentAt) > 125_000)
      || !Array.isArray(freshIds) || !freshIds.length || freshIds.length > 12 || freshIds.some(id => typeof id !== "string" || !context.some(e => e.id === id))) return json({ error: "대화 기록을 확인해 주세요." }, 400);
    const fresh = context.filter(e => freshIds.includes(e.id)), called = fresh.some(e => callsLumi(e.text));
    if (state.lease && state.lease.until > now && state.lease.owner === identity) return json({ skip: "busy", state });
    if (now - state.lastReplyAt < (called ? 10_000 : 45_000) || now - state.lastAttemptAt < (called ? 10_000 : 30_000)) return json({ skip: "cooldown", state });
    if (!called && fresh.length < 3 && fresh.reduce((n, e) => n + e.text.length, 0) < 55) return json({ skip: "little-context", state });
    const id = crypto.randomUUID();
    state = { ...state, lastAttemptAt: now, lease: { id, owner: identity, until: now + 160_000 } };
    await write(state);
    if ((await read()).state.lease?.id !== id) return json({ skip: "busy" });
    try {
      const aliases = [...members], names = [...members];
      const publicConversation = context.slice(-8).map(e => ({ speaker: `참가자 ${aliases.indexOf(e.speaker) + 1}`, text: maskPersonalInfo(e.text, names).slice(0,240) })).filter(e => hasPublicContent(e.text));
      const transcript = publicConversation.map(e=>`${e.speaker}: ${e.text}`).join("\n");
      const direct = fresh.filter(e=>callsLumi(e.text)).at(-1);
      let question: NpcQuestion | undefined;
      if (direct) {
        question = { type:"NPC_QUESTION",id:crypto.randomUUID(),room,asker:direct.speaker,text:maskPersonalInfo(direct.text,names).slice(0,500),sentAt:Date.now() };
        await service.sendData(room,new TextEncoder().encode(JSON.stringify(question)),DataPacket_Kind.RELIABLE,{});
      }
      const quick = direct ? quickNpcReply(maskPersonalInfo(direct.text, names)) : null;
      const text = publicConversation.length ? quick ?? await askExaone([{ role: "user", content: `${transcript}\n${called ? "루미를 불렀어요. 짧게 대답해 주세요." : "보탤 말이 있으면 한마디 해 주세요."}` }], req.signal, NPC_AMBIENT_PROMPT, 768) : "[PASS]";
      const latest = (await read()).state;
      if (!latest.enabled || latest.lease?.id !== id) return json({ skip: "cancelled", state: latest });
      if (text.trim() === "[PASS]") { delete latest.lease; await write(latest); return json({ skip: "pass", state: latest }); }
      const reply: NpcReply = { type: "NPC_REPLY", id, room, text: text.slice(0, 200), asker: identity, sentAt: Date.now(), ambient: true, tts: latest.tts, ...(question ? { questionId: question.id } : {}) };
      return json({ draft: reply, signature: signature(reply, cfg.apiSecret), state: latest, question });
    } catch (e) {
      const latest = (await read()).state;
      if (latest.lease?.id === id) { delete latest.lease; await write(latest); }
      throw e;
    }
  } catch (error) {
    if (error instanceof ExaoneRateLimitError) return NextResponse.json({ error: "AI 제공 서버의 요청 한도로 루미가 잠시 쉬고 있어요.", retryAfter: error.retryAfter }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(error.retryAfter) } });
    return json({ error: "루미 연결이 지연되고 있어요. 잠시 후 다시 참여할게요." }, 502);
  }
}
