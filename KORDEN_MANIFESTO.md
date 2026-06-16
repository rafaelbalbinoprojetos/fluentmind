# KORDEN Manifesto

Este documento resume a stack, as convencoes e os pontos importantes do projeto KORDEN para orientar manutencao e evolucao por engenheiros de software.

## Stack

- Frontend: React 19 com Vite 7.
- Build e dev server: Vite.
- Roteamento: `react-router-dom`.
- Estilizacao: Tailwind CSS, CSS global em `src/index.css` e estilos locais em arquivos como `src/App.css`.
- UI e interacao: `lucide-react`, `framer-motion`, `react-hot-toast`.
- Graficos: `echarts` e `echarts-for-react`.
- Backend serverless: funcoes Node.js em `api/`, preparadas para Vercel.
- Banco, autenticacao e storage logico: Supabase via `@supabase/supabase-js`.
- Inteligencia artificial: OpenAI via pacote `openai`.
- Pagamentos: Mercado Pago, com checkout e webhook em `api/mercadopago/`.
- Testes: Vitest com Testing Library.
- Qualidade: ESLint 9.
- Deploy: Vercel, configurado por `vercel.json`.

## Estrutura principal

- `src/App.jsx`: define as rotas publicas e protegidas.
- `src/main.jsx`: ponto de entrada do React.
- `src/layout/Layout.jsx`: layout autenticado principal, navegacao e notificacoes.
- `src/pages/`: telas de produto, login, dashboard, despesas, rendas, investimentos, biblioteca, radar, configuracoes e paginas legais.
- `src/components/`: componentes reutilizaveis de interface.
- `src/context/`: providers globais, como autenticacao e tema.
- `src/services/`: camada de acesso a dados no Supabase.
- `src/utils/`: funcoes puras de formatacao, formularios, datas, erros e calculos.
- `src/lib/`: clientes e integracoes base, como Supabase.
- `src/data/`: constantes de navegacao, planos e universo do radar.
- `api/`: endpoints serverless usados pelo frontend e por integracoes externas.
- `api/_utils/`: utilitarios compartilhados entre endpoints serverless.
- `supabase/`: scripts SQL de schema e migracoes manuais.
- `public/` e `src/documents/`: assets estaticos e documentos da aplicacao.

## Fluxo geral do sistema

O KORDEN e uma aplicacao financeira pessoal. O frontend React renderiza telas autenticadas dentro de `Layout`, enquanto rotas sensiveis passam por `ProtectedRoute`. A sessao do usuario e controlada pelo Supabase Auth em `AuthContext`.

Dados de negocio sao gravados e lidos principalmente pelos arquivos em `src/services/`. Esses servicos encapsulam tabelas do Supabase, como `expenses`, `incomes`, `carteira`, `contas_fixas`, `credit_cards`, `overtime_hours`, `ultra_access_grants`, `mercadopago_payments`, `historico_precos` e tabelas do radar.

As APIs em `api/` rodam no ambiente serverless. Elas concentram logicas que exigem segredo de servidor ou integracoes externas: OpenAI, Mercado Pago, atualizacao de cotacoes, transcricao, leitura de extratos, radar diario e controle de uso de IA.

## Autenticacao e autorizacao

