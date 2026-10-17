import { askModel } from "@/lib/todo/ai";
import { env } from "cloudflare:workers";
import { z } from "zod";
import {
  aiConfig,
  ApiError,
  body,
  fail,
  owner,
  setting,
} from "@/lib/todo/server";

const schema = z.object({
  mode: z.enum(["chat", "notes", "summarize", "explain"]),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(20000),
      }),
    )
    .min(1)
    .max(20),
  image: z
    .string()
    .max(4_200_000)
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)
    .optional(),
});
export async function POST(request: Request) {
  try {
    const userId = await owner(request),
      parsed = schema.safeParse(await body(request, 4_700_000));
    if (!parsed.success || parsed.data.messages.at(-1)?.role !== "user")
      throw new ApiError(
        "Add a message (up to 20,000 characters) and a PNG, JPG, or WebP image under 3 MB.",
      );
    const config = aiConfig();
    if (!config)
      throw new ApiError(
        "Todo’s AI is waiting for a private API connection. You can still focus, write notes, and export PDFs.",
        503,
      );
    if (!config.baseURL.startsWith("https://"))
      throw new ApiError(
        "The AI connection needs a secure server address.",
        503,
      );
    if (parsed.data.image && setting("TODO_AI_VISION") !== "true")
      throw new ApiError(
        "This AI connection does not have image reading enabled yet.",
        422,
      );
    const max = Math.min(
      100,
      Math.max(1, Number(setting("TODO_AI_DAILY_LIMIT")) || 25),
    );
    if (!env.DB)
      throw new ApiError("Todo’s storage is not connected yet.", 503);
    const quota = await env.DB.prepare(
      "INSERT INTO daily_usage (user_id, day, count) VALUES (?, ?, 1) ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1 WHERE count < ? RETURNING count",
    )
      .bind(userId, new Date().toISOString().slice(0, 10), max)
      .first();
    if (!quota)
      throw new ApiError(
        "You’ve reached today’s AI allowance. Your focus tools and saved notes are still available.",
        429,
      );
    const text = await askModel(
      config,
      parsed.data,
      AbortSignal.any([request.signal, AbortSignal.timeout(45000)]),
    );
    if (!text.trim())
      throw new ApiError(
        "The AI didn’t return text this time. Please try a shorter request.",
        502,
      );
    return Response.json(
      { text },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    if (e instanceof ApiError) return fail(e);
    console.error(
      "Todo AI request failed:",
      e instanceof Error ? e.name : "UnknownError",
    );
    return Response.json(
      {
        error:
          "The AI service couldn’t answer. It may be busy or out of free quota. Your message is still here—try again shortly.",
      },
      { status: 502 },
    );
  }
}
