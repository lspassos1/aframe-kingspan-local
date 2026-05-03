"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type StoredFeedback = {
  number: number;
  status: "pending" | "approved" | "rejected";
  name: string;
  category: string;
  notifiedStatus?: "approved" | "rejected";
};

const storageKey = "aframe-feedback-submissions";

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

function writeStoredFeedback(items: StoredFeedback[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(items));
}

export function FeedbackStatusNotifier() {
  const [items, setItems] = useState<StoredFeedback[]>(readStoredFeedback);
  const notification = useMemo(
    () => items.find((item) => item.status !== "pending" && item.notifiedStatus !== item.status),
    [items]
  );

  useEffect(() => {
    const stored = readStoredFeedback();
    const pending = stored.filter((item) => item.status === "pending" || item.notifiedStatus !== item.status);
    if (pending.length === 0) return;

    fetch("/api/feedback/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numbers: pending.map((item) => item.number) }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { items?: StoredFeedback[] } | null) => {
        if (!payload?.items) return;
        const byNumber = new Map(payload.items.map((item) => [item.number, item]));
        const next = stored.map((item) => ({ ...item, ...(byNumber.get(item.number) ?? {}) }));
        writeStoredFeedback(next);
        setItems(next);
      })
      .catch(() => undefined);
  }, []);

  const close = () => {
    if (!notification) return;
    const next = items.map((item) =>
      item.number === notification.number && notification.status !== "pending"
        ? { ...item, notifiedStatus: notification.status }
        : item
    );
    writeStoredFeedback(next);
    setItems(next);
  };

  return (
    <Dialog open={Boolean(notification)} onOpenChange={(open) => (!open ? close() : undefined)}>
      <DialogContent className="rounded-md">
        <DialogHeader>
          <DialogTitle>{notification?.status === "approved" ? "Melhoria aprovada" : "Melhoria analisada"}</DialogTitle>
          <DialogDescription>
            {notification?.status === "approved"
              ? "Obrigado pela contribuicao. Sua melhoria foi aprovada e pode aparecer discretamente na pagina inicial com seu nome e tipo de colaboracao."
              : "Obrigado pela contribuicao. Desta vez a melhoria foi recusada, mas continue enviando ideias e problemas que encontrar no app."}
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
