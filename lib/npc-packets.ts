export const NPC_ID = "루미 · AI 안내원";
export type NpcReply = { type: "NPC_REPLY"; id: string; room: string; text: string; asker: string; sentAt: number; ambient?: boolean; tts?: boolean; questionId?: string };
export type NpcQuestion = { type: "NPC_QUESTION"; id: string; room: string; text: string; asker: string; sentAt: number; source?: "voice" };
export function isNpcQuestion(value: unknown): value is NpcQuestion {
  if (!value || typeof value !== "object") return false;
  const v = value as NpcQuestion;
  return v.type === "NPC_QUESTION" && typeof v.id === "string" && v.id.length > 0 && v.id.length <= 120 && typeof v.room === "string"
    && typeof v.text === "string" && v.text.length > 0 && v.text.length <= 500
    && typeof v.asker === "string" && v.asker.length > 0 && v.asker.length <= 60 && Number.isFinite(v.sentAt) && (v.source === undefined || v.source === "voice");
}
export function isNpcReply(value: unknown): value is NpcReply {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<NpcReply>;
  return v.type === "NPC_REPLY" && typeof v.id === "string" && v.id.length < 100 && typeof v.room === "string"
    && typeof v.text === "string" && v.text.length > 0 && v.text.length <= 600
    && typeof v.asker === "string" && v.asker.length <= 60 && typeof v.sentAt === "number" && Number.isFinite(v.sentAt);
}
