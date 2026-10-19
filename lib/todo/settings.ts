import { env } from "cloudflare:workers";

export function setting(key: string) {
  return (
    (env as unknown as Record<string, string | undefined>)[key] ||
    process.env[key]
  );
}
