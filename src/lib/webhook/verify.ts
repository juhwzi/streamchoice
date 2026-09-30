import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_HEADERS = [
  "x-signature",
  "x-livepix-signature",
  "x-pixgg-signature",
  "x-hub-signature-256",
];

export function computeHmacHex(secret: string, rawBody: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

/**
 * Aceita a assinatura como hex, "sha256=<hex>" ou base64. Comparação em tempo constante,
 * sobre o corpo BRUTO (nunca sobre JSON re-serializado).
 */
export function verifySignature(rawBody: string, header: string | null | undefined, secret: string): boolean {
  if (!header || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  let provided = header.trim();
  if (provided.toLowerCase().startsWith("sha256=")) provided = provided.slice(7);

  const candidates: Buffer[] = [];
  if (/^[0-9a-fA-F]{64}$/.test(provided)) candidates.push(Buffer.from(provided, "hex"));
  else {
    try {
      candidates.push(Buffer.from(provided, "base64"));
    } catch {
      return false;
    }
  }
  return candidates.some((c) => c.length === expected.length && timingSafeEqual(c, expected));
}

export function pickSignatureHeader(get: (name: string) => string | null, preferred?: string): string | null {
  const names = preferred ? [preferred.toLowerCase(), ...SIGNATURE_HEADERS] : SIGNATURE_HEADERS;
  for (const n of names) {
    const v = get(n);
    if (v) return v;
  }
  return null;
}
