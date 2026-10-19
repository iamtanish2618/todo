import { env } from "cloudflare:workers";
import { ApiError, aiConfig, fail, owner, setting } from "@/lib/todo/server";
import { dailyLimit, quotaReset, usageDay } from "@/lib/todo/quota";
export async function GET(request: Request) {
  try {
    const database = env.DB;
    if (!database)
      throw new ApiError("Your storage is not connected yet.", 503);
    const userId = await owner(request),
      limit = dailyLimit();
    const row = await database
      .prepare("SELECT count FROM daily_usage WHERE user_id = ? AND day = ?")
      .bind(userId, usageDay())
      .first<{ count: number }>();
    const used = row?.count || 0;
    return Response.json(
      {
        ai: Boolean(aiConfig()),
        vision: setting("TODO_AI_VISION") === "true",
        provider: setting("TODO_AI_LABEL") || "AI connection",
        friends: false,
        quota: { used, limit, resting: used >= limit, resetsAt: quotaReset() },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
