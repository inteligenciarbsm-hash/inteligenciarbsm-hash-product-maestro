import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SacScoreSaude, SacTendencias, TendenciaIndicador } from "@/lib/sacAnalysis";

type SacExecutiveSummaryProps = {
  resumo: string;
  score: SacScoreSaude;
  tendencias: SacTendencias;
};

const NIVEL_CLASS: Record<SacScoreSaude["nivel"], { ring: string; text: string; label: string }> = {
  otimo: { ring: "ring-emerald-500/30 bg-emerald-500/10", text: "text-emerald-600", label: "Saudável" },
  atencao: { ring: "ring-amber-500/30 bg-amber-500/10", text: "text-amber-600", label: "Atenção" },
  critico: { ring: "ring-destructive/30 bg-destructive/10", text: "text-destructive", label: "Crítico" },
};

const ScoreGauge = ({ score, nivel }: SacScoreSaude) => {
  const classes = NIVEL_CLASS[nivel];
  return (
    <div className={cn("flex flex-col items-center justify-center gap-1 rounded-full h-28 w-28 shrink-0 ring-4", classes.ring)}>
      <span className={cn("text-3xl font-bold", classes.text)}>{score}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">de 100</span>
      <span className={cn("text-xs font-medium", classes.text)}>{classes.label}</span>
    </div>
  );
};

const TrendBadge = ({ label, indicador, invertido = false }: { label: string; indicador: TendenciaIndicador; invertido?: boolean }) => {
  // invertido: quando "subir" é ruim (ex: tempo de resolução, ocorrências críticas)
  const positivo = invertido ? indicador.tendencia === "desceu" : indicador.tendencia === "subiu";
  const negativo = invertido ? indicador.tendencia === "subiu" : indicador.tendencia === "desceu";

  const Icon = indicador.tendencia === "subiu" ? TrendingUp : indicador.tendencia === "desceu" ? TrendingDown : Minus;
  const colorClass = indicador.tendencia === "estavel"
    ? "text-muted-foreground"
    : positivo
    ? "text-emerald-600"
    : negativo
    ? "text-destructive"
    : "text-muted-foreground";

  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className={cn("h-4 w-4 shrink-0", colorClass)} />
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium", colorClass)}>
        {indicador.percentual === null
          ? "sem dados do mês anterior"
          : indicador.tendencia === "estavel"
          ? "estável"
          : `${indicador.tendencia === "subiu" ? "aumentou" : "reduziu"} ${Math.abs(indicador.percentual)}%`}
      </span>
    </div>
  );
};

const SacExecutiveSummary = ({ resumo, score, tendencias }: SacExecutiveSummaryProps) => {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <ScoreGauge score={score.score} nivel={score.nivel} />

          <div className="flex-1 space-y-4 min-w-0">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Resumo executivo</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{resumo}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 pt-2 border-t border-border/60">
              <TrendBadge label="Novas ocorrências" indicador={tendencias.novasOcorrencias} invertido />
              <TrendBadge label="Ocorrências críticas" indicador={tendencias.criticasAbertas} invertido />
              <TrendBadge label="Tempo médio de resolução" indicador={tendencias.tempoMedioResolucao} invertido />
              <TrendBadge label="Cumprimento de SLA" indicador={tendencias.slaPercentual} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SacExecutiveSummary;
