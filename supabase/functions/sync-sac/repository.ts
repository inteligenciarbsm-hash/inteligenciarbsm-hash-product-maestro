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

// ─── Remoção de órfãos ─────────────────────────────────────────────────────────
// Mantém o banco espelhando exatamente a planilha: qualquer num_ocorrencia que
// exista em sac_ocorrencias mas não veio no lote mais recente foi apagado (ou
// renomeado) na planilha, e deve ser removido também do banco. Só roda DEPOIS
// do UPSERT ter concluído com sucesso — nunca antes.
//
// Proteção: se numerosValidos vier vazio (planilha ilegível, erro de leitura
// etc.), a remoção é abortada. Sem essa guarda, uma falha de leitura zeraria
// a tabela inteira em vez de simplesmente não sincronizar nada.

export async function removerOrfaos(
  supabase: SupabaseClient,
  numerosValidos: string[]
): Promise<{ removidos: number; numerosRemovidos: string[] }> {
  if (numerosValidos.length === 0) {
    log("WARN", "Lista de números válidos vazia — remoção de órfãos abortada por segurança");
    return { removidos: 0, numerosRemovidos: [] };
  }

  const { data: existentes, error: erroSelect } = await supabase
    .from("sac_ocorrencias")
    .select("num_ocorrencia");

  if (erroSelect) {
    throw new Error(`Erro ao listar ocorrências existentes: ${erroSelect.message}`);
  }

  const validosSet = new Set(numerosValidos);
  const orfaos = (existentes ?? [])
    .map((r) => r.num_ocorrencia as string)
    .filter((numero) => !validosSet.has(numero));

  if (orfaos.length === 0) {
    log("INFO", "Nenhuma ocorrência órfã encontrada");
    return { removidos: 0, numerosRemovidos: [] };
  }

  log("INFO", "Removendo ocorrências órfãs", { total: orfaos.length, numeros: orfaos });

  const { error: erroDelete } = await supabase
    .from("sac_ocorrencias")
    .delete()
    .in("num_ocorrencia", orfaos);

  if (erroDelete) {
    throw new Error(`Erro ao remover ocorrências órfãs: ${erroDelete.message}`);
  }

  log("INFO", "Remoção de órfãos concluída", { removidos: orfaos.length });
  return { removidos: orfaos.length, numerosRemovidos: orfaos };
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
