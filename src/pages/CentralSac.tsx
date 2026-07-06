import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  List,
  PieChart,
  Target,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import SacAlertsPanel from "@/components/SacAlertsPanel";
import SacDistributionChart from "@/components/SacDistributionChart";
import SacExecutiveSummary from "@/components/SacExecutiveSummary";
import SacFiltersPanel from "@/components/SacFiltersPanel";
import SacKpiCards from "@/components/SacKpiCards";
import SacOccurrencesTable from "@/components/SacOccurrencesTable";
import SacPriorityPanel from "@/components/SacPriorityPanel";
import SacRankingChart from "@/components/SacRankingChart";
import SacSyncStatus from "@/components/SacSyncStatus";
import SacTrendChart from "@/components/SacTrendChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSacOcorrencias } from "@/hooks/useOcorrencias";
import {
  agruparPorCriticidade,
  agruparPorFornecedor,
  agruparPorMes,
  agruparPorProduto,
  agruparPorTipo,
  calcularKpis,
  calcularScoreSaude,
  calcularTendencias,
  filtrarOcorrencias,
  gerarAlertas,
  gerarPrioridades,
  gerarResumoExecutivo,
  type SacFiltrosTabela,
} from "@/lib/sacAnalysis";

// Cores semânticas de criticidade — mesma lógica de RATING_COLORS (Pesquisas.tsx):
// vermelho para o nível mais grave, verde para o mais brando.
const CRITICIDADE_COLORS: Record<string, string> = {
  alta: "hsl(0, 75%, 55%)",
  média: "hsl(45, 90%, 55%)",
  media: "hsl(45, 90%, 55%)",
  baixa: "hsl(140, 60%, 45%)",
};

// ─── Skeletons de carregamento ────────────────────────────────────────────────

const KpisSkeleton = () => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {Array.from({ length: 8 }).map((_, i) => (
      <Card key={i}>
        <CardContent className="pt-6">
          <Skeleton className="h-3.5 w-20 mb-3" />
          <Skeleton className="h-7 w-12" />
        </CardContent>
      </Card>
    ))}
  </div>
);

const ChartsSkeleton = () => (
  <div className="space-y-4">
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-40" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-48 w-full" />
      </CardContent>
    </Card>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);

const ListSkeleton = ({ rows = 4 }: { rows?: number }) => (
  <Card>
    <CardHeader>
      <Skeleton className="h-4 w-32" />
    </CardHeader>
    <CardContent className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </CardContent>
  </Card>
);

