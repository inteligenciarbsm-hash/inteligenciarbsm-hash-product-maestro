import { log } from "./logger.ts";

// ─── Leitura via exportação CSV pública do Google Sheets ─────────────────────
// A planilha precisa estar compartilhada como "Qualquer pessoa com o link pode
// visualizar". Nesse modo, o endpoint de exportação CSV não exige autenticação
// nem credenciais de API — só o ID da planilha e (opcionalmente) o gid da aba.

// gid é opcional: quando informado, endereça uma aba específica. Quando
// ausente, o Google Sheets retorna a aba padrão da planilha — evita depender
// de descobrir o gid manualmente para o caso comum de planilha com 1 aba útil.
export function buildCsvExportUrl(spreadsheetId: string, gid?: string): string {
  const base = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
  return gid ? `${base}&gid=${gid}` : base;
}

// ─── Parser CSV mínimo (RFC 4180) ──────────────────────────────────────────────
// Suporta campos entre aspas com vírgulas, aspas escapadas ("") e quebras de
// linha internas — necessário porque OCORRÊNCIA/OBSERVAÇÃO/ENDEREÇO podem
// conter vírgulas. Sem dependência externa, mesma filosofia do restante do projeto.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }

    if (char === "\r") {
      i++;
      continue;
    }

    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }

    field += char;
    i++;
  }

  // Última linha, caso o arquivo não termine com quebra de linha
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

// ─── Leitura da planilha ──────────────────────────────────────────────────────

export async function fetchSheetValues(
  spreadsheetId: string,
  gid?: string
): Promise<unknown[][]> {
  const url = buildCsvExportUrl(spreadsheetId, gid);

  log("INFO", "Lendo planilha via Google Sheets (CSV)", { spreadsheet_id: spreadsheetId, gid });

  const res = await fetch(url);

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Falha ao ler planilha do Google Sheets (${res.status}): ${body.slice(0, 300)}`
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    throw new Error(
      "O Google Sheets retornou uma página HTML em vez de CSV — normalmente indica que a " +
        "planilha não está compartilhada como \"Qualquer pessoa com o link pode visualizar\"."
    );
  }

  const csvText = await res.text();
  const values = parseCsv(csvText);

  log("INFO", "Planilha lida com sucesso", { total_rows: values.length });

  return values as unknown[][];
}
