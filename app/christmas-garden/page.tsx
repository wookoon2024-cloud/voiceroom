"use client";
import Link from "next/link";
import { PlazaScene, type PlazaActor } from "@/lib/plaza";

const actors: PlazaActor[]=[];
const noop=()=>{};

export default function ChristmasGardenPreview() {
  return <main className="min-h-dvh bg-[#17263b] px-3 py-5 text-stone-100 sm:px-6">
    <header className="mx-auto mb-4 flex max-w-[1672px] items-center justify-between gap-4">
      <div><h1 className="text-lg font-bold sm:text-2xl">크리스마스 캠핑 라운지</h1>
        <p className="mt-1 text-xs text-stone-300 sm:text-sm">겨울 숲의 큰 트리와 따뜻한 모닥불 · 여섯 자리에서 함께 쉬어요</p></div>
      <Link href="/" className="shrink-0 rounded-lg border border-stone-500 px-3 py-2 text-sm hover:bg-white/10">보이스룸으로</Link>
    </header>
    <div data-garden-preview className="relative mx-auto aspect-[1672/941] w-full max-w-[1672px] overflow-hidden rounded-xl shadow-lg">
      <svg viewBox="0 0 1672 941" className="absolute inset-0 h-full w-full" role="img" aria-label="트리 전구와 모닥불이 움직이는 크리스마스 캠핑 라운지">
        <foreignObject width="1672" height="941">
          <div className="pointer-events-none relative" style={{width:1672,height:941}}>
            <PlazaScene actors={actors} theme="christmas_party" onMyMove={noop} onActorClick={noop} registerActorEl={noop}/>
          </div>
        </foreignObject>
      </svg>
    </div>
  </main>;
}
