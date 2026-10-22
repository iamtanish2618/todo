import { APICallError } from "ai";
import { dailyLimit, usageDay } from "@/lib/todo/quota";
import { ROOM_CONFIG } from "@/components/todo/room/config";
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
  mode: z.enum([
    "chat",
    "notes",
    "summarize",
    "explain",
    "quiz",
    "flashcards",
    "tiny-step",
  ]),
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
    const max = dailyLimit();
    if (!env.DB)
      throw new ApiError("Todo’s storage is not connected yet.", 503);
    const quota = await env.DB.prepare(
      "INSERT INTO daily_usage (user_id, day, count) VALUES (?, ?, 1) ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1 WHERE count < ? RETURNING count",
    )
      .bind(userId, usageDay(), max)
      .first();
    if (!quota) throw new ApiError(ROOM_CONFIG.restMessage, 429);
    let text: string;
    try {
      text = await askModel(
        config,
        parsed.data,
        AbortSignal.any([request.signal, AbortSignal.timeout(45000)]),
      );
    } catch (error) {
      if (APICallError.isInstance(error) && error.statusCode === 429) {
        await env.DB.prepare(
          "UPDATE daily_usage SET count = ? WHERE user_id = ? AND day = ?",
        )
          .bind(max, userId, usageDay())
          .run();
        throw new ApiError(ROOM_CONFIG.restMessage, 429);
      }
      throw error;
    }
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
