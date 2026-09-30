"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function FollowButton({ slug, initialFollowing, initialFollowers, loggedIn }: { slug: string; initialFollowing: boolean; initialFollowers: number; loggedIn: boolean }) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [followers, setFollowers] = useState(initialFollowers);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!loggedIn) {
      router.push(`/entrar?next=${encodeURIComponent(`/streamer/${slug}`)}`);
      return;
    }
    if (busy) return;
    setBusy(true);
    const res = await fetch(`/api/channels/${slug}/follow`, { method: following ? "DELETE" : "POST" });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      const next = json.following !== false;
      setFollowing(next);
      setFollowers((n) => Math.max(0, n + (next ? 1 : -1)));
    }
    setBusy(false);
  }

  return (
    <button onClick={toggle} disabled={busy} className={`rounded-lg px-5 py-3 font-bold transition ${following ? "border border-line bg-ink text-white" : "bg-kick text-ink"} disabled:opacity-60`}>
      {busy ? "..." : following ? "✓ Seguindo" : "Seguir streamer"}
      <span className="ml-2 text-xs opacity-70">{followers}</span>
    </button>
  );
}
