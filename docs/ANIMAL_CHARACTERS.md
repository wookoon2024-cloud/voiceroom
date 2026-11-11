# Playable animal characters

Four quadruped avatars join the existing seven human characters:

- `shiba_dog`: ginger/cream Shiba Inu, red bandana.
- `ginger_cat`: ginger tabby, teal collar.
- `red_squirrel`: chestnut squirrel, large brush tail, moss-green neckerchief.
- `cream_rabbit`: cream rabbit, long pink-lined ears, lavender ribbon.

Each character has 27 sprite states: eight directional/basic states, sixteen send/receive interaction states, and three persistent rest states. There are 136 frames per animal, 544 total across four animals. Dog/cat packs live in `public/plaza/animals-v19/<id>/{base,social,rest}`; squirrel/rabbit packs use `animals-v20`. Runtime textures and frame timing come from sprite-gen's composed manifests. Movement/social cells are 288×240, and rest cells are 320×240; source proportions and the ground anchor remain intact.

The animals have independent world scales, wider interaction spacing and a bench-seat height offset. Four-paw locomotion is maintained; paw gestures temporarily sit on the haunches instead of using a humanoid body. Human avatars keep their existing size and rendering paths. The character lab accepts `?first=shiba_dog&second=ginger_cat` for direct previews.

Generation used GPT identity references and sprite-gen GPT image rows, followed by canonical extraction, atlas composition and inspection. Per-state requests and QA evidence are under `sprites_run/animals-v19`. Six completed packs passed extraction. The inspector's only warnings were low motion in the dog's two idle rows and the cat's floor-sit row; visual review confirmed the intended subtle blink/rest poses. Walk cycles were inspected as four-frame stylized quadruped steps; no static fallback was installed.

Validation covers all eleven selectable IDs, 121 pair combinations, all eight interactions, all 132 rest frames, frame geometry and timing, repeated solo playback, remote interaction playback, alpha hit testing and seating. Local isolated browser QA checked dog/cat selection, walking, jumping, rest, bench arrival/release, remote receive animations and the mobile picker.

Squirrel/rabbit requests, motion-QA sheets and extraction reports live in `sprites_run/animals-v20`; the game resolves each animal root from the roster entry instead of assuming one versioned directory. All six new packs passed inspection without errors or warnings. Local browser QA confirmed four walking and jump frames, persistent floor rest, rabbit bench arrival, every receive frame for hug/high-five, and all eleven options fitting a 390×844 mobile viewport. The lab preview accepts `?first=red_squirrel&second=cream_rabbit`.
