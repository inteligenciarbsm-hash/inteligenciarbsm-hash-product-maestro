# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Start dev server on port 8080
npm run build         # Production build
npm run build:dev     # Dev mode build
npm run preview       # Preview production build
npm run lint          # ESLint check
npm run test          # Run tests once
npm run test:watch    # Run tests in watch mode
```

To run a single test file:
```bash
npx vitest run src/path/to/test.spec.tsx
```

## Architecture

**Product Maestro** is a product management SPA built with React 18 + TypeScript + Vite. It uses Supabase for the backend (PostgreSQL with RLS), though the current UI layer operates with in-memory React state and is wired up but not yet fully connected to Supabase.

### Routing & Entry Points

- `src/main.tsx` — React root, mounts `<App />`
- `src/App.tsx` — Sets up `QueryClient`, `TooltipProvider`, toast providers, and React Router routes
- `src/pages/` — One file per route: `Index` (landing), `Products` (CRUD panel), `NotFound`

### Data Layer

- `src/integrations/supabase/client.ts` — Supabase client (reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from `.env`)
- `src/integrations/supabase/types.ts` — Auto-generated DB types; do not hand-edit
- `supabase/migrations/` — SQL migrations; the `products` table has user-scoped RLS policies
- TanStack Query (`@tanstack/react-query`) is the intended data-fetching layer for Supabase calls

### Component Conventions

- `src/components/ui/` — shadcn/ui components (Radix UI primitives + Tailwind); treat these as library code
- Custom app components live directly in `src/components/`
- All components use the `cn()` helper from `src/lib/utils.ts` for conditional Tailwind classes
- Design tokens (colors, radius, etc.) are defined as HSL CSS variables in `src/index.css` — reference them by token name, not raw hex

### Forms & Validation

React Hook Form + Zod everywhere. Define a `z.object()` schema, derive the TypeScript type with `z.infer<>`, pass to `useForm<>` via `zodResolver`.

### Path Aliases

`@/` maps to `src/`. Use it for all internal imports.

### Testing

Vitest + Testing Library with jsdom. Test setup lives in `src/test/setup.ts`. Tests sit alongside source files or in `src/test/`.
