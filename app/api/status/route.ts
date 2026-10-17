import { aiConfig, fail, owner, setting } from "@/lib/todo/server";
export async function GET(request: Request) {
  try {
    await owner(request);
    return Response.json(
      {
        ai: Boolean(aiConfig()),
        vision: setting("TODO_AI_VISION") === "true",
        provider: setting("TODO_AI_LABEL") || "AI connection",
        friends: false,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
