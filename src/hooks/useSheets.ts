import { useQuery } from "@tanstack/react-query";

// Fonte padrão (Análise de produto): VITE_SHEETS_API_URL
const DEFAULT_API = import.meta.env.VITE_SHEETS_API_URL as string | undefined;

export type SheetSummary = {
  name: string;
  /** Título do Google Form vinculado, se houver (preenchido pelo Apps Script). */
  formTitle?: string | null;
  rows: number;
  lastUpdate: string | null;
};

export type SheetCell = string | number | boolean | null;
export type SheetRow = Record<string, SheetCell>;
export type SheetData = {
  headers: string[];
  rows: SheetRow[];
};

/** Verifica se a fonte está configurada. Passe uma URL pra checar uma fonte específica. */
export const isSheetsConfigured = (apiUrl?: string) => !!(apiUrl ?? DEFAULT_API);

const fetchOrThrow = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`HTTP ${res.status} ao buscar ${url}`);
  const data = await res.json();
  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String(data.error));
  }
  return data as T;
};

// Auto-refresh em background a cada 60s — pesquisas novas aparecem sozinhas.
const AUTO_REFRESH_MS = 60_000;

/**
 * Lista as abas de uma planilha via Apps Script.
 * @param apiUrl URL /exec da fonte. Se omitida, usa VITE_SHEETS_API_URL.
 */
export const useSheetsList = (apiUrl?: string) => {
  const api = apiUrl ?? DEFAULT_API;
  return useQuery({
    queryKey: ["sheets-list", api],
    queryFn: async (): Promise<SheetSummary[]> => {
      if (!api) throw new Error("Fonte de dados (Apps Script) não configurada");
      const data = await fetchOrThrow<{ sheets: SheetSummary[] }>(api);
      return data.sheets ?? [];
    },
    enabled: !!api,
    staleTime: 30_000,
    refetchInterval: AUTO_REFRESH_MS,
    refetchOnWindowFocus: true,
  });
};

/**
 * Busca as linhas de uma aba.
 * @param apiUrl URL /exec da fonte. Se omitida, usa VITE_SHEETS_API_URL.
 */
export const useSheetData = (sheetName: string | null, apiUrl?: string) => {
  const api = apiUrl ?? DEFAULT_API;
  return useQuery({
    queryKey: ["sheet-data", api, sheetName],
    queryFn: async (): Promise<SheetData> => {
      if (!api) throw new Error("Fonte de dados (Apps Script) não configurada");
      if (!sheetName) throw new Error("Selecione um formulário");
      const url = `${api}?sheet=${encodeURIComponent(sheetName)}`;
      return fetchOrThrow<SheetData>(url);
    },
    enabled: !!api && !!sheetName,
    staleTime: 15_000,
    refetchInterval: AUTO_REFRESH_MS,
    refetchOnWindowFocus: true,
  });
};
