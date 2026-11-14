import type {PostPacket} from './map-posts';

/** Browser-backed posts stay queued until the room data channel is ready. */
export function createMapPostDelivery(publish:(packet:PostPacket)=>Promise<void>,canShare:()=>boolean,onPending:(count:number)=>void,now:()=>number=Date.now){
  let queue:PostPacket[]=[],running=false,version=0,failures=0,notBefore=0;
  const enqueue=(packet:PostPacket)=>{
    const id=packet.type==='MAP_POST_SYNC'?packet.post.id:'id' in packet?packet.id:undefined;
    const replace=(packet.type==='MAP_POST_SYNC'||packet.type==='MAP_POST_MOVE')&&id;
    const index=replace?queue.findIndex(p=>p.type===packet.type&&(p.type==='MAP_POST_SYNC'?p.post.id:'id' in p?p.id:undefined)===id):-1;
    if(index>=0)queue[index]=packet;else queue.push(packet);
    onPending(queue.length);
  };
  const drain=async(force=false)=>{
    if(running||!canShare()||(!force&&now()<notBefore))return;
    const ownVersion=version;running=true;
    try{
      while(queue.length&&canShare()&&version===ownVersion){
        const packet=queue[0];await publish(packet);
        if(version!==ownVersion)return;
        if(queue[0]===packet)queue.shift();
        failures=0;notBefore=0;
        onPending(queue.length);
      }
    }catch{if(version===ownVersion){failures++;notBefore=now()+Math.min(30000,1500*2**Math.min(5,failures-1));}}
    finally{if(version===ownVersion)running=false;}
  };
  const reset=()=>{version++;queue=[];running=false;failures=0;notBefore=0;};
  return {enqueue,drain,reset,get pending(){return queue.length;}};
}
