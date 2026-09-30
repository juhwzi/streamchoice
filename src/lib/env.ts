export function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente ausente: ${name}`);
  return v;
}
export const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
