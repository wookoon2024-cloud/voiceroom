import { findWalkPath, walkDistance, type BlockedPoint, type WalkPoint } from "./plaza-navigation";
export type NpcHold = { phase: number; until: number; issuedAt: number; x: number; y: number };
export const npcPhase = (now: number, hold?: NpcHold) => hold ? hold.phase + Math.max(0, now - hold.until) : now;
export const NPC_WAYPOINTS: WalkPoint[] = [{x:.60,y:.47},{x:.69,y:.47},{x:.69,y:.60},{x:.61,y:.65},{x:.60,y:.58},{x:.60,y:.47}];
export type NpcRoute = { from: WalkPoint; to: WalkPoint; duration: number; pause: boolean }[];
export function buildNpcRoute(blocked: BlockedPoint): NpcRoute {
  const route: NpcRoute = [];
  for (let i=1;i<NPC_WAYPOINTS.length;i++) {
    const path=findWalkPath(NPC_WAYPOINTS[i-1],NPC_WAYPOINTS[i],blocked);
    if (!path) return [];
    let from=NPC_WAYPOINTS[i-1];
    for (const to of path) { route.push({from,to,duration:Math.max(300,walkDistance(from,to)/.055*1000),pause:false});from=to; }
    route.push({from,to:from,duration:3200,pause:true});
  }
  return route;
}
export function sampleNpcRoute(route: NpcRoute, phase: number) {
  const total=route.reduce((n,s)=>n+s.duration,0);
  if (!total) return { ...NPC_WAYPOINTS[0], walking:false, dir:"down" as const, facing:1 as const };
  let elapsed=((phase%total)+total)%total;
  for (const step of route) {
    if (elapsed<step.duration) {
      const t=elapsed/step.duration, dx=step.to.x-step.from.x,dy=step.to.y-step.from.y;
      const dir: "down"|"up"|"left"|"right"=step.pause?"down":Math.abs(dy)>Math.abs(dx)*1.15?(dy<0?"up":"down"):(dx<0?"left":"right");
      return {x:step.from.x+dx*t,y:step.from.y+dy*t,walking:!step.pause,dir,facing:dx<0?-1 as const:1 as const};
    }
    elapsed-=step.duration;
  }
  return { ...NPC_WAYPOINTS[0], walking:false, dir:"down" as const, facing:1 as const };
}
export function isNpcHold(value: unknown): value is NpcHold {
  if (!value || typeof value!=="object") return false;
  const v=value as NpcHold;
  return [v.phase,v.until,v.issuedAt,v.x,v.y].every(Number.isFinite)&&v.x>=.04&&v.x<=.96&&v.y>=.065&&v.y<=.955&&v.until-v.issuedAt<=35_000&&v.until>=v.issuedAt;
}
