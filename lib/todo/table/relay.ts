/** Cloudflare TURN key stays on the server. Only expiring ICE credentials leave it. */
export type RelayKey = { id: string; token: string };
export type MeteredKey = { host: string; apiKey: string };
const TTL_SECONDS = 4 * 60 * 60;
const REUSE_MS = 60 * 60 * 1000;
const MAX_USERS = 256;

export function createRelayIssuer(
  fetcher: typeof fetch = fetch,
  now = Date.now,
) {
  const cache = new Map<string, { until: number; servers: RTCIceServer[] }>();
  const pending = new Map<string, Promise<RTCIceServer[]>>();
  let activeKey = "";
  return async (userId: string, key: RelayKey): Promise<RTCIceServer[]> => {
    if (!userId || !/^[a-f0-9]{32}$/i.test(key.id) || !key.token)
      throw new Error("Relay is not configured");
    // Rotating the master key invalidates all cached credentials in this isolate.
    const keyVersion = key.id + ":" + key.token;
    if (activeKey !== keyVersion) {
      cache.clear();
      pending.clear();
      activeKey = keyVersion;
    }
    const hit = cache.get(userId);
    if (hit && hit.until > now()) return hit.servers;
    if (pending.has(userId)) return pending.get(userId)!;
    if (pending.size >= 16) throw new Error("Relay is busy");
    const request = (async () => {
      const response = await fetcher(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${key.id}/credentials/generate-ice-servers`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ttl: TTL_SECONDS }),
          redirect: "error",
          signal: AbortSignal.timeout(8000),
        },
      );
      // Never include the provider's response body or credentials in logs/errors.
      if (!response.ok) throw new Error("Relay provider unavailable");
      const data = (await response.json()) as { iceServers?: unknown };
      if (!Array.isArray(data.iceServers))
        throw new Error("Invalid relay settings");
      const servers: RTCIceServer[] = [];
      for (const entry of data.iceServers.slice(0, 8)) {
        if (!entry || typeof entry !== "object") continue;
        const e = entry as Record<string, unknown>;
        const urls = (Array.isArray(e.urls) ? e.urls : [e.urls]).filter(
          (u): u is string =>
            typeof u === "string" &&
            /^turns?:turn\.cloudflare\.com:(?:3478|5349|443|80)(?:\?transport=(?:udp|tcp))?$/.test(
              u,
            ),
        );
        if (
          !urls.length ||
          typeof e.username !== "string" ||
          !e.username ||
          typeof e.credential !== "string" ||
          !e.credential ||
          e.username.length > 4096 ||
          e.credential.length > 4096
        )
          continue;
        servers.push({ urls, username: e.username, credential: e.credential });
      }
      if (!servers.length) throw new Error("No usable relay settings");
      if (activeKey === keyVersion) {
        for (const [id, value] of cache)
          if (value.until <= now()) cache.delete(id);
        if (cache.size >= MAX_USERS) cache.delete(cache.keys().next().value!);
        cache.set(userId, { until: now() + REUSE_MS, servers });
      }
      return servers;
    })();
    pending.set(userId, request);
    try {
      return await request;
    } finally {
      if (pending.get(userId) === request) pending.delete(userId);
    }
  };
}

/** Open Relay / Metered credential-scoped API key (never its account secret key).
 * The provider controls credential expiry; refreshing does not extend it. */
export function createMeteredRelayIssuer(
  fetcher: typeof fetch = fetch,
  now = Date.now,
) {
  let cache: { key: string; until: number; servers: RTCIceServer[] } | null =
    null;
  let pending: { key: string; request: Promise<RTCIceServer[]> } | null = null;
  return async (userId: string, key: MeteredKey): Promise<RTCIceServer[]> => {
    if (
      !userId ||
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.metered\.live$/.test(key.host) ||
      !key.apiKey
    )
      throw new Error("Relay is not configured");
    const version = key.host + ":" + key.apiKey;
    if (cache?.key === version && cache.until > now()) return cache.servers;
    if (pending?.key === version) return pending.request;
    const request = (async () => {
      const response = await fetcher(
        `https://${key.host}/api/v1/turn/credentials?apiKey=${encodeURIComponent(key.apiKey)}`,
        {
          redirect: "error",
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!response.ok) throw new Error("Relay provider unavailable");
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error("Invalid relay settings");
      const servers: RTCIceServer[] = [];
      for (const entry of data.slice(0, 8)) {
        if (!entry || typeof entry !== "object") continue;
        const e = entry as Record<string, unknown>;
        const urls = (Array.isArray(e.urls) ? e.urls : [e.urls]).filter(
          (u): u is string =>
            typeof u === "string" &&
            /^turns?:(?:[a-z0-9-]+\.)?(?:relay\.metered\.ca|openrelay\.metered\.ca):(?:80|443|3478|5349)(?:\?transport=(?:udp|tcp))?$/.test(
              u,
            ),
        );
        if (
          !urls.length ||
          typeof e.username !== "string" ||
          !e.username ||
          typeof e.credential !== "string" ||
          !e.credential ||
          e.username.length > 4096 ||
          e.credential.length > 4096
        )
          continue;
        servers.push({ urls, username: e.username, credential: e.credential });
      }
      if (!servers.length) throw new Error("No usable relay settings");
      cache = { key: version, until: now() + 5 * 60 * 1000, servers };
      return servers;
    })();
    pending = { key: version, request };
    try {
      return await request;
    } finally {
      if (pending?.request === request) pending = null;
    }
  };
}
