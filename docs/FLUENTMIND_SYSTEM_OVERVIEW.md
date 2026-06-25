# FluentMind - Visao Geral do Sistema

Ultima atualizacao: 2026-06-24

## Identidade do produto

**Nome:** FluentMind

**Slogan:** Stop translating. Start thinking.

**Metodo:** MindBlocks Method

**Conceito:** plataforma de aprendizado de idiomas focada em pensar diretamente no idioma alvo por meio de conversas com IA, blocos mentais de expressoes, revisao inteligente, playlists, audio, erros corrigidos e progresso pessoal.

O projeto nasceu a partir do KORDEN, um sistema financeiro em React, Tailwind e Supabase. A arquitetura base foi preservada, mas a experiencia foi redirecionada para aprendizado de idiomas.

## Stack principal

- **Frontend:** React 19, Vite 7, React Router 7.
- **Estilo:** Tailwind CSS 3, CSS customizado em `src/index.css`.
- **UI/UX:** dashboard SaaS premium, tema dark como principal, responsividade desktop/tablet/mobile.
- **Icones:** `lucide-react`.
- **Graficos:** `echarts` e `echarts-for-react`.
- **Animacoes:** `framer-motion`.
- **Toasts:** `react-hot-toast`.
- **Backend serverless:** Vercel Functions em `api/`.
- **Banco de dados:** Supabase Postgres.
- **Autenticacao:** Supabase Auth.
- **Storage:** Supabase Storage para audios de MindBlocks.
- **IA texto:** OpenAI via pacote `openai`.
- **Audio/TTS:** ElevenLabs via API serverless.
- **Deploy:** Vercel conectado ao GitHub.
- **Repositorio:** `https://github.com/rafaelbalbinoprojetos/fluentmind.git`.

## Scripts do projeto

Arquivo: `package.json`

- `npm run dev`: inicia Vite local.
- `npm run build`: gera build de producao.
- `npm run lint`: executa ESLint.
- `npm run preview`: preview local do build.
- `npm run test`: executa testes Vitest.

## Estrutura geral

```text
api/
  chat.js
  mindblock-audio.js
  transcribe.js
  ultra-access.js
  _utils/

src/
  components/
    NeuralBrain.jsx
    EvolvingBrain.jsx
  context/
  data/
    achievementsMock.js
  layout/
  lib/
  pages/
  services/
    progressionEngine.js
    learningEventEngine.js
  utils/

supabase/
  corrected_mistakes.sql
  insights_schema.sql
  mindblocks_favorites.sql
  progression_and_learning_events.sql
  ultra_access_grants.sql

docs/
  FLUENTMIND_SYSTEM_OVERVIEW.md
```

## Rotas principais

Rotas publicas:

- `/`: landing page.
- `/app`: login.
- `/recuperar-senha`: recuperacao de senha.
- `/politica-de-privacidade`: politica.
- `/termos-de-uso`: termos.

Rotas protegidas por autenticacao:

- `/dashboard`: dashboard principal.
- `/daily-workout`: sessao guiada diaria de treino cerebral.
- `/biblioteca`: biblioteca de MindBlocks.
- `/playlists`: gerenciamento de playlists.
- `/insights`: revisao inteligente.
- `/chatbot`: conversa com mentor de IA.
- `/conversas`: historico e informacoes de conversas.
- `/meus-erros`: erros corrigidos.
- `/neural-universe`: visualizacao conceitual das conexoes.
- `/configuracoes`: preferencias do usuario.
- `/usuarios`: gerenciamento de usuarios/acesso.
- `/acesso-ultra/confirmar`: confirmacao de acesso ultra.

## Arquivos centrais do frontend

- `src/App.jsx`: definicao das rotas.
- `src/layout/Layout.jsx`: layout autenticado, sidebar, header, mobile nav e estrutura visual.
- `src/data/navigation.js`: itens de navegacao e configuracao da barra mobile.
- `src/context/AuthContext.jsx`: contexto de autenticacao Supabase.
- `src/lib/supabase.js`: inicializacao do cliente Supabase no frontend.
- `src/index.css`: estilos globais, tema, cards, chatbot, biblioteca, revisao e demais componentes.
- `src/components/NeuralBrain.jsx`: cerebro neural premium usado para representar crescimento, XP, conexoes e mastery.
- `src/components/EvolvingBrain.jsx`: visual auxiliar de progressao ligado ao motor local de XP.
- `src/hooks/useProgression.js`: hook para consumir XP, achievements, missoes e estado de evolucao.

