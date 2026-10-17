import { getChatGPTUser } from "@/app/chatgpt-auth";
import { env } from "cloudflare:workers";

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function owner(request: Request) {
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      throw new ApiError("This request came from a different website.", 403);
  }
  const user = await getChatGPTUser();
  if (!user) throw new ApiError("Please sign in to keep your work safe.", 401);
  return user.userId;
}
export async function body(request: Request, limit = 100_000) {
  if (Number(request.headers.get("content-length")) > limit)
    throw new ApiError("This file or message is too large.", 413);
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > limit)
    throw new ApiError("This file or message is too large.", 413);
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ApiError("Please send valid JSON.");
  }
}
export function fail(error: unknown) {
  if (error instanceof ApiError)
    return Response.json({ error: error.message }, { status: error.status });
  console.error(
    "Todo request failed:",
    error instanceof Error ? error.name : "UnknownError",
  );
  return Response.json(
    {
      error: "Something went wrong. Your work is still here; please try again.",
    },
    { status: 500 },
  );
}
export function setting(key: string) {
  return (
    (env as unknown as Record<string, string | undefined>)[key] ||
    process.env[key]
  );
}
export function aiConfig() {
  const key = setting("TODO_AI_API_KEY"),
    baseURL = setting("TODO_AI_BASE_URL"),
    model = setting("TODO_AI_MODEL");
  return key && baseURL && model ? { key, baseURL, model } : null;
}
