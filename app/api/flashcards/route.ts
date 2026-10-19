import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { flashcards } from "@/db/schema";
import { ApiError, body, fail, owner } from "@/lib/todo/server";
export async function GET(request: Request) {
  try {
    const userId = await owner(request);
    return Response.json(
      await getDb()
        .select()
        .from(flashcards)
        .where(eq(flashcards.userId, userId))
        .orderBy(desc(flashcards.createdAt))
        .limit(200),
      { headers: { "Cache-Control": "private, no-store" } },
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
          question: z.string().trim().min(1).max(500),
          answer: z.string().trim().min(1).max(2000),
        })
        .strict()
        .safeParse(await body(request, 12000));
    if (!parsed.success)
      throw new ApiError("Add a question and answer to keep this card.");
    const card = {
      ...parsed.data,
      id: crypto.randomUUID(),
      userId,
      createdAt: Date.now(),
    };
    await getDb().insert(flashcards).values(card);
    return Response.json(card, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
export async function DELETE(request: Request) {
  try {
    const userId = await owner(request),
      parsed = z
        .object({ id: z.string().uuid() })
        .strict()
        .safeParse(await body(request));
    if (!parsed.success) throw new ApiError("Choose a valid card.");
    const deleted = await getDb()
      .delete(flashcards)
      .where(
        and(eq(flashcards.id, parsed.data.id), eq(flashcards.userId, userId)),
      )
      .returning();
    if (!deleted.length) throw new ApiError("That card was not found.", 404);
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
