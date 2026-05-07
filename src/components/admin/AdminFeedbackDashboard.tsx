"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, KeyRound, ShieldAlert, XCircle } from "lucide-react";
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

type AdminFeedbackStatus = "ok" | "empty" | "forbidden" | "missing_token" | "github_error" | "server_error" | "invalid_request";

type AdminFeedbackResponse = {
  status?: AdminFeedbackStatus;
  code?: string;
  items?: FeedbackIssue[];
  message?: string;
  action?: string;
  githubStatus?: number | null;
};

type AdminFeedbackDiagnostic = {
  status: Exclude<AdminFeedbackStatus, "ok">;
  message: string;
  action?: string;
  githubStatus?: number | null;
};

const statusLabel = {
  pending: "Pendente",
  approved: "Aprovada",
  rejected: "Recusada",
} as const;

const diagnosticCopy: Record<AdminFeedbackDiagnostic["status"], { title: string; icon: typeof AlertTriangle; tone: string }> = {
  empty: {
    title: "Sem feedback ainda",
    icon: CheckCircle2,
    tone: "border-emerald-200 bg-emerald-50 text-emerald-950",
  },
  forbidden: {
    title: "Sem permissão",
    icon: ShieldAlert,
    tone: "border-amber-200 bg-amber-50 text-amber-950",
  },
  missing_token: {
    title: "Token GitHub ausente",
    icon: KeyRound,
    tone: "border-amber-200 bg-amber-50 text-amber-950",
  },
  github_error: {
    title: "GitHub API falhou",
    icon: AlertTriangle,
    tone: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  server_error: {
    title: "Erro operacional",
    icon: AlertTriangle,
    tone: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  invalid_request: {
    title: "Solicitação inválida",
    icon: AlertTriangle,
    tone: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

export function AdminFeedbackDashboard() {
  const [items, setItems] = useState<FeedbackIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
  const [diagnostic, setDiagnostic] = useState<AdminFeedbackDiagnostic | null>(null);

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
    setDiagnostic(null);
    try {
      const response = await fetch("/api/admin/feedback", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as AdminFeedbackResponse | null;
      if (!response.ok) {
        setItems([]);
        setDiagnostic({
          status: payload?.status && payload.status !== "ok" ? payload.status : "server_error",
          message: payload?.message ?? "Não foi possível carregar melhorias.",
          action: payload?.action,
          githubStatus: payload?.githubStatus,
        });
        setLoading(false);
        return;
      }
      const nextItems = payload?.items ?? [];
      setItems(nextItems);
      setDiagnostic(
        payload?.status === "empty" || nextItems.length === 0
          ? {
              status: "empty",
              message: payload?.message ?? "Nenhuma melhoria recebida ainda.",
            }
          : null
      );
      setLoading(false);
    } catch {
      setItems([]);
      setDiagnostic({
        status: "server_error",
        message: "Não foi possível conectar ao serviço de feedback.",
        action: "Verifique a rota /api/admin/feedback e tente novamente.",
      });
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const update = async (issueNumber: number, status: "approved" | "rejected") => {
    setUpdating(issueNumber);
    setDiagnostic(null);
    try {
      const response = await fetch("/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueNumber, status }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as AdminFeedbackResponse | null;
        setDiagnostic({
          status: payload?.status && payload.status !== "ok" ? payload.status : "server_error",
          message: payload?.message ?? "Não foi possível atualizar.",
          action: payload?.action,
          githubStatus: payload?.githubStatus,
        });
        setUpdating(null);
        return;
      }
      setItems((current) => current.map((item) => (item.number === issueNumber ? { ...item, status } : item)));
      setUpdating(null);
    } catch {
      setDiagnostic({
        status: "server_error",
        message: "Não foi possível conectar ao serviço de feedback.",
        action: "Verifique a rota /api/admin/feedback e tente novamente.",
      });
      setUpdating(null);
    }
  };

  const diagnosticMeta = diagnostic ? diagnosticCopy[diagnostic.status] : null;
  const DiagnosticIcon = diagnosticMeta?.icon;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Admin</p>
          <h1 className="text-3xl font-semibold tracking-normal">Melhorias dos usuários</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Aprove ou recuse sugestões enviadas pelo formulário. Aprovadas aparecem discretamente na página inicial.
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

      {diagnostic && diagnosticMeta ? (
        <section className={`flex gap-3 rounded-md border p-4 text-sm ${diagnosticMeta.tone}`}>
          {DiagnosticIcon ? <DiagnosticIcon className="mt-0.5 h-5 w-5 shrink-0" /> : null}
          <div className="space-y-1">
            <p className="font-medium">{diagnosticMeta.title}</p>
            <p>{diagnostic.message}</p>
            {typeof diagnostic.githubStatus === "number" ? <p>Status GitHub: {diagnostic.githubStatus}</p> : null}
            {diagnostic.action ? <p>{diagnostic.action}</p> : null}
          </div>
        </section>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuário</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Mensagem</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                Carregando melhorias...
              </TableCell>
            </TableRow>
          ) : diagnostic && diagnostic.status !== "empty" ? (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                Corrija o diagnóstico acima para carregar a lista de melhorias.
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
