import { useQuery } from "@tanstack/react-query";

// Configurar via env: VITE_SHEETS_API_URL = URL pública do Apps Script (...exec)
const API = import.meta.env.VITE_SHEETS_API_URL as string | undefined;

export type SheetSummary = {
  name: string;
  rows: number;
  lastUpdate: string | null;
};

export type SheetCell = string | number | boolean | null;
export type SheetRow = Record<string, SheetCell>;
export type SheetData = {
  headers: string[];
  rows: SheetRow[];
};

export const isSheetsConfigured = () => !!API;

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

export const useSheetsList = () => {
  return useQuery({
    queryKey: ["sheets-list"],
    queryFn: async (): Promise<SheetSummary[]> => {
      if (!API) throw new Error("VITE_SHEETS_API_URL não configurada");
      const data = await fetchOrThrow<{ sheets: SheetSummary[] }>(API);
      return data.sheets ?? [];
    },
    enabled: !!API,
    staleTime: 30_000,
    refetchInterval: AUTO_REFRESH_MS,
    refetchOnWindowFocus: true,
  });
};

export const useSheetData = (sheetName: string | null) => {
  return useQuery({
    queryKey: ["sheet-data", sheetName],
    queryFn: async (): Promise<SheetData> => {
      if (!API) throw new Error("VITE_SHEETS_API_URL não configurada");
      if (!sheetName) throw new Error("Selecione um formulário");
      const url = `${API}?sheet=${encodeURIComponent(sheetName)}`;
      return fetchOrThrow<SheetData>(url);
    },
    enabled: !!API && !!sheetName,
    staleTime: 15_000,
    refetchInterval: AUTO_REFRESH_MS,
    refetchOnWindowFocus: true,
  });
};
