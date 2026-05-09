"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ChevronDown, Download, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Mobile3DSummaryItem } from "@/lib/model-3d/mobile-summary";

export type Mobile3DViewMode = "iso" | "top" | "front" | "rear" | "side" | "section";

const quickViews: Array<{ id: Mobile3DViewMode; label: string }> = [
  { id: "iso", label: "3D" },
  { id: "top", label: "Topo" },
  { id: "front", label: "Frente" },
  { id: "section", label: "Corte" },
];

const viewLabels: Record<Mobile3DViewMode, string> = {
  front: "Frente",
  iso: "Isométrica",
  rear: "Posterior",
  section: "Corte",
  side: "Lateral",
  top: "Topo",
};

export interface Mobile3DOpeningPreview {
  doorCount: number;
  windowCount: number;
}

function hasOpeningPreview(openings: Mobile3DOpeningPreview | undefined) {
  return openings != null && openings.doorCount + openings.windowCount > 0;
}

function MobileOpeningMarkers({ openings, view }: { openings?: Mobile3DOpeningPreview; view: Mobile3DViewMode }) {
  if (!hasOpeningPreview(openings)) return null;

  if (view === "top") {
    return (
      <>
        {openings?.doorCount ? <rect x="132" y="172" width="42" height="8" rx="4" fill="#111827" /> : null}
        {openings?.windowCount ? <rect x="236" y="112" width="8" height="34" rx="4" fill="#0ea5e9" /> : null}
      </>
    );
  }

  if (view === "front" || view === "section") {
    return (
      <>
        {openings?.doorCount ? <rect x="142" y="162" width="32" height="44" rx="2" fill="#111827" opacity="0.82" /> : null}
        {openings?.windowCount ? <rect x="186" y="142" width="34" height="24" rx="3" fill="#38bdf8" stroke="#0f172a" strokeWidth="2" opacity="0.86" /> : null}
      </>
    );
  }

  return (
    <>
      {openings?.doorCount ? <polygon points="230,132 244,126 244,174 230,180" fill="#111827" opacity="0.84" /> : null}
      {openings?.windowCount ? <polygon points="182,144 208,134 208,158 182,168" fill="#38bdf8" stroke="#0f172a" strokeWidth="2" opacity="0.86" /> : null}
    </>
  );
}

