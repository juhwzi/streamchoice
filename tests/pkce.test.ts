import test from "node:test";
import assert from "node:assert/strict";
import { codeChallengeS256, generateCodeVerifier, sanitizeNext } from "../src/lib/kick/pkce.ts";

test("S256 bate com o vetor de teste da RFC 7636", () => {
  assert.equal(
    codeChallengeS256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  );
});

test("code_verifier tem tamanho válido e alfabeto base64url", () => {
  const v = generateCodeVerifier();
  assert.ok(v.length >= 43 && v.length <= 128);
  assert.match(v, /^[A-Za-z0-9_-]+$/);
});

test("sanitizeNext bloqueia open redirect", () => {
  assert.equal(sanitizeNext("/dashboard"), "/dashboard");
  assert.equal(sanitizeNext("//evil.com"), "/");
  assert.equal(sanitizeNext("https://evil.com"), "/");
  assert.equal(sanitizeNext("/\\evil"), "/");
  assert.equal(sanitizeNext(null), "/");
});
