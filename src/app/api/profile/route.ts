import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, readJson } from "@/lib/api";
import { requireSession } from "@/lib/auth/guard";
import { admin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  displayName: z.string().trim().min(2).max(40),
  bio: z.string().trim().max(180).default(""),
});

export async function PATCH(req: Request) {
  const s = await requireSession(req);
  if (!s.ok) return s.res;
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail(400, "bad_request", "Nome ou bio inválidos.");

  const { error } = await admin()
    .from("users")
    .update({
      display_name: parsed.data.displayName,
      bio: parsed.data.bio || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", s.session.uid);

  if (error) return fail(500, "internal", "Não foi possível salvar o perfil.");
  return NextResponse.json({ ok: true });
}
