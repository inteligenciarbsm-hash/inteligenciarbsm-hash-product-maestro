import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Calendar, FileSpreadsheet, MessageSquareQuote, RefreshCw, Star, TrendingUp,
  ShoppingCart, AlertTriangle, Search, X,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { isSheetsConfigured, useSheetsList, useSheetData, type SheetRow, type SheetCell } from "@/hooks/useSheets";
import {
  detectColumnKind, isDateColumn, numericStats, categoricalStats, textStats,
  findSubSurveyColumn, type ColumnKind,
} from "@/lib/sheetAnalysis";

const ALL_PRODUCTS = "__all__";

// Paleta semântica pra notas 1..N (vermelho → verde).
// Para qualquer escala, mapeamos o índice no array proporcionalmente.
const RATING_COLORS = [
  "hsl(0, 75%, 55%)",   // 1 — vermelho
  "hsl(20, 85%, 55%)",  // 2 — laranja
  "hsl(45, 90%, 55%)",  // 3 — amarelo
  "hsl(85, 60%, 50%)",  // 4 — verde-limão
  "hsl(140, 60%, 45%)", // 5 — verde
];

// Cores estáveis pra produtos comparados no radar
const COMPARE_COLORS = [
  "hsl(218, 70%, 45%)",  // navy (primary)
  "hsl(15, 75%, 55%)",   // coral
  "hsl(165, 55%, 40%)",  // teal
  "hsl(280, 55%, 55%)",  // purple
  "hsl(35, 85%, 55%)",   // amber
];

