// Funções puras de parse. Sem efeitos colaterais, sem imports externos.

export function normalizeHeader(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

export function parseText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str === "" ? null : str;
}

export function parseDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  // Serial number do Excel (dias desde 1900-01-00, com bug do ano bissexto de 1900)
  if (typeof value === "number" && value > 1000) {
    const ms = Math.round((value - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().split("T")[0];
  }

  const str = String(value).trim();
  if (!str) return null;

  // Formato BR: "15/03/2026" — também extrai de strings mistas como "SIM - 15/03/2026"
  const brMatch = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (brMatch) {
    const [, d, m, y] = brMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // ISO: "2026-03-15"
  const isoMatch = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  return null;
}

export function parseInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  // Fórmulas quebradas do Excel chegam como string (ex: "#VALUE!") — retorna null
  if (typeof value === "number" && isFinite(value)) return Math.round(value);
  const n = parseInt(String(value).trim(), 10);
  return isNaN(n) ? null : n;
}
