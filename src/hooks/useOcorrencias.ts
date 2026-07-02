import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type {
  SacConfig,
  SacFiltros,
  SacOcorrencia,
  SacSyncLog,
} from "@/lib/sacAnalysis";

// ─── Query keys ───────────────────────────────────────────────────────────────
// Exportados para que páginas possam invalidar queries após ações externas.

export const SAC_QUERY_KEYS = {
  ocorrencias: (filtros?: SacFiltros) =>
    ["sac-ocorrencias", filtros ?? {}] as const,
  syncLog: () => ["sac-sync-log"] as const,
  config: (chave: string) => ["sac-config", chave] as const,
} as const;

// ─── Configurações de cache ───────────────────────────────────────────────────
// Dados do SAC mudam apenas na sincronização — staleTime longo reduz fetches.

const STALE_5MIN = 5 * 60_000;
const REFETCH_30MIN = 30 * 60_000; // alinhado com o intervalo de sync do pg_cron

// ─── useSacOcorrencias ────────────────────────────────────────────────────────

export const useSacOcorrencias = (filtros?: SacFiltros) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: SAC_QUERY_KEYS.ocorrencias(filtros),
    queryFn: async (): Promise<SacOcorrencia[]> => {
      let query = supabase
        .from("sac_ocorrencias")
        .select("*")
        .order("data_email", { ascending: false, nullsFirst: false });

      if (filtros?.fornecedor) query = query.eq("fornecedor", filtros.fornecedor);
      if (filtros?.produto) query = query.eq("produto", filtros.produto);
      if (filtros?.criticidade) query = query.eq("criticidade", filtros.criticidade);
      if (filtros?.dataInicio) query = query.gte("data_email", filtros.dataInicio);
      if (filtros?.dataFim) query = query.lte("data_email", filtros.dataFim);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as SacOcorrencia[];
    },
    enabled: !!user,
    staleTime: STALE_5MIN,
    refetchInterval: REFETCH_30MIN,
    refetchOnWindowFocus: false,
  });
};

// ─── useSacSyncStatus ─────────────────────────────────────────────────────────

export const useSacSyncStatus = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: SAC_QUERY_KEYS.syncLog(),
    queryFn: async (): Promise<SacSyncLog | null> => {
      const { data, error } = await supabase
        .from("sac_sync_log")
        .select("*")
        .order("iniciado_em", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return (data as SacSyncLog | null) ?? null;
    },
    enabled: !!user,
    staleTime: STALE_5MIN,
    refetchInterval: REFETCH_30MIN,
    refetchOnWindowFocus: false,
  });
};

// ─── useSacConfig ─────────────────────────────────────────────────────────────

export const useSacConfig = (chave: string, defaultValue?: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: SAC_QUERY_KEYS.config(chave),
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("system_config")
        .select("valor")
        .eq("chave", chave)
        .maybeSingle();

      if (error) throw error;
      return (data as Pick<SacConfig, "valor"> | null)?.valor ?? defaultValue ?? null;
    },
    enabled: !!user,
    staleTime: 10 * 60_000, // configs mudam raramente
    refetchOnWindowFocus: false,
  });
};

// ─── useSacSync ───────────────────────────────────────────────────────────────
// Dispara a Edge Function manualmente e invalida os dados após conclusão.

export const useSacSync = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<{ ok: boolean; erro?: string }> => {
      const { data, error } = await supabase.functions.invoke("sync-sac");
      if (error) throw error;
      return data as { ok: boolean; erro?: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sac-ocorrencias"] });
      queryClient.invalidateQueries({ queryKey: SAC_QUERY_KEYS.syncLog() });
    },
  });
};