const fmtDateTime = (v: unknown) => {
  if (v == null || v === "") return "—";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

const truncate = (s: string, n = 30) => (s.length > n ? s.slice(0, n) + "…" : s);

const Pesquisas = () => {
  const configured = isSheetsConfigured();
  const {
    data: sheets, isLoading: loadingSheets, error: sheetsError,
    refetch: refetchSheets, isFetching: fetchingList,
  } = useSheetsList();
  const [selected, setSelected] = useState<string | null>(null);
  const [subColumn, setSubColumn] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string>(ALL_PRODUCTS);

  const {
    data: sheetData, isLoading: loadingData, error: dataError,
    refetch: refetchData, isFetching: fetchingData,
  } = useSheetData(selected);

  // Auto-seleciona primeiro form com respostas
  useEffect(() => {
    if (!selected && sheets && sheets.length > 0) {
      const first = sheets.find((s) => s.rows > 0) ?? sheets[0];
      setSelected(first.name);
    }
  }, [sheets, selected]);

  // Detecta coluna de data (pra "última resposta") e sub-pesquisa
  const dateCol = useMemo(() => {
    if (!sheetData) return null;
    return sheetData.headers.find(isDateColumn) ?? null;
  }, [sheetData]);

  useEffect(() => {
    if (!sheetData) return;
    setSubColumn(findSubSurveyColumn(sheetData.headers, sheetData.rows));
    setSelectedProduct(ALL_PRODUCTS);
  }, [sheetData]);

  // Lista de valores possíveis da sub-pesquisa
  const subValues = useMemo(() => {
    if (!sheetData || !subColumn) return [];
    const set = new Set<string>();
    sheetData.rows.forEach((r) => {
      const v = r[subColumn];
      if (v != null && v !== "") set.add(String(v).trim());
    });
    return Array.from(set).sort();
  }, [sheetData, subColumn]);

  // Linhas filtradas pelo produto selecionado (ALL_PRODUCTS = todas)
  const filteredRows = useMemo(() => {
    if (!sheetData) return [];
    if (!subColumn || selectedProduct === ALL_PRODUCTS) return sheetData.rows;
    return sheetData.rows.filter(
      (r) => String(r[subColumn] ?? "").trim() === selectedProduct
    );
  }, [sheetData, subColumn, selectedProduct]);

  // Headers únicos (planilha pode ter colunas duplicadas se o admin do form
  // adicionou a mesma pergunta duas vezes sem querer).
  const uniqueHeaders = useMemo(() => {
    if (!sheetData) return [];
    return Array.from(new Set(sheetData.headers));
  }, [sheetData]);

  // Análise de cada coluna (skip date e sub-survey column)
  // Apenas colunas numéricas e categóricas viram cards (texto vai pra tabela de comentários)
  const columnAnalysis = useMemo(() => {
    if (!sheetData) return [];
    return uniqueHeaders
      .filter((h) => h !== dateCol && h !== subColumn)
      .map((header) => {
        const values = filteredRows.map((r) => r[header]);
        const kind = detectColumnKind(header, values);
        return { header, kind, values };
      })
      .filter((c) => c.kind === "number" || c.kind === "categorical");
  }, [sheetData, uniqueHeaders, filteredRows, dateCol, subColumn]);

  // Colunas de texto livre (perguntas dissertativas) — viram tabela de comentários.
  // Detecta o tipo olhando o dataset inteiro (kind correto), mas só mostra
  // colunas que tenham ALGUM valor não-vazio dentro do filtro atual
  // (evita colunas com prefixo "456-" aparecerem todas como "—" quando filtrado em PAÇOCA 1).
  const textColumns = useMemo(() => {
    if (!sheetData) return [];
    const allTextCols = uniqueHeaders.filter((h) => {
      if (h === dateCol || h === subColumn) return false;
      const values = sheetData.rows.map((r) => r[h]);
      return detectColumnKind(h, values) === "text";
    });
    return allTextCols.filter((c) =>
      filteredRows.some((r) => {
        const v = r[c];
        return v != null && String(v).trim() !== "";
      })
    );
  }, [sheetData, uniqueHeaders, filteredRows, dateCol, subColumn]);

  // Linhas que têm pelo menos 1 comentário não vazio, ordenadas por data desc
  const commentRows = useMemo(() => {
    if (textColumns.length === 0) return [];
    const rows = filteredRows.filter((r) =>
      textColumns.some((c) => {
        const v = r[c];
        return v != null && String(v).trim() !== "";
      })
    );
    if (dateCol) {
      rows.sort((a, b) => {
        const ta = new Date(String(a[dateCol])).getTime();
        const tb = new Date(String(b[dateCol])).getTime();
        return tb - ta;
      });
    }
    return rows;
  }, [filteredRows, textColumns, dateCol]);

  // KPIs
  const totalResponses = filteredRows.length;
  const lastResponseDate = useMemo(() => {
    if (!dateCol) return null;
    let max: Date | null = null;
    filteredRows.forEach((r) => {
      const t = new Date(String(r[dateCol])).getTime();
      if (isNaN(t)) return;
      if (!max || t > max.getTime()) max = new Date(t);
    });
    return max;
  }, [filteredRows, dateCol]);

  const heroAvg = useMemo(() => {
    const numericCols = columnAnalysis.filter((c) => c.kind === "number");
    if (numericCols.length === 0) return null;
    const allStats = numericCols.map((c) => numericStats(c.values, c.header));
    const totalCount = allStats.reduce((s, x) => s + x.count, 0);
    if (totalCount === 0) return null;
    return allStats.reduce((s, x) => s + x.avg * x.count, 0) / totalCount;
  }, [columnAnalysis]);

  // KPI Intenção de compra: detecta colunas numéricas com nome relacionado
  // a compra/recomendação. Em pesquisa sensorial é métrica-chave pra decidir
  // lançamento. Combina valores de todas as colunas-sinônimo (ex: "710 -
  // probabilidade de comprar" e "456 - probabilidade de comprar") usando
  // collectValuesAcrossColumns pra agregar com a mesma técnica do radar.
  const purchaseIntent = useMemo(() => {
    const purchaseCols = columnAnalysis.filter(
      (c) => c.kind === "number" && /comprar|compraria|recomenda|probabilidade/i.test(c.header)
    );
    if (purchaseCols.length === 0) return null;
    const allValues = purchaseCols.flatMap((c) => c.values);
    const stats = numericStats(allValues, purchaseCols[0].header);
    if (stats.count === 0) return null;
    // Pega o teto DA ESCALA (do histograma, que cobre a escala inteira),
    // não o maior valor observado. Evita mostrar "3.00 / 3" quando a escala é 1-5.
    const scaleMax = stats.histogram.length > 0
      ? stats.histogram[stats.histogram.length - 1].value
      : stats.max;
    return { avg: stats.avg, count: stats.count, max: scaleMax };
  }, [columnAnalysis]);

  // Busca dentro dos comentários
  const [commentSearch, setCommentSearch] = useState("");

  if (!configured) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container py-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                Pesquisas — configuração pendente
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Adicione a variável <code className="text-foreground"> VITE_SHEETS_API_URL </code> com a URL pública do
              Apps Script (terminada em <code>/exec</code>).
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container py-8 space-y-6">
        <div className="flex items-end justify-between gap-4 flex-wrap reveal">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
              Painel
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight">Análise de produto</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Indicadores das respostas dos formulários — atualiza sozinho a cada minuto.
            </p>
          </div>
          <button
            onClick={() => { refetchSheets(); refetchData(); }}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-lg border border-border/70 px-3 py-1.5 transition-colors hover:bg-muted/60"
            disabled={fetchingList || fetchingData}
          >
            <RefreshCw className={`h-4 w-4 ${(fetchingList || fetchingData) ? "animate-spin" : ""}`} />
            Atualizar agora
          </button>
        </div>

        <Card className="reveal reveal-delay-1 shadow-layered border-border/70">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingSheets ? (
              <div className="text-sm text-muted-foreground">Carregando lista...</div>
            ) : sheetsError ? (
              <div className="text-sm text-destructive">
                Erro: {sheetsError instanceof Error ? sheetsError.message : "desconhecido"}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Formulário</Label>
                  <Select value={selected ?? ""} onValueChange={setSelected}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha um formulário" />
                    </SelectTrigger>
                    <SelectContent>
                      {(sheets ?? []).map((s) => (
                        <SelectItem key={s.name} value={s.name}>
                          {s.formTitle || s.name}
                          <span className="text-muted-foreground ml-2">({s.rows})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {subColumn && subValues.length > 1 && (
                  <div className="space-y-1.5">
                    <Label>Produto</Label>
                    <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_PRODUCTS}>Todos (cada um isolado)</SelectItem>
                        {subValues.map((v) => (
                          <SelectItem key={v} value={v}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Pra comparar produtos lado a lado, vai na aba <strong>Comparativo</strong>.
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {!selected ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Selecione um formulário acima.</CardContent></Card>
        ) : loadingData ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Carregando respostas...</CardContent></Card>
        ) : dataError ? (
          <Card><CardContent className="py-12 text-center text-destructive">
            Erro: {dataError instanceof Error ? dataError.message : "desconhecido"}
          </CardContent></Card>
        ) : !sheetData || sheetData.rows.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma resposta neste formulário.</CardContent></Card>
        ) : (
          <>
            {/* KPIs principais */}
            <div className={`grid grid-cols-1 ${purchaseIntent ? "md:grid-cols-4" : "md:grid-cols-3"} gap-4 reveal reveal-delay-2`}>
              <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Avaliações" value={String(totalResponses)} />
              <KpiCard
                icon={<Calendar className="h-4 w-4" />}
                label="Última resposta"
                value={lastResponseDate ? fmtDateTime(lastResponseDate.toISOString()) : "—"}
                small
              />
              <KpiCard
                icon={<Star className="h-4 w-4" />}
                label="Nota média geral"
                value={heroAvg != null ? heroAvg.toFixed(2) : "—"}
                accent
              />
              {purchaseIntent && (
                <KpiCard
                  icon={<ShoppingCart className="h-4 w-4" />}
                  label="Intenção de compra"
                  value={`${purchaseIntent.avg.toFixed(2)} / ${purchaseIntent.max}`}
                  accent
                />
              )}
            </div>

            {/* Modo isolado: "Todos" selecionado + 2+ produtos disponíveis → uma seção por produto */}
            {subColumn && selectedProduct === ALL_PRODUCTS && subValues.length >= 2 ? (
              <div className="space-y-6 reveal reveal-delay-3">
                {subValues.map((sub) => {
                  const subRows = sheetData.rows.filter(
                    (r) => String(r[subColumn] ?? "").trim() === sub
                  );
                  const cols = uniqueHeaders
                    .filter((h) => h !== dateCol && h !== subColumn)
                    .map((header) => {
                      const values = subRows.map((r) => r[header]);
                      return { header, kind: detectColumnKind(header, values), values };
                    })
                    .filter((c) => c.kind === "number" || c.kind === "categorical");
                  return (
                    <ProductSection
                      key={sub}
                      name={sub}
                      responses={subRows.length}
                      columns={cols}
                    />
                  );
                })}
              </div>
            ) : (
              /* Modo normal: cards inteligentes da seleção atual */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 reveal reveal-delay-3">
                {columnAnalysis.map((col) => (
                  <SmartColumnCard
                    key={col.header}
                    header={col.header}
                    kind={col.kind}
                    values={col.values}
                    rows={filteredRows}
                    dateCol={dateCol}
                  />
                ))}
              </div>
            )}

            {/* Tabela de comentários (com busca) */}
            {textColumns.length > 0 && commentRows.length > 0 && (() => {
              const search = commentSearch.trim().toLowerCase();
              const visibleRows = search
                ? commentRows.filter((r) =>
                    textColumns.some((c) => String(r[c] ?? "").toLowerCase().includes(search))
                  )
                : commentRows;
              return (
              <Card>
                <CardHeader className="space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MessageSquareQuote className="h-4 w-4 text-primary" />
                      Comentários ({visibleRows.length}{search && commentRows.length !== visibleRows.length ? ` de ${commentRows.length}` : ""})
                    </CardTitle>
                    <div className="relative w-full sm:w-64">
                      <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Buscar nos comentários..."
                        value={commentSearch}
                        onChange={(e) => setCommentSearch(e.target.value)}
                        className="pl-8 pr-8 h-9"
                      />
                      {commentSearch && (
                        <button
                          type="button"
                          onClick={() => setCommentSearch("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label="Limpar busca"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {dateCol && <TableHead className="whitespace-nowrap w-[140px]">Data</TableHead>}
                          {subColumn && <TableHead className="whitespace-nowrap w-[160px]">{subColumn}</TableHead>}
                          {textColumns.map((c) => (
                            <TableHead key={c} className="whitespace-nowrap">{c}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleRows.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={(dateCol ? 1 : 0) + (subColumn ? 1 : 0) + textColumns.length}
                              className="text-center text-sm text-muted-foreground py-6"
                            >
                              Nenhum comentário com "{commentSearch}".
                            </TableCell>
                          </TableRow>
                        ) : visibleRows.map((row, i) => (
                          <TableRow key={i}>
                            {dateCol && (
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                {fmtDateTime(row[dateCol])}
                              </TableCell>
                            )}
                            {subColumn && (
                              <TableCell className="text-xs">
                                {String(row[subColumn] ?? "—")}
                              </TableCell>
                            )}
                            {textColumns.map((c) => {
                              const v = row[c];
                              const text = v == null || String(v).trim() === "" ? "—" : String(v);
                              return (
                                <TableCell key={c} className="text-sm max-w-md whitespace-pre-wrap align-top">
                                  {text}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
              );
            })()}
          </>
        )}
      </main>
    </div>
  );
};

// ============ Componentes auxiliares ============

/** Bloco isolado de um produto, com média geral + grid de cards */
const ProductSection = ({
  name, responses, columns,
}: {
  name: string;
  responses: number;
  columns: { header: string; kind: ColumnKind; values: SheetCell[] }[];
}) => {
  const numericCols = columns.filter((c) => c.kind === "number");
  const allStats = numericCols.map((c) => numericStats(c.values, c.header));
  const totalCount = allStats.reduce((s, x) => s + x.count, 0);
  const overallAvg =
    totalCount > 0
      ? allStats.reduce((s, x) => s + x.avg * x.count, 0) / totalCount
      : null;

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-lg">{name}</CardTitle>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {responses} resposta{responses !== 1 ? "s" : ""}
            </span>
            {overallAvg != null && (
              <span className="flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="font-semibold">{overallAvg.toFixed(2)}</span>
                <span className="text-muted-foreground text-xs">média</span>
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {columns.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">
            Sem perguntas com opções pra exibir.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {columns.map((col) => (
              <SmartColumnCard
                key={col.header}
                header={col.header}
                kind={col.kind}
                values={col.values}
                rows={[]}
                dateCol={null}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const KpiCard = ({
  icon, label, value, small, accent,
}: { icon: React.ReactNode; label: string; value: string; small?: boolean; accent?: boolean }) => (
  <Card
    className={
      accent
        ? "relative overflow-hidden border-primary/30 bg-primary/[0.04] shadow-layered"
        : "shadow-layered border-border/70"
    }
  >
    {accent && (
      <div className="absolute inset-x-0 top-0 h-0.5 bg-primary/70" aria-hidden="true" />
    )}
    <CardContent className="pt-6">
      <div className={`flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] mb-2 ${accent ? "text-primary" : "text-muted-foreground"}`}>
        {icon}
        <span>{label}</span>
      </div>
      <div
        className={
          small
            ? "font-display text-lg font-semibold tracking-tight"
            : `font-display text-[2.5rem] leading-none font-bold tracking-tight tabular-nums ${accent ? "text-primary" : "text-foreground"}`
        }
      >
        {value}
      </div>
    </CardContent>
  </Card>
);

/** Renderiza estrelas pra notas 1..5. Para outras escalas, retorna null. */
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

/** Barra empilhada 100% colorida segundo a distribuição (vermelho → verde). */
const StackedRatingBar = ({
  histogram, total,
}: { histogram: { value: number; count: number }[]; total: number }) => {
  if (total === 0 || histogram.length === 0) return null;
  const minV = histogram[0]?.value;
  const maxV = histogram[histogram.length - 1]?.value;
  return (
    <div className="space-y-1.5">
      <div className="flex h-3 rounded-full overflow-hidden border border-border/40">
        {histogram.map((bin, i) => {
          const pct = (bin.count / total) * 100;
          if (pct === 0) return null;
          const colorIdx = Math.round((i / Math.max(1, histogram.length - 1)) * (RATING_COLORS.length - 1));
          return (
            <div
              key={bin.value}
              style={{ width: `${pct}%`, backgroundColor: RATING_COLORS[colorIdx] }}
              title={`Nota ${bin.value}: ${bin.count} resposta(s) (${pct.toFixed(0)}%)`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        {histogram.map((bin) => (
          <div key={bin.value} className="flex-1 text-center">
            <div className="font-medium text-foreground">{bin.value}</div>
            <div>{bin.count}</div>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground/80 italic">
        <span>← {minV} pior</span>
        <span>melhor {maxV} →</span>
      </div>
    </div>
  );
};

const SmartColumnCard = ({
  header, kind, values, rows, dateCol,
}: {
  header: string;
  kind: ColumnKind;
  values: SheetCell[];
  rows: SheetRow[];
  dateCol: string | null;
}) => {
  if (kind === "number") {
    const stats = numericStats(values, header);
    if (stats.count === 0) return null;
    const lowSample = stats.count < 3;
    return (
      <Card className={`shadow-layered transition-shadow hover:shadow-lg ${lowSample ? "border-amber-300/60" : "border-border/70"}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground line-clamp-2" title={header}>
            {header}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[2rem] leading-none font-bold tracking-tight tabular-nums text-primary">{stats.avg.toFixed(2)}</span>
            <RatingStars avg={stats.avg} max={stats.max} />
            <span className="text-xs text-muted-foreground ml-auto">{stats.count} resp.</span>
          </div>
          <StackedRatingBar histogram={stats.histogram} total={stats.count} />
          {lowSample && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 rounded px-2 py-1">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span>Amostra pequena — interprete com cautela</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (kind === "categorical") {
    const stats = categoricalStats(values);
    if (stats.count === 0) return null;
    // Esconde cards redundantes: se só tem 1 valor único, não há informação útil pra mostrar
    // (caso típico: coluna que duplica o filtro de produto já aplicado).
    if (stats.items.length <= 1) return null;
    return (
      <Card className="shadow-layered border-border/70 transition-shadow hover:shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground line-clamp-2" title={header}>
            {header}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground mb-2">{stats.count} respostas</div>
          <div className="space-y-2">
            {stats.items.slice(0, 6).map((item, i) => {
              const colorIdx = Math.round((i / Math.max(1, Math.min(5, stats.items.length - 1))) * (RATING_COLORS.length - 1));
              return (
                <div key={item.value} className="space-y-1">
                  <div className="flex justify-between text-xs gap-2">
                    <span className="truncate" title={item.value}>{item.value}</span>
                    <span className="text-muted-foreground whitespace-nowrap font-medium">
                      {item.count} <span className="opacity-70">({item.pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${item.pct}%`, backgroundColor: RATING_COLORS[colorIdx] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (kind === "text") {
    const stats = textStats(rows, header, dateCol, 4);
    if (stats.count === 0) return null;
    return (
      <Card className="shadow-layered border-border/70 transition-shadow hover:shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-start gap-2">
            <MessageSquareQuote className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <CardTitle className="text-sm font-medium text-muted-foreground line-clamp-2" title={header}>
              {header}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground mb-2">
            {stats.count} comentário{stats.count > 1 ? "s" : ""}
          </div>
          <ul className="space-y-2">
            {stats.recent.map((r, i) => (
              <li key={i} className="text-xs border-l-2 border-primary/40 pl-2">
                <p className="text-foreground line-clamp-3">"{r.text}"</p>
                {r.date && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDateTime(r.date.toISOString())}</p>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    );
  }

  return null;
};

export default Pesquisas;
