import test from "node:test";
import assert from "node:assert/strict";
import { computeHmacHex, verifySignature } from "../src/lib/webhook/verify.ts";
import { extractVoteTag, normalizePayload, parseAmount } from "../src/lib/webhook/payload.ts";

const secret = "segredo-de-teste";
const body = JSON.stringify({ id: "abc", amount: 5, message: "Voto no Alien #VOTO-104" });

test("HMAC: aceita hex, sha256=hex e base64", () => {
  const hex = computeHmacHex(secret, body);
  assert.ok(verifySignature(body, hex, secret));
  assert.ok(verifySignature(body, `sha256=${hex}`, secret));
  assert.ok(verifySignature(body, Buffer.from(hex, "hex").toString("base64"), secret));
});

test("HMAC: rejeita corpo adulterado, segredo errado, ausente ou lixo", () => {
  const hex = computeHmacHex(secret, body);
  assert.equal(verifySignature(body + " ", hex, secret), false);
  assert.equal(verifySignature(body, hex, "outro"), false);
  assert.equal(verifySignature(body, null, secret), false);
  assert.equal(verifySignature(body, "zzzz", secret), false);
  assert.equal(verifySignature(body, hex, ""), false);
});

test("extractVoteTag tolera variações", () => {
  assert.equal(extractVoteTag("Voto no Alien #VOTO-104"), "#VOTO-104");
  assert.equal(extractVoteTag("vai alien #voto 8392 !!"), "#VOTO-8392");
  assert.equal(extractVoteTag("# VOTO-7"), "#VOTO-7");
  assert.equal(extractVoteTag("sem tag"), null);
  assert.equal(extractVoteTag(""), null);
});

test("parseAmount trata formatos brasileiros", () => {
  assert.equal(parseAmount("R$ 1.234,50"), 1234.5);
  assert.equal(parseAmount("5,00"), 5);
  assert.equal(parseAmount("5.5"), 5.5);
  assert.equal(parseAmount(10), 10);
  assert.equal(parseAmount(0), null);
  assert.equal(parseAmount("abc"), null);
  assert.equal(parseAmount(-3), null);
});

test("normalizePayload: formatos plano, aninhado em data e em centavos", () => {
  assert.deepEqual(normalizePayload({ id: 1, amount: "5,00", message: "x", name: "Ana" }), {
    externalId: "1", amount: 5, donor: "Ana", message: "x",
  });
  assert.equal(normalizePayload({ data: { transactionId: "t9", value: 12.5, msg: "m" } })?.externalId, "t9");
  assert.equal(normalizePayload({ id: "c", amount_cents: 1550 })?.amount, 15.5);
  assert.equal(normalizePayload({ amount: 5 }), null);
  assert.equal(normalizePayload(null), null);
});
