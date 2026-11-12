# Administrator refresh

Settings → “관리자 · 접속자 새로고침” accepts the management code on first connection. Choose the current room or all rooms, preview the current count, then confirm. The sender is included if connected to a targeted room. The API acknowledges command delivery; it does not claim individual reload acknowledgements.

`ADMIN_REFRESH_KEY` is a server-only secret. It is configured in ignored local development env and Vercel Production; the user's local copy is `C:/Users/user/AppData/Local/VoiceRoom/refresh-admin-key.txt`, outside the repository. The key is never bundled. A correct code sets an HMAC-signed HttpOnly, SameSite=Strict, production Secure cookie scoped to the refresh endpoint for eight hours. The input clears after successful preview. Cross-origin requests and invalid credentials are rejected. Per-process cooldown and the separate confirmation step reduce repeat requests.

`POST /api/admin/refresh` accepts `{action:"preview"|"refresh",scope:"all"|"room",room?:string}`. Preview only lists existing rooms/counts. Refresh sends a reliable server-origin `ROOM_FORCE_REFRESH` packet with an ID and a three-second deadline to the selected active LiveKit rooms. Normal participant-origin refresh packets are rejected by the client. Stale, wrong-room, duplicate and already-pending commands are ignored.

The client shows a countdown and flushes map posts to IndexedDB immediately and again before reload. A bounded wait avoids a stuck cache preventing reload. Reload preserves the current URL and existing app session restoration. Leaving/changing room cancels the pending reload. No content is stored on the application server for this feature.

**Clients must load this feature once before they can receive a forced refresh. Already open older versions without the receiver require one manual reload.** Browser-suspended/offline tabs may not receive the command; this is not a push-notification channel.

`node scripts/check-admin-refresh.mjs` covers auth, signed sessions, origin/scope validation, read-only preview, broadcast selection, cooldown, server-only receipt, stale/duplicate rejection, cache flush and reload scheduling. Browser QA mocks the endpoint to verify preview/confirmation, scope changes and mobile layout. No actual participant refresh was triggered during QA.
