import { authenticatedTableConfig } from "@/lib/todo/table/config.server";
import { getTodoUser } from "@/lib/auth/server";
export async function GET() {
  const user = await getTodoUser();
  return Response.json(await authenticatedTableConfig(user?.id || null), {
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Authorization, Cookie",
    },
  });
}
