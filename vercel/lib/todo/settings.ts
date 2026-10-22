import "server-only";

export function setting(key: string) {
  return process.env[key];
}
