// Relógio do servidor para sincronizar a contagem regressiva (RF12).
export const runtime = "edge";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ now: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