export function Mobile3DPreview({
  badge = "Modo mobile simplificado",
  openings,
  subtitle,
  title,
  view,
}: {
  badge?: string;
  openings?: Mobile3DOpeningPreview;
  subtitle: string;
  title: string;
  view: Mobile3DViewMode;
}) {
  return (
    <div className="relative grid h-full min-h-[360px] place-items-center overflow-hidden bg-[linear-gradient(90deg,#e2e8f0_1px,transparent_1px),linear-gradient(#e2e8f0_1px,transparent_1px)] bg-[size:32px_32px] p-5">
      <div className="absolute left-4 top-4 rounded-full border bg-background/90 px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm">
        {badge}
      </div>
      <div className="absolute right-4 top-4 rounded-full border bg-background/90 px-3 py-1 text-xs font-semibold shadow-sm">{viewLabels[view]}</div>
      <svg aria-hidden="true" className="h-full max-h-[300px] w-full max-w-[320px]" viewBox="0 0 320 260">
        {view === "top" ? (
          <>
            <rect x="54" y="48" width="212" height="156" rx="10" fill="#f8fafc" stroke="#0f172a" strokeWidth="4" />
            <rect x="80" y="76" width="160" height="100" rx="6" fill="#e0f2fe" stroke="#0891b2" strokeWidth="3" />
            <line x1="80" y1="126" x2="240" y2="126" stroke="#0f172a" strokeDasharray="8 8" strokeWidth="2" />
            <line x1="160" y1="76" x2="160" y2="176" stroke="#0f172a" strokeDasharray="8 8" strokeWidth="2" />
            <MobileOpeningMarkers openings={openings} view={view} />
          </>
        ) : view === "front" ? (
          <>
            <polygon points="160,42 66,206 254,206" fill="#dbeafe" stroke="#0f172a" strokeLinejoin="round" strokeWidth="4" />
            <rect x="112" y="132" width="96" height="74" fill="#f8fafc" stroke="#0f172a" strokeWidth="3" />
            <line x1="160" y1="42" x2="160" y2="206" stroke="#0369a1" strokeDasharray="9 8" strokeWidth="3" />
            <MobileOpeningMarkers openings={openings} view={view} />
          </>
        ) : view === "section" ? (
          <>
            <polygon points="70,210 160,48 250,210" fill="#ecfeff" stroke="#0f172a" strokeLinejoin="round" strokeWidth="4" />
            <path d="M108 210 L108 142 L212 142 L212 210" fill="#f8fafc" stroke="#0f172a" strokeWidth="3" />
            <rect x="126" y="158" width="68" height="52" fill="#fde68a" stroke="#92400e" strokeWidth="3" />
            <line x1="70" y1="210" x2="250" y2="210" stroke="#0f766e" strokeWidth="5" />
            <MobileOpeningMarkers openings={openings} view={view} />
          </>
        ) : (
          <>
            <polygon points="84,82 190,42 262,92 154,134" fill="#dbeafe" stroke="#0f172a" strokeLinejoin="round" strokeWidth="4" />
            <polygon points="84,82 154,134 154,214 84,162" fill="#bfdbfe" stroke="#0f172a" strokeLinejoin="round" strokeWidth="4" />
            <polygon points="154,134 262,92 262,172 154,214" fill="#e0f2fe" stroke="#0f172a" strokeLinejoin="round" strokeWidth="4" />
            <line x1="84" y1="162" x2="154" y2="214" stroke="#0f766e" strokeWidth="5" />
            <line x1="154" y1="214" x2="262" y2="172" stroke="#0f766e" strokeWidth="5" />
            <MobileOpeningMarkers openings={openings} view={view} />
          </>
        )}
      </svg>
      <div className="absolute bottom-4 left-4 right-4 rounded-2xl border bg-background/92 p-3 shadow-sm">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs leading-5 text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

export function Mobile3DControls({
  advancedControls,
  onScreenshot,
  onViewChange,
  showScreenshotAction = true,
  summary,
  view,
}: {
  advancedControls: ReactNode;
  onScreenshot: () => void;
  onViewChange: (view: Mobile3DViewMode) => void;
  showScreenshotAction?: boolean;
  summary: Mobile3DSummaryItem[];
  view: Mobile3DViewMode;
}) {
  return (
    <div className="space-y-3 xl:hidden">
      <section className="rounded-2xl border bg-background p-3 shadow-sm">
        <div className="grid gap-2">
          {summary.map((item) => (
            <div className="rounded-xl border bg-muted/20 px-3 py-2" key={item.label}>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-sm font-semibold">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {quickViews.map((item) => (
            <Button key={item.id} type="button" variant={view === item.id ? "default" : "outline"} size="sm" onClick={() => onViewChange(item.id)}>
              {item.label}
            </Button>
          ))}
        </div>
        <div className={`mt-3 grid gap-2 ${showScreenshotAction ? "grid-cols-2" : "grid-cols-1"}`}>
          <Button type="button" variant="outline" size="sm" onClick={() => onViewChange("iso")}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          {showScreenshotAction ? (
            <Button type="button" variant="outline" size="sm" onClick={onScreenshot}>
              <Download className="mr-2 h-4 w-4" />
              PNG
            </Button>
          ) : null}
        </div>
      </section>

      <details className="group rounded-2xl border bg-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold">
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Controles avançados
          </span>
          <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
        </summary>
        <div className="space-y-4 border-t px-3 py-4">{advancedControls}</div>
      </details>
    </div>
  );
}

export function useMobile3DViewport() {
  const [isMobile, setIsMobile] = useState(() => (typeof window === "undefined" ? false : window.matchMedia("(max-width: 1279px)").matches));

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1279px)");
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isMobile;
}
