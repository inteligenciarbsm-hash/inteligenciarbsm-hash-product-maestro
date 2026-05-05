import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Calendar, FileSpreadsheet, MessageSquareQuote, RefreshCw, Star, TrendingUp, Award, AlertTriangle, Info,
} from "lucide-react";
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip,
  Legend,
} from "recharts";
import AppHeader from "@/components/AppHeader";
import { isSheetsConfigured, useSheetsList, useSheetData, type SheetRow, type SheetCell } from "@/hooks/useSheets";
import {
  detectColumnKind, isDateColumn, numericStats, categoricalStats, textStats,
  findSubSurveyColumn, numericAvgByGroup, type ColumnKind,
} from "@/lib/sheetAnalysis";

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
  const [activeSubs, setActiveSubs] = useState<string[]>([]);

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
    setActiveSubs([]);
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

  // Linhas filtradas pelos botões selecionados (vazio = todas)
  const filteredRows = useMemo(() => {
    if (!sheetData) return [];
    if (!subColumn || activeSubs.length === 0) return sheetData.rows;
    const set = new Set(activeSubs);
    return sheetData.rows.filter((r) => set.has(String(r[subColumn] ?? "").trim()));
  }, [sheetData, subColumn, activeSubs]);

  // Linhas por sub (pra modo comparação)
  const rowsBySub = useMemo(() => {
    if (!sheetData || !subColumn || activeSubs.length < 2) return null;
    const map: Record<string, SheetRow[]> = {};
    activeSubs.forEach((s) => (map[s] = []));
    sheetData.rows.forEach((r) => {
      const k = String(r[subColumn] ?? "").trim();
      if (k in map) map[k].push(r);
    });
    return map;
  }, [sheetData, subColumn, activeSubs]);

  // Análise de cada coluna (skip date e sub-survey column)
  // Apenas colunas numéricas e categóricas viram cards (texto vai pra tabela de comentários)
  const columnAnalysis = useMemo(() => {
    if (!sheetData) return [];
    return sheetData.headers
      .filter((h) => h !== dateCol && h !== subColumn)
      .map((header) => {
        const values = filteredRows.map((r) => r[header]);
        const kind = detectColumnKind(header, values);
        return { header, kind, values };
      })
      .filter((c) => c.kind === "number" || c.kind === "categorical");
  }, [sheetData, filteredRows, dateCol, subColumn]);

  // Colunas de texto livre (perguntas dissertativas) — viram tabela de comentários
  const textColumns = useMemo(() => {
    if (!sheetData) return [];
    return sheetData.headers.filter((h) => {
      if (h === dateCol || h === subColumn) return false;
      const values = sheetData.rows.map((r) => r[h]);
      return detectColumnKind(h, values) === "text";
    });
  }, [sheetData, dateCol, subColumn]);

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
    const allStats = numericCols.map((c) => numericStats(c.values));
    const totalCount = allStats.reduce((s, x) => s + x.count, 0);
    if (totalCount === 0) return null;
    return allStats.reduce((s, x) => s + x.avg * x.count, 0) / totalCount;
  }, [columnAnalysis]);

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
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold">Pesquisas</h2>
            <p className="text-sm text-muted-foreground">
              Análise sensorial e indicadores das respostas dos formulários. Atualiza sozinho a cada minuto.
            </p>
          </div>
          <button
            onClick={() => { refetchSheets(); refetchData(); }}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            disabled={fetchingList || fetchingData}
          >
            <RefreshCw className={`h-4 w-4 ${(fetchingList || fetchingData) ? "animate-spin" : ""}`} />
            Atualizar agora
          </button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
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
              <>
                <div className="space-y-1.5 max-w-md">
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
                    <Label>
                      Produtos / pesquisas
                      <span className="font-normal text-muted-foreground ml-2">
                        — selecione 1 pra ver detalhe, 2+ pra comparar
                      </span>
                    </Label>
                    <ToggleGroup
                      type="multiple"
                      value={activeSubs}
                      onValueChange={setActiveSubs}
                      className="flex flex-wrap justify-start gap-1"
                    >
                      {subValues.map((v) => (
                        <ToggleGroupItem
                          key={v}
                          value={v}
                          className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                        >
                          {v}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                    {activeSubs.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Nenhum filtro ativo — mostrando <strong>todas</strong> as respostas.
                      </p>
                    )}
                  </div>
                )}
              </>
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
            {/* KPIs principais (3 cards) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Respostas no filtro" value={String(totalResponses)} />
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
            </div>

            {/* Comparativo entre produtos */}
            {rowsBySub && (
              <ComparisonSection
                rowsBySub={rowsBySub}
                headers={(sheetData?.headers ?? []).filter((h) => h !== dateCol && h !== subColumn)}
              />
            )}

            {/* Cards inteligentes por coluna */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

            {/* Tabela de comentários */}
            {textColumns.length > 0 && commentRows.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MessageSquareQuote className="h-4 w-4 text-primary" />
                    Comentários ({commentRows.length})
                  </CardTitle>
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
                        {commentRows.map((row, i) => (
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
            )}
          </>
        )}
      </main>
    </div>
  );
};

