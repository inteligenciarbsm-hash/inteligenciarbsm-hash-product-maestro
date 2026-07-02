import {
  AlertOctagon,
  CheckCircle2,
  Clock,
  Inbox,
  PackageSearch,
  ShieldAlert,
  Timer,
  Truck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { SacKpis } from "@/lib/sacAnalysis";

type SacKpiCardsProps = {
  kpis: SacKpis;
};

type KpiCardConfig = {
  icon: React.ElementType;
  message: string;
  tone: "neutral" | "warning" | "critical" | "positive";
};

const TONE_CLASS: Record<KpiCardConfig["tone"], string> = {
  neutral: "text-muted-foreground",
  warning: "text-amber-600",
  critical: "text-destructive",
  positive: "text-emerald-600",
};

const KpiCard = ({ icon: Icon, message, tone }: KpiCardConfig) => (
  <Card>
    <CardContent className="pt-6 flex items-start gap-3">
      <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${TONE_CLASS[tone]}`} />
      <p className="text-sm leading-snug text-foreground">{message}</p>
    </CardContent>
  </Card>
);

const SacKpiCards = ({ kpis }: SacKpiCardsProps) => {
  const totalResolvidas = kpis.dentroDoSla + kpis.foraDoSla;
  const percentualSla =
    totalResolvidas > 0 ? Math.round((kpis.dentroDoSla / totalResolvidas) * 100) : null;

  const cards: KpiCardConfig[] = [
    {
      icon: Inbox,
      message:
        kpis.total === 0
          ? "Nenhuma ocorrência registrada até o momento."
          : `${kpis.total} ${kpis.total === 1 ? "ocorrência registrada" : "ocorrências registradas"} no total.`,
      tone: "neutral",
    },
    {
      icon: Clock,
      message:
        kpis.abertas === 0
          ? "Nenhuma ocorrência aguardando resolução."
          : `${kpis.abertas} ${kpis.abertas === 1 ? "ocorrência aguarda" : "ocorrências aguardam"} resolução.`,
      tone: kpis.abertas > 0 ? "warning" : "positive",
    },
    {
      icon: AlertOctagon,
      message:
        kpis.criticas === 0
          ? "Nenhuma ocorrência crítica em aberto."
          : `${kpis.criticas} ${kpis.criticas === 1 ? "ocorrência crítica está" : "ocorrências críticas estão"} em aberto e precisam de atenção imediata.`,
      tone: kpis.criticas > 0 ? "critical" : "positive",
    },
    {
      icon: ShieldAlert,
      message:
        kpis.atrasadas === 0
          ? "Nenhuma ocorrência fora do prazo."
          : `${kpis.atrasadas} ${kpis.atrasadas === 1 ? "ocorrência está" : "ocorrências estão"} atrasadas em relação ao prazo de resolução.`,
      tone: kpis.atrasadas > 0 ? "critical" : "positive",
    },
    {
      icon: Timer,
      message:
        kpis.tempoMedioResolucao === null
          ? "Ainda não há ocorrências encerradas para calcular o tempo médio de resolução."
          : `As ocorrências levam em média ${kpis.tempoMedioResolucao} ${kpis.tempoMedioResolucao === 1 ? "dia" : "dias"} para serem resolvidas.`,
      tone: "neutral",
    },
    {
      icon: Truck,
      message:
        kpis.aguardandoFornecedor === 0
          ? "Nenhuma ocorrência aguardando comunicação ao fornecedor."
          : `${kpis.aguardandoFornecedor} ${kpis.aguardandoFornecedor === 1 ? "ocorrência aguarda" : "ocorrências aguardam"} comunicação ao fornecedor.`,
      tone: kpis.aguardandoFornecedor > 0 ? "warning" : "positive",
    },
    {
      icon: PackageSearch,
      message:
        kpis.aguardandoRessarcimento === 0
          ? "Nenhuma ocorrência aguardando ressarcimento."
          : `${kpis.aguardandoRessarcimento} ${kpis.aguardandoRessarcimento === 1 ? "ocorrência aguarda" : "ocorrências aguardam"} ressarcimento ao consumidor.`,
      tone: kpis.aguardandoRessarcimento > 0 ? "warning" : "positive",
    },
    {
      icon: CheckCircle2,
      message:
        percentualSla === null
          ? "Ainda não há ocorrências encerradas para calcular o cumprimento de prazo."
          : `${percentualSla}% das ocorrências foram resolvidas dentro do prazo.`,
      tone: percentualSla === null ? "neutral" : percentualSla >= 80 ? "positive" : "warning",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <KpiCard key={i} {...card} />
      ))}
    </div>
  );
};

export default SacKpiCards;
