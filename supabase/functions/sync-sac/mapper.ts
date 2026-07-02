import { log } from "./logger.ts";
import { normalizeHeader, parseDate, parseInteger, parseText } from "./parser.ts";

// ─── Tipo que espelha a tabela sac_ocorrencias ────────────────────────────────

export type OcorrenciaInsert = {
  num_ocorrencia: string;
  data_email: string | null;
  produto: string | null;
  fornecedor: string | null;
  associado: string | null;
  tipo_ocorrencia: string | null;
  criticidade: string | null;
  ocorrencia_descricao: string | null;
  lote: string | null;
  data_fabricacao: string | null;
  data_validade: string | null;
  nome_consumidor: string | null;
  tel_consumidor: string | null;
  email_consumidor: string | null;
  endereco_consumidor: string | null;
  fornecedor_comunicado_em: string | null;
  associado_comunicado_em: string | null;
  ressarcimento_em: string | null;
  rnc_finalizado_em: string | null;
  dias_resolucao: number | null;
  observacao: string | null;
  sincronizado_em: string;
};

// ─── Mapeamento de colunas Excel → banco ─────────────────────────────────────
// Ponto único onde os nomes das colunas do Excel existem no código.
// Cabeçalhos são normalizados (trim + espaços múltiplos → único) antes da comparação,
// portanto nomes com espaço duplo original (ex: "RESSARCIU CLIENTE?  DATA") são cobertos.

export const COLUMN_MAP: Record<string, keyof OcorrenciaInsert> = {
  "Nº OCORRÊNCIA": "num_ocorrencia",
  "DATA DO E-MAIL": "data_email",
  "PRODUTO": "produto",
  "DATA FAB": "data_fabricacao",
  "DATA VAL": "data_validade",
  "LOTE": "lote",
  "FORNECEDOR": "fornecedor",
  "ASSOCIADO/SÓCIO": "associado",
  "OCORRÊNCIA": "ocorrencia_descricao",
  "TIPO DE OCORRÊNCIA": "tipo_ocorrencia",
  "CRITICIDADE": "criticidade",
  "NOME DO CONSUMIDOR": "nome_consumidor",
  "TEL CONTATO CONSUMIDOR": "tel_consumidor",
  "E-MAIL CONTATO CONSUMIDOR": "email_consumidor",
  "ENDEREÇO CONSUMIDOR": "endereco_consumidor",
  "FORNECEDOR COMUNICADO? DATA": "fornecedor_comunicado_em",
  "SÓCIO / ASSOCIADO COMUNICADO? DATA": "associado_comunicado_em",
  "SÓCIO / ASSOCIADO RESSARCIU CLIENTE? DATA": "ressarcimento_em",
  "RNC FINALIZADO DATA": "rnc_finalizado_em",
  "TEMPO DE FINALIZAÇÃO DO SAC (DIAS) (Ressarcimento + RNC finalizada)": "dias_resolucao",
  "OBSERVAÇÃO": "observacao",
};

// Cabeçalho âncora — identifica a linha de cabeçalho no Excel
export const ANCHOR_HEADER = "Nº OCORRÊNCIA";

const DATE_FIELDS = new Set<keyof OcorrenciaInsert>([
  "data_email",
  "data_fabricacao",
  "data_validade",
  "fornecedor_comunicado_em",
  "associado_comunicado_em",
  "ressarcimento_em",
  "rnc_finalizado_em",
]);

const INTEGER_FIELDS = new Set<keyof OcorrenciaInsert>(["dias_resolucao"]);

// ─── Funções ──────────────────────────────────────────────────────────────────

export function findHeaderRow(values: unknown[][]): number {
  const idx = values
    .slice(0, 10)
    .findIndex((row) =>
      (row as unknown[]).some((cell) => normalizeHeader(cell) === ANCHOR_HEADER)
    );

  if (idx === -1) {
    throw new Error(
      `Cabeçalho "${ANCHOR_HEADER}" não encontrado nas 10 primeiras linhas. ` +
        `Verifique o valor de "sac.sheet_name" em system_config.`
    );
  }

  return idx;
}

export function buildColIndex(
  headers: string[]
): Partial<Record<keyof OcorrenciaInsert, number>> {
  const colIndex: Partial<Record<keyof OcorrenciaInsert, number>> = {};
  let mapeadas = 0;

  headers.forEach((header, i) => {
    const field = COLUMN_MAP[header];
    if (field !== undefined) {
      colIndex[field] = i;
      mapeadas++;
    }
  });

  log("INFO", "Colunas mapeadas", { mapeadas, total: headers.length });
  return colIndex;
}

