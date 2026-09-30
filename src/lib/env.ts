export function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente ausente: ${name}`);
  return v;
}

export const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

function csv(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((value: string) => value.trim())
    .filter(Boolean);
}

/** Prefira IDs, mas permite username para facilitar o primeiro bootstrap do admin. */
export function isConfiguredAdmin(kickUserId: string, username: string): boolean {
  const ids = csv("ADMIN_KICK_USER_IDS");
  const names = csv("ADMIN_KICK_USERNAMES").map((value) => value.toLowerCase());
  return ids.includes(kickUserId) || names.includes(username.toLowerCase());
}
