import AuthShell from "@/components/todo/auth-shell";
import { getTodoUser } from "@/lib/auth/server";
import { authConfig } from "@/lib/auth/config";

export const dynamic = "force-dynamic";

export default async function Home() {
  return <AuthShell identity={await getTodoUser()} config={authConfig()}
    signInPath="/" signOutPath="/" />;
}
