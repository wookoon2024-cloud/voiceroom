import type { PlazaPos } from "./plaza";
export type BenchClaim = { identity: string; theme: string; benchId: string; claimId: string; claimedAt: number; seat: 0 | 1 };
export type BenchRequest = { id: string; benchId: string; target: PlazaPos };
/** All peers use the map's one- or two-place capacity and deterministic ordering. */
export function resolveBenchClaims(claims: BenchClaim[],capacity:(theme:string,bench:string)=>number=()=>2): Record<string, BenchClaim> {
  const result: Record<string, BenchClaim> = {}, used = new Map<string, Set<number>>();
  for (const claim of [...claims].sort((a,b)=>a.claimedAt-b.claimedAt || (a.claimId < b.claimId ? -1 : a.claimId > b.claimId ? 1 : 0))) {
    const key=`${claim.theme}/${claim.benchId}`, occupied=used.get(key) ?? new Set<number>();
    const places=([0,1] as const).slice(0,Math.max(0,Math.min(2,capacity(claim.theme,claim.benchId))));
    if(!places.includes(claim.seat))continue;
    const seat=occupied.has(claim.seat) ? places.find(s=>!occupied.has(s)) : claim.seat;
    if (seat === undefined) continue;
    occupied.add(seat); used.set(key,occupied); result[claim.identity]={...claim,seat};
  }
  return result;
}
