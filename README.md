# Drive IA

Copiloto financeiro para motoristas de aplicativo: corridas, custos, lucro real, metas e análise por IA.

Stack: React + Vite + TypeScript + Tailwind/shadcn · Supabase (banco, login e Edge Functions) · Cloudflare Pages (hospedagem).

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/` | Aplicativo web |
| `supabase/migrations/` | Esquema completo do banco (um único script, reexecutável) |
| `supabase/functions/groq-analysis` | Análise por IA (Groq) com controle de plano e intervalo |
| `supabase/functions/admin-confirm-email` | Confirmação de e-mail pelo administrador |

## Configuração

1. **Banco**: no Supabase, abra *SQL Editor* e execute `supabase/migrations/20261116000000_drive_ia_schema.sql`.
2. **Segredos das funções** (*Edge Functions > Secrets*): `GROQ_API_KEY`.
3. **Login** (*Authentication > URL Configuration*): informe o endereço do site em *Site URL* e adicione `https://SEU-DOMINIO/redefinir-senha` em *Redirect URLs*.
4. **Variáveis do site**: `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (veja `.env.example`).

## Rodar localmente

```bash
npm install
cp .env.example .env   # preencha com os dados do seu projeto
npm run dev
```

## Publicar no Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`
- Variáveis: as duas `VITE_...` acima
- `public/_redirects` já garante que as rotas do app funcionem ao recarregar a página.

## Testes

```bash
npm test
```
