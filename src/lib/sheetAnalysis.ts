// Análise heurística de colunas vindas de uma planilha de respostas
// (Google Forms ou similar). Detecta tipo da coluna e calcula estatísticas
// adequadas pra cada tipo, tudo no client.

import type { SheetCell, SheetRow } from "@/hooks/useSheets";

export type ColumnKind = "date" | "number" | "categorical" | "text" | "email" | "skip";

export type NumericStats = {
  count: number;
  avg: number;
  min: number;
  max: number;
  /** Distribuição: cada bin tem (label numérico, contagem). */
  histogram: { value: number; count: number }[];
};

export type CategoricalStats = {
  count: number;
  /** Top valores ordenados por frequência. */
  items: { value: string; count: number; pct: number }[];
};

export type TextStats = {
  count: number;
  /** Últimas N respostas não vazias, ordenadas pela coluna de data se possível. */
  recent: { text: string; date: Date | null }[];
};

const DATE_KEYWORDS = /carimbo|timestamp|data.?hora|date.?time|data.?envio/i;
const EMAIL_KEYWORDS = /e[\s_-]?mail/i;
const EMAIL_VALUE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isDateColumn = (header: string) => DATE_KEYWORDS.test(header);

export const toDate = (cell: SheetCell): Date | null => {
  if (cell == null || cell === "") return null;
  if (typeof cell === "string") {
    const t = Date.parse(cell);
    return isNaN(t) ? null : new Date(t);
  }
  if (typeof cell === "number") return null;
  return null;
};

const cleanString = (cell: SheetCell): string =>
  cell == null ? "" : String(cell).trim();

const tryNumber = (cell: SheetCell): number | null => {
  if (cell == null || cell === "") return null;
  if (typeof cell === "number") return cell;
  const s = String(cell).trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
};

/**
 * Detecta o tipo da coluna olhando para os valores não vazios.
 *
 * Regras (em ordem):
 * - header com "carimbo|data|hora" => date
 * - header com "email" ou ≥80% dos valores parecem e-mail => email
 * - ≥80% dos valores não vazios são numéricos com até 3 casas decimais => number
 * - <= 12 valores únicos OU média de comprimento curta => categorical
 * - Caso contrário => text
 * - Sem valores não vazios => skip
 */
export const detectColumnKind = (header: string, values: SheetCell[]): ColumnKind => {
  if (isDateColumn(header)) return "date";

  const nonEmpty = values.filter((v) => v != null && v !== "");
  if (nonEmpty.length === 0) return "skip";

  if (EMAIL_KEYWORDS.test(header)) return "email";
  const emailHits = nonEmpty.filter((v) => EMAIL_VALUE.test(String(v))).length;
  if (emailHits / nonEmpty.length >= 0.8) return "email";

  const numeric = nonEmpty.map(tryNumber).filter((n): n is number => n !== null);
  if (numeric.length / nonEmpty.length >= 0.8) return "number";

  const uniques = new Set(nonEmpty.map((v) => cleanString(v)));
  const avgLen =
    nonEmpty.reduce((sum, v) => sum + cleanString(v).length, 0) / nonEmpty.length;
  if (uniques.size <= 12 && avgLen <= 60) return "categorical";

  return "text";
};

export const numericStats = (values: SheetCell[]): NumericStats => {
  const nums = values.map(tryNumber).filter((n): n is number => n !== null);
  if (nums.length === 0) {
    return { count: 0, avg: 0, min: 0, max: 0, histogram: [] };
  }
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;

  // Decide o tamanho dos bins. Se min/max são inteiros pequenos (<=10),
  // usa cada inteiro como bin. Senão, 5 bins igualmente espaçados.
  const integers = nums.every((n) => Number.isInteger(n));
  const span = max - min;
  let bins: { value: number; count: number }[] = [];

  if (integers && span <= 10) {
    for (let v = Math.floor(min); v <= Math.ceil(max); v++) {
      bins.push({ value: v, count: 0 });
    }
    nums.forEach((n) => {
      const bin = bins.find((b) => b.value === n);
      if (bin) bin.count++;
    });
  } else {
    const binCount = 5;
    const binSize = span === 0 ? 1 : span / binCount;
    for (let i = 0; i < binCount; i++) {
      const center = min + binSize * (i + 0.5);
      bins.push({ value: Number(center.toFixed(2)), count: 0 });
    }
    nums.forEach((n) => {
      let idx = Math.floor((n - min) / binSize);
      if (idx >= binCount) idx = binCount - 1;
      if (idx < 0) idx = 0;
      bins[idx].count++;
    });
  }

  return { count: nums.length, avg, min, max, histogram: bins };
};

export const categoricalStats = (values: SheetCell[]): CategoricalStats => {
  const counts = new Map<string, number>();
  let total = 0;
  values.forEach((v) => {
    const s = cleanString(v);
    if (!s) return;
    total++;
    counts.set(s, (counts.get(s) ?? 0) + 1);
  });
  const items = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({
      value,
      count,
      pct: total === 0 ? 0 : (count / total) * 100,
    }));
  return { count: total, items };
};

export const textStats = (
  rows: SheetRow[],
  column: string,
  dateColumn: string | null,
  limit = 5
): TextStats => {
  const nonEmpty = rows
    .map((r) => ({
      text: cleanString(r[column]),
      date: dateColumn ? toDate(r[dateColumn]) : null,
    }))
    .filter((x) => x.text.length > 0);

  nonEmpty.sort((a, b) => {
    const ta = a.date?.getTime() ?? 0;
    const tb = b.date?.getTime() ?? 0;
    return tb - ta;
  });

  return { count: nonEmpty.length, recent: nonEmpty.slice(0, limit) };
};

/** Heurística: encontra a coluna que parece ser uma "sub-pesquisa" / produto. */
export const findSubSurveyColumn = (
  headers: string[],
  rows: SheetRow[]
): string | null => {
  // Preferência por nomes que mencionam "escolha", "pesquisa", "produto", "categoria"
  const preferred = headers.find((h) =>
    /escolha.*pesquisa|qual.*pesquisa|produto|categoria/i.test(h)
  );
  if (preferred) return preferred;

  // Fallback: primeira coluna categórica com 2-8 valores únicos
  for (const h of headers) {
    if (isDateColumn(h)) continue;
    const values = rows.map((r) => r[h]);
    const kind = detectColumnKind(h, values);
    if (kind === "categorical") {
      const uniq = new Set(values.filter((v) => v != null && v !== "").map((v) => String(v).trim()));
      if (uniq.size >= 2 && uniq.size <= 8) return h;
    }
  }
  return null;
};
