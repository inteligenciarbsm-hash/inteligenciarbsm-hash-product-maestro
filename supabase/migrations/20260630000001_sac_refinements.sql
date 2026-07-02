-- =============================================================================
-- Central SAC — Refinamentos da infraestrutura
-- =============================================================================
-- Ajustes sobre 20260630000000_sac_central.sql:
--   1. sac_sync_log     — schema aprimorado com métricas detalhadas de sync
--   2. system_config    — tabela de configurações do módulo sem alterar código
--
-- Por que recriar sac_sync_log em vez de ALTER TABLE:
--   Nenhum dado foi inserido ainda; DROP + CREATE é mais limpo e evita
--   incompatibilidade de NOT NULL em colunas novas.
-- =============================================================================


-- ─── 1. sac_sync_log — recriar com schema aprimorado ────────────────────────

DROP TABLE IF EXISTS public.sac_sync_log;

CREATE TABLE public.sac_sync_log (

  id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Janela de tempo da execução
  iniciado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalizado_em       TIMESTAMPTZ,
  duracao_ms          INTEGER,

  -- Resultado geral
  status              TEXT        NOT NULL CHECK (status IN ('ok', 'parcial', 'falha')),

  -- Contadores de linhas
  linhas_lidas        INTEGER     NOT NULL DEFAULT 0,  -- com num_ocorrencia preenchido
  linhas_importadas   INTEGER     NOT NULL DEFAULT 0,  -- parseadas sem erro
  linhas_atualizadas  INTEGER     NOT NULL DEFAULT 0,  -- efetivamente escritas no banco
  linhas_ignoradas    INTEGER     NOT NULL DEFAULT 0,  -- sem num_ocorrencia (linhas em branco, totais)
  linhas_com_erro     INTEGER     NOT NULL DEFAULT 0,  -- falha de parse

  -- Mensagem de erro quando status != 'ok'
  erro                TEXT

);

ALTER TABLE public.sac_sync_log ENABLE ROW LEVEL SECURITY;

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

CREATE INDEX IF NOT EXISTS idx_sac_sync_log_iniciado
  ON public.sac_sync_log (iniciado_em DESC);


-- ─── 2. system_config — configurações do módulo ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.system_config (

  chave          TEXT        NOT NULL PRIMARY KEY,
  valor          TEXT,
  descricao      TEXT,
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()

);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Usuários aprovados leem as configs (necessário para a UI exibir parâmetros)
DROP POLICY IF EXISTS "Approved users can read system_config" ON public.system_config;
CREATE POLICY "Approved users can read system_config"
  ON public.system_config FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND approved = true
    )
  );

-- Escrita somente via service_role (Edge Function e migrações) — sem política de UPDATE

-- Valores iniciais do módulo SAC
INSERT INTO public.system_config (chave, valor, descricao) VALUES
  (
    'sac.sheet_name',
    'SAC 2026',
    'Nome da aba do Excel com as ocorrências do SAC. Atualizar a cada virada de ano.'
  ),
  (
    'sac.sync_interval_minutes',
    '30',
    'Intervalo de sincronização automática em minutos (referência para o pg_cron job).'
  ),
  (
    'sac.sla_dias_resolucao',
    '30',
    'Meta de prazo de resolução em dias, usado para cálculo do SLA no dashboard.'
  )
ON CONFLICT (chave) DO NOTHING;


-- =============================================================================
-- SECRETS DA EDGE FUNCTION — atualização em relação à migration anterior
-- =============================================================================
-- GRAPH_WORKBOOK_URL foi substituído por três parâmetros independentes.
-- Remover o secret antigo (se já tiver sido configurado) e adicionar os novos:
--
--   supabase secrets unset GRAPH_WORKBOOK_URL
--
--   supabase secrets set GRAPH_SITE_ID="<site-id-do-sharepoint>"
--   supabase secrets set GRAPH_DRIVE_ID="<drive-id-do-sharepoint>"   ← opcional se SITE_ID fornecido
--   supabase secrets set GRAPH_ITEM_ID="<item-id-do-arquivo-excel>"
--
-- Como obter os IDs via Graph Explorer (developer.microsoft.com/graph/graph-explorer):
--
--   GRAPH_SITE_ID:  GET /v1.0/sites?search=rbrasil
--                   → copiar campo "id" do site correspondente
--
--   GRAPH_DRIVE_ID: GET /v1.0/sites/{site_id}/drives
--                   → copiar campo "id" do drive que contém o arquivo
--
--   GRAPH_ITEM_ID:  GET /v1.0/drives/{drive_id}/root/search(q='SAC 2026')
--                   → copiar campo "id" do arquivo Excel
--
-- GRAPH_SHEET_NAME foi movido para system_config (chave: 'sac.sheet_name').
-- Não é mais necessário como secret.
-- =============================================================================
