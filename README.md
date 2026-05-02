# Product Maestro

Painel para cadastro e gestão de produtos. Construído com Vite, React, TypeScript, shadcn/ui, Tailwind CSS e Supabase.

## Stack

- **Vite** + **React 18** + **TypeScript**
- **shadcn/ui** + **Radix UI** + **Tailwind CSS** — UI
- **React Router** — roteamento
- **TanStack Query** — fetching e cache
- **React Hook Form** + **Zod** — formulários e validação
- **Supabase** — autenticação e banco (Postgres com RLS)
- **Vitest** + **Testing Library** — testes

## Configuração

Crie um arquivo `.env` na raiz com as credenciais do seu projeto Supabase:

```bash
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<anon ou publishable key>"
VITE_SUPABASE_PROJECT_ID="<project-ref>"
```

A migração inicial está em `supabase/migrations/` — rode-a no SQL Editor do dashboard antes de subir o app.

## Como rodar localmente

```bash
npm install
npm run dev      # servidor de dev na porta 8080
npm run build    # build de produção
npm run preview  # preview do build
npm test         # testes
npm run lint     # ESLint
```

## Estrutura

```
src/
├── components/      # componentes da aplicação (incluindo shadcn/ui)
├── contexts/        # AuthContext
├── hooks/           # useProducts e demais
├── integrations/    # client Supabase + tipos
├── lib/             # utilitários
├── pages/           # rotas (Auth, Products, NotFound)
└── test/            # configuração de testes
supabase/
├── config.toml
└── migrations/
```
