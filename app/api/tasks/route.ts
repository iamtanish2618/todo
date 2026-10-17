import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { tasks } from "@/db/schema";
import { ApiError, body, fail, owner } from "@/lib/todo/server";
import { z } from "zod";
export async function GET(request: Request) {
  try {
    const userId = await owner(request);
    return Response.json(
      await getDb()
        .select()
        .from(tasks)
        .where(eq(tasks.userId, userId))
        .orderBy(desc(tasks.createdAt)),
    );
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    const userId = await owner(request),
      parsed = z
        .object({ title: z.string().trim().min(1).max(180) })
        .safeParse(await body(request));
    if (!parsed.success)
      throw new ApiError("Give your task a short name (up to 180 characters).");
    const task = {
      id: crypto.randomUUID(),
      userId,
      title: parsed.data.title,
      done: false,
      createdAt: Date.now(),
    };
    await getDb().insert(tasks).values(task);
    return Response.json(task, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
export async function PATCH(request: Request) {
  try {
    const userId = await owner(request),
      parsed = z
        .object({ id: z.string().uuid(), done: z.boolean() })
        .safeParse(await body(request));
    if (!parsed.success) throw new ApiError("Choose a valid task.");
    const result = await getDb()
      .update(tasks)
      .set({ done: parsed.data.done })
      .where(and(eq(tasks.id, parsed.data.id), eq(tasks.userId, userId)))
      .returning();
    if (!result[0]) throw new ApiError("That task was not found.", 404);
    return Response.json(result[0]);
  } catch (e) {
    return fail(e);
  }
}
export async function DELETE(request: Request) {
  try {
    const userId = await owner(request),
      parsed = z
        .object({ id: z.string().uuid() })
        .safeParse(await body(request));
    if (!parsed.success) throw new ApiError("Choose a valid task.");
    const deleted = await getDb()
      .delete(tasks)
      .where(and(eq(tasks.id, parsed.data.id), eq(tasks.userId, userId)))
      .returning();
    if (!deleted.length) throw new ApiError("That task was not found.", 404);
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
