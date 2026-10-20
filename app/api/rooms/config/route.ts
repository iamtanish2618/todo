import { tableConfig } from "@/lib/todo/table/config.server";
export async function GET() {
  return Response.json(tableConfig(), {
    headers: { "Cache-Control": "no-store" },
  });
}
