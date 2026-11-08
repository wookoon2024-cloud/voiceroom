import { isSocialAction } from "./social-actions";

/** Sender wall clocks must never be used to expire a receiver's one-shot. */
export function receivedSocialStart(packet: { sentAt?: unknown; startedAt?: unknown }, receivedAt: number) {
  if (typeof packet.sentAt !== "number" || typeof packet.startedAt !== "number") return receivedAt + 80;
  const lead = Math.max(0, Math.min(250, packet.startedAt - packet.sentAt));
  const apparentTransit = receivedAt - packet.sentAt;
  // Use small plausible transport age only to shorten the lead-in, never the animation.
  // Large differences are clock skew (or a late packet): play the complete action locally.
  const transit = apparentTransit >= 0 && apparentTransit < 1000 ? Math.min(lead, apparentTransit) : 0;
  return receivedAt + lead - transit;
}

export function canReplaceSocial(activeUntil: number | undefined, incomingPose: unknown, now: number) {
  return !activeUntil || now >= activeUntil || isSocialAction(incomingPose);
}
