"use client";

import { useState, type ReactNode } from "react";
import { Download, Maximize2, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Mobile3DSummaryItem } from "@/lib/model-3d/mobile-summary";
import type { Mobile3DViewMode } from "./Mobile3DControls";

const desktopViews: Array<{ id: Mobile3DViewMode; label: string }> = [
  { id: "iso", label: "3D" },
  { id: "top", label: "Topo" },
  { id: "front", label: "Frente" },
  { id: "section", label: "Corte" },
];

export function SceneFirstViewerShell({
  controls,
  methodLabel,
  mobileControls,
  onResetView,
  onScreenshot,
  onViewChange,
  scene,
  screenshotEnabled = true,
  statusLabel,
  summary,
  title,
  view,
}: {
  controls: ReactNode;
  methodLabel: string;
  mobileControls: ReactNode;
  onResetView: () => void;
  onScreenshot: () => void;
  onViewChange: (view: Mobile3DViewMode) => void;
  scene: ReactNode;
  screenshotEnabled?: boolean;
  statusLabel?: string;
  summary: Mobile3DSummaryItem[];
  title: string;
  view: Mobile3DViewMode;
}) {
  const [controlsOpen, setControlsOpen] = useState(false);

  return (
    <section data-slot="scene-first-3d-shell" className="space-y-4">
      <div className="relative min-h-[58svh] overflow-hidden rounded-[1.65rem] border border-slate-900/10 bg-slate-950 shadow-2xl shadow-slate-950/15 xl:min-h-[calc(100svh-9rem)]">
        <div className="absolute inset-0">{scene}</div>
        <div className="pointer-events-none absolute inset-x-3 top-3 z-20 hidden items-start justify-between gap-3 xl:flex">
          <div className="pointer-events-auto max-w-xl rounded-2xl border border-white/20 bg-white/88 px-4 py-3 text-slate-950 shadow-xl shadow-slate-950/10 backdrop-blur-xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-semibold text-white">{methodLabel}</span>
              {statusLabel ? <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">{statusLabel}</span> : null}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Maximize2 className="h-4 w-4 text-slate-500" />
              <h1 className="text-lg font-semibold tracking-normal">{title}</h1>
            </div>
          </div>

          <div className="pointer-events-auto flex flex-wrap justify-end gap-2 rounded-2xl border border-white/20 bg-white/88 p-2 shadow-xl shadow-slate-950/10 backdrop-blur-xl">
            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              {desktopViews.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  size="sm"
                  variant={view === item.id ? "default" : "ghost"}
                  className="h-8 rounded-lg px-3"
                  onClick={() => onViewChange(item.id)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            <Button type="button" size="sm" variant="outline" className="h-10 rounded-xl bg-white" onClick={onResetView}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            {screenshotEnabled ? (
              <Button type="button" size="sm" variant="outline" className="h-10 rounded-xl bg-white" onClick={onScreenshot}>
                <Download className="mr-2 h-4 w-4" />
                PNG
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              className="h-10 rounded-xl"
              aria-expanded={controlsOpen}
              aria-controls="scene-first-controls"
              onClick={() => setControlsOpen((current) => !current)}
            >
              {controlsOpen ? <X className="mr-2 h-4 w-4" /> : <SlidersHorizontal className="mr-2 h-4 w-4" />}
              Controles
            </Button>
          </div>
        </div>

        {controlsOpen ? (
          <aside
            id="scene-first-controls"
            className="pointer-events-auto absolute bottom-4 right-4 top-24 z-30 hidden w-[380px] overflow-y-auto rounded-3xl border border-white/25 bg-white/92 p-4 text-slate-950 shadow-2xl shadow-slate-950/20 backdrop-blur-xl xl:block"
          >
            {controls}
          </aside>
        ) : null}

        <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-20 hidden grid-cols-4 gap-2 xl:grid">
          {summary.map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/20 bg-white/86 px-3 py-2 text-slate-950 shadow-lg shadow-slate-950/10 backdrop-blur-xl">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">{item.label}</p>
              <p className="mt-1 text-sm font-semibold">{item.value}</p>
              <p className="truncate text-xs text-slate-500">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>
      {mobileControls}
    </section>
  );
}

export function ViewerControlSection({ children, icon, title }: { children: ReactNode; icon?: ReactNode; title: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      {children}
    </section>
  );
}
