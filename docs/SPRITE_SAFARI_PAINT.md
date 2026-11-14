# Safari sprite paint clipping

The previous scene filtered the actor's nominal width/height container while the character renderer scaled/transformed a descendant outside it. Idle actors used `drop-shadow` as well as speaking/whisper SVG filters, so the risky structure existed even when silent. Safari/WebKit has a documented related regression: [313665](https://bugs.webkit.org/show_bug.cgi?id=313665), where filtering a translated ancestor clips transformed overflowing descendants. This is the leading explanation for the reported iPhone head crop, not a confirmed reproduction on the reporting device.

The scene now passes its visual filter to the actual atlas-frame element. Scaling and jumping happen outside that filtered frame; actor containers remain unfiltered, and character/jump overflow stays visible. Existing frame rectangles, scale factors, foot alignment and alpha picking are preserved. Single-row atlases also use zero background offset rather than division by zero.

`node scripts/check-sprite-paint.mjs` exercises all eleven characters, six pose types and shadow/speaking filters (132 render cases), checks effect placement and finite CSS, and preserves character scale. Roster/alpha-hit checks and the production build also run. Actual iPhone Safari rendering cannot be validated in this Windows environment; the affected user should recheck after the deployment.
