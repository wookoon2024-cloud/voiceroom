export const NPC_AMBIENT_ATTRIBUTE = "npc.ambient.v1";
export type NpcAmbientState = { enabled: boolean; tts: boolean; lastReplyAt: number; lastAttemptAt: number; updatedAt: number; lease?: { id: string; owner: string; until: number } };
export type NpcUtterance = { type: "NPC_UTTERANCE"; id: string; room: string; speaker: string; text: string; sentAt: number };
export const DEFAULT_NPC_AMBIENT: NpcAmbientState = { enabled: true, tts: false, lastReplyAt: 0, lastAttemptAt: 0, updatedAt: 0 };
export const callsLumi = (text: string) => /루미(?:야|씨|님|는|가|도|에게|한테)?[\s,.!?~]|루미$/i.test(text);
export const canShareNpcVoice = (state: { enabled: boolean; requested: boolean; micMuted: boolean; privateConversation: boolean; speaking: boolean }) => state.enabled && state.requested && !state.micMuted && !state.privateConversation && !state.speaking;
export function ambientState(metadata?: string): NpcAmbientState {
  try {
    const value = JSON.parse(metadata || "{}").npcAmbient;
    return value && typeof value.enabled === "boolean" && typeof value.tts === "boolean"
      ? { enabled: value.enabled, tts: value.tts, lastReplyAt: Number(value.lastReplyAt) || 0, lastAttemptAt: Number(value.lastAttemptAt) || 0, updatedAt: Number(value.updatedAt) || 0, lease: value.lease } : { ...DEFAULT_NPC_AMBIENT };
  } catch { return { ...DEFAULT_NPC_AMBIENT }; }
}
export function npcLeader(participants: { identity: string; attributes: Record<string, string> }[]): string | undefined {
  return participants.filter(p => p.attributes[NPC_AMBIENT_ATTRIBUTE] === "1").map(p => p.identity).sort()[0];
}
export function isNpcUtterance(value: unknown): value is NpcUtterance {
  if (!value || typeof value !== "object") return false;
  const v = value as NpcUtterance;
  return v.type === "NPC_UTTERANCE" && typeof v.id === "string" && v.id.length <= 120 && v.id.length > 0
    && typeof v.room === "string" && typeof v.speaker === "string" && v.speaker.length > 0 && v.speaker.length <= 60
    && typeof v.text === "string" && v.text.trim().length > 0 && v.text.length <= 500 && Number.isFinite(v.sentAt);
}

/** Every client retains the same short public context; only the elected client requests a turn. */
export class AmbientContext {
  entries: NpcUtterance[] = [];
  private seen = new Set<string>();
  private handled = new Set<string>();
  clear() { this.entries = []; this.seen.clear(); this.handled.clear(); }
  add(entry: NpcUtterance, now = Date.now()) {
    if (!isNpcUtterance(entry) || this.seen.has(entry.id) || Math.abs(now - entry.sentAt) > 120_000) return false;
    if (this.seen.size > 500) { this.seen.clear(); this.handled.clear(); }
    this.seen.add(entry.id); this.entries = [...this.entries.filter(x => now - x.sentAt < 120_000), entry].sort((a, b) => a.sentAt - b.sentAt).slice(-20);
    return true;
  }
  consume(entries: NpcUtterance[]) { entries.forEach(x => this.handled.add(x.id)); }
  plan(state: NpcAmbientState, now: number, humanSpeaking: boolean, lastActivity: number) {
    if (!state.enabled || humanSpeaking || (state.lease && state.lease.until > now)) return null;
    const fresh = this.entries.filter(e => !this.handled.has(e.id) && now - e.sentAt < 90_000);
    if (!fresh.length) return null;
    const called = fresh.some(e => callsLumi(e.text));
    const quiet = called ? 1800 : 3500;
    if (now - Math.max(lastActivity, fresh.at(-1)!.sentAt) < quiet) return null;
    if (now - state.lastReplyAt < (called ? 10_000 : 45_000) || now - state.lastAttemptAt < (called ? 10_000 : 30_000)) return null;
    if (!called && (fresh.length < 3 && fresh.reduce((sum, e) => sum + e.text.length, 0) < 55)) return null;
    return { context: this.entries.filter(e => now - e.sentAt < 120_000).slice(-12), fresh, called };
  }
}
