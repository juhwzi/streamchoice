import { NextResponse } from "next/server";
import { searchPublicProfiles } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";

  if (q.trim().length < 2) {
    return NextResponse.json({ query: q.trim(), users: [], channels: [] });
  }

  try {
    const results = await searchPublicProfiles(q, 6);
    return NextResponse.json(results, {
      headers: {
        "Cache-Control": "public, max-age=20, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("[search] failed", error);
    return NextResponse.json({ error: "Não foi possível realizar a busca." }, { status: 500 });
  }
}
