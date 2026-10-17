import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions } from "@/db/schema";
import { ApiError, body, fail, owner } from "@/lib/todo/server";
import { z } from "zod";
export async function GET(request: Request) {
  try {
    const userId = await owner(request);
    return Response.json(
      await getDb()
        .select()
        .from(sessions)
        .where(eq(sessions.userId, userId))
        .orderBy(desc(sessions.createdAt))
        .limit(50),
    );
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    const userId = await owner(request),
      parsed = z
        .object({
          task: z.string().trim().min(1).max(180),
          seconds: z.number().int().min(1).max(86400),
          character: z.enum(["male", "female"]),
        })
        .safeParse(await body(request));
    if (!parsed.success)
      throw new ApiError(
        "This session could not be saved. Check its task and duration.",
      );
    const session = {
      ...parsed.data,
      id: crypto.randomUUID(),
      userId,
      createdAt: Date.now(),
    };
    await getDb().insert(sessions).values(session);
    return Response.json(session, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
