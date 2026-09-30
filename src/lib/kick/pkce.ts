import { createHash, randomBytes } from "node:crypto";

export function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** RFC 7636: 43–128 caracteres. 64 bytes aleatórios → 86 caracteres. */
export function generateCodeVerifier(): string {
  return base64url(randomBytes(64));
}

export function codeChallengeS256(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}

export function generateState(): string {
  return base64url(randomBytes(24));
}

/** Só aceita caminhos internos, evitando open redirect. */
export function sanitizeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/";
  return next;
}
