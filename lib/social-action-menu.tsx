import { SOCIAL_ACTIONS, type SocialAction } from "./social-actions";

export function SocialActionMenu({ solo = false, active, onSelect }: {
  solo?: boolean;
  active?: SocialAction;
  onSelect: (action: SocialAction) => void;
}) {
  return <div className="grid grid-cols-4 gap-1.5">
    {(Object.keys(SOCIAL_ACTIONS) as SocialAction[]).map(action => <button key={action} type="button"
      data-social-action={action} aria-label={solo && action === "dance" ? "춤추기" : SOCIAL_ACTIONS[action].name}
      aria-pressed={solo ? active === action : undefined} onClick={() => onSelect(action)}
      className={`flex flex-col items-center justify-center gap-1 min-h-[62px] rounded-lg border px-0.5 py-2 transition-colors ${active === action ? "border-amber-400/60 bg-amber-900/25 text-amber-100" : "border-stone-700 bg-black/20 text-stone-200 hover:border-stone-500 hover:bg-stone-800/60"}`}>
      <span aria-hidden="true" className="text-xl leading-none">{SOCIAL_ACTIONS[action].icon}</span>
      <span className="text-[10px] font-semibold leading-tight break-keep">{solo && action === "dance" ? "춤추기" : SOCIAL_ACTIONS[action].name}</span>
    </button>)}
  </div>;
}
