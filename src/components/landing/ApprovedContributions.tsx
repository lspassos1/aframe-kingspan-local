"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

type ApprovedContribution = {
  id: number;
  name: string;
  category: string;
};

export function ApprovedContributions() {
  const [items, setItems] = useState<ApprovedContribution[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/feedback/approved", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { items?: ApprovedContribution[] } | null) => {
        if (!cancelled) setItems(payload?.items?.slice(0, 4) ?? []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="absolute inset-x-4 bottom-4 mx-auto hidden max-w-5xl items-center justify-center gap-2 text-xs text-white/75 sm:flex">
      <span className="text-white/45">Melhorias aprovadas:</span>
      {items.map((item) => (
        <Badge key={item.id} variant="outline" className="border-white/18 bg-black/20 text-white/75 backdrop-blur">
          {item.name} · {item.category}
        </Badge>
      ))}
    </div>
  );
}