const CentralSac = () => {
  const { data: ocorrencias, isLoading, error } = useSacOcorrencias();
  const isEmpty = !isLoading && !error && (ocorrencias?.length ?? 0) === 0;

  const [filtros, setFiltros] = useState<SacFiltrosTabela>({});

  const opcoesFiltro = useMemo(() => {
    const unicos = (campo: "produto" | "fornecedor" | "criticidade" | "tipo_ocorrencia") => {
      const set = new Set<string>();
      (ocorrencias ?? []).forEach((o) => {
        const valor = o[campo];
        if (valor) set.add(valor);
      });
      return Array.from(set).sort();
    };
    return {
      produtos: unicos("produto"),
      fornecedores: unicos("fornecedor"),
      criticidades: unicos("criticidade"),
      tipos: unicos("tipo_ocorrencia"),
    };
  }, [ocorrencias]);

  // Todas as seções da página (resumo, KPIs, score, alertas, prioridades,
  // gráficos e tabela) derivam de ocorrenciasFiltradas — os filtros do topo
  // controlam a página inteira, não só a tabela.
  const ocorrenciasFiltradas = useMemo(
    () => filtrarOcorrencias(ocorrencias ?? [], filtros),
    [ocorrencias, filtros]
  );

  const kpis = useMemo(() => calcularKpis(ocorrenciasFiltradas), [ocorrenciasFiltradas]);
  const alertas = useMemo(() => gerarAlertas(ocorrenciasFiltradas), [ocorrenciasFiltradas]);
  const score = useMemo(() => calcularScoreSaude(kpis), [kpis]);
  const tendencias = useMemo(() => calcularTendencias(ocorrenciasFiltradas), [ocorrenciasFiltradas]);
  const resumo = useMemo(
    () => gerarResumoExecutivo(kpis, score, tendencias),
    [kpis, score, tendencias]
  );
  const prioridades = useMemo(
    () => gerarPrioridades(ocorrenciasFiltradas, kpis),
    [ocorrenciasFiltradas, kpis]
  );
  const evolucaoMensal = useMemo(() => agruparPorMes(ocorrenciasFiltradas), [ocorrenciasFiltradas]);
  const rankingFornecedores = useMemo(() => agruparPorFornecedor(ocorrenciasFiltradas), [ocorrenciasFiltradas]);
  const rankingProdutos = useMemo(() => agruparPorProduto(ocorrenciasFiltradas), [ocorrenciasFiltradas]);
  const distribuicaoCriticidade = useMemo(() => agruparPorCriticidade(ocorrenciasFiltradas), [ocorrenciasFiltradas]);
  const distribuicaoTipo = useMemo(() => agruparPorTipo(ocorrenciasFiltradas), [ocorrenciasFiltradas]);

  return (
    <div className="min-h-screen bg-background md:pl-64">
      <AppHeader />

      <main className="container py-8 space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              Central SAC
            </h2>
            <p className="text-sm text-muted-foreground">
              Painel executivo para acompanhamento das ocorrências de SAC sincronizadas
              automaticamente a partir do SharePoint.
            </p>
          </div>
          <SacSyncStatus />
        </div>

        {error && (
          <Card className="border-destructive/40">
            <CardContent className="py-6 text-sm text-destructive">
              Erro ao carregar ocorrências: {error instanceof Error ? error.message : "desconhecido"}
            </CardContent>
          </Card>
        )}

        {isEmpty && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Activity className="h-9 w-9 text-muted-foreground/30" />
              <p className="text-sm font-medium text-foreground">Nenhuma ocorrência sincronizada ainda</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Assim que a sincronização com o SharePoint for executada, as ocorrências aparecerão aqui.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Filtros — controlam toda a página (resumo, KPIs, alertas, gráficos e tabela) */}
        <SacFiltersPanel
          filtros={filtros}
          opcoes={opcoesFiltro}
          onChange={(patch) => setFiltros((atual) => ({ ...atual, ...patch }))}
          onLimpar={() => setFiltros({})}
        />

        {/* 1. Resumo executivo */}
        {isLoading ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-6">
                <Skeleton className="h-28 w-28 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          !error && <SacExecutiveSummary resumo={resumo} score={score} tendencias={tendencias} />
        )}

        {/* 2. KPIs */}
        {isLoading ? <KpisSkeleton /> : !error && <SacKpiCards kpis={kpis} />}

        {/* 3. O que precisa da sua atenção */}
        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : !error ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                O que precisa da sua atenção
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SacPriorityPanel prioridades={prioridades} />
            </CardContent>
          </Card>
        ) : null}

        {/* 4. Alertas e pendências */}
        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : !error ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                Alertas e pendências
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SacAlertsPanel alertas={alertas} />
            </CardContent>
          </Card>
        ) : null}

        {/* 5. Gráficos — apenas placeholders nesta etapa */}
        {isLoading ? (
          <ChartsSkeleton />
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  Evolução mensal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SacTrendChart data={evolucaoMensal} />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    Por fornecedor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <SacRankingChart
                    data={rankingFornecedores}
                    color="hsl(218, 70%, 45%)"
                    emptyLabel="Nenhuma ocorrência com fornecedor identificado."
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    Por produto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <SacRankingChart
                    data={rankingProdutos}
                    color="hsl(165, 55%, 40%)"
                    emptyLabel="Nenhuma ocorrência com produto identificado."
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <PieChart className="h-4 w-4 text-muted-foreground" />
                    Criticidade
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <SacDistributionChart
                    data={distribuicaoCriticidade}
                    semanticColors={CRITICIDADE_COLORS}
                    emptyLabel="Nenhuma ocorrência com criticidade informada."
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <PieChart className="h-4 w-4 text-muted-foreground" />
                    Tipo de ocorrência
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <SacDistributionChart
                    data={distribuicaoTipo}
                    emptyLabel="Nenhuma ocorrência com tipo informado."
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* 6. Tabela de ocorrências */}
        {isLoading ? (
          <ListSkeleton rows={5} />
        ) : !error ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <List className="h-4 w-4 text-muted-foreground" />
                Ocorrências
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SacOccurrencesTable ocorrencias={ocorrenciasFiltradas} />
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  );
};

export default CentralSac;
