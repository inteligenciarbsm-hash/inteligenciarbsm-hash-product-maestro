-- =============================================================================
-- Central SAC — Infraestrutura do banco de dados
-- =============================================================================
-- Cria:
--   1. sac_ocorrencias  — ocorrências sincronizadas do Excel (SharePoint)
--   2. sac_sync_log     — log de cada execução da Edge Function
--   3. Índices          — performance das queries do dashboard
--   4. RLS + políticas  — leitura restrita a usuários aprovados
--
-- Pré-requisitos:
--   • Extension pg_net ativa (já habilitada em 20260505000000_user_approval.sql)
--   • Edge Function "sync-sac" implantada:
--       supabase functions deploy sync-sac
--   • Secrets da Edge Function configurados (ver seção no final deste arquivo):
--       GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET,
--       GRAPH_WORKBOOK_URL, GRAPH_SHEET_NAME
--
-- Para pg_cron (agendamento automático, opcional):
--   • Habilitar extensão: Supabase Dashboard → Database → Extensions → pg_cron
--   • Executar o bloco comentado no final deste arquivo
-- =============================================================================


-- ─── 1. Tabela principal ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sac_ocorrencias (

  -- Chave
  id                        UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Chave natural vinda do Excel — garante idempotência no UPSERT
  num_ocorrencia            TEXT        NOT NULL UNIQUE,

  -- Identificação da reclamação
  data_email                DATE,
  produto                   TEXT,
  fornecedor                TEXT,
  associado                 TEXT,
  tipo_ocorrencia           TEXT,
  criticidade               TEXT,
  ocorrencia_descricao      TEXT,

  -- Rastreabilidade do produto
  lote                      TEXT,
  data_fabricacao           DATE,
  data_validade             DATE,

  -- Dados do consumidor (PII — armazenados para operação, nunca exibidos no dashboard)
  nome_consumidor           TEXT,
  tel_consumidor            TEXT,
  email_consumidor          TEXT,
  endereco_consumidor       TEXT,

  -- Marcos de resolução (preenchido = etapa concluída; null = pendente)
  fornecedor_comunicado_em  DATE,
  associado_comunicado_em   DATE,
  ressarcimento_em          DATE,
  rnc_finalizado_em         DATE,

  -- KPI direto do Excel (fórmula: rnc_finalizado - data_email)
  dias_resolucao            INTEGER,

  -- Campo livre
  observacao                TEXT,

  -- Controle interno
  sincronizado_em           TIMESTAMPTZ NOT NULL DEFAULT now()

);


-- ─── 2. Tabela de log de sincronização ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sac_sync_log (

  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  executado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 'ok' = tudo sincronizado | 'parcial' = sync com erros em algumas linhas | 'falha' = sync abortou
  status        TEXT        NOT NULL CHECK (status IN ('ok', 'parcial', 'falha')),

  total_linhas  INTEGER,
  atualizados   INTEGER,

  -- Mensagem de erro simples (uma por linha para múltiplos erros)
  erros         TEXT

);


-- ─── 3. Índices ─────────────────────────────────────────────────────────────

-- Gráfico de tendência temporal (eixo X do dashboard)
CREATE INDEX IF NOT EXISTS idx_sac_data_email
  ON public.sac_ocorrencias (data_email);

-- Rankings: fornecedores e produtos com mais ocorrências
CREATE INDEX IF NOT EXISTS idx_sac_fornecedor
  ON public.sac_ocorrencias (fornecedor);

CREATE INDEX IF NOT EXISTS idx_sac_produto
  ON public.sac_ocorrencias (produto);

-- Filtro de alertas críticos
CREATE INDEX IF NOT EXISTS idx_sac_criticidade
  ON public.sac_ocorrencias (criticidade);

-- Distinção aberta/encerrada (campo NULL = aberta, preenchido = encerrada)
CREATE INDEX IF NOT EXISTS idx_sac_rnc_finalizado
  ON public.sac_ocorrencias (rnc_finalizado_em);

-- Agrupamento por loja/sócio
CREATE INDEX IF NOT EXISTS idx_sac_associado
  ON public.sac_ocorrencias (associado);

-- Log: query de "último sync bem-sucedido"
CREATE INDEX IF NOT EXISTS idx_sac_sync_log_executado
  ON public.sac_sync_log (executado_em DESC);


-- ─── 4. Row Level Security ──────────────────────────────────────────────────

ALTER TABLE public.sac_ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sac_sync_log    ENABLE ROW LEVEL SECURITY;

-- Leitura restrita a usuários autenticados e aprovados.
-- A Edge Function escreve com service_role (bypassa RLS — sem política de escrita necessária).

DROP POLICY IF EXISTS "Approved users can read sac_ocorrencias" ON public.sac_ocorrencias;
CREATE POLICY "Approved users can read sac_ocorrencias"
  ON public.sac_ocorrencias FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND approved = true
    )
  );

DROP POLICY IF EXISTS "Approved users can read sac_sync_log" ON public.sac_sync_log;
CREATE POLICY "Approved users can read sac_sync_log"
  ON public.sac_sync_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND approved = true
    )
  );


-- =============================================================================
-- 5. SECRETS DA EDGE FUNCTION — configurar via CLI antes de implantar
-- =============================================================================
-- Execute no terminal (nunca commitar esses valores):
--
--   supabase secrets set GRAPH_TENANT_ID="<tenant-id-do-azure-ad>"
--   supabase secrets set GRAPH_CLIENT_ID="<client-id-do-app-registration>"
--   supabase secrets set GRAPH_CLIENT_SECRET="<client-secret-gerado-no-azure>"
--   supabase secrets set GRAPH_WORKBOOK_URL="https://graph.microsoft.com/v1.0/sites/<site-id>/drive/items/<item-id>/workbook"
--   supabase secrets set GRAPH_SHEET_NAME="SAC 2026"
--
-- Como obter GRAPH_WORKBOOK_URL:
--   1. Abrir o arquivo Excel no SharePoint no navegador
--   2. Copiar a URL e extrair o "site-id" e o "item-id" da URL
--   3. Ou usar o Graph Explorer (developer.microsoft.com/graph/graph-explorer)
--      para navegar até o arquivo e copiar o campo "id" do item
--
-- Permissão mínima necessária no App Registration:
--   Files.Read (escopo de aplicação, não delegado)
--   — solicitar à TI da empresa
-- =============================================================================


-- =============================================================================
-- 6. pg_cron — agendamento automático (executar MANUALMENTE após implantar a Edge Function)
-- =============================================================================
-- Pré-requisito: habilitar pg_cron no Supabase Dashboard → Database → Extensions
--
-- Após habilitar, executar no SQL Editor do Supabase (substituir <SERVICE_ROLE_KEY>
-- pelo valor em: Supabase Dashboard → Project Settings → API → service_role):
--
-- SELECT cron.schedule(
--   'sync-sac-30min',
--   '*/30 * * * *',
--   $$
--   SELECT net.http_post(
--     url     := 'https://sczwfpxggagesfvvqktb.supabase.co/functions/v1/sync-sac',
--     headers := jsonb_build_object(
--       'Content-Type',  'application/json',
--       'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
--     ),
--     body    := '{}'::jsonb
--   ) AS request_id;
--   $$
-- );
--
-- Para verificar jobs agendados:   SELECT * FROM cron.job;
-- Para remover este job:           SELECT cron.unschedule('sync-sac-30min');
-- =============================================================================
