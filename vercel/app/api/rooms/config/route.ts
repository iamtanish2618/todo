import { getTodoUser } from "@/lib/auth/server";
import { proxyTodo } from "@/lib/server/backend-proxy.mjs";
import { roomVoiceConfig } from "@/lib/server/room-voice-config.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const response = await proxyTodo(request, "rooms/config");
  if (!response.ok) return response;
  const user = await getTodoUser();
  return Response.json(roomVoiceConfig(await response.json(), !!user), {
    headers: { "Cache-Control": "private, no-store", Vary: "Authorization, Cookie" },
  });
}
