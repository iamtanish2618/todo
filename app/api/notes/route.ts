import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { notes } from "@/db/schema";
import { ApiError, body, fail, owner } from "@/lib/todo/server";
import { z } from "zod";
export async function GET(request: Request) {
  try {
    const userId = await owner(request);
    return Response.json(
      await getDb()
        .select()
        .from(notes)
        .where(eq(notes.userId, userId))
        .orderBy(desc(notes.createdAt))
        .limit(100),
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
          title: z.string().trim().min(1).max(160),
          content: z.string().trim().min(1).max(50000),
        })
        .safeParse(await body(request));
    if (!parsed.success)
      throw new ApiError("Add a title and some text to save your note.");
    const note = {
      ...parsed.data,
      id: crypto.randomUUID(),
      userId,
      createdAt: Date.now(),
    };
    await getDb().insert(notes).values(note);
    return Response.json(note, { status: 201 });
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
    if (!parsed.success) throw new ApiError("Choose a valid note.");
    const result = await getDb()
      .delete(notes)
      .where(and(eq(notes.id, parsed.data.id), eq(notes.userId, userId)))
      .returning();
    if (!result.length) throw new ApiError("That note was not found.", 404);
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
