import Link from "next/link";
import { Bot, Database, FileText, MapPin, PencilLine, SearchCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionCard, SectionHeader, StatusPill } from "@/components/shared/design-system";
import type { GuidedActionItem, GuidedActionKind } from "@/lib/ux/guided-actions";

const iconByKind: Record<GuidedActionKind, typeof Bot> = {
  ai: Bot,
  "central-db": SearchCheck,
  export: FileText,
  "manual-price": PencilLine,
  "price-base": Database,
  region: MapPin,
  review: ShieldCheck,
};

export function GuidedActionPanel({
  title = "Próximas ações",
  description = "Cada pendência mostra um caminho seguro para continuar sem travar o estudo.",
  items,
  className,
}: {
  title?: string;
  description?: string;
  items: GuidedActionItem[];
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <section className={className}>
      <SectionHeader title={title} description={description} />
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <ActionCard
            key={item.id}
            icon={iconByKind[item.kind]}
            title={item.title}
            description={item.description}
            badge={<StatusPill tone={item.tone} icon={false}>{item.status}</StatusPill>}
            footer={
              <div className="flex flex-wrap gap-2">
                {item.actions.map((action) => (
                  <Button key={`${item.id}-${action.href}-${action.label}`} asChild size="sm" variant={action.variant ?? "default"}>
                    <Link href={action.href}>{action.label}</Link>
                  </Button>
                ))}
              </div>
            }
          />
        ))}
      </div>
    </section>
  );
}
