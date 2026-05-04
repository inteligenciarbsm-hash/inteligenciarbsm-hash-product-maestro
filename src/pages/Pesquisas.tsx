import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Calendar, FileSpreadsheet, MessageSquareQuote, RefreshCw, Star, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar,
} from "recharts";
import AppHeader from "@/components/AppHeader";
import { isSheetsConfigured, useSheetsList, useSheetData, type SheetRow } from "@/hooks/useSheets";
import {
  detectColumnKind, isDateColumn, toDate, numericStats, categoricalStats, textStats,
  findSubSurveyColumn,
} from "@/lib/sheetAnalysis";

const ymd = (d: Date) => d.toISOString().slice(0, 10);

const fmtDateTime = (v: unknown) => {
  if (v == null || v === "") return "—";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const Pesquisas = () => {
  const configured = isSheetsConfigured();
  const { data: sheets, isLoading: loadingSheets, error: sheetsError, refetch: refetchSheets, isFetching: fetchingList } = useSheetsList();
  const [selected, setSelected] = useState<string | null>(null);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [subColumn, setSubColumn] = useState<string | null>(null);
  const [subValue, setSubValue] = useState<string>("__all__");

  const { data: sheetData, isLoading: loadingData, error: dataError, refetch: refetchData, isFetching: fetchingData } = useSheetData(selected);

  // Auto-seleciona primeiro form ao chegar
  useEffect(() => {
    if (!selected && sheets && sheets.length > 0) {
      const first = sheets.find((s) => s.rows > 0) ?? sheets[0];
      setSelected(first.name);
    }
  }, [sheets, selected]);

  // Detecta a coluna de data
  const dateCol = useMemo(() => {
    if (!sheetData) return null;
    return sheetData.headers.find(isDateColumn) ?? null;
  }, [sheetData]);

  // Detecta automaticamente a sub-pesquisa
  useEffect(() => {
    if (!sheetData) return;
    const auto = findSubSurveyColumn(sheetData.headers, sheetData.rows);
    setSubColumn(auto);
    setSubValue("__all__");
  }, [sheetData]);

  const subValues = useMemo(() => {
    if (!sheetData || !subColumn) return [];
    const set = new Set<string>();
    sheetData.rows.forEach((r) => {
      const v = r[subColumn];
      if (v != null && v !== "") set.add(String(v).trim());
    });
    return Array.from(set).sort();
  }, [sheetData, subColumn]);

  // Aplica filtros: data + sub
  const filteredRows = useMemo(() => {
    if (!sheetData) return [];
    let rows = sheetData.rows;

    if (dateCol) {
      const fromTs = from ? new Date(from).getTime() : null;
      const toTs = to ? new Date(to + "T23:59:59").getTime() : null;
      rows = rows.filter((r) => {
        const v = r[dateCol];
        if (v == null || v === "") return !fromTs && !toTs;
        const t = new Date(String(v)).getTime();
        if (isNaN(t)) return false;
        if (fromTs && t < fromTs) return false;
        if (toTs && t > toTs) return false;
        return true;
      });
    }

    if (subColumn && subValue !== "__all__") {
      rows = rows.filter((r) => String(r[subColumn] ?? "").trim() === subValue);
    }

    return rows;
  }, [sheetData, dateCol, from, to, subColumn, subValue]);

  // KPIs gerais
  const kpis = useMemo(() => {
    let last7 = 0;
    let lastDate: Date | null = null;
    if (dateCol) {
      const sevenAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      filteredRows.forEach((r) => {
        const t = new Date(String(r[dateCol])).getTime();
        if (isNaN(t)) return;
        if (t >= sevenAgo) last7++;
        if (!lastDate || t > lastDate.getTime()) lastDate = new Date(t);
      });
    }
    return { total: filteredRows.length, last7, lastDate };
  }, [filteredRows, dateCol]);

  // Série diária (últimos 30 dias)
  const dailySeries = useMemo(() => {
    if (!dateCol) return [];
    const counts: Record<string, number> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      counts[ymd(d)] = 0;
    }
    filteredRows.forEach((r) => {
      const t = new Date(String(r[dateCol])).getTime();
      if (isNaN(t)) return;
      const key = ymd(new Date(t));
      if (key in counts) counts[key]++;
    });
    return Object.entries(counts).map(([date, count]) => ({ date: date.slice(5), count }));
  }, [filteredRows, dateCol]);

  // Análise inteligente por coluna
  const columnAnalysis = useMemo(() => {
    if (!sheetData) return [];
    return sheetData.headers
      .filter((h) => h !== dateCol && h !== subColumn)
      .map((header) => {
        const values = filteredRows.map((r) => r[header]);
        const kind = detectColumnKind(header, values);
        return { header, kind, values };
      })
      .filter((c) => c.kind !== "skip" && c.kind !== "email");
  }, [sheetData, filteredRows, dateCol, subColumn]);

  // KPI hero: média geral das colunas numéricas
  const heroAvg = useMemo(() => {
    const numericCols = columnAnalysis.filter((c) => c.kind === "number");
    if (numericCols.length === 0) return null;
    const allStats = numericCols.map((c) => numericStats(c.values));
    const totalCount = allStats.reduce((s, x) => s + x.count, 0);
    if (totalCount === 0) return null;
    const weightedSum = allStats.reduce((s, x) => s + x.avg * x.count, 0);
    return weightedSum / totalCount;
  }, [columnAnalysis]);

  const lastRows = useMemo(() => {
    const rows = [...filteredRows];
    if (dateCol) {
      rows.sort((a, b) => {
        const ta = new Date(String(a[dateCol])).getTime();
        const tb = new Date(String(b[dateCol])).getTime();
        return tb - ta;
      });
    }
    return rows.slice(0, 10);
  }, [filteredRows, dateCol]);

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
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                A integração com o Google Sheets ainda não foi configurada. Adicione a variável
                <code className="text-foreground"> VITE_SHEETS_API_URL </code> com a URL pública do Apps Script
                (terminada em <code>/exec</code>).
              </p>
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
              Indicadores das respostas dos formulários da marca própria. Atualiza sozinho a cada minuto.
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div className="space-y-1.5">
                  <Label>Formulário</Label>
                  <Select value={selected ?? ""} onValueChange={(v) => { setSelected(v); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha um formulário" />
                    </SelectTrigger>
                    <SelectContent>
                      {(sheets ?? []).map((s) => (
                        <SelectItem key={s.name} value={s.name}>
                          {s.name} <span className="text-muted-foreground ml-2">({s.rows})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="from">De</Label>
                  <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="to">Até</Label>
                  <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
                {subColumn && subValues.length > 1 && (
                  <div className="md:col-span-3 space-y-1.5">
                    <Label>Filtrar por <span className="font-normal text-muted-foreground">"{subColumn}"</span></Label>
                    <Select value={subValue} onValueChange={setSubValue}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Todas</SelectItem>
                        {subValues.map((v) => (
                          <SelectItem key={v} value={v}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
            {/* KPIs hero */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Respostas no filtro" value={String(kpis.total)} />
              <KpiCard icon={<Calendar className="h-4 w-4" />} label="Últimos 7 dias" value={String(kpis.last7)} />
              <KpiCard
                icon={<Calendar className="h-4 w-4" />}
                label="Última resposta"
                value={kpis.lastDate ? fmtDateTime(kpis.lastDate.toISOString()) : "—"}
                small
              />
              <KpiCard
                icon={<Star className="h-4 w-4" />}
                label="Nota média geral"
                value={heroAvg != null ? heroAvg.toFixed(2) : "—"}
                accent
              />
            </div>

            {/* Série diária */}
            {dateCol && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="h-4 w-4 text-primary" /> Respostas por dia (últimos 30)
                  </CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailySeries} margin={{ top: 5, right: 16, bottom: 0, left: -16 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                        />
                        <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
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

            {/* Últimas respostas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Últimas {lastRows.length} respostas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {sheetData.headers.slice(0, 6).map((h) => (
                          <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lastRows.map((row, i) => (
                        <TableRow key={i}>
                          {sheetData.headers.slice(0, 6).map((h) => (
                            <TableCell key={h} className="text-sm max-w-[280px] truncate" title={String(row[h] ?? "")}>
                              {h === dateCol ? fmtDateTime(row[h]) : String(row[h] ?? "—")}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {sheetData.headers.length > 6 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Mostrando primeiras 6 colunas de {sheetData.headers.length}.
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

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

const SmartColumnCard = ({
  header, kind, values, rows, dateCol,
}: {
  header: string;
  kind: "date" | "number" | "categorical" | "text" | "email" | "skip";
  values: import("@/hooks/useSheets").SheetCell[];
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
            <span className="text-xs text-muted-foreground">média ({stats.count} respostas)</span>
          </div>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.histogram} margin={{ top: 5, right: 5, bottom: 0, left: -28 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="value" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (kind === "categorical") {
    const stats = categoricalStats(values);
    if (stats.count === 0) return null;
    const max = stats.items[0]?.count ?? 1;
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
            {stats.items.slice(0, 6).map((item) => (
              <div key={item.value} className="space-y-1">
                <div className="flex justify-between text-xs gap-2">
                  <span className="truncate" title={item.value}>{item.value}</span>
                  <span className="text-muted-foreground whitespace-nowrap">
                    {item.count} <span className="opacity-70">({item.pct.toFixed(0)}%)</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${(item.count / max) * 100}%` }} />
                </div>
              </div>
            ))}
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

export default Pesquisas;
