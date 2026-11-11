"use client";
import { useId, useState } from "react";
import { MessageCircle, Mic, Send, Volume2, X } from "lucide-react";
import { SocialActionMenu } from "./social-action-menu";
import type { SocialAction } from "./social-actions";

type Props = {
  enabled: boolean; tts: boolean; voice: boolean; listening: boolean; micMuted: boolean; privateConversation: boolean;
  busy: boolean; working: boolean; saving: boolean; error: string; audioBlocked: boolean; canReplay: boolean; deafened: boolean;
  input: string; onInput: (value: string) => void; onSend: () => void; onClose: () => void; onReplay: () => void;
  onInteraction: (action: SocialAction) => void; onToggleVoice: () => void; onToggleEnabled: () => void; onToggleTts: () => void;
};
function Toggle({checked,disabled,label,onClick}:{checked:boolean;disabled:boolean;label:string;onClick:()=>void}) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={onClick}
    className={`relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-40 ${checked?"bg-amber-500":"bg-stone-600"}`}>
    <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-[left] ${checked?"left-5":"left-1"}`}/>
  </button>;
}
export function NpcPanel(p: Props) {
  const [tab,setTab]=useState<"actions"|"settings">("actions"),id=useId();
  const status=p.working?"생각 중":p.listening?"목소리 듣는 중":p.enabled?"대화 참여 중":"쉬는 중";
  const voiceStatus=!p.enabled?"참여 꺼짐":p.micMuted?"마이크 꺼짐":p.privateConversation?"귓속말 중지":p.listening?"연결됨":"연결 대기";
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]" onClick={p.onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} data-npc-dialog
      className="flex max-h-[calc(100dvh-32px)] w-full max-w-[380px] flex-col overflow-hidden rounded-2xl border border-stone-700 bg-[#191817] text-stone-100 shadow-2xl"
      onClick={e=>e.stopPropagation()} onKeyDown={e=>{e.stopPropagation();if(e.key==="Escape")p.onClose();}}>
      <header className="flex shrink-0 items-center gap-3 px-4 pb-3 pt-4">
        <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-sm font-semibold text-amber-200">루</span>
        <div className="min-w-0 flex-1"><h2 id={`${id}-title`} className="flex items-center gap-2 text-sm font-semibold">루미 <span className="rounded border border-stone-700 px-1 text-[9px] font-normal text-stone-400">AI 친구</span></h2>
          <p role="status" className="mt-0.5 flex items-center gap-1.5 text-[10px] text-stone-400"><span className={`h-1 w-1 rounded-full ${p.working?"bg-amber-400":p.enabled?"bg-emerald-400":"bg-stone-500"}`}/>{status}</p></div>
        {p.canReplay&&<button type="button" onClick={p.onReplay} disabled={p.deafened} aria-label="루미 최근 답변 듣기" title="최근 답변 음성 듣기" className="rounded-lg p-2 text-stone-400 hover:bg-white/5 hover:text-amber-200 disabled:opacity-30"><Volume2 className="h-4 w-4"/></button>}
        <button type="button" autoFocus onClick={p.onClose} aria-label="루미 대화 닫기" className="rounded-lg p-2 text-stone-400 hover:bg-white/5 hover:text-white"><X className="h-4 w-4"/></button>
      </header>
      <div role="tablist" aria-label="루미 메뉴" className="mx-4 flex shrink-0 rounded-lg bg-black/25 p-1">
        {([['actions','함께하기'],['settings','참여 설정']] as const).map(([value,label],index)=><button key={value} type="button" role="tab" id={`${id}-${value}-tab`} aria-selected={tab===value} aria-controls={`${id}-${value}`} tabIndex={tab===value?0:-1}
          onClick={()=>setTab(value)} onKeyDown={e=>{if(e.key==="ArrowRight"||e.key==="ArrowLeft"){e.preventDefault();setTab(value==="actions"?"settings":"actions");e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[1-index].focus();}}}
          className={`flex-1 rounded-md py-2 text-[11px] font-medium transition-colors ${tab===value?"bg-stone-700/70 text-white":"text-stone-400 hover:text-stone-200"}`}>{label}</button>)}
      </div>
      <div className="min-h-0 overflow-y-auto px-4 py-3">
        {tab==="actions"?<div role="tabpanel" id={`${id}-actions`} aria-labelledby={`${id}-actions-tab`}>
          <SocialActionMenu onSelect={p.onInteraction}/><p className="mt-2.5 text-center text-[10px] text-stone-500">루미에게 걸어가 함께 동작해요.</p>
        </div>:<div role="tabpanel" id={`${id}-settings`} aria-labelledby={`${id}-settings-tab`}>
          <div className="flex items-center justify-between gap-3 border-b border-stone-700/60 py-2"><div><p className="text-xs text-stone-200">방 대화 참여</p><p className="mt-0.5 text-[10px] text-stone-500">방 전체에 적용</p></div><Toggle label="루미 방 대화 참여" checked={p.enabled} disabled={p.saving} onClick={p.onToggleEnabled}/></div>
          <div className="flex items-center justify-between gap-3 border-b border-stone-700/60 py-2.5"><div className="min-w-0"><p className="flex items-center gap-1 text-xs text-stone-200"><Mic className="h-3 w-3 text-stone-500"/>내 목소리</p><p className={`mt-0.5 text-[10px] ${p.voice?"text-emerald-400":"text-stone-500"}`}>{p.voice?voiceStatus:"이 기기에서 연결"}</p></div>
            <button type="button" disabled={!p.enabled&&!p.voice} aria-label={p.voice?"내 목소리 연결 해제":"내 목소리 연결"} onClick={p.onToggleVoice} className="shrink-0 rounded-md border border-stone-600 px-3 py-1.5 text-[11px] text-stone-200 hover:border-stone-400 disabled:opacity-35">{p.voice?"해제":"연결"}</button></div>
          <div className="flex items-center justify-between gap-3 py-2.5"><div><p className="text-xs text-stone-200">음성 답변</p><p className="mt-0.5 text-[10px] text-stone-500">끄면 말풍선으로만 답해요</p></div><Toggle label="루미 음성 답변" checked={p.tts} disabled={p.saving} onClick={p.onToggleTts}/></div>
          <details className="mt-1 text-[10px] text-stone-500"><summary className="cursor-pointer py-1 hover:text-stone-300">음성 연결·개인정보 안내</summary><div className="space-y-2 pb-1 pt-2 leading-relaxed text-stone-400"><p>내 목소리를 연결하면 창을 닫아도 들어요. 마이크를 끄거나 귓속말 중에는 공유를 멈춰요.</p><p>이름·연락처·주소 등은 가리고, 개인정보를 알리는 문장은 제외한 뒤 EXAONE에 보내요. 음성 인식은 브라우저 제공 서비스를 사용해요.</p></div></details>
        </div>}
      </div>
      <footer className="shrink-0 border-t border-stone-700/60 px-4 pb-3 pt-3">
        {p.error&&<p role="alert" className="mb-2 text-[11px] leading-snug text-rose-300">{p.error}</p>}
        {p.audioBlocked&&<p className="mb-2 text-[10px] text-amber-300">위 음성 버튼을 눌러 답변을 들을 수 있어요.</p>}
        <form onSubmit={e=>{e.preventDefault();p.onSend();}} className="flex items-center gap-2 rounded-lg border border-stone-600 bg-black/25 p-1 pl-2.5">
          <MessageCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-stone-500"/>
          <input aria-label="루미에게 질문" value={p.input} maxLength={500} disabled={p.busy} onChange={e=>p.onInput(e.target.value)} placeholder="루미에게 한마디…" className="min-w-0 flex-1 bg-transparent py-1.5 text-[16px] font-normal text-stone-100 placeholder-stone-500 md:text-xs"/>
          <button type="submit" aria-label="루미에게 보내기" title="보내기" disabled={p.busy||!p.input.trim()} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-600 text-white hover:bg-amber-500 disabled:bg-stone-700 disabled:text-stone-500"><Send className="h-3.5 w-3.5"/></button>
        </form>
        <p className="mt-1.5 text-center text-[9px] text-stone-500">질문과 답변은 방 전체 채팅에 공유돼요.</p>
      </footer>
    </section>
  </div>;
}