## Paginas implementadas

### Dashboard

Arquivo: `src/components/dashboard/FluentMindDashboard.jsx`

Funcao:

- ser a tela principal de evolucao intelectual do usuario;
- reforcar a narrativa "seu cerebro esta crescendo";
- transformar estatisticas em progresso, missoes e atividade viva.

Blocos principais:

- Hero premium com saudacao personalizada, frase dinamica, level, XP, proximo nivel e barra de evolucao;
- `NeuralBrain` 3D-like em SVG com pulsacao, particulas, conexoes neurais e intensidade baseada em progresso;
- `Today's Brain Mission` com progresso, tarefas do dia e recompensas de XP;
- `Your Growth` com MindBlocks, Neural Connections, Streak e Mastery Score;
- `Brain Insights` com mensagens inteligentes sobre evolucao do usuario;
- `Your Brain Activity` com feed de eventos recentes;
- `Recent Expressions` com cards reduzidos e focados em uso rapido;
- Quick Actions no final da pagina para nao competir com o progresso.

Fontes de dados:

- Supabase: perfil, MindBlocks, playlists, revisoes e atividade diaria;
- `progressionEngine.js`: XP, level, missoes e achievements locais;
- `learningEventEngine.js`: eventos de aprendizado que alimentam feed e Neural Universe.

### Daily Brain Workout

Arquivo: `src/pages/DailyWorkout.jsx`

Funcao:

- transformar a missao da dashboard em uma sessao guiada de 5 a 8 minutos;
- revisar ate 3 MindBlocks vencidos ou de baixa mastery;
- tocar audio de uma expressao usando ElevenLabs quando houver MindBlock real;
- usar fallback de voz do navegador para treino demonstrativo;
- propor um desafio rapido de frase;
- conceder XP via `progressionEngine.js`;
- registrar eventos via `learningEventEngine.js`;
- enviar o usuario para Revisao ou Neural Universe ao concluir.

Fluxo:

1. Warmup com o deck do dia.
2. Smart Review.
3. Listening Path.
4. Practice Challenge.
5. Session Complete.

### Minha Biblioteca

Arquivo: `src/pages/Library.jsx`

Funcionalidades:

- lista MindBlocks reais do Supabase;
- busca, filtros e ordenacao;
- colecoes rapidas;
- detalhe do MindBlock;
- gerar/tocar audio;
- favoritar;
- marcar como dominado;
- mover para revisao;
- excluir;
- adicionar/remover em playlists;
- criar MindBlock manualmente;
- criar playlist padrao quando necessario.

### Playlists

Arquivo: `src/pages/Playlists.jsx`

Funcionalidades:

- lista playlists reais do Supabase;
- cria playlist nova;
- cria conjunto inicial: `Daily Fluency`, `Work English`, `Travel`, `My Mistakes`;
- edita nome, descricao e cor;
- exclui playlist sem apagar MindBlocks;
- adiciona MindBlocks a uma playlist;
- remove MindBlocks de uma playlist;
- mostra metricas por playlist: itens, tempo estimado e revisoes vencidas.

### Chatbot

Arquivo: `src/pages/Chatbot.jsx`

Experiencia:

- conversa com mentor personalizado, por padrao `Neo`;
- layout mobile estilo WhatsApp/ChatGPT;
- area de mensagens rolavel;
- campo de digitacao fixo no rodape da experiencia de chat;
- modo de voz preparado visualmente;
- sugestoes de MindBlocks detectadas na resposta da IA;
- salvar MindBlock individualmente;
- salvar varios MindBlocks extraidos de uma resposta;
- salvar automaticamente conforme preferencia do usuario;
- detectar erro real na mensagem do usuario;
- salvar automaticamente erros do usuario em `Meus Erros`;
- correcoes gerais podem ser salvas manualmente.

