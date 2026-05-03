"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type StoredFeedback = {
  number: number;
  status: "pending" | "approved" | "rejected";
  name: string;
  category: string;
  notifiedStatus?: "approved" | "rejected";
};

const storageKey = "aframe-feedback-submissions";

const statusLabel = {
  pending: "Em analise",
  approved: "Aprovada",
  rejected: "Recusada",
} as const;

function readStoredFeedback() {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as StoredFeedback[];
  } catch {
    return [];
  }
}

export function MyFeedbackStatusList() {
  const [items, setItems] = useState<StoredFeedback[]>(readStoredFeedback);

  const refresh = async () => {
    const stored = readStoredFeedback();
    if (stored.length === 0) {
      setItems([]);
      return;
    }
    const response = await fetch("/api/feedback/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numbers: stored.map((item) => item.number) }),
    });
    const payload = (await response.json().catch(() => null)) as { items?: StoredFeedback[] } | null;
    const byNumber = new Map((payload?.items ?? []).map((item) => [item.number, item]));
    const next = stored.map((item) => ({ ...item, ...(byNumber.get(item.number) ?? {}) }));
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    setItems(next);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="mt-6 rounded-md border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Suas contribuicoes</h2>
          <p className="text-xs text-muted-foreground">Status das sugestoes enviadas neste navegador.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
          Atualizar
        </Button>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.number} className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm">
            <span>#{item.number} · {item.category}</span>
            <Badge variant={item.status === "rejected" ? "destructive" : item.status === "approved" ? "default" : "outline"}>
              {statusLabel[item.status]}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
