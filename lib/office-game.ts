export const OFFICE_GAME_MS=30_000;
export type OfficeInput={at:number;cell:number};
export type OfficeRun={id:string;owner:string;nick:string;seed:number;startedAt:number;finishedAt:number;inputs:OfficeInput[]};
export type OfficeTarget={at:number;until:number;cell:number};
export type OfficeScore={run:OfficeRun;score:number;hits:number;misses:number;combo:number;target:OfficeTarget|null;cleared:boolean};
export function officeTargets(seed:number):OfficeTarget[]{
 let state=seed>>>0,last=-1,at=0;const targets:OfficeTarget[]=[];
 while(at<OFFICE_GAME_MS){state=(Math.imul(state,1664525)+1013904223)>>>0;let cell=state%9;if(cell===last)cell=(cell+1)%9;last=cell;const until=Math.min(OFFICE_GAME_MS,at+Math.round(950-400*at/OFFICE_GAME_MS));targets.push({at,until,cell});at=until;}
 return targets;
}
export function officeFrame(seed:number,inputs:OfficeInput[],elapsed:number){
 const targets=officeTargets(seed),end=Math.max(0,Math.min(OFFICE_GAME_MS,elapsed));let index=0,score=0,hits=0,misses=0,combo=0,cleared=false;
 const expire=(at:number)=>{while(index<targets.length&&targets[index].until<=at){if(!cleared){misses++;combo=0;}index++;cleared=false;}};
 for(const input of inputs){if(input.at>end)break;expire(input.at);const target=targets[index];if(target&&input.at>=target.at&&input.cell===target.cell&&!cleared){score+=10+Math.min(combo,10)*2;hits++;combo++;cleared=true;}else{score=Math.max(0,score-5);combo=0;misses++;}}
 expire(end);return{score,hits,misses,combo,target:targets[index]??null,cleared};
}
export function validOfficeRun(value:unknown,now=Date.now()):value is OfficeRun{
 const r=value as OfficeRun;if(!r||typeof r.id!=='string'||r.id.length>140||!r.id||typeof r.owner!=='string'||!r.owner||r.owner.length>100||typeof r.nick!=='string'||!r.nick.trim()||r.nick.length>80||!Number.isInteger(r.seed)||r.seed<0||r.seed>0xffffffff||!Number.isSafeInteger(r.startedAt)||r.startedAt<0||!Number.isSafeInteger(r.finishedAt)||r.finishedAt-r.startedAt!==OFFICE_GAME_MS||r.finishedAt>now+10_000||now-r.finishedAt>6*60*60*1000||!Array.isArray(r.inputs)||r.inputs.length>180)return false;
 let previous=-1;for(const input of r.inputs){if(!input||!Number.isInteger(input.at)||input.at<0||input.at>=OFFICE_GAME_MS||input.at<previous||!Number.isInteger(input.cell)||input.cell<0||input.cell>8)return false;previous=input.at;}return true;
}
export const officeScore=(run:OfficeRun):OfficeScore=>({run,...officeFrame(run.seed,run.inputs,OFFICE_GAME_MS)});
export function officeRanking(runs:OfficeRun[],now=Date.now()):OfficeScore[]{
 const compare=(a:OfficeScore,b:OfficeScore)=>b.score-a.score||b.hits-a.hits||a.misses-b.misses||a.run.finishedAt-b.run.finishedAt||a.run.owner.localeCompare(b.run.owner);
 const best=new Map<string,OfficeScore>();for(const run of runs){if(!validOfficeRun(run,now))continue;const candidate=officeScore(run),old=best.get(run.owner);if(!old||compare(candidate,old)<0)best.set(run.owner,candidate);}
 return [...best.values()].sort(compare).slice(0,20);
}
