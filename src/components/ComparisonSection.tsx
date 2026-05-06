import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip,
  Legend,
} from "recharts";
import { Award, AlertTriangle, Info, Star } from "lucide-react";
import type { SheetRow } from "@/hooks/useSheets";
import { numericStats } from "@/lib/sheetAnalysis";

// Cores estáveis pra produtos comparados no radar
const COMPARE_COLORS = [
  "hsl(218, 70%, 45%)",  // navy
  "hsl(15, 75%, 55%)",   // coral
  "hsl(165, 55%, 40%)",  // teal
  "hsl(280, 55%, 55%)",  // purple
  "hsl(35, 85%, 55%)",   // amber
];

const truncate = (s: string, n = 30) => (s.length > n ? s.slice(0, n) + "…" : s);

const RatingStars = ({ avg, max }: { avg: number; max: number }) => {
  if (max > 5 || max < 1) return null;
  const filled = Math.round(avg);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < filled ? "fill-amber-400 text-amber-400" : "text-muted stroke-muted-foreground/40"}`}
        />
      ))}
    </div>
  );
};

/** Comparação entre 2+ produtos: radar + médias por produto + destaques */
export const ComparisonSection = ({
  rowsBySub, headers,
}: { rowsBySub: Record<string, SheetRow[]>; headers: string[] }) => {
  const subs = Object.keys(rowsBySub);

  // Encontra colunas numéricas que tenham dados em pelo menos 2 produtos
  const numericCols = useMemo(() => {
    return headers.filter((h) => {
      let hits = 0;
      for (const sub of subs) {
        const values = rowsBySub[sub].map((r) => r[h]);
        const stats = numericStats(values, h);
        if (stats.count > 0) hits++;
        if (hits >= 2) return true;
      }
      return false;
    });
  }, [headers, rowsBySub, subs]);

  // Dados pro radar
  const radarData = useMemo(() => {
    return numericCols.map((col) => {
      const point: Record<string, string | number> = { question: truncate(col, 28) };
      subs.forEach((sub) => {
        const values = rowsBySub[sub].map((r) => r[col]);
        const stats = numericStats(values, col);
        point[sub] = stats.count > 0 ? Number(stats.avg.toFixed(2)) : 0;
      });
      return point;
    });
  }, [numericCols, rowsBySub, subs]);

  // Médias gerais por produto
  const subStats = useMemo(() => {
    return subs.map((sub) => {
      const stats = numericCols.map((col) =>
        numericStats(rowsBySub[sub].map((r) => r[col]), col)
      );
      const totalCount = stats.reduce((s, x) => s + x.count, 0);
      const weightedSum = stats.reduce((s, x) => s + x.avg * x.count, 0);
      return {
        sub,
        responses: rowsBySub[sub].length,
        avg: totalCount > 0 ? weightedSum / totalCount : null,
      };
    });
  }, [subs, numericCols, rowsBySub]);

  // Destaques: melhor e pior atributo por produto
  const highlights = useMemo(() => {
    return subs.map((sub) => {
      const perCol = numericCols.map((col) => {
        const stats = numericStats(rowsBySub[sub].map((r) => r[col]), col);
        return { col, avg: stats.avg, count: stats.count };
      }).filter((x) => x.count > 0);
      if (perCol.length === 0) return { sub, best: null, worst: null };
      const sorted = [...perCol].sort((a, b) => b.avg - a.avg);
      return { sub, best: sorted[0], worst: sorted[sorted.length - 1] };
    });
  }, [subs, numericCols, rowsBySub]);

  if (numericCols.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comparação entre {subs.join(" × ")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Não há perguntas numéricas suficientes nesses produtos pra montar um comparativo.
        </CardContent>
      </Card>
    );
  }

  const allValues = radarData.flatMap((p) => subs.map((s) => Number(p[s] ?? 0)));
  const maxScale = Math.max(5, Math.ceil(Math.max(...allValues) || 5));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Comparação entre {subs.join(" × ")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Médias por produto */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {subStats.map((s, i) => (
            <div
              key={s.sub}
              className="rounded-lg border p-3 space-y-1"
              style={{ borderLeftWidth: 4, borderLeftColor: COMPARE_COLORS[i % COMPARE_COLORS.length] }}
            >
              <div className="text-xs text-muted-foreground uppercase tracking-wide">{s.sub}</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">
                  {s.avg != null ? s.avg.toFixed(2) : "—"}
                </span>
                {s.avg != null && <RatingStars avg={s.avg} max={5} />}
              </div>
              <div className="text-xs text-muted-foreground">{s.responses} respostas</div>
            </div>
          ))}
        </div>

        {/* Bloco do radar com explicação */}
        <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
          <div className="flex items-start gap-2 text-sm">
            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="text-muted-foreground space-y-1">
              <p>
                <strong className="text-foreground">Como ler este gráfico:</strong> cada
                <strong className="text-foreground"> ponta</strong> é uma pergunta da pesquisa.
                Quanto <strong className="text-foreground">mais longe do centro</strong>, melhor a nota
                média naquela pergunta (centro = 0, borda = {maxScale}).
              </p>
              <p>
                Cada <strong className="text-foreground">cor</strong> representa um produto. Quanto
                maior a área pintada, melhor o desempenho geral. Quando uma cor "afunda" em alguma
                ponta, é uma fraqueza naquele atributo específico.
              </p>
            </div>
          </div>
          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="75%">
                <PolarGrid />
                <PolarAngleAxis dataKey="question" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis domain={[0, maxScale]} tick={{ fontSize: 10 }} />
                {subs.map((sub, i) => (
                  <Radar
                    key={sub}
                    name={sub}
                    dataKey={sub}
                    stroke={COMPARE_COLORS[i % COMPARE_COLORS.length]}
                    fill={COMPARE_COLORS[i % COMPARE_COLORS.length]}
                    fillOpacity={0.25}
                  />
                ))}
                <Legend />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                    fontSize: 12,
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Destaques: melhor / pior por produto */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {highlights.map((h, i) => (
            h.best && h.worst ? (
              <div
                key={h.sub}
                className="rounded-lg border p-3 space-y-2"
                style={{ borderTopWidth: 3, borderTopColor: COMPARE_COLORS[i % COMPARE_COLORS.length] }}
              >
                <div className="text-sm font-medium">{h.sub}</div>
                <div className="flex items-start gap-2 text-xs">
                  <Award className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-muted-foreground">Mais bem avaliado</div>
                    <div className="truncate" title={h.best.col}>{h.best.col}</div>
                    <div className="font-semibold text-emerald-700">{h.best.avg.toFixed(2)}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <AlertTriangle className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-muted-foreground">Precisa de atenção</div>
                    <div className="truncate" title={h.worst.col}>{h.worst.col}</div>
                    <div className="font-semibold text-rose-700">{h.worst.avg.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            ) : null
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ComparisonSection;
