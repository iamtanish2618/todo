export type TodoIdentity = {
  id: string;
  name: string | null;
  email: string;
} | null;
export type AuthConfig = {
  provider: "chatgpt" | "firebase";
  configured: boolean;
  firebase?: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    appId: string;
  };
};
