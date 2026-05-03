import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Calendar, FileSpreadsheet, ListTree, RefreshCw, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import AppHeader from "@/components/AppHeader";
import { isSheetsConfigured, useSheetsList, useSheetData, type SheetRow } from "@/hooks/useSheets";

const detectDateColumn = (headers: string[], rows: SheetRow[]): string | null => {
  const byName = headers.find((h) => /carimbo|timestamp|data.?hora|date.?time|data.?envio/i.test(h));
  if (byName) return byName;
  for (const h of headers) {
    const sample = rows.slice(0, 10).map((r) => r[h]).filter((v) => v !== "" && v != null);
    if (sample.length === 0) continue;
    const allDates = sample.every((v) => !isNaN(Date.parse(String(v))));
    if (allDates) return h;
  }
  return null;
};

const ymd = (d: Date) => d.toISOString().slice(0, 10);

const fmtDateTime = (v: unknown) => {
  if (v == null || v === "") return "—";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const Pesquisas = () => {
  const configured = isSheetsConfigured();
  const { data: sheets, isLoading: loadingSheets, error: sheetsError, refetch: refetchSheets } = useSheetsList();
  const [selected, setSelected] = useState<string | null>(null);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const { data: sheetData, isLoading: loadingData, error: dataError, refetch: refetchData } = useSheetData(selected);

  const dateCol = useMemo(() => {
    if (!sheetData) return null;
    return detectDateColumn(sheetData.headers, sheetData.rows);
  }, [sheetData]);

  const filteredRows = useMemo(() => {
    if (!sheetData) return [];
    if (!dateCol) return sheetData.rows;
    const fromTs = from ? new Date(from).getTime() : null;
    const toTs = to ? new Date(to + "T23:59:59").getTime() : null;
    return sheetData.rows.filter((r) => {
      const v = r[dateCol];
      if (v == null || v === "") return false;
      const t = new Date(String(v)).getTime();
      if (isNaN(t)) return false;
      if (fromTs && t < fromTs) return false;
      if (toTs && t > toTs) return false;
      return true;
    });
  }, [sheetData, dateCol, from, to]);

  const kpis = useMemo(() => {
    if (!sheetData) return null;
    const rows = filteredRows;
    let last7 = 0;
    let lastDate: Date | null = null;
    if (dateCol) {
      const sevenAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      rows.forEach((r) => {
        const t = new Date(String(r[dateCol])).getTime();
        if (isNaN(t)) return;
        if (t >= sevenAgo) last7++;
        if (!lastDate || t > lastDate.getTime()) lastDate = new Date(t);
      });
    }
    return { total: rows.length, last7, lastDate };
  }, [sheetData, filteredRows, dateCol]);

  const dailySeries = useMemo(() => {
    if (!dateCol || !sheetData) return [];
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
    return Object.entries(counts).map(([date, count]) => ({
      date: date.slice(5), // MM-DD
      count,
    }));
  }, [filteredRows, dateCol, sheetData]);

  const distributions = useMemo(() => {
    if (!sheetData) return [];
    const cols = sheetData.headers.filter(
      (h) => h !== dateCol && !/email|e-mail/i.test(h)
    );
    return cols
      .map((col) => {
        const counts: Record<string, number> = {};
        let nonEmpty = 0;
        filteredRows.forEach((r) => {
          const raw = r[col];
          if (raw == null || raw === "") return;
          nonEmpty++;
          const key = String(raw).trim();
          counts[key] = (counts[key] ?? 0) + 1;
        });
        const top = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        const uniqueValues = Object.keys(counts).length;
        return { col, top, nonEmpty, uniqueValues };
      })
      .filter((d) => d.nonEmpty > 0 && d.uniqueValues < d.nonEmpty); // ignora colunas de texto livre (todos diferentes)
  }, [filteredRows, sheetData, dateCol]);

  const lastRows = useMemo(() => {
    if (!sheetData) return [];
    const rows = [...filteredRows];
    if (dateCol) {
      rows.sort((a, b) => {
        const ta = new Date(String(a[dateCol])).getTime();
        const tb = new Date(String(b[dateCol])).getTime();
        return tb - ta;
      });
    }
    return rows.slice(0, 10);
  }, [filteredRows, dateCol, sheetData]);

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
                A integração com o Google Sheets ainda não foi configurada. Pra ativar,
                adicione a variável de ambiente <code className="text-foreground">VITE_SHEETS_API_URL</code>
                {" "}com a URL pública do Apps Script (terminada em <code>/exec</code>):
              </p>
              <ol className="list-decimal ml-5 space-y-1">
                <li>Localmente: criar/editar <code className="text-foreground">.env</code> e adicionar a variável.</li>
                <li>Na Vercel: <strong>Project Settings → Environment Variables</strong> → adicionar e re-deploy.</li>
              </ol>
              <p>
                Depois que adicionar, esta tela volta a funcionar automaticamente.
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
              Indicadores das respostas dos formulários da marca própria.
            </p>
          </div>
          <button
            onClick={() => { refetchSheets(); refetchData(); }}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <RefreshCw className="h-4 w-4" /> Atualizar
          </button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Selecione o formulário
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingSheets ? (
              <div className="text-sm text-muted-foreground">Carregando lista...</div>
            ) : sheetsError ? (
              <div className="text-sm text-destructive">
                Erro ao buscar planilha: {sheetsError instanceof Error ? sheetsError.message : "desconhecido"}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div className="md:col-span-2 space-y-1.5">
                  <Label>Formulário</Label>
                  <Select value={selected ?? ""} onValueChange={setSelected}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha um formulário" />
                    </SelectTrigger>
                    <SelectContent>
                      {(sheets ?? []).map((s) => (
                        <SelectItem key={s.name} value={s.name}>
                          {s.name} <span className="text-muted-foreground ml-2">({s.rows} respostas)</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="from">De</Label>
                    <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="to">Até</Label>
                    <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {!selected ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Selecione um formulário acima pra ver os indicadores.
            </CardContent>
          </Card>
        ) : loadingData ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Carregando respostas...</CardContent></Card>
        ) : dataError ? (
          <Card><CardContent className="py-12 text-center text-destructive">
            Erro: {dataError instanceof Error ? dataError.message : "desconhecido"}
          </CardContent></Card>
        ) : !sheetData || sheetData.rows.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma resposta encontrada.</CardContent></Card>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Total de respostas" value={String(kpis?.total ?? 0)} />
              <KpiCard icon={<Calendar className="h-4 w-4" />} label="Últimos 7 dias" value={String(kpis?.last7 ?? 0)} />
              <KpiCard
                icon={<Calendar className="h-4 w-4" />}
                label="Última resposta"
                value={kpis?.lastDate ? fmtDateTime(kpis.lastDate.toISOString()) : "—"}
                small
              />
            </div>

            {/* Gráfico */}
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
                          labelStyle={{ color: "hsl(var(--foreground))" }}
                        />
                        <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Distribuições */}
            {distributions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ListTree className="h-4 w-4 text-primary" /> Top respostas por pergunta
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {distributions.map((d) => {
                      const max = d.top[0]?.[1] ?? 1;
                      return (
                        <div key={d.col} className="rounded-lg border p-3 space-y-2">
                          <div className="text-xs font-medium text-muted-foreground line-clamp-2" title={d.col}>
                            {d.col}
                          </div>
                          <div className="space-y-1.5">
                            {d.top.map(([value, count]) => (
                              <div key={value} className="space-y-0.5">
                                <div className="flex justify-between text-xs">
                                  <span className="truncate pr-2" title={value}>{value}</span>
                                  <span className="text-muted-foreground">{count}</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full bg-primary"
                                    style={{ width: `${(count / max) * 100}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

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
  icon, label, value, small,
}: { icon: React.ReactNode; label: string; value: string; small?: boolean }) => (
  <Card>
    <CardContent className="pt-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
        {icon}
        <span className="uppercase tracking-wide">{label}</span>
      </div>
      <div className={small ? "text-lg font-semibold" : "text-3xl font-bold"}>{value}</div>
    </CardContent>
  </Card>
);

export default Pesquisas;
