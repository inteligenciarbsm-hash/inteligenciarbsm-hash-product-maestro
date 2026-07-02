import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MesSerie } from "@/lib/sacAnalysis";

type SacTrendChartProps = {
  data: MesSerie[];
};

const MES_LABELS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

const formatMes = (mes: string): string => {
  const [ano, mesNum] = mes.split("-");
  const idx = Number(mesNum) - 1;
  return `${MES_LABELS[idx] ?? mesNum}/${ano.slice(2)}`;
};

const SacTrendChart = ({ data }: SacTrendChartProps) => {
  const chartData = data.map((d) => ({ ...d, label: formatMes(d.mes) }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--card))",
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="abertas" name="Em aberto" stackId="ocorrencias" fill="hsl(35, 85%, 55%)" radius={[0, 0, 0, 0]} />
          <Bar dataKey="encerradas" name="Encerradas" stackId="ocorrencias" fill="hsl(165, 55%, 40%)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SacTrendChart;
