import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { log } from "./logger.ts";
import type { OcorrenciaInsert } from "./mapper.ts";

// ─── Tipo do registro de log ──────────────────────────────────────────────────

export type SyncLogInsert = {
  iniciado_em: string;
  finalizado_em: string;
  duracao_ms: number;
  status: "ok" | "parcial" | "falha";
  linhas_lidas: number;
  linhas_importadas: number;
  linhas_atualizadas: number;
  linhas_ignoradas: number;
  linhas_com_erro: number;
  erro: string | null;
};

// ─── Configurações ────────────────────────────────────────────────────────────

export async function getConfig(
  supabase: SupabaseClient,
  chave: string,
  defaultValue?: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("system_config")
    .select("valor")
    .eq("chave", chave)
    .maybeSingle();

  if (error) {
    log("WARN", `Falha ao ler configuração`, { chave, erro: error.message });
    return defaultValue ?? null;
  }

  const valor = data?.valor ?? defaultValue ?? null;
  log("INFO", "Configuração lida", { chave, valor });
  return valor;
}

// ─── Operações de dados ───────────────────────────────────────────────────────

export async function upsertOcorrencias(
  supabase: SupabaseClient,
  ocorrencias: OcorrenciaInsert[]
): Promise<number> {
  if (ocorrencias.length === 0) return 0;

  log("INFO", "Iniciando UPSERT", { total: ocorrencias.length });

  const { error } = await supabase
    .from("sac_ocorrencias")
    .upsert(ocorrencias, { onConflict: "num_ocorrencia" });

  if (error) {
    throw new Error(`Erro no UPSERT: ${error.message}`);
  }

  log("INFO", "UPSERT concluído", { atualizadas: ocorrencias.length });
  return ocorrencias.length;
}

// ─── Log de sincronização ─────────────────────────────────────────────────────

export async function insertSyncLog(
  supabase: SupabaseClient,
  data: SyncLogInsert
): Promise<void> {
  const { error } = await supabase.from("sac_sync_log").insert(data);

  if (error) {
    // Não relança — o log é best-effort para não mascarar o erro original
    log("ERROR", "Falha ao inserir log de sync", { erro: error.message });
  } else {
    log("INFO", "Log de sync registrado", {
      status: data.status,
      duracao_ms: data.duracao_ms,
      linhas_atualizadas: data.linhas_atualizadas,
    });
  }
}
