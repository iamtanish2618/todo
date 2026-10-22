/** Only this server's independently verified Todo identity may receive relay access. */
export function roomVoiceConfig(base, signedIn, settings = process.env) {
  const stun = (base.iceServers || []).flatMap(server => {
    const urls = [server.urls].flat().filter(url => typeof url === "string" && /^stuns?:/.test(url));
    return urls.length ? [{ urls }] : [];
  });
  const result = { ...base, iceServers: stun };
  if (!signedIn || !base.enabled || !base.voice || !base.configured) return result;
  const url = settings.TODO_TURN_URL?.trim();
  const username = settings.TODO_TURN_USERNAME?.trim();
  const credential = settings.TODO_TURN_CREDENTIAL?.trim();
  if (url && /^turns?:[a-z0-9.-]+:\d+(?:\?transport=(?:tcp|udp))?$/.test(url) && username && credential) {
    result.iceServers.push({ urls: url, username, credential });
  }
  return result;
}
