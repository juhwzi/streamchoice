import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function OwnProfileRedirect() {
  const session = await getSession();
  if (!session) redirect("/entrar?next=/u/me");

  const { data: user } = await admin().from("users").select("username").eq("id", session.uid).maybeSingle();
  if (!user?.username) redirect("/entrar");

  redirect(`/u/${encodeURIComponent(user.username)}`);
}
