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
// Headers que claramente são perguntas dissertativas (texto livre).
// Quando o nome bate aqui, força "text" mesmo que os valores sejam curtos
// — evita classificar "gdfgd", "ok" etc. como opções categóricas.
const TEXT_HINTS = /coment|gostou|por.?que|justifique|opini[ãa]o|sugest|observa|descrev|relata|fale|sinta|escreva|relate|opinou/i;

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

  // Se o nome do header indica pergunta dissertativa, força "text" antes
  // do heurístico de cardinalidade — comentários curtos não viram categoria.
  if (TEXT_HINTS.test(header)) return "text";

  const uniques = new Set(nonEmpty.map((v) => cleanString(v)));
  const avgLen =
    nonEmpty.reduce((sum, v) => sum + cleanString(v).length, 0) / nonEmpty.length;
  if (uniques.size <= 12 && avgLen <= 60) return "categorical";

  return "text";
};

/**
 * Tenta inferir a escala completa de uma pergunta numérica.
 * Procura padrão "(N ... M)" no header (ex: "(1-5)", "(1 a 5)",
 * "(1 muito ruim e 5 muito bom)") e usa esses extremos.
 * Caso contrário, heurística: integers ≤ 5 vira 1-5; ≤ 10 vira 0-10.
 */
const detectScale = (
  header: string | undefined,
  nums: number[]
): { min: number; max: number } | null => {
  if (header) {
    const inside = header.match(/\(([^)]+)\)/);
    if (inside) {
      const numbers = inside[1].match(/\d+/g);
      if (numbers && numbers.length >= 2) {
        const lo = Number(numbers[0]);
        const hi = Number(numbers[numbers.length - 1]);
        if (!isNaN(lo) && !isNaN(hi) && hi > lo && hi - lo <= 20) {
          return { min: lo, max: hi };
        }
      }
    }
  }
  if (nums.length === 0) return null;
  const allInt = nums.every((n) => Number.isInteger(n));
  if (!allInt) return null;
  const max = Math.max(...nums);
  const min = Math.min(...nums);
  if (max <= 5 && min >= 1) return { min: 1, max: 5 };
  if (max <= 10 && min >= 0) return { min: 0, max: 10 };
  return null;
};

export const numericStats = (values: SheetCell[], header?: string): NumericStats => {
  const nums = values.map(tryNumber).filter((n): n is number => n !== null);
  if (nums.length === 0) {
    return { count: 0, avg: 0, min: 0, max: 0, histogram: [] };
  }
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;

  const scale = detectScale(header, nums);
  let bins: { value: number; count: number }[] = [];

  if (scale) {
    // Sempre exibe todos os pontos da escala, mesmo com count = 0
    for (let v = scale.min; v <= scale.max; v++) {
      bins.push({ value: v, count: 0 });
    }
    nums.forEach((n) => {
      const bin = bins.find((b) => b.value === n);
      if (bin) bin.count++;
    });
  } else if (Number.isInteger(min) && Number.isInteger(max) && max - min <= 10) {
    for (let v = Math.floor(min); v <= Math.ceil(max); v++) {
      bins.push({ value: v, count: 0 });
    }
    nums.forEach((n) => {
      const bin = bins.find((b) => b.value === n);
      if (bin) bin.count++;
    });
  } else {
    const binCount = 5;
    const span = max - min;
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

/**
 * Remove código numérico de blindagem do nome da coluna.
 * Em pesquisas sensoriais cegas, cada amostra recebe um código (710, 456, etc.),
 * e as colunas viram tipo "710 - Como avalia a COR (1-5)". O comparativo precisa
 * ignorar esse prefixo pra agrupar perguntas equivalentes entre produtos.
 *
 * Exemplos:
 *   "710 - Como avalia COR"        → "Como avalia COR"
 *   "456 - SABOR (1-5)"            → "SABOR (1-5)"
 *   "Pergunta sem código"          → "Pergunta sem código" (inalterado)
 */
export const stripCodePrefix = (header: string): string =>
  header.replace(/^\s*\d+\s*-\s*/, "").trim();

/**
 * Agrupa colunas por texto da pergunta (sem código de blindagem).
 * Retorna `{ "Como avalia COR": ["710 - Como avalia COR", "456 - Como avalia COR"] }`.
 */
export const groupColumnsByQuestion = (
  headers: string[]
): Record<string, string[]> => {
  const groups: Record<string, string[]> = {};
  headers.forEach((h) => {
    const norm = stripCodePrefix(h);
    if (!groups[norm]) groups[norm] = [];
    groups[norm].push(h);
  });
  return groups;
};

/**
 * Coleta valores não-vazios de um conjunto de linhas, olhando em TODAS as colunas
 * sinônimas (que representam a mesma pergunta em códigos diferentes). Usado pra
 * agregar respostas de uma pergunta normalizada em pesquisas com prefixo de código.
 */
export const collectValuesAcrossColumns = (
  rows: SheetRow[],
  cols: string[]
): SheetCell[] => {
  const out: SheetCell[] = [];
  rows.forEach((row) => {
    for (const c of cols) {
      const v = row[c];
      if (v != null && v !== "") {
        out.push(v);
        break; // 1 valor por linha — o que estiver preenchido
      }
    }
  });
  return out;
};

/**
 * Calcula a média numérica de uma coluna para cada grupo (sub-pesquisa).
 * Retorna `null` para grupos sem dados numéricos.
 */
export const numericAvgByGroup = (
  rows: SheetRow[],
  column: string,
  groupColumn: string
): Record<string, number | null> => {
  const sums: Record<string, { sum: number; count: number }> = {};
  rows.forEach((r) => {
    const group = String(r[groupColumn] ?? "").trim();
    if (!group) return;
    const raw = r[column];
    if (raw == null || raw === "") return;
    const n = typeof raw === "number" ? raw : Number(String(raw).trim().replace(",", "."));
    if (isNaN(n)) return;
    sums[group] = sums[group] ?? { sum: 0, count: 0 };
    sums[group].sum += n;
    sums[group].count += 1;
  });
  const out: Record<string, number | null> = {};
  Object.entries(sums).forEach(([g, { sum, count }]) => {
    out[g] = count > 0 ? sum / count : null;
  });
  return out;
};

/**
 * Heurística: encontra a coluna que parece ser uma "sub-pesquisa" / produto.
 * Procura padrões fortes (verbo + substantivo) pra evitar falsos positivos
 * de perguntas que mencionam "produto" no meio do texto.
 */
export const findSubSurveyColumn = (
  headers: string[],
  rows: SheetRow[]
): string | null => {
  // 1. Padrões fortes: começa com (ou contém) verbo seletivo + alvo
  const strongPatterns = [
    /selecione.*(pesquisa|produto|formul[áa]rio|item)/i,
    /escolha.*(pesquisa|produto|formul[áa]rio|item)/i,
    /qual.*(pesquisa|produto|formul[áa]rio|item)/i,
    /(pesquisa|produto|formul[áa]rio|item).*(selecione|escolha|escolhid)/i,
  ];
  for (const pattern of strongPatterns) {
    const found = headers.find((h) => pattern.test(h));
    if (found) return found;
  }

  // 2. Fallback: primeira coluna categórica com 2-8 valores únicos
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
