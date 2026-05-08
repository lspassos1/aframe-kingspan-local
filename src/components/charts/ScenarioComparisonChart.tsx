"use client";

import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/format";
import type { ScenarioComparisonRow } from "@/lib/calculations/scenarios";

export function ScenarioComparisonChart({ data }: { data: ScenarioComparisonRow[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateSize = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      setSize({
        width: rect && rect.width > 0 ? Math.floor(rect.width) : 0,
        height: rect && rect.height > 0 ? Math.floor(rect.height) : 0,
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    const node = containerRef.current;
    if (node) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const chartWidth = Math.max(size.width, 320);
  const chartHeight = Math.max(size.height, 260);

  return (
    <div ref={containerRef} className="h-full min-h-[260px] w-full overflow-x-auto">
      {size.width > 0 && size.height > 0 ? (
        <BarChart data={data} width={chartWidth} height={chartHeight}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-12} height={70} />
          <YAxis tickFormatter={(value) => `${Number(value).toFixed(0)}`} />
          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
          <Bar dataKey="costPerUsefulM2" fill="#0f766e" radius={[4, 4, 0, 0]} />
        </BarChart>
      ) : (
        <div className="h-full min-h-[260px] rounded-2xl bg-muted/50" aria-hidden="true" />
      )}
    </div>
  );
}
