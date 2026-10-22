import { proxyTodo } from "@/lib/server/backend-proxy.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxyTodo(request, path.join("/"));
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