- O cliente Supabase do frontend fica em `src/lib/supabase.js` e usa `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- APIs serverless usam credenciais de servidor, como `SUPABASE_URL` e `SUPABASE_SERVICE_KEY`.
- `api/_utils/auth.js` valida tokens Bearer enviados pelo frontend.
- `AuthContext` centraliza `user`, `session`, login, logout, plano, trial, acesso premium e acesso vitalicio.
- `src/config/accessControl.js` e `api/_utils/accessControl.js` definem emails master e regras de acesso ultra.

## IA e limites de uso

- `api/chat.js` e o assistente financeiro principal.
- O chat usa OpenAI com function calling legado (`functions` e `function_call`) para registrar despesas, rendas, investimentos, horas extras e consultar resumos.
- `api/insights.js` gera insights financeiros com base em dados do usuario.
- `api/transcribe.js` processa audio.
- `api/statement.js` processa extratos/PDFs e tenta extrair transacoes.
- `api/_utils/aiUsage.js` controla limites por plano e consumo de recursos de IA.

## Pagamentos e acesso premium

- `api/mercadopago/checkout.js` cria preferencias de checkout.
- `api/mercadopago/webhook.js` recebe eventos do Mercado Pago, registra auditoria e atualiza acesso/plano.
- `src/lib/mercadoPago.js`, `src/services/mercadoPagoPayments.js` e componentes de planos conectam a UI ao fluxo de pagamento.
- Acesso ultra/premium tambem pode ser gerenciado por `api/ultra-access/*` e `src/services/ultraAccess.js`.

## Regras de nomenclatura

### Arquivos

- Paginas React usam PascalCase com sufixo conceitual de pagina quando exportadas: `Dashboard.jsx`, `InvestmentCreate.jsx`, `PasswordRecovery.jsx`.
- Componentes reutilizaveis usam PascalCase: `ProtectedRoute.jsx`, `SettingsMenu.jsx`, `PremiumPlansModal.jsx`.
- Contextos usam PascalCase com `Context`: `AuthContext.jsx`, `ThemeContext.jsx`.
- Services usam camelCase ou nomes de dominio no plural: `expenses.js`, `fixedBills.js`, `marketRadar.js`, `mercadoPagoPayments.js`.
- Utils usam nomes curtos por responsabilidade: `formatters.js`, `forms.js`, `authErrors.js`.
- APIs serverless usam kebab-case quando ha rota composta: `update-quotes.js`, `generate-daily.js`, `ultra-access/confirm.js`.

### Componentes React

- Componentes devem usar PascalCase.
- Paginas exportadas geralmente seguem o padrao `NomePage`, por exemplo `LandingPage`, `SettingsPage`, `InvestmentsPage`.
- Componentes internos auxiliares tambem usam PascalCase quando retornam JSX, por exemplo `SummaryCard`, `InsightCard`, `RadarCard`.
- Hooks customizados devem usar prefixo `use`, como `useAuth` e `useTheme`.

### Funcoes

- Funcoes comuns usam camelCase.
- Funcoes booleanas devem preferir prefixos semanticos como `is`, `has`, `can` ou `should`: `isMasterEmail`, `hasUltraAccess`, `canStartTrial`.
- Funcoes de normalizacao usam prefixo `normalize`: `normalizePlan`, `normalizeAssetSymbol`, `normalizeDateForSupabase`.
- Funcoes de formatacao usam prefixo `format`: `formatCurrency`, `formatDate`, `formatPercent`.
- Funcoes de parsing usam prefixo `parse`: `parseBody`, `parseNumeric`, `parseDecimalInput`.
- Funcoes de construcao usam prefixo `build`: `buildChartOption`, `buildGeneratedFeed`, `buildPersonalizedNotifications`.
- Funcoes de resolucao usam prefixo `resolve`: `resolveAiPlan`, `resolvePortfolioClass`.
- Funcoes de leitura/listagem usam prefixo `list` ou `fetch`: `listExpenses`, `fetchUltraAccessPass`, `listPortfolioPositions`.
- Funcoes de escrita seguem verbos CRUD: `createExpense`, `updateExpense`, `deleteExpense`, `upsertPortfolioSnapshot`.
- Handlers internos de API usam prefixo `handle`: `handleCreateExpense`, `handleFinancialSummary`.

### Constantes

- Constantes globais ou de configuracao usam UPPER_SNAKE_CASE: `API_BASE`, `CHECKOUT_ENDPOINT`, `DEFAULT_PLAN_ID`, `TABLE`.
- Mapas e colecoes estaticas tambem usam UPPER_SNAKE_CASE quando sao configuracao de modulo: `EXPENSE_CATEGORIES`, `PLAN_DETAILS`, `RADAR_UNIVERSE`.
- Variaveis locais e estados React usam camelCase.

### Banco e payloads

- Campos vindos do Supabase e payloads persistidos usam snake_case quando refletem colunas: `user_id`, `payment_method`, `trial_expires_at`, `granted_by_email`.
- No codigo React, nomes de variaveis tendem a ser camelCase. Ao montar payload para Supabase, converter explicitamente para o nome da coluna.

## Convencoes importantes

- Nao acessar Supabase diretamente nas paginas quando ja existir service em `src/services/`; manter a regra de negocio concentrada nos services.
- Nao expor service keys no frontend. Variaveis com `SUPABASE_SERVICE_KEY`, `OPENAI_API_KEY` e tokens do Mercado Pago pertencem ao ambiente serverless.
- Variaveis expostas ao Vite precisam usar prefixo `VITE_`.
- Datas persistidas devem usar ISO quando possivel. Utilitarios de data e formulario devem ser reutilizados.
- Valores monetarios devem ser formatados com `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })` ou helpers existentes.
- APIs devem validar metodo HTTP e responder com status coerente.
- APIs autenticadas devem usar `requireUser(req)` quando operam dados do usuario.
- Erros de Supabase devem ser tratados e convertidos em mensagens claras para a UI.
- Ao adicionar uma nova area de negocio, criar service dedicado em `src/services/`, pagina em `src/pages/`, rota em `src/App.jsx` e item de navegacao em `src/data/navigation.js` quando aplicavel.
- Ao adicionar tabela nova, incluir SQL correspondente em `supabase/` e manter nomes de colunas consistentes com os payloads.
- Evitar duplicar categorias, planos e opcoes fixas em paginas; preferir `src/utils/constants.js`, `src/data/plans.js` ou modulo de dominio.

## Comandos uteis

```bash
npm run dev
npm run build
npm run lint
npm run test
```

## Variaveis de ambiente relevantes

- Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE`, `VITE_MERCADOPAGO_PUBLIC_KEY`, `VITE_MERCADOPAGO_LOCALE`, `VITE_BASE_CURRENCY`.
- Backend/serverless: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `MERCADOPAGO_ACCESS_TOKEN`, `BRAPI_TOKEN`, `FX_ACCESS_KEY`, `YAHOO_BATCH_SIZE`.

## Pontos de atencao

- O projeto ainda usa JavaScript/JSX, nao TypeScript.
- Existem arquivos temporarios ou legados na raiz; antes de limpar, verificar se ainda sao usados.
- Ha `package-lock.json` e `yarn.lock` ao mesmo tempo. Escolher um gerenciador de pacotes por fluxo de trabalho evita divergencias.
- O README atual ainda parece ser o README padrao do Vite; este manifesto deve ser tratado como guia inicial ate que a documentacao principal seja expandida.
- Algumas regras de negocio estao em paginas grandes, especialmente dashboard, layout, investimentos e radar. Mudancas nessas areas devem ser testadas com mais cuidado.
