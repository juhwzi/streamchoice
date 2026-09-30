export function VerifiedBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-kick text-[11px] font-black text-ink shadow-[0_0_0_3px_rgba(83,252,24,.10)] ${className}`}
      title="Streamer verificado na Kick"
      aria-label="Streamer verificado na Kick"
    >
      ✓
    </span>
  );
}
