export const NPC_ID = "루미 · AI 안내원";
export type NpcReply = { type: "NPC_REPLY"; id: string; room: string; text: string; asker: string; sentAt: number; ambient?: boolean; tts?: boolean };
export function isNpcReply(value: unknown): value is NpcReply {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<NpcReply>;
  return v.type === "NPC_REPLY" && typeof v.id === "string" && v.id.length < 100 && typeof v.room === "string"
    && typeof v.text === "string" && v.text.length > 0 && v.text.length <= 600
    && typeof v.asker === "string" && v.asker.length <= 60 && typeof v.sentAt === "number" && Number.isFinite(v.sentAt);
}
