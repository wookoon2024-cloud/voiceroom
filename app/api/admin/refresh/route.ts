import {NextRequest,NextResponse} from 'next/server';
import {DataPacket_Kind} from 'livekit-server-sdk';
import {randomUUID} from 'node:crypto';
import {ALLOWED_ROOMS,getLiveKitConfig,getRoomService,isAllowedRoom} from '@/lib/livekit';
import {REFRESH_COOKIE,equalSecret,adminSession,validAdminSession} from '@/lib/admin-refresh';
export const runtime='nodejs';
const lastRefresh=new Map<string,number>();
export async function POST(req:NextRequest){
  const json=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
  const origin=req.headers.get('origin');if(origin&&origin!==req.nextUrl.origin)return json({error:'허용되지 않은 요청입니다.'},403);
  const key=process.env.ADMIN_REFRESH_KEY?.trim();if(!key)return json({error:'새로고침 관리코드가 설정되지 않았어요.'},503);
  const supplied=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  if(!equalSecret(supplied,key)&&!validAdminSession(req.cookies.get(REFRESH_COOKIE)?.value||'',key))return json({error:'관리코드를 확인해 주세요.'},401);
  try{
    const body=await req.json();if(!['preview','refresh'].includes(body.action)||!['all','room'].includes(body.scope)||(body.scope==='room'&&!isAllowedRoom(body.room)))return json({error:'새로고침 범위를 확인해 주세요.'},400);
    const config=getLiveKitConfig();if(!config)return json({error:'방 서버 연결을 확인해 주세요.'},503);
    const service=getRoomService(config),names=body.scope==='all'?[...ALLOWED_ROOMS]:[body.room as string];
    const rooms=await service.listRooms(names),targets=rooms.filter(r=>r.name&&names.includes(r.name)&&r.numParticipants>0);
    const counts=targets.map(r=>({room:r.name,count:r.numParticipants})),total=counts.reduce((n,r)=>n+r.count,0);
    const now=Date.now();let notified=0;const failed:string[]=[];
    if(body.action==='refresh'){
      if(targets.some(r=>now-(lastRefresh.get(r.name)??0)<30_000))return json({error:'방금 새로고침을 요청했어요. 30초 후 다시 시도해 주세요.'},429);
      const results=await Promise.allSettled(targets.map(async r=>{lastRefresh.set(r.name,now);await service.sendData(r.name,new TextEncoder().encode(JSON.stringify({type:'ROOM_FORCE_REFRESH',id:randomUUID(),room:r.name,sentAt:now,reloadAt:now+3000})),DataPacket_Kind.RELIABLE,{});return r;}));
      results.forEach((result,i)=>{if(result.status==='fulfilled')notified+=targets[i].numParticipants;else{failed.push(targets[i].name);lastRefresh.delete(targets[i].name);}});
    }
    const response=json({ok:failed.length===0,counts,total,notified,failed});
    response.cookies.set(REFRESH_COOKIE,adminSession(key),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/api/admin/refresh',maxAge:8*60*60});return response;
  }catch{return json({error:'접속자 정보를 가져오지 못했어요. 다시 시도해 주세요.'},502);}
}
