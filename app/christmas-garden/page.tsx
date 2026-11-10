"use client";
import Link from "next/link";
import { PlazaScene, type PlazaActor } from "@/lib/plaza";

const actors: PlazaActor[]=[];
const noop=()=>{};

export default function ChristmasGardenPreview() {
  return <main className="min-h-dvh bg-[#f3e8d4] px-3 py-5 text-[#493a2b] sm:px-6">
    <header className="mx-auto mb-4 flex max-w-[1600px] items-center justify-between gap-4">
      <div><h1 className="text-lg font-bold sm:text-2xl">꽃빛 정원 · 크리스마스</h1>
        <p className="mt-1 text-xs text-[#76644e] sm:text-sm">반짝이는 트리와 중앙 분수, 따뜻한 겨울 정원</p></div>
      <Link href="/" className="shrink-0 rounded-lg border border-[#b79b74] px-3 py-2 text-sm hover:bg-white/50">보이스룸으로</Link>
    </header>
    <div data-garden-preview className="relative mx-auto aspect-[8/5] w-full max-w-[1600px] overflow-hidden rounded-xl shadow-lg">
      <svg viewBox="0 0 1600 1000" className="absolute inset-0 h-full w-full" role="img" aria-label="실시간으로 반짝이는 크리스마스 정원">
        <foreignObject width="1600" height="1000">
          <div className="pointer-events-none relative" style={{width:1600,height:1000}}>
            <PlazaScene actors={actors} theme="christmas_party" onMyMove={noop} onActorClick={noop} registerActorEl={noop}/>
          </div>
        </foreignObject>
      </svg>
    </div>
  </main>;
}