// ============ Componentes auxiliares ============

const KpiCard = ({
  icon, label, value, small, accent,
}: { icon: React.ReactNode; label: string; value: string; small?: boolean; accent?: boolean }) => (
  <Card className={accent ? "border-primary/40 bg-primary/5" : undefined}>
    <CardContent className="pt-6">
      <div className={`flex items-center gap-2 text-xs mb-1.5 ${accent ? "text-primary" : "text-muted-foreground"}`}>
        {icon}
        <span className="uppercase tracking-wide">{label}</span>
      </div>
      <div className={small ? "text-lg font-semibold" : `text-3xl font-bold ${accent ? "text-primary" : ""}`}>
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
    const stats = numericStats(values);
    if (stats.count === 0) return null;
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground line-clamp-2" title={header}>
            {header}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-primary">{stats.avg.toFixed(2)}</span>
            <RatingStars avg={stats.avg} max={stats.max} />
            <span className="text-xs text-muted-foreground ml-auto">{stats.count} resp.</span>
          </div>
          <StackedRatingBar histogram={stats.histogram} total={stats.count} />
        </CardContent>
      </Card>
    );
  }

  if (kind === "categorical") {
    const stats = categoricalStats(values);
    if (stats.count === 0) return null;
    return (
      <Card>
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
      <Card>
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

/** Comparação entre 2+ produtos: radar + médias por produto + destaques */
const ComparisonSection = ({
  rowsBySub, headers,
}: { rowsBySub: Record<string, SheetRow[]>; headers: string[] }) => {
  const subs = Object.keys(rowsBySub);

  // Encontra colunas numéricas que tenham dados em pelo menos 2 produtos
  const numericCols = useMemo(() => {
    return headers.filter((h) => {
      let hits = 0;
      for (const sub of subs) {
        const values = rowsBySub[sub].map((r) => r[h]);
        const stats = numericStats(values);
        if (stats.count > 0) hits++;
        if (hits >= 2) return true;
      }
      return false;
    });
  }, [headers, rowsBySub, subs]);

  // Dados pro radar: cada ponto = uma pergunta numérica, cada dimensão = um produto
  const radarData = useMemo(() => {
    return numericCols.map((col) => {
      const point: Record<string, string | number> = { question: truncate(col, 28) };
      subs.forEach((sub) => {
        const values = rowsBySub[sub].map((r) => r[col]);
        const stats = numericStats(values);
        point[sub] = stats.count > 0 ? Number(stats.avg.toFixed(2)) : 0;
      });
      return point;
    });
  }, [numericCols, rowsBySub, subs]);

  // Médias gerais por produto
  const subStats = useMemo(() => {
    return subs.map((sub) => {
      const stats = numericCols.map((col) => numericStats(rowsBySub[sub].map((r) => r[col])));
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
        const stats = numericStats(rowsBySub[sub].map((r) => r[col]));
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

  // Determina o domínio do radar (1..max das notas)
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

export default Pesquisas;