function getCell(
  row: unknown[],
  colIndex: Partial<Record<keyof OcorrenciaInsert, number>>,
  field: keyof OcorrenciaInsert
): unknown {
  const idx = colIndex[field];
  return idx !== undefined ? row[idx] : undefined;
}

function parseField(
  field: keyof OcorrenciaInsert,
  value: unknown
): string | number | null {
  if (DATE_FIELDS.has(field)) return parseDate(value);
  if (INTEGER_FIELDS.has(field)) return parseInteger(value);
  return parseText(value);
}

export type TransformResult = {
  ocorrencias: OcorrenciaInsert[];
  linhasLidas: number;
  linhasIgnoradas: number;
  linhasComErro: number;
  erros: string[];
};

export function transformRows(
  values: unknown[][],
  headerRowIndex: number,
  syncTs: string
): TransformResult {
  const headers = (values[headerRowIndex] as unknown[]).map(normalizeHeader);
  const colIndex = buildColIndex(headers);
  const dataRows = values.slice(headerRowIndex + 1) as unknown[][];

  const ocorrencias: OcorrenciaInsert[] = [];
  const erros: string[] = [];
  let linhasLidas = 0;
  let linhasIgnoradas = 0;
  let linhasComErro = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const numOcorrencia = parseText(getCell(row, colIndex, "num_ocorrencia"));

    if (!numOcorrencia) {
      linhasIgnoradas++;
      continue;
    }

    linhasLidas++;

    try {
      ocorrencias.push({
        num_ocorrencia: numOcorrencia,
        data_email: parseField("data_email", getCell(row, colIndex, "data_email")) as string | null,
        produto: parseField("produto", getCell(row, colIndex, "produto")) as string | null,
        fornecedor: parseField("fornecedor", getCell(row, colIndex, "fornecedor")) as string | null,
        associado: parseField("associado", getCell(row, colIndex, "associado")) as string | null,
        tipo_ocorrencia: parseField("tipo_ocorrencia", getCell(row, colIndex, "tipo_ocorrencia")) as string | null,
        criticidade: parseField("criticidade", getCell(row, colIndex, "criticidade")) as string | null,
        ocorrencia_descricao: parseField("ocorrencia_descricao", getCell(row, colIndex, "ocorrencia_descricao")) as string | null,
        lote: parseField("lote", getCell(row, colIndex, "lote")) as string | null,
        data_fabricacao: parseField("data_fabricacao", getCell(row, colIndex, "data_fabricacao")) as string | null,
        data_validade: parseField("data_validade", getCell(row, colIndex, "data_validade")) as string | null,
        nome_consumidor: parseField("nome_consumidor", getCell(row, colIndex, "nome_consumidor")) as string | null,
        tel_consumidor: parseField("tel_consumidor", getCell(row, colIndex, "tel_consumidor")) as string | null,
        email_consumidor: parseField("email_consumidor", getCell(row, colIndex, "email_consumidor")) as string | null,
        endereco_consumidor: parseField("endereco_consumidor", getCell(row, colIndex, "endereco_consumidor")) as string | null,
        fornecedor_comunicado_em: parseField("fornecedor_comunicado_em", getCell(row, colIndex, "fornecedor_comunicado_em")) as string | null,
        associado_comunicado_em: parseField("associado_comunicado_em", getCell(row, colIndex, "associado_comunicado_em")) as string | null,
        ressarcimento_em: parseField("ressarcimento_em", getCell(row, colIndex, "ressarcimento_em")) as string | null,
        rnc_finalizado_em: parseField("rnc_finalizado_em", getCell(row, colIndex, "rnc_finalizado_em")) as string | null,
        dias_resolucao: parseField("dias_resolucao", getCell(row, colIndex, "dias_resolucao")) as number | null,
        observacao: parseField("observacao", getCell(row, colIndex, "observacao")) as string | null,
        sincronizado_em: syncTs,
      });
    } catch (err) {
      linhasComErro++;
      const linhaExcel = headerRowIndex + 1 + i + 1;
      const msg = err instanceof Error ? err.message : String(err);
      erros.push(`Linha ${linhaExcel} (${numOcorrencia}): ${msg}`);
      log("WARN", "Falha ao parsear linha", { linha: linhaExcel, num_ocorrencia: numOcorrencia, erro: msg });
    }
  }

  return { ocorrencias, linhasLidas, linhasIgnoradas, linhasComErro, erros };
}
