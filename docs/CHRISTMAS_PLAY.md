# Christmas tent, cushions and snow play

The Christmas tent has its own `tent_christmas` private space, sharing the existing warm tent interior artwork and bed/cushion mechanics. Users walk to the doorway before entering; leaving returns to (325,447) on the Christmas map. Presence filtering and late-join replay support both camping maps. Changing the shared outdoor map resets private-space selection, but resyncing the same map does not eject someone from the tent.

Six one-person floor-cushion regions are added to the two existing picnic paintings (four left, two right). They use separate floor support contacts, approach positions and hover rings. They do not repaint duplicated furniture pixels. The picnic collision polygons now describe the tables rather than blocking the whole rug/cushion area; table paint depth follows table feet so front seated bodies remain visible. Existing six campfire bench seats remain available.

AI Lumi uses a Christmas-only Santa costume. Sprite-gen's palette bake supplies the red cardigan; the generated real-alpha hat is composed at the measured rose-hair crown in all 152 existing motion cells across five packs. A documented manual garment-protection pass restores source pixels outside the strongly blue cardigan, because tolerance matching also selected grey shoes/trousers. Frames, feet, motion timing and proportions are unchanged. This is costume assembly over existing motions, not a newly generated Santa animation set. `bake-lumi-santa.py` and `compose-lumi-santa.mjs` reproduce these stages. The original character roster is unaffected.

The small **❄ 눈 놀이** menu appears only outside in Christmas camp:

- Roll: walks along a checked clear route while a growing snowball follows the same ground travel.
- Build: uses the existing gift/hand gesture while three snow balls form a generated snowman.
- Throw: uses the existing playful-punch send gesture with an arcing snowball and snow burst. It does not damage or force another participant's pose.

Snow plays are sent through authenticated reliable room packets. Duplicate IDs, malformed/out-of-range points, unreasonable time/travel and overlapping actor actions are rejected. Up to 24 snowmen are shared, kept in connected room memory for five minutes and replayed to late joiners. Projectiles expire quickly; old throws are not replayed. Browser/server persistence is not added. Completed snowmen are decorative, nonblocking props. Room changes clear local snow state. The canvas stops when no short action remains and pauses while the document is hidden.

`check-snow-play.mjs` covers sender authentication, validation, duplicates, cooldown, concurrent players, late joins, expiration and limits. Space/seat regressions cover the doorway round-trip, shared private presence, all cushion/bench approach/exit paths and one-person reservation. Costume tests cover all source canvas sizes, preserved foot alpha and real-alpha artwork. Local browser QA verified the Santa row URL, 12 outdoor seats, tent entry/return, snowman completion and throw gesture. Browser timing observations and any remaining verification limits are recorded in the conversation; actual users' microphones and rooms are not used for QA.
