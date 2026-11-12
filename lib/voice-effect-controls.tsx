"use client";
import {useEffect} from 'react';
import {Mic,Headphones} from 'lucide-react';
import {VOICE_EFFECTS} from './voice-effects';
import type {useVoiceEffects} from './use-voice-effects';

export function VoiceEffectControls({effects,muted}:{effects:ReturnType<typeof useVoiceEffects>;muted:boolean}) {
  useEffect(()=>effects.stopPreview,[effects.stopPreview]);
  return <section className="border-t border-stone-700/60 pt-3 space-y-2" aria-label="음성 변조">
    <div className="flex items-center justify-between"><h3 className="flex items-center gap-1.5 text-xs text-stone-200"><Mic className="h-3 w-3"/>음성 변조</h3><span className="text-[9px] text-stone-500">내 마이크에 적용</span></div>
    <div className="grid grid-cols-4 gap-1.5">{VOICE_EFFECTS.map(effect=><button type="button" key={effect.id} aria-pressed={effects.mode===effect.id} disabled={effects.busy} onClick={()=>void effects.select(effect.id)} title={effect.description} className={`rounded-lg border py-2 text-[11px] disabled:opacity-40 ${effects.mode===effect.id?'border-amber-600/60 bg-amber-900/20 text-amber-200':'border-stone-700 bg-black/20 text-stone-300 hover:bg-stone-800'}`}>{effect.name}</button>)}</div>
    <div className="flex items-center justify-between gap-2"><p className="text-[9px] text-stone-500">{muted?'선택한 효과는 마이크를 켤 때 적용돼요.':'상대방에게도 변조된 목소리가 들려요.'}</p><button type="button" onClick={()=>void effects.togglePreview()} disabled={muted||effects.busy} aria-pressed={effects.preview} className="flex shrink-0 items-center gap-1 rounded-md border border-stone-600 px-2 py-1 text-[10px] text-stone-200 disabled:opacity-35"><Headphones className="h-3 w-3"/>{effects.preview?'듣기 중지':'미리 듣기'}</button></div>
    {effects.preview&&<p className="text-[9px] text-amber-200/80">이어폰 권장 · 미리 듣기는 나에게만 들려요.</p>}
    {effects.error&&<p role="alert" className="text-[10px] text-rose-300">{effects.error}</p>}
  </section>;
}
