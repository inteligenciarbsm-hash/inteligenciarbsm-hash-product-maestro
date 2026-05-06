-- =============================================================================
-- ZUPPA — Sistema de aprovação manual de usuários
-- =============================================================================
-- Cria tabela user_profiles, RLS, trigger automático após cadastro,
-- função RPC pra aprovar via token, e gatilho de e-mail via Resend.
--
-- Pré-requisitos:
--   1. Conta Resend (resend.com) com API key
--   2. Extensions: pg_net (para HTTP), supabase_vault (para guardar segredos)
--      Habilitar no painel Supabase → Database → Extensions
--   3. Substituir placeholders no final deste arquivo:
--      - <RESEND_API_KEY>
--      - <ADMIN_EMAIL>
--      - <APP_URL>
-- =============================================================================

-- 1) Habilita pg_net (precisa estar ativo)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2) Tabela user_profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT false,
  approval_token UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Cada usuário pode ler somente o próprio perfil (pra app saber se foi aprovado)
DROP POLICY IF EXISTS "Users read own profile" ON public.user_profiles;
CREATE POLICY "Users read own profile"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Não permitimos INSERT/UPDATE via app — só via service_role e via RPC controlada
-- (RPC approve_user_by_token usa SECURITY DEFINER pra bypassar RLS).

-- 3) Trigger: ao criar usuário em auth.users, criar user_profile
CREATE OR REPLACE FUNCTION public.create_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, approved)
  VALUES (NEW.id, NEW.email, false)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_user_profile();

-- 4) Grandfathering: usuários que já existem entram aprovados
INSERT INTO public.user_profiles (id, email, approved)
SELECT id, email, true
FROM auth.users
ON CONFLICT (id) DO UPDATE SET approved = true;

-- 5) RPC pra aprovar via token (chamada pela página /aprovar)
CREATE OR REPLACE FUNCTION public.approve_user_by_token(p_token UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  UPDATE public.user_profiles
     SET approved = true
   WHERE approval_token = p_token
     AND approved = false
  RETURNING email INTO v_email;

  RETURN v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_user_by_token(UUID) TO anon, authenticated;

-- 6) Função que envia e-mail ao admin via Resend
CREATE OR REPLACE FUNCTION public.notify_admin_new_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_resend_key TEXT;
  v_admin_email TEXT;
  v_app_url TEXT;
  v_subject TEXT;
  v_html TEXT;
BEGIN
  -- Lê os 3 segredos do Vault
  SELECT decrypted_secret INTO v_resend_key
  FROM vault.decrypted_secrets WHERE name = 'resend_api_key' LIMIT 1;

  SELECT decrypted_secret INTO v_admin_email
  FROM vault.decrypted_secrets WHERE name = 'admin_email' LIMIT 1;

  SELECT decrypted_secret INTO v_app_url
  FROM vault.decrypted_secrets WHERE name = 'app_url' LIMIT 1;

  IF v_resend_key IS NULL OR v_admin_email IS NULL OR v_app_url IS NULL THEN
    RAISE WARNING 'Secrets de notificação não configurados — pulando e-mail';
    RETURN NEW;
  END IF;

  IF NEW.approved THEN
    RETURN NEW; -- Não notifica grandfathered ou re-aprovações
  END IF;

  v_subject := 'ZUPPA: novo cadastro pendente — ' || NEW.email;
  v_html := '<div style="font-family: -apple-system, sans-serif; padding: 20px;">' ||
            '<h2>Novo cadastro pendente</h2>' ||
            '<p>O usuário <strong>' || NEW.email || '</strong> está aguardando aprovação.</p>' ||
            '<p style="margin: 24px 0;">' ||
            '<a href="' || v_app_url || '/aprovar?token=' || NEW.approval_token || '" ' ||
            'style="background:#0E2A5C;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">' ||
            'Aprovar acesso</a></p>' ||
            '<p style="font-size:12px;color:#666">Se não foi você quem solicitou, ignore esta mensagem.</p>' ||
            '</div>';

  PERFORM extensions.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_resend_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', 'ZUPPA <onboarding@resend.dev>',
      'to', v_admin_email,
      'subject', v_subject,
      'html', v_html
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profile_notify ON public.user_profiles;
CREATE TRIGGER user_profile_notify
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW
  WHEN (NEW.approved = false)
  EXECUTE FUNCTION public.notify_admin_new_signup();

-- =============================================================================
-- 7) CONFIGURAÇÃO DOS SEGREDOS — você precisa rodar isto MANUALMENTE,
--    substituindo os 3 valores pelos seus reais.
--    NÃO commitar esses valores no Git.
-- =============================================================================
-- INSERT INTO vault.secrets (name, secret) VALUES ('resend_api_key', 're_xxxxxxxx');
-- INSERT INTO vault.secrets (name, secret) VALUES ('admin_email', 'danilo.oliveira@rbsm.com.br');
-- INSERT INTO vault.secrets (name, secret) VALUES ('app_url', 'https://inteligenciarbsm-hash-product-maest.vercel.app');
--
-- Pra atualizar depois:
-- UPDATE vault.secrets SET secret = 'novo_valor' WHERE name = 'resend_api_key';
-- =============================================================================

-- 8) Drop das tabelas antigas que não fazem mais parte do escopo
DROP TABLE IF EXISTS public.tickets CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
