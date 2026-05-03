"use client";

import { useState } from "react";
import { Controller, type Resolver, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { feedbackSchema, type FeedbackFormValues } from "@/lib/validation/feedback";

const categories = [
  { value: "melhoria", label: "Melhoria" },
  { value: "bug", label: "Erro no app" },
  { value: "orcamento", label: "Orcamento" },
  { value: "3d", label: "Modelo 3D" },
  { value: "privacidade", label: "Privacidade" },
  { value: "outro", label: "Outro" },
] as const;

export function FeedbackForm() {
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [serverMessage, setServerMessage] = useState("");
  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackSchema) as Resolver<FeedbackFormValues>,
    mode: "onChange",
    defaultValues: {
      name: "",
      contact: "",
      category: "melhoria",
      message: "",
      company: "",
    },
  });

  const onSubmit = async (values: FeedbackFormValues) => {
    setStatus("idle");
    setServerMessage("");
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    if (!response.ok) {
      setStatus("error");
      setServerMessage(payload?.message ?? "Nao foi possivel enviar agora.");
      return;
    }
    setStatus("success");
    setServerMessage(payload?.message ?? "Mensagem enviada.");
    form.reset({ name: "", contact: "", category: "melhoria", message: "", company: "" });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Nome opcional</Label>
          <Input id="name" autoComplete="name" {...form.register("name")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact">Contato opcional</Label>
          <Input id="contact" autoComplete="email" placeholder="Email ou WhatsApp, se quiser retorno" {...form.register("contact")} />
          <p className="text-xs text-muted-foreground">Nao precisa informar contato para enviar melhoria.</p>
        </div>
      </div>

      <Controller
        control={form.control}
        name="category"
        render={({ field }) => (
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((item) => (
                  <SelectItem value={item.value} key={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      />

      <div className="hidden" aria-hidden="true">
        <Label htmlFor="company">Empresa</Label>
        <Input id="company" tabIndex={-1} autoComplete="off" {...form.register("company")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="message" className={cn(form.formState.errors.message && "text-destructive")}>
          Descreva a melhoria
        </Label>
        <Textarea
          id="message"
          rows={7}
          aria-invalid={Boolean(form.formState.errors.message)}
          className={cn(form.formState.errors.message && "border-destructive bg-destructive/5 ring-2 ring-destructive/20")}
          placeholder="Explique o problema, tela afetada, comportamento esperado ou ideia de melhoria."
          {...form.register("message")}
        />
        {form.formState.errors.message ? <p className="text-xs font-medium text-destructive">{form.formState.errors.message.message}</p> : null}
      </div>

      {serverMessage ? (
        <p
          className={cn(
            "rounded-md border p-3 text-sm",
            status === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-destructive/30 bg-destructive/10 text-destructive"
          )}
        >
          {serverMessage}
        </p>
      ) : null}

      <Button type="submit" disabled={!form.formState.isValid || form.formState.isSubmitting}>
        <Send className="mr-2 h-4 w-4" />
        Enviar melhoria
      </Button>
    </form>
  );
}