### Conversas

Arquivo: `src/pages/Conversations.jsx`

Objetivo:

- separar informacoes auxiliares da experiencia principal do chatbot;
- manter uma pagina mais analitica/organizacional para conversas.

### Revisao inteligente

Arquivo: `src/pages/Insights.jsx`

Funcionalidades:

- deck real de revisao;
- mistura MindBlocks e erros corrigidos;
- cards vencidos aparecem primeiro;
- pergunta tipo flashcard;
- campo para resposta digitada;
- revelar resposta;
- similaridade simples da resposta;
- resultados `Again`, `Hard`, `Good`, `Easy`;
- atualizacao de mastery;
- calculo de proxima revisao;
- atualizacao de `daily_activity`;
- MindBlocks registram evento em `review_events`;
- erros corrigidos atualizam `corrected_mistakes`.

### Meus Erros

Arquivo: `src/pages/Mistakes.jsx`

Funcionalidades:

- lista erros corrigidos reais do Supabase;
- busca;
- status de revisao;
- salvar erro como MindBlock;
- marcar como revisado;
- marcar como dominado;
- excluir;
- integracao com a Revisao inteligente.

### Neural Universe

Arquivo: `src/pages/NeuralUniverse.jsx`

Funcao atual:

- visualizacao dinamica das conexoes de aprendizado;
- leitura dos eventos locais criados pelo `learningEventEngine.js`;
- criacao de nos e conexoes a partir de MindBlocks, revisoes, erros corrigidos, playlists, conversa com Neo e audio;
- fallback com dados mockados quando ainda nao ha atividade suficiente;
- seed/clear de eventos para demonstracao e testes internos;
- replay cronologico do crescimento neural.

Proxima evolucao natural:

- persistir eventos em tabela Supabase para manter o universo neural sincronizado entre dispositivos.

### Configuracoes

Arquivo: `src/pages/Settings.jsx`

Funcionalidades:

- perfil de aprendizado;
- nome de exibicao;
- idioma nativo;
- idioma alvo;
- nivel atual;
- meta diaria;
- nome do mentor de IA;
- voz preferida;
- modo de salvamento de MindBlocks;
- tom do chat;
- configuracao de navegacao mobile;
- reset do Progression Engine local;
- seed e limpeza de Learning Events para teste do Neural Universe.

## Services do frontend

### `src/services/mindblocks.js`

Responsavel por:

- listar MindBlocks;
- criar MindBlock;
- atualizar MindBlock;
- excluir MindBlock;
- mapear metadados ricos salvos em `notes` com prefixo `FM_META::`.

Campos logicos usados:

- expression;
- translation;
- category;
- source;
- notes;
- mastery;
- timesReviewed;
- nextReviewAt;
- lastReviewedAt;
- favorite;
- examples;
- relatedExpressions;
- commonMistake;
- pattern;
- variations.

### `src/services/playlists.js`

Responsavel por:

- listar playlists;
- criar playlist;
- atualizar playlist;
- excluir playlist;
- listar vinculos playlist/MindBlock;
- adicionar MindBlock a playlist;
- remover MindBlock de playlist.

Tabelas relacionadas:

- `playlists`;
- `playlist_mindblocks`.

### `src/services/correctedMistakes.js`

Responsavel por:

- listar erros corrigidos;
- criar erro corrigido;
- atualizar erro corrigido;
- excluir erro corrigido;
- mapear datas relativas e status de revisao.

Tabela relacionada:

- `corrected_mistakes`.

### `src/services/conversations.js`

Responsavel por:

- listar sessoes de conversa;
- criar sessao;
- listar mensagens;
- criar mensagens;
- persistir metadados de sugestoes/correcoes.

Tabelas relacionadas:

- `conversation_sessions`;
- `conversation_messages`.

### `src/services/reviewEvents.js`

Responsavel por:

- criar eventos de revisao;
- listar historico de revisao.

Tabela relacionada:

- `review_events`.

### `src/services/learningProgress.js`

Responsavel por:

