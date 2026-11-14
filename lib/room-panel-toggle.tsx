"use client";
import {ChevronDown,ChevronUp} from 'lucide-react';
export function RoomPanelToggle({collapsed,label,controls,participant=false,onToggle}:{collapsed:boolean;label:string;controls:string;participant?:boolean;onToggle:()=>void}){
  return <button type="button" data-room-panel-toggle data-participant-panel-toggle={participant||undefined} aria-label={`${label} ${collapsed?'펼치기':'접기'}`} title={`${label} ${collapsed?'펼치기':'접기'}`} aria-expanded={!collapsed} aria-controls={controls} onClick={event=>{event.currentTarget.blur();onToggle();}} className="room-panel-toggle">
    <span>{collapsed?'펼치기':'접기'}</span>{collapsed?<ChevronUp aria-hidden="true"/>:<ChevronDown aria-hidden="true"/>}
  </button>;
}
