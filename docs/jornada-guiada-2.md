# Jornada Guiada 2.0

## Arquitetura
| Camada | Arquivo | Papel |
|---|---|---|
| Conteúdo | `src/data/learningJourney.js` | 10 capítulos, MindBlocks (traduções revisadas), erros comuns |
| Conteúdo | `src/data/journeyExamples.js` | Diálogos reais (3 por capítulo) |
| Conteúdo | `src/data/journeyCurriculum.js` | Aula, padrão, produção e desafio escritos à mão por capítulo |
| Regras | `src/services/journeyEngine.js` | Fases, atividades, estados, conclusão e montagem dos exercícios (funções puras) |
| Estado | `src/hooks/useJourneyProgress.js` | Única fonte de escrita; XP só na primeira conclusão |
| Revisão | `src/services/journeyMindBlocks.js` | Salva na revisão espaçada sem duplicar |
| Interface | `src/components/journey/*`, `src/pages/LearningJourney.jsx` | Visão geral, mapa, uma atividade por vez, tela de conclusão |
| Neo | `src/services/conversationMission.js`, `src/pages/NeoImmersive.jsx` | Missão do capítulo e evidência por expressão |

## Fases e atividades
| Fase | Atividade | Avaliação | Concluída quando |
|---|---|---|---|
| Descobrir | Aula, Expressões, Diálogos | — | O aluno avança (não basta abrir) |
| Compreender | Compreensão do diálogo, Escuta, Escolha a frase certa | Local e exata (múltipla escolha) | Todas respondidas. "Correto" só se tudo certo na 1ª tentativa |
| Recuperar | Lembrar em inglês | IA (`/api/review-check`, modo translate) | Todas tentadas, sem resposta visível antes |
| Recuperar | Complete a conversa | Local e exata (expressão fechada) | Todas completadas (2 tentativas e depois revela) |
| Recuperar | Sua resposta | IA (modo sentence) | Resposta corrigida |
| Conversar | Missão com o Neo | Correção do Neo por mensagem | As 3 expressões usadas em mensagens sem erro apontado |
| Demonstrar | Desafio final | IA com critérios do capítulo | Veredito "correto" ou "quase" → "Demonstrado" |

Estados separados: **Visto**, **Feito**, **Correto**, **Demonstrado** e **Marcado antes** (progresso da versão anterior).

## Dados e migração (sem mudança de banco)
- Tudo continua em `progressionState.learningJourney`, o mesmo JSON salvo no localStorage e no Supabase.
- Campos novos em `chapterProgress[capítulo]`: `activities[atividade] = { status, score, total, attempts, lastVerdict, evidence, updatedAt }` e `lastActivityId` (para retomar).
- As 10 marcações antigas (`lesson`, `vocabulary`, …, `challenge`) continuam sendo gravadas pelas atividades correspondentes. Home, Neo e histórico seguem lendo.
- Capítulos já concluídos continuam concluídos. Marcações antigas contam como "Marcado antes". O XP nunca é retirado.
- **Mudança de regra:** concluir um capítulo agora exige todas as atividades, conversa verificada e desafio demonstrado. Antes bastavam 6 marcações, e "conversa" e "desafio" eram marcados sozinhos. A regra nova vale para capítulos ainda não concluídos.

## Avaliação pedagógica (`shared/learningEvaluation.js`)
Funções puras, usadas pela API e pelo app.

- **Neo, por expressão** (`/api/chat` com `targets` e `objective`, campos opcionais): cada mensagem da missão recebe, por expressão, um destes status:
  - `adequate`, `partial`, `inadequate`, `unused` ou `inconclusive`;
  - mais `impact` (none/minor/blocks), `autonomous`, `feedback` e `suggestion`.
- **Regras de coerência aplicadas no servidor:**
  - erro que bloqueia a comunicação → `inadequate`;
  - erro leve → no máximo `partial`;
  - copiar o tutor → no máximo `partial`;
  - baixa confiança → `inconclusive`;
  - resposta inválida ou falha → `inconclusive` para todas as expressões.