- perfil de aprendizado;
- atividade diaria;
- progresso semanal;
- incrementos de estudo, mensagens, revisoes e playlists.

Tabelas relacionadas:

- `user_learning_profiles`;
- `daily_activity`.

### `src/services/progressionEngine.js`

Responsavel por:

- estado local de XP;
- calculo de level;
- missoes diarias;
- achievements;
- streak;
- eventos de ganho de XP;
- sincronizacao com Supabase quando o usuario esta autenticado;
- fallback local quando Supabase/tabela/rede nao estiver disponivel.

Chaves locais:

- `fluentmind_progression_state`;
- `fluentmind_achievements`;
- `fluentmind_daily_missions`.

Tabela relacionada:

- `user_progression_state`.

### `src/services/learningEventEngine.js`

Responsavel por:

- registrar eventos de aprendizado relevantes;
- normalizar eventos como `mindblock_saved`, `review_completed`, `mistake_corrected`, `playlist_created`, `audio_generated`, `conversation_message`, `practice_completed`;
- alimentar o feed da dashboard;
- alimentar o grafo do Neural Universe;
- permitir seed e limpeza para testes;
- sincronizar eventos com Supabase quando o usuario esta autenticado;
- manter fallback local quando Supabase/tabela/rede nao estiver disponivel.

Chave local:

- `fluentmind_learning_events`.

Tabela relacionada:

- `learning_events`.

### `src/services/mindblockAudio.js`

Responsavel por:

- solicitar audio de MindBlock;
- buscar audio ja gerado;
- conversar com a rota serverless `api/mindblock-audio.js`.

## APIs serverless

### `api/chat.js`

Funcao:

- recebe historico recente da conversa;
- chama OpenAI;
- gera resposta como mentor de fluencia;
- extrai MindBlocks sugeridos;
- extrai metadados para salvar MindBlocks;
- detecta correcoes gerais;
- analisa a ultima mensagem do usuario para detectar erros reais de ingles;
- retorna `reply`, `suggestedMindBlocks`, `correction`.

Modelos:

- usa `OPENAI_MODEL` quando configurado;
- fallback para `gpt-4o-mini`;
- analise de correcao pode usar `OPENAI_CORRECTION_MODEL`;
- fallback para `OPENAI_MODEL` ou `gpt-4o-mini`.

### `api/mindblock-audio.js`

Funcao:

- autentica usuario;
- busca MindBlock;
- gera audio via ElevenLabs;
- salva MP3 no Supabase Storage;
- atualiza referencia de audio no banco quando aplicavel;
- retorna URL assinada para reproducao.

Storage:

- bucket esperado: `mindblock-audio`.

### `api/transcribe.js`

Funcao atual:

- rota preparada para transcricao/audio.
- pode evoluir para pratica oral: usuario grava audio, IA transcreve, interpreta e corrige.

### `api/ultra-access.js`

Funcao:

- controle de acesso ultra/premium.

### `api/_utils/auth.js`

Funcao:

- valida usuario autenticado via token Supabase.

### `api/_utils/aiUsage.js`

Funcao:

- estrutura auxiliar para controle de uso de IA.

### `api/_utils/accessControl.js`

Funcao:

- regras auxiliares de acesso.

## Supabase

### Autenticacao

Usa Supabase Auth. O frontend trabalha com sessao e `access_token`. As rotas serverless usam o token para validar usuario.

### Tabelas utilizadas ou esperadas

#### `user_learning_profiles`

Perfil individual do aluno.

Campos esperados:

- `user_id`;
- `display_name`;
- `native_language`;
- `target_language`;
- `current_level`;
- `daily_expression_goal`;
- `last_active_date`.

#### `daily_activity`

Atividade diaria do usuario.

Campos usados:

- `user_id`;
- `activity_date`;
- `expressions_saved`;
- `expressions_reviewed`;
- `conversations_started`;
- `messages_sent`;
- `study_minutes`;
- `reviews_easy`;
- `reviews_good`;
- `reviews_hard`;
- `reviews_again`;
- `mindblocks_created`;
- `playlists_created`.

#### `mindblocks`

Biblioteca principal de expressoes.

Campos usados:

