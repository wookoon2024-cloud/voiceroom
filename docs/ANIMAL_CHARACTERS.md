# Playable animal characters

Two quadruped avatars join the existing seven human characters:

- `shiba_dog`: ginger/cream Shiba Inu, red bandana.
- `ginger_cat`: ginger tabby, teal collar.

Each character has 27 sprite states: eight directional/basic states, sixteen send/receive interaction states, and three persistent rest states. There are 136 frames per animal, 272 total. The complete packs live in `public/plaza/animals-v19/<id>/{base,social,rest}`. Runtime textures and frame timing come from sprite-gen's composed manifests. Movement/social cells are 288×240, and rest cells are 320×240; source proportions and the ground anchor remain intact.

The animals have independent world scales, wider interaction spacing and a bench-seat height offset. Four-paw locomotion is maintained; paw gestures temporarily sit on the haunches instead of using a humanoid body. Human avatars keep their existing size and rendering paths. The character lab accepts `?first=shiba_dog&second=ginger_cat` for direct previews.

Generation used GPT identity references and sprite-gen GPT image rows, followed by canonical extraction, atlas composition and inspection. Per-state requests and QA evidence are under `sprites_run/animals-v19`. Six completed packs passed extraction. The inspector's only warnings were low motion in the dog's two idle rows and the cat's floor-sit row; visual review confirmed the intended subtle blink/rest poses. Walk cycles were inspected as four-frame stylized quadruped steps; no static fallback was installed.

Validation covers all nine selectable IDs, 81 pair combinations, all eight interactions, all 108 rest frames, frame geometry and timing, repeated solo playback, remote interaction playback, alpha hit testing and seating. Local isolated browser QA checked dog/cat selection, walking, jumping, rest, bench arrival/release, remote receive animations and the mobile picker.