- **Missão cumprida:** as 3 expressões com `adequate` ou `partial`. Erros leves não travam o aluno. Vale o melhor resultado ao longo da conversa.
- **Respostas abertas e desafio** (`/api/review-check`, que ganhou o modo `challenge` e os campos opcionais `criteria`, `difficulty` e `context`):
  - devolve `assessment` (correct, almost, wrong ou inconclusive), `passed`, `criteria[{status: met|partial|not_met}]`, `onTopic`, `confidence` e `improvement`;
  - os campos antigos (`verdict`, `score`, `feedback`, `corrected`, `alternative`, `suggestedResult`) continuam iguais.
- **Aprovação proporcional:**
  - `assessment` precisa ser correct ou almost;
  - a fração de critérios atendidos (met = 1, partial = 0,5) precisa chegar a 60% no conteúdo inicial, 65% no básico, 70% no intermediário e 75% no avançado;
  - resposta fora do tema → `wrong`;
  - baixa confiança, critérios inválidos ou JSON inválido → `inconclusive`, que nunca aprova.

## Limitações conhecidas
- **Avaliação por IA:** o modelo pode errar. As regras de coerência reduzem o risco, mas não o eliminam. Cada mensagem de missão faz 1 chamada extra de IA.
- **Missões antigas:** registros salvos antes desta versão (`used` e `needs-help`) continuam aparecendo com o rótulo antigo.
- **Escuta:** usa a voz do navegador (Web Speech API), sem custo. Se o navegador não tiver voz, a atividade mostra a frase para leitura.
- **Pronúncia:** não é avaliada. A fala é prática, não nota.
- **Desafio e respostas abertas:** dependem da IA de correção. Se ela falhar, nada é aprovado e o aluno tenta de novo.
- **CEFR:** não é atribuído. A dificuldade mostrada é do conteúdo do capítulo, não do aluno.

## Calibração (versão atual)
- **Parâmetros configuráveis** (`EVALUATION_CONFIG` em `shared/learningEvaluation.js`): pontuação mínima por dificuldade (60 / 65 / 70 / 75%), status aceitos nos critérios essenciais (`met` ou `partial`) e número mínimo de expressões com uso adequado e autônomo na missão (1). São pontos de partida para calibração, não medidas científicas de proficiência.
- **Desafio:** só aprova com avaliação válida, resposta dentro do tema, todos os critérios essenciais atendidos (erro leve aceito) e a pontuação mínima. "Correto" com um critério essencial não atendido é rebaixado para "quase" e não aprova.
- **Missão do Neo:**
  - nenhuma expressão pode ficar inadequada, inconclusiva ou sem uso;
  - pelo menos uma precisa de uso adequado e autônomo;
  - as demais podem ser parciais;
  - copiar a fala do tutor não conta como uso independente;
  - "adequado" ou "parcial" sem informar o impacto do erro vira "inconclusivo";
  - as evidências anteriores ficam em `history` (últimas 5).
- **Custo:**
  - numa missão, a avaliação combinada (expressões + correção) substitui a chamada de correção: 2 chamadas por mensagem, como numa conversa normal;
  - o pré-filtro local pula a avaliação quando nenhuma expressão tem palavras presentes na mensagem;
  - o cache por tentativa exata (mesmo usuário, contexto e resposta, 10 min, só na memória da instância) evita pagar duas vezes por um reenvio. Resultado inconclusivo não entra no cache;
  - latência e tokens vão para `evaluationMeta` na resposta e para o log `[chat:mission-usage]` / `[review-check:usage]`.
- **Bateria de casos:** `tests/fixtures/evaluationCases.js`. Teste com IA real, desativado por padrão: `tests/live/evaluation.live.test.js` (`RUN_LIVE_AI=1 LIVE_AI_MAX_CALLS=n`, no máximo 20 chamadas).