- `id`;
- `user_id`;
- `expression_en`;
- `meaning_pt`;
- `context`;
- `category`;
- `source`;
- `notes`;
- `mastery_level`;
- `times_reviewed`;
- `next_review_at`;
- `last_reviewed_at`;
- `is_favorite`;
- `created_at`.

Observacao:

- metadados ricos podem ser serializados em `notes` com prefixo `FM_META::`.

#### `playlists`

Playlists de estudo.

Campos usados:

- `id`;
- `user_id`;
- `name`;
- `description`;
- `color`;
- `icon`;
- `created_at`;
- `updated_at`.

#### `playlist_mindblocks`

Tabela de relacionamento entre playlists e MindBlocks.

Campos usados:

- `user_id`;
- `playlist_id`;
- `mindblock_id`.

#### `conversation_sessions`

Sessoes de conversa com o mentor.

Campos usados:

- `id`;
- `user_id`;
- `title` ou dados equivalentes;
- `scenario`;
- `status`;
- `created_at`;
- `updated_at`.

#### `conversation_messages`

Mensagens da conversa.

Campos usados:

- `id`;
- `user_id`;
- `session_id`;
- `role`;
- `content`;
- `correction`;
- `created_at`.

#### `review_events`

Historico de revisoes de MindBlocks.

Campos usados:

- `user_id`;
- `mindblock_id`;
- `result`;
- `answer_text`;
- `expected_text`;
- `response_time_ms`;
- `reviewed_at`.

#### `corrected_mistakes`

Erros corrigidos do usuario.

Arquivo SQL: `supabase/corrected_mistakes.sql`

Campos:

- `id`;
- `user_id`;
- `conversation_id`;
- `message_id`;
- `original_text`;
- `corrected_text`;
- `explanation`;
- `category`;
- `level`;
- `status`;
- `mastery_level`;
- `times_reviewed`;
- `next_review_at`;
- `last_reviewed_at`;
- `created_at`.

Status aceitos:

- `new`;
- `review_due`;
- `reviewed`;
- `mastered`;
- `archived`.

#### `mindblock_audio` ou coluna equivalente

O sistema de audio depende de armazenamento no Supabase Storage e pode usar tabela/colunas de referencia conforme schema aplicado. O bucket principal configurado e usado e `mindblock-audio`.

#### `user_progression_state`

Estado agregado de progressao do usuario.

Arquivo SQL: `supabase/progression_and_learning_events.sql`

Campos principais:

- `user_id`;
- `state`;
- `total_xp`;
- `current_level`;
- `streak`;
- `last_activity_at`;
- `updated_at`;
- `created_at`.

Uso:

- XP;
- level;
- streak;
- missoes diarias;
- achievements;
- estatisticas internas;
- snapshot completo em JSON.

#### `learning_events`

Historico granular de eventos de aprendizado.

Arquivo SQL: `supabase/progression_and_learning_events.sql`

Campos principais:

- `id`;
- `user_id`;
- `event_type`;
- `source`;
- `payload`;
- `created_at`.

Uso:

- feed da dashboard;
- Neural Universe;
- analytics futuros;
- reconstrucao historica da evolucao do usuario;
- sincronizacao entre dispositivos.

#### `ultra_access_grants`

Tabela ligada ao controle de acesso ultra.

Arquivo SQL: `supabase/ultra_access_grants.sql`

## Row Level Security

As tabelas criadas seguem o padrao:

- usuario le apenas seus dados;
- usuario insere apenas seus dados;
- usuario atualiza apenas seus dados;
- usuario exclui apenas seus dados.

Exemplo aplicado em `corrected_mistakes.sql`:

- `auth.uid() = user_id` para `select`, `insert`, `update`, `delete`.

## Storage

### Bucket `mindblock-audio`

Uso:

- armazenar audios MP3 gerados por ElevenLabs para MindBlocks;
- evitar regenerar audio repetidamente;
- servir audio por URL assinada.

Recomendacao:

- manter bucket privado;
- limitar tamanho de arquivo;
- usar MIME types de audio quando o projeto sair da fase de validacao.

## Variaveis de ambiente

