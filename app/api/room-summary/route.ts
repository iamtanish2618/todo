import { env } from "cloudflare:workers";
import { ApiError, fail, owner } from "@/lib/todo/server";
export async function GET(request: Request) {
  try {
    const database = env.DB;
    if (!database)
      throw new ApiError("Your storage is not connected yet.", 503);
    const userId = await owner(request),
      now = new Date(),
      month = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    const [focus, done, total] = await database.batch([
      database
        .prepare(
          "SELECT COALESCE(SUM(seconds),0) AS seconds, COUNT(*) AS sits FROM sessions WHERE user_id = ? AND created_at >= ?",
        )
        .bind(userId, month),
      database
        .prepare(
          "SELECT COUNT(*) AS count FROM tasks WHERE user_id = ? AND done = 1 AND completed_at >= ?",
        )
        .bind(userId, month),
      database
        .prepare("SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?")
        .bind(userId),
    ]);
    const row = focus.results[0] as { seconds: number; sits: number };
    return Response.json(
      {
        minutes: Math.round(row.seconds / 60),
        sits: row.sits,
        tasksDone: Number((done.results[0] as { count?: number })?.count || 0),
        totalSits: Number((total.results[0] as { count?: number })?.count || 0),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
