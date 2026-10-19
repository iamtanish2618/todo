import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { ApiError, body, fail, owner } from "@/lib/todo/server";

export async function GET(request: Request) {
  try {
    const userId = await owner(request);
    const [profile] = await getDb()
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId));
    return Response.json(profile ? { name: profile.name } : null, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: Request) {
  try {
    const userId = await owner(request);
    const parsed = z
      .object({
        name: z
          .string()
          .trim()
          .min(1)
          .max(50)
          .refine((name) => !/[\u0000-\u001f\u007f]/.test(name)),
      })
      .strict()
      .safeParse(await body(request, 2048));
    if (!parsed.success)
      throw new ApiError("Please use a name between 1 and 50 characters.");
    const now = Date.now();
    await getDb()
      .insert(profiles)
      .values({
        userId,
        name: parsed.data.name,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: profiles.userId,
        set: { name: parsed.data.name, updatedAt: now },
      });
    return Response.json(
      { name: parsed.data.name },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return fail(error);
  }
}
