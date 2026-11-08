import type { PlazaPos } from "./plaza";
export type BenchClaim = { identity: string; theme: string; benchId: string; claimId: string; claimedAt: number; seat: 0 | 1 };
export type BenchRequest = { id: string; benchId: string; target: PlazaPos };
/** All peers resolve simultaneous reservations identically; a bench has exactly two places. */
export function resolveBenchClaims(claims: BenchClaim[]): Record<string, BenchClaim> {
  const result: Record<string, BenchClaim> = {}, used = new Map<string, Set<number>>();
  for (const claim of [...claims].sort((a,b)=>a.claimedAt-b.claimedAt || (a.claimId < b.claimId ? -1 : a.claimId > b.claimId ? 1 : 0))) {
    const key=`${claim.theme}/${claim.benchId}`, occupied=used.get(key) ?? new Set<number>();
    const seat=occupied.has(claim.seat) ? ([0,1] as const).find(s=>!occupied.has(s)) : claim.seat;
    if (seat === undefined) continue;
    occupied.add(seat); used.set(key,occupied); result[claim.identity]={...claim,seat};
  }
  return result;
}
