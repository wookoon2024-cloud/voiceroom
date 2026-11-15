/** Refresh SDK membership and retry app snapshots after mobile suspension/data-channel startup. */
export function startRoomPresence(options:{
  connected:()=>boolean;
  members:()=>string[];
  onMembers:(members:string[])=>void;
  sync:()=>void;
  visible:()=>boolean;
  events:{addEventListener:(name:string,fn:()=>void)=>void;removeEventListener:(name:string,fn:()=>void)=>void};
  documentEvents:{addEventListener:(name:string,fn:()=>void)=>void;removeEventListener:(name:string,fn:()=>void)=>void};
}) {
  let stopped=false;
  const timers=new Set<ReturnType<typeof setTimeout>>();
  const refresh=()=>{if(!stopped&&options.visible()&&options.connected())options.onMembers([...new Set(options.members())]);};
  const wake=()=>{
    if(stopped||!options.visible())return;
    for(const timer of timers)clearTimeout(timer);timers.clear();
    refresh();
    for(const delay of [0,1500,4000,10000]){
      const timer=setTimeout(()=>{timers.delete(timer);if(!stopped&&options.visible()&&options.connected()){refresh();options.sync();}},delay);
      timers.add(timer);
    }
  };
  // Poll membership without repeatedly broadcasting snapshots in an idle room.
  const interval=setInterval(refresh,10000);
  options.events.addEventListener('online',wake);options.events.addEventListener('pageshow',wake);
  options.documentEvents.addEventListener('visibilitychange',wake);
  wake();
  return {wake,refresh,stop:()=>{
    stopped=true;clearInterval(interval);for(const timer of timers)clearTimeout(timer);timers.clear();
    options.events.removeEventListener('online',wake);options.events.removeEventListener('pageshow',wake);
    options.documentEvents.removeEventListener('visibilitychange',wake);
  }};
}

/** Fresh-token rejoin only after the SDK has exhausted its own reconnects. */
export function startRoomRecovery(attempt:()=>Promise<boolean>,exhausted:()=>void){
  let cancelled=false,index=0,timer:ReturnType<typeof setTimeout>;
  const delays=[1500,4000,8000];
  const schedule=()=>{
    timer=setTimeout(async()=>{
      if(cancelled)return;
      let connected=false;
      try{connected=await attempt();}catch{}
      if(cancelled||connected)return;
      index++;if(index<delays.length)schedule();else exhausted();
    },delays[index]);
  };
  schedule();return {cancel:()=>{cancelled=true;clearTimeout(timer);}};
}
