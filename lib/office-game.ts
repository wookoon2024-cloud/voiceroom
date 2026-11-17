export const OFFICE_GAME_VERSION='flight-v1';
export type OfficeRun={game:typeof OFFICE_GAME_VERSION;id:string;owner:string;nick:string;seed:number;startedAt:number;finishedAt:number;durationMs:number;status:'over'|'clear';score:number;kills:number;bosses:number;damage:number};
export type OfficeScore={run:OfficeRun;score:number;hits:number;misses:number};
export function validOfficeRun(value:unknown,now=Date.now()):value is OfficeRun{
 const r=value as OfficeRun;if(!r||r.game!==OFFICE_GAME_VERSION||typeof r.id!=='string'||!r.id||r.id.length>140||typeof r.owner!=='string'||!r.owner||r.owner.length>100||typeof r.nick!=='string'||!r.nick.trim()||r.nick.length>80)return false;
 if(!Number.isInteger(r.seed)||r.seed<0||r.seed>0xffffffff||!Number.isSafeInteger(r.startedAt)||r.startedAt<0||!Number.isSafeInteger(r.finishedAt)||r.finishedAt>now+10_000||now-r.finishedAt>6*60*60*1000)return false;
 if(!Number.isInteger(r.durationMs)||r.durationMs<0||r.durationMs>180_000||r.finishedAt-r.startedAt<r.durationMs-1000||r.finishedAt-r.startedAt>6*60*60*1000)return false;
 if(!Number.isInteger(r.score)||r.score<0||r.score>r.durationMs/1000*2500+5000||!Number.isInteger(r.kills)||r.kills<0||r.kills>r.durationMs/1000*10+10||!Number.isInteger(r.bosses)||r.bosses<0||r.bosses>6||r.bosses>r.kills||!Number.isInteger(r.damage)||r.damage<0||r.damage>3)return false;
 return r.status==='over'?r.damage===3:r.status==='clear'&&r.durationMs>=179_980&&r.damage<3;
}
export const officeScore=(run:OfficeRun):OfficeScore=>({run,score:run.score,hits:run.kills,misses:run.damage});
export function officeRanking(runs:OfficeRun[],now=Date.now()):OfficeScore[]{
 const compare=(a:OfficeScore,b:OfficeScore)=>b.score-a.score||b.run.bosses-a.run.bosses||b.hits-a.hits||b.run.durationMs-a.run.durationMs||a.misses-b.misses||a.run.finishedAt-b.run.finishedAt||a.run.owner.localeCompare(b.run.owner);
 const best=new Map<string,OfficeScore>();for(const run of runs){if(!validOfficeRun(run,now))continue;const candidate=officeScore(run),old=best.get(run.owner);if(!old||compare(candidate,old)<0)best.set(run.owner,candidate);}
 return [...best.values()].sort(compare).slice(0,20);
}
