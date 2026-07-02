import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RankingItem } from "@/lib/sacAnalysis";

type SacRankingChartProps = {
  data: RankingItem[];
  color?: string;
  emptyLabel: string;
};

const truncate = (s: string, n = 18) => (s.length > n ? s.slice(0, n) + "…" : s);

const SacRankingChart = ({ data, color = "hsl(218, 70%, 45%)", emptyLabel }: SacRankingChartProps) => {
  if (data.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-sm text-muted-foreground text-center px-4">
        {emptyLabel}
      </div>
    );
  }

  const chartData = data.map((d) => ({ ...d, labelCurto: truncate(d.label) }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
          <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="labelCurto"
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={90}
          />
          <Tooltip
            formatter={(value: number) => [`${value} ocorrências`, ""]}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ""}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--card))",
              fontSize: 12,
            }}
          />
          <Bar dataKey="count" name="Ocorrências" fill={color} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SacRankingChart;
