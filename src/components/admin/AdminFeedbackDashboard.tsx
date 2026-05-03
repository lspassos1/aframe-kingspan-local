"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type FeedbackIssue = {
  number: number;
  title: string;
  name: string;
  contact: string;
  category: string;
  message: string;
  status: "pending" | "approved" | "rejected";
  htmlUrl: string;
  createdAt: string;
};

const statusLabel = {
  pending: "Pendente",
  approved: "Aprovada",
  rejected: "Recusada",
} as const;

export function AdminFeedbackDashboard() {
  const [items, setItems] = useState<FeedbackIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
  const [error, setError] = useState("");

  const stats = useMemo(
    () => ({
      pending: items.filter((item) => item.status === "pending").length,
      approved: items.filter((item) => item.status === "approved").length,
      rejected: items.filter((item) => item.status === "rejected").length,
    }),
    [items]
  );

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError("");
    const response = await fetch("/api/admin/feedback", { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as { items?: FeedbackIssue[]; message?: string } | null;
    if (!response.ok) {
      setError(payload?.message ?? "Nao foi possivel carregar melhorias.");
      setLoading(false);
      return;
    }
    setItems(payload?.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const update = async (issueNumber: number, status: "approved" | "rejected") => {
    setUpdating(issueNumber);
    setError("");
    const response = await fetch("/api/admin/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issueNumber, status }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      setError(payload?.message ?? "Nao foi possivel atualizar.");
      setUpdating(null);
      return;
    }
    setItems((current) => current.map((item) => (item.number === issueNumber ? { ...item, status } : item)));
    setUpdating(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Admin</p>
          <h1 className="text-3xl font-semibold tracking-normal">Melhorias dos usuarios</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Aprove ou recuse sugestoes enviadas pelo formulario. Aprovadas aparecem discretamente na pagina inicial.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          Atualizar
        </Button>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border bg-card p-4">
          <p className="text-sm text-muted-foreground">Pendentes</p>
          <p className="mt-2 text-2xl font-semibold">{stats.pending}</p>
        </div>
        <div className="rounded-md border bg-card p-4">
          <p className="text-sm text-muted-foreground">Aprovadas</p>
          <p className="mt-2 text-2xl font-semibold">{stats.approved}</p>
        </div>
        <div className="rounded-md border bg-card p-4">
          <p className="text-sm text-muted-foreground">Recusadas</p>
          <p className="mt-2 text-2xl font-semibold">{stats.rejected}</p>
        </div>
      </section>

      {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuario</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Mensagem</TableHead>
            <TableHead className="text-right">Acoes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                Carregando melhorias...
              </TableCell>
            </TableRow>
          ) : items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                Nenhuma melhoria recebida ainda.
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.number}>
                <TableCell>
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-muted-foreground">{item.contact || "Sem contato"}</div>
                </TableCell>
                <TableCell>{item.category}</TableCell>
                <TableCell>
                  <Badge variant={item.status === "rejected" ? "destructive" : item.status === "approved" ? "default" : "outline"}>
                    {statusLabel[item.status]}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-md whitespace-normal text-sm text-muted-foreground">{item.message}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <a href={item.htmlUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button size="sm" onClick={() => update(item.number, "approved")} disabled={updating === item.number}>
                      <CheckCircle2 className="h-4 w-4" />
                      Aprovar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => update(item.number, "rejected")} disabled={updating === item.number}>
                      <XCircle className="h-4 w-4" />
                      Recusar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
