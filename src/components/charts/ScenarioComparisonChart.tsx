"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/format";
import type { ScenarioComparisonRow } from "@/lib/calculations/scenarios";

export function ScenarioComparisonChart({ data }: { data: ScenarioComparisonRow[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-12} height={70} />
        <YAxis tickFormatter={(value) => `${Number(value).toFixed(0)}`} />
        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
        <Bar dataKey="costPerUsefulM2" fill="#0f766e" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
