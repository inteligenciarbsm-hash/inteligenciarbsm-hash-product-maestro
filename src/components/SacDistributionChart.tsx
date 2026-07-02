import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { RankingItem } from "@/lib/sacAnalysis";

type SacDistributionChartProps = {
  data: RankingItem[];
  emptyLabel: string;
  /** Cores semânticas por rótulo (ex: criticidade Alta/Média/Baixa). Rótulos sem match usam a paleta padrão. */
  semanticColors?: Record<string, string>;
};

// Paleta categórica padrão — mesma lógica de COMPARE_COLORS (ComparisonSection.tsx),
// usada quando não há mapeamento semântico para o rótulo.
const DEFAULT_PALETTE = [
  "hsl(218, 70%, 45%)", // navy
  "hsl(15, 75%, 55%)",  // coral
  "hsl(165, 55%, 40%)", // teal
  "hsl(280, 55%, 55%)", // purple
  "hsl(35, 85%, 55%)",  // amber
  "hsl(340, 65%, 55%)", // rosa
];

const SacDistributionChart = ({ data, emptyLabel, semanticColors }: SacDistributionChartProps) => {
  if (data.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-sm text-muted-foreground text-center px-4">
        {emptyLabel}
      </div>
    );
  }

  const colorFor = (label: string, i: number): string =>
    semanticColors?.[label.toLowerCase()] ?? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            paddingAngle={2}
          >
            {data.map((entry, i) => (
              <Cell key={entry.label} fill={colorFor(entry.label, i)} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, _name, entry) => [`${value} ocorrências`, entry?.payload?.label ?? ""]}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--card))",
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SacDistributionChart;