Importante: valores reais nao devem ser documentados nem enviados ao Git.

### Supabase frontend

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Essas variaveis sao usadas no browser. Devem usar URL base do projeto Supabase, por exemplo `https://xxxxx.supabase.co`, sem `/rest/v1`.

### Supabase serverless

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

Usadas por rotas serverless. A service key nunca deve ir para o frontend.

### OpenAI

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_CORRECTION_MODEL`

`OPENAI_API_KEY` deve ficar apenas no ambiente serverless/Vercel.

### ElevenLabs

- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID` ou mapeamentos equivalentes por voz quando configurados.

### Vite/API

- `VITE_API_BASE`

Normalmente pode ficar vazio quando frontend e API estao no mesmo dominio Vercel.

## IA e prompts

### Mentor de fluencia

O mentor padrao se chama `Neo`, mas o usuario pode alterar em Configuracoes.

O prompt base orienta a IA a:

- agir como mentor de fluencia;
- ensinar ingles natural para brasileiros;
- priorizar expressao natural antes de explicacao longa;
- explicar significado em portugues quando ajudar;
- trazer exemplos naturais;
- corrigir com gentileza;
- sugerir expressoes relacionadas;
- apontar erros comuns;
- sugerir salvar MindBlocks;
- evitar placeholders em portugues dentro de frases para audio.

### Extracao de MindBlocks

A API tenta extrair:

- expressao;
- traducao;
- exemplos;
- expressoes relacionadas;
- erro comum;
- pratica;
- padrao reutilizavel.

O chatbot mostra opcoes para salvar individualmente cada expressao.

### Deteccao de erros

Fluxo atual:

1. Usuario envia mensagem.
2. API responde normalmente.
3. API tambem analisa a ultima mensagem do usuario quando parece conter ingles.
4. Se houver erro real, retorna `correction` estruturada.
5. Frontend salva automaticamente em `corrected_mistakes`.
6. O erro aparece em `Meus Erros`.
7. O erro entra na `Revisao inteligente`.

## Audio

### Geracao

O audio de MindBlocks usa ElevenLabs por meio de `api/mindblock-audio.js`.

Fluxo:

1. Usuario clica em ouvir.
2. Frontend chama endpoint serverless.
3. Endpoint valida usuario.
4. Endpoint busca MindBlock.
5. Endpoint chama ElevenLabs.
6. Audio MP3 e salvo no Supabase Storage.
7. Frontend recebe URL assinada.
8. Audio toca no navegador.

### Normalizacao de texto para audio

Arquivo: `src/utils/mindblockText.js`

Objetivo:

- evitar que placeholders em portugues sejam lidos em audio;
- trocar termos como `[atividade]`, `[comida]`, `[nome]` por exemplos em ingles;
- gerar audio mais natural.

## Design e UX

### Identidade visual

- fundo dark navy/quase preto;
- cards com glassmorphism leve;
- bordas suaves;
- roxo/violeta como cor primaria;
- azul/ciano como acento;
- verde para sucesso;
- laranja para streak/revisao;
- texto principal claro;
- texto secundario em tons slate.

### NeuralBrain V2

Componente: `src/components/NeuralBrain.jsx`

Representa:

- level;
- XP;
- proximo nivel;
- quantidade de nos;
- conexoes neurais;
- mastery;
- humor visual do cerebro.

Estados visuais:

- `calm`;
- `focused`;
- `energized`;
- `celebrating`.

Usos atuais:

- hero da dashboard;
- estados de crescimento neural;
- futuras animacoes de XP, review e salvamento.

### Mobile

Melhorias feitas:

- chatbot com experiencia parecida com WhatsApp/ChatGPT;
- lista de mensagens rolavel;
- composer sempre acessivel;
- bottom nav ajustada para nao cobrir campo de digitacao;
- footer/legal removido da tela mobile do chatbot para nao prejudicar uso.
- conteudos laterais do chatbot reduzidos/collapsaveis no mobile;
- campo de digitacao preservado acima da barra inferior;
- ajustes de tema claro/escuro para evitar texto sem contraste.

## Deploy

### Vercel

Configuracao:

- projeto conectado ao GitHub;
- build via Vite;
- serverless functions em `api/`;
- `vercel.json` usa filesystem routing antes do fallback SPA:

```json
{
  "routes": [
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```

Isso permite que `/api/...` seja tratado como function e as rotas do React continuem funcionando.

### Upload para GitHub

Script:

- `upload_fluentmind_to_github.ps1`

Funcao:

- protege arquivos `.env`;
- configura remote;
- adiciona alteracoes;
- cria commit;
- faz pull se necessario;
- envia para GitHub.

Observacao:

- o script usa mensagem generica de commit atualmente.

## Features implementadas

- Autenticacao Supabase.
- Layout autenticado com sidebar/header/mobile nav.
- Landing page.
- Login e recuperacao de senha.
- Dashboard premium.
- Biblioteca de MindBlocks.
- Criacao manual de MindBlocks.
- Salvamento de MindBlocks pelo chatbot.
- Extracao de multiplas expressoes da resposta da IA.
- Salvamento individual de expressoes.
- Audio de MindBlock com ElevenLabs.
- Armazenamento de audio no Supabase Storage.
- Playlists reais.
- Criacao/edicao/exclusao de playlists.
- Vinculo MindBlock/playlist.
- Chatbot com mentor personalizado.
- Deteccao automatica de erros do usuario.
- Meus Erros.
- Revisao inteligente.
- Revisao de MindBlocks.
- Revisao de erros corrigidos.
- Perfil de aprendizado.
- Configuracoes de mentor, voz, tom e metas.
- Atividade diaria.
- Progression Engine com Supabase e fallback local para XP, level, missoes e achievements.
- Learning Event Engine com Supabase e fallback local para registrar atividade real do usuario.
- Neural Universe dinamico baseado em eventos de aprendizado.
- NeuralBrain V2 com animacoes, conexoes e estados visuais.
- Dashboard premium focada em crescimento cerebral, missoes, feed e insights.
- Seed/clear de eventos de aprendizado para testes de produto.
- Controle de acesso ultra.
- Politica de privacidade e termos.

## Pontos ainda em evolucao

- Reduzir dependencia restante de `localStorage` para dados que ainda sao preferencias locais.
- Melhorar o Daily Brain Workout com correcao por IA no desafio final.
- Playlists sugeridas automaticamente pelo chatbot quando uma resposta gerar varias expressoes do mesmo tema.
- Reproducao/geracao de audio individual para expressoes relacionadas dentro do detalhe do MindBlock.
- Pratica oral real:
  - gravar audio do usuario;
  - transcrever;
  - avaliar pronuncia;
  - corrigir naturalidade;
  - salvar erro ou MindBlock.
- Sincronizar Neural Universe entre dispositivos com dados persistidos no banco.
- Melhorias de analytics e progresso com metricas por tema, habilidade e frequencia.
- Limpeza final de qualquer nomenclatura herdada do KORDEN que ainda apareca internamente.
- Melhorar mensagens de erro serverless para diagnostico em producao.
- Testes automatizados para services e fluxos principais.

## Cuidados importantes

- Nunca commitar `.env.local`, `.env.production` ou chaves reais.
- `VITE_` expoe variaveis no browser; nao usar service keys com prefixo `VITE_`.
- `SUPABASE_SERVICE_KEY` deve existir apenas no servidor/Vercel.
- Buckets privados devem usar URL assinada.
- As APIs serverless dependem de token Supabase valido.
- Tabelas Supabase precisam ter RLS e policies corretas.

## Proximo passo recomendado

Evoluir o `Daily Brain Workout` com correcao por IA no desafio final.

Fluxo sugerido:

1. Usuario responde ao desafio.
2. API avalia naturalidade, gramatica e aderencia ao padrao.
3. Se houver erro, oferece salvar em `corrected_mistakes`.
4. Se a frase for boa, oferece salvar como novo MindBlock.
5. Resultado alimenta XP, Learning Events e Neural Universe.

Esse passo fecha o ciclo mais importante do produto:

missao -> resposta do usuario -> correcao inteligente -> XP -> revisao -> Neural Universe.
