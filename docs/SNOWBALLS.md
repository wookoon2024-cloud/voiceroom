# Shared Christmas snowballs

The outdoor Christmas map spawns four small ground snowballs, then one every twelve seconds up to eight. Click a ball to walk over and roll it. Movement keys push the owned ball; growth uses actual unobstructed ball travel and stops at radius 34. E releases it in place, preserving its size for others. F picks it up, then throws it toward the mouse or a tapped participant. Larger balls move and fly more slowly. Seats, tents and map boundaries block rolling and projectiles.

A swept projectile collision briefly topples a standing participant for 1.2 seconds, then restores them. A 3.5-second immunity prevents continuous knockdown. Seated, lying and paired-action participants cannot be hit. Falls transform the existing sprite without loading additional atlases. Snowmen remain a separate decorative action, using no gift-box gesture.

`snowballs.ts` validates bounded states and commands and serializes exclusive ball claims. `use-snowballs.ts` elects an awake, capable participant as simulator, excluding older clients, and distributes authenticated room-scoped snapshots. Late joiners request the current state; host changes recover the newest offered snapshot. Inputs only accompany an owned ball, simulation runs at 10 Hz and shared snapshots at at most 6 Hz. Everything stays in connected room memory; nothing is persisted to browsers or a server.

An external store confines snow snapshots to the ball controls and artwork. Ground balls use CSS; one fixed-size canvas draws only active flight, aiming and impact fragments, and pauses in hidden tabs. Existing character row loading and hit-mask memory limits remain intact.

Near a free chair, cushion, bed or tent entrance/exit, a compact E prompt performs the existing walk-and-reserve or walk-and-enter action. E stands up when resting, and gives owned-ball release precedence. The prompt is also tappable. F remains the snowball pickup/throw key; Space remains jump, and text inputs retain normal typing.

`node scripts/check-snowballs.mjs` exercises domain physics and the real hook with multiple simulated clients, concurrent claims, dropped snapshots, host handover and late joins. `check-room-seating.mjs` checks spawn clearance against the actual map props as well as seat navigation. Browser QA uses the local mock room and never sends messages to live users.

Local browser QA verified native E rolling and distance growth, F pickup/throw, E chair approach/reservation/sitting/standing and E tent entry after walking. At a 390×844 viewport the snow panel fits from x=12 to 378 and ends eight pixels above the participant toolbar. This is browser emulation, not a physical iPhone test. A fresh settings screen shows the new background-effect default of 0.3×; saved explicit speeds are retained.
