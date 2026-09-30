export interface NormalizedPix {
  externalId: string;
  amount: number;
  donor: string;
  message: string;
}

/** "R$ 1.234,50" | "5,00" | 5 | "5.5" → número com 2 casas; null se inválido. */
export function parseAmount(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null;
  if (typeof v !== "string") return null;
  let s = v.replace(/[^\d.,-]/g, "");
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/** Extrai "#VOTO-104" de qualquer lugar da mensagem (tolera "# voto 104", minúsculas). */
export function extractVoteTag(message: string): string | null {
  const m = /#\s?voto[-\s]?(\d{1,6})/i.exec(message ?? "");
  return m ? `#VOTO-${m[1]}` : null;
}

const pick = (o: Record<string, unknown>, keys: string[]): unknown => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k];
  return undefined;
};

/**
 * Adaptador tolerante: o formato exato muda por gateway. Ajuste aqui ao validar com a
 * documentação/payload real do Livepix ou PixGG (ver docs/OPERACAO.md).
 */
export function normalizePayload(json: unknown): NormalizedPix | null {
  if (!json || typeof json !== "object") return null;
  const root = json as Record<string, unknown>;
  const o = (typeof root.data === "object" && root.data ? (root.data as Record<string, unknown>) : root);

  const id = pick(o, ["id", "transaction_id", "transactionId", "txid", "reference"]);
  const cents = pick(o, ["amount_cents", "amountInCents"]);
  const amount = cents !== undefined ? parseAmount(Number(cents) / 100) : parseAmount(pick(o, ["amount", "value", "amount_paid"]));
  const message = pick(o, ["message", "msg", "text", "comment"]);
  const donor = pick(o, ["name", "donor", "donor_name", "username", "sender"]);

  if (id === undefined || amount === null) return null;
  return {
    externalId: String(id).slice(0, 120),
    amount,
    donor: donor !== undefined ? String(donor).slice(0, 60) : "Anônimo",
    message: message !== undefined ? String(message).slice(0, 500) : "",
  };
}
