-- =============================================================================
-- Central SAC — Coluna ENDEREÇO LOJA
-- =============================================================================
-- A planilha do Google Sheets passou a ter duas colunas separadas onde antes
-- havia uma só: ASSOCIADO/SÓCIO (nome do sócio/loja) e ENDEREÇO LOJA (endereço
-- físico da loja). Esta migration adiciona a coluna nova; associado já existe
-- desde 20260630000000_sac_central.sql e continua mapeando o nome do sócio.
-- =============================================================================

ALTER TABLE public.sac_ocorrencias
  ADD COLUMN IF NOT EXISTS endereco_loja TEXT;
