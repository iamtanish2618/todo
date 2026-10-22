// Keep Todo's existing data and AI service while the UI is hosted on Vercel.
// This is a fixed-destination API bridge, never a general-purpose proxy.
const routes = {
  "auth/session": ["GET", "POST", "DELETE"],
  profile: ["GET", "PUT"],
  tasks: ["GET", "POST", "PATCH", "DELETE"],
  sessions: ["GET", "POST"],
  notes: ["GET", "POST", "DELETE"],
  flashcards: ["GET", "POST", "DELETE"],
  status: ["GET"],
  "room-summary": ["GET"],
  "rooms/config": ["GET"],
  chat: ["POST"],
  assistant: ["POST"],
};
export const MAX_BODY_BYTES = 4_400_000;
const trustedBackend = "https://todo-penguin.aniketyadav982.chatgpt.site";
const privateHeaders = { "Cache-Control": "private, no-store" };
const error = (message, status) => Response.json({ error: message }, { status, headers: privateHeaders });

async function readBoundedBody(request) {
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES)
    throw new RangeError("Request too large");
  if (!request.body) return undefined;
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new RangeError("Request too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let position = 0;
  for (const chunk of chunks) { body.set(chunk, position); position += chunk.length; }
  return body;
}

export async function proxyTodo(request, path, { origin = process.env.TODO_BACKEND_ORIGIN, fetcher = fetch } = {}) {
  if (!Object.hasOwn(routes, path)) return error("Not found.", 404);
  if (!routes[path].includes(request.method)) return error("Method not allowed.", 405);
  // A deployment setting cannot turn this endpoint into an SSRF or credential relay.
  if (origin !== trustedBackend) return error("Todo’s connection is not configured.", 503);
  const write = !["GET", "HEAD"].includes(request.method);
  // Next can normalize request.url to localhost behind its server. Use the Host
  // actually receiving the browser request; never trust x-forwarded-host here.
  if (write) {
    let caller;
    try { caller = new URL(request.headers.get("origin")); } catch { return error("Please make this request from Todo.", 403); }
    const host = request.headers.get("host") || new URL(request.url).host;
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(caller.hostname);
    if (caller.host !== host || (caller.protocol !== "https:" && !(local && caller.protocol === "http:")))
      return error("Please make this request from Todo.", 403);
  }

  const headers = new Headers({ Accept: "application/json" });
  const authorization = request.headers.get("authorization");
  if (authorization) headers.set("Authorization", authorization);
  // Only Todo's session cookie can cross this boundary. No Vercel, platform,
  // OAuth refresh, or unrelated browser cookies/identity headers are forwarded.
  const cookie = request.headers.get("cookie")?.split(";").map(p => p.trim())
    .find(p => p.startsWith("__Host-todo_session="));
  if (cookie) headers.set("Cookie", cookie);
  if (write) {
    headers.set("Origin", origin);
    headers.set("Content-Type", "application/json");
  }
  try {
    const body = write ? await readBoundedBody(request) : undefined;
    // Next exposes an empty stream even for a bodyless DELETE (sign-out).
    if (body?.byteLength && !request.headers.get("content-type")?.startsWith("application/json"))
      return error("Please send JSON.", 415);
    const upstream = await fetcher(`${origin}/api/${path}`, {
      method: request.method, headers, body,
      redirect: "manual", cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(55_000)]),
    });
    if (upstream.status >= 300 && upstream.status < 400)
      return error("Todo’s connection needs attention. Please try again.", 502);
    if (!upstream.headers.get("content-type")?.includes("application/json"))
      return error("Todo couldn’t connect just now. Please try again.", 502);
    const responseHeaders = new Headers(privateHeaders);
    responseHeaders.set("Content-Type", "application/json; charset=utf-8");
    if (path === "auth/session") {
      for (const cookie of upstream.headers.getSetCookie()) {
        if (cookie.startsWith("__Host-todo_session=") && !/;\s*domain=/i.test(cookie))
          responseHeaders.append("Set-Cookie", cookie);
      }
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch (cause) {
    if (cause instanceof RangeError) return error("Please attach a smaller file (under 3 MB).", 413);
    return error("Todo couldn’t connect just now. Please try again.", 502);
  }
}
