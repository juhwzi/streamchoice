"use client";
import { useEffect, useRef, useState } from "react";
import { leaderId } from "@/lib/scoring";
import type { RankingRow } from "@/lib/types";

/** Devolve o id do líder por ~1s quando a liderança muda (destaque de "sniping", RF20). */
export function useLeaderFlash(ranking: RankingRow[] | undefined): string | null {
  const prev = useRef<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const lead = ranking ? leaderId(ranking) : null;
  useEffect(() => {
    if (lead && prev.current && lead !== prev.current) {
      setFlash(lead);
      const t = setTimeout(() => setFlash(null), 1200);
      prev.current = lead;
      return () => clearTimeout(t);
    }
    prev.current = lead;
  }, [lead]);
  return flash;
}
