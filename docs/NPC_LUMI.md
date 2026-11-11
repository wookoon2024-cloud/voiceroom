# Lumi ambient NPC

Lumi lives in the plaza, walks slowly along collision-checked waypoints, pauses, and resumes without teleporting after a paired action. Click Lumi or the hotbar control for eight send/receive interactions. The player walks to Lumi; both share a foot baseline. Social reactions use short fixed lines and do not call EXAONE.

Room conversation participation defaults ON, with TTS OFF. Each speaker explicitly enables **내 목소리 연결** once per room/session. Browser Korean speech recognition then continues with the panel closed. Muting the microphone, entering a whisper, disconnecting voice, room OFF, leaving, or NPC audio playback stops sharing. Other connected speakers' shared transcripts and public chat form a short context. A participant who has not connected voice contributes public chat only. Unsupported browsers show an explanation; they never silently claim to be listening. Browser recognition services may process original microphone audio; text redaction occurs after recognition and before EXAONE.

Lumi waits for a pause before considering a comment and again before publishing a generated draft. Ordinary turns require several utterances or enough context, a 45-second reply interval and 30-second attempt interval. Calling Lumi directly has a shorter interval. EXAONE may return `[PASS]` instead of forcing a comment. Whisper/system messages and NPC-generated replies do not trigger the loop.

New clients register the `npc.ambient.v1` participant attribute. One eligible participant, elected by deterministic identity ordering, coordinates generation. The server validates the elected caller. Room metadata retains settings, last turn times and a bounded lease, but no transcript. Only signed, unexpired drafts belonging to the current lease can be published. OFF clears/cancels the lease; duplicates and old coordinators cannot publish. Topic changes preserve other metadata. Clients deduplicate replies by ID. Settings and hold-phase updates synchronize through LiveKit; late joiners receive the current motion phase.

## Privacy boundary

`lib/npc-privacy.ts` performs deterministic redaction locally and again on the server. It masks recognized telephone/personal numbers, email, links, Korean/English addresses, regions, dates, common name patterns and known participant names. Statements explicitly announcing names, contact details, home addresses and similar private information are omitted entirely. Before EXAONE, real speaker identities become `참가자 1`, `참가자 2`, etc.; IDs/timestamps are not sent. The final provider caller rechecks all user/assistant message content, including the optional direct-text conversation. Only the public context needed for a turn is sent. Context remains in client memory for up to two minutes and is bounded; no transcript is written to room metadata or application logs.

These are conservative text patterns and participant-name matching, not a guarantee that every ambiguous/unmarked personal reference can be recognized. Some ordinary words/locations may be masked conservatively. Original public chat remains visible to room participants; this is the AI transmission boundary, not a room-chat censorship feature. Raw voice recognition is provided by the user's browser, with its own processing/permission behavior.

## Provider and deployment

EXAONE uses `k-exaone_v2.5` with low reasoning effort. JSON and SSE are accepted, including fragmented UTF-8, CRLF, omitted blank event separators and final finish chunks. Internal reasoning is excluded. Ambient requests use a smaller token budget. Requests have explicit timeouts and release state on failures; OFF aborts an in-flight client request. A real ambient opinion test succeeded in approximately 95 seconds; several earlier attempts exceeded shorter deadlines. The upstream provider remains slow/variable, so natural comments can be delayed even though walking/social actions continue.

`EXAONE_API_KEY` is a server secret in ignored `.env.local` and Vercel Production. It is never bundled or committed. `/api/npc` retains optional direct text requests. `/api/npc/ambient` handles registration, room settings, draft generation/publishing and fixed social reactions. Both require a valid LiveKit room token and active participant membership. TTS respects output mute/volume and room TTS mode.

## Validation

- `node scripts/check-npc.mjs`: JSON/SSE parsing, auth/origin/history validation, server broadcast and manual request limits.
- `node scripts/check-npc-ambient.mjs`: personal-data fixtures and final provider-payload spying, speaker pseudonyms, coordinator/lease/signature checks, duplicate/disabled publication, mute/whisper/consent policy, PASS, safe paths in both maps and hold/resume timing.
- Existing solo, seating, social-playback and alpha-hit tests remain passing.
- Browser fixtures in `sprites_run/npc-ambient-20261111` exercise continuous recognition with the panel closed, automatic bubble-only replies, omitted private statements, NPC movement, walking up to handshake, all six receive frames, zero foot-height difference, resumed walking, participation/voice OFF and mobile layout. Recognition/network/audio fixtures avoid real microphone prompts; physical recognition accuracy is device dependent.
