import AuthShell from "@/components/todo/auth-shell";
import { getTodoUser } from "@/lib/auth/server";
import { authConfig } from "@/lib/auth/config";
import { chatGPTSignInPath, chatGPTSignOutPath } from "./chatgpt-auth";
export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await getTodoUser();
  return (
    <AuthShell
      identity={user}
      config={authConfig()}
      signInPath={chatGPTSignInPath("/")}
      signOutPath={chatGPTSignOutPath("/")}
    />
  );
}
