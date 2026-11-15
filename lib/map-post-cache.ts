// Migration only: posts now live exclusively in connected participants' memory.
// Never open/read the old database or touch unrelated browser preferences.
export function clearLegacyMapPostCache():void {
  if(typeof indexedDB==='undefined')return;
  try {
    const request=indexedDB.deleteDatabase('voiceroom-map-posts');
    request.onerror=event=>event.preventDefault();
    // An old tab holding the database may delay deletion until it closes.
  } catch {
    // Storage may be unavailable; live sharing still works without it.
  }
}
