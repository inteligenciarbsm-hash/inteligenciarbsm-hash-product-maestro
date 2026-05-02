-- Tabela de chamados (SAC) — vincula reclamações/dúvidas/sugestões a produtos da marca própria.
CREATE TABLE public.tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  store TEXT,
  order_number TEXT,
  category TEXT NOT NULL DEFAULT 'outros'
    CHECK (category IN ('defeito','embalagem','falta_item','duvida','sugestao','outros')),
  priority TEXT NOT NULL DEFAULT 'media'
    CHECK (priority IN ('baixa','media','alta')),
  status TEXT NOT NULL DEFAULT 'aberto'
    CHECK (status IN ('aberto','em_andamento','resolvido','cancelado')),
  description TEXT NOT NULL,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tickets"
  ON public.tickets FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tickets"
  ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tickets"
  ON public.tickets FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tickets"
  ON public.tickets FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER tickets_set_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX tickets_user_id_idx ON public.tickets(user_id);
CREATE INDEX tickets_product_id_idx ON public.tickets(product_id);
CREATE INDEX tickets_status_idx ON public.tickets(status);
CREATE INDEX tickets_created_at_idx ON public.tickets(created_at DESC);
