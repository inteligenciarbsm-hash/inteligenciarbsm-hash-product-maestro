import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { GitCompareArrows, RefreshCw } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import ComparisonSection from "@/components/ComparisonSection";
import { isSheetsConfigured, useSheetsList, useSheetData, type SheetRow } from "@/hooks/useSheets";
import { findSubSurveyColumn, isDateColumn } from "@/lib/sheetAnalysis";

const Comparativo = () => {
  const configured = isSheetsConfigured();
  const {
    data: sheets, isLoading: loadingSheets, error: sheetsError,
    refetch: refetchSheets, isFetching: fetchingList,
  } = useSheetsList();
  const [selected, setSelected] = useState<string | null>(null);
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

  const dateCol = useMemo(() => {
    if (!sheetData) return null;
    return sheetData.headers.find(isDateColumn) ?? null;
  }, [sheetData]);

  const subColumn = useMemo(() => {
    if (!sheetData) return null;
    return findSubSurveyColumn(sheetData.headers, sheetData.rows);
  }, [sheetData]);

  // Reset seleção quando troca de form
  useEffect(() => {
    setActiveSubs([]);
  }, [selected]);

  const subValues = useMemo(() => {
    if (!sheetData || !subColumn) return [];
    const set = new Set<string>();
    sheetData.rows.forEach((r) => {
      const v = r[subColumn];
      if (v != null && v !== "") set.add(String(v).trim());
    });
    return Array.from(set).sort();
  }, [sheetData, subColumn]);

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

  const headersForCompare = useMemo(() => {
    if (!sheetData) return [];
    // Dedupe headers — planilha pode ter colunas duplicadas
    const unique = Array.from(new Set(sheetData.headers));
    return unique.filter((h) => h !== dateCol && h !== subColumn);
  }, [sheetData, dateCol, subColumn]);

  if (!configured) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container py-8">
          <Card>
            <CardHeader>
              <CardTitle>Comparativo — configuração pendente</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Adicione a variável <code className="text-foreground"> VITE_SHEETS_API_URL </code>.
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
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <GitCompareArrows className="h-6 w-6 text-primary" />
              Comparativo de produtos
            </h2>
            <p className="text-sm text-muted-foreground">
              Selecione uma pesquisa e 2 ou mais produtos pra ver o radar de comparação,
              destaques e médias por produto.
            </p>
          </div>
          <button
            onClick={() => { refetchSheets(); refetchData(); }}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            disabled={fetchingList || fetchingData}
          >
            <RefreshCw className={`h-4 w-4 ${(fetchingList || fetchingData) ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtros</CardTitle>
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
                  <Label>Pesquisa</Label>
                  <Select value={selected ?? ""} onValueChange={setSelected}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha uma pesquisa" />
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

                {selected && subColumn && subValues.length > 1 && (
                  <div className="space-y-1.5">
                    <Label>
                      Produtos pra comparar
                      <span className="font-normal text-muted-foreground ml-2">
                        — selecione 2 ou mais
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
                    <p className="text-xs text-muted-foreground">
                      {activeSubs.length === 0
                        ? "Nenhum produto selecionado."
                        : activeSubs.length === 1
                        ? `1 produto selecionado — selecione mais 1 pra comparar.`
                        : `${activeSubs.length} produtos selecionados.`}
                    </p>
                  </div>
                )}

                {selected && subColumn && subValues.length <= 1 && !loadingData && (
                  <p className="text-sm text-muted-foreground">
                    Esta pesquisa só tem {subValues.length} produto detectado — não dá pra comparar.
                  </p>
                )}

                {selected && !subColumn && !loadingData && sheetData && (
                  <p className="text-sm text-muted-foreground">
                    Não foi possível identificar a coluna de produto/sub-pesquisa nesta planilha.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {!selected ? null : loadingData ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Carregando respostas...</CardContent></Card>
        ) : dataError ? (
          <Card><CardContent className="py-12 text-center text-destructive">
            Erro: {dataError instanceof Error ? dataError.message : "desconhecido"}
          </CardContent></Card>
        ) : !sheetData || sheetData.rows.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma resposta nesta pesquisa.</CardContent></Card>
        ) : !rowsBySub ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground space-y-2">
              <GitCompareArrows className="h-8 w-8 mx-auto text-muted-foreground/40" />
              <p>Marque <strong>2 ou mais produtos</strong> acima pra ver a comparação.</p>
            </CardContent>
          </Card>
        ) : (
          <ComparisonSection rowsBySub={rowsBySub} headers={headersForCompare} />
        )}
      </main>
    </div>
  );
};

export default Comparativo;
