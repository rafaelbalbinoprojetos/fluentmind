# Proposta: motor adaptativo e missões de aprendizagem real

Status: **proposta, não implementada.** A Home de hoje usa regras fixas (`src/services/nextStep.js`) e as missões quantitativas do `progressionEngine`. Este documento explica o que falta para ir além disso sem simular personalização.

## 1. O que existe hoje

| Peça | O que faz | Limite |
|---|---|---|
| `getNextStep` | Escolhe o próximo passo por prioridade fixa: revisões vencidas → correções vencidas → etapa da Jornada → conversa. Devolve motivo e evidências. | Não aprende com o aluno, não estima domínio. |
| FSRS (`fsrs.js`, `smartReview.js`) | Agenda a próxima revisão de cada MindBlock. | A nota (Não lembrei/Difícil/Lembrei/Fácil) é **autoavaliada**. |
| Revisão ativa (`DailyWorkout`) | O aluno digita ou pensa antes de “Mostrar resposta”. | A resposta digitada **não é corrigida** antes da nota. |
| Correção do Neo (`api/chat.js` → `analyzeUserCorrection`) | Aponta o erro mais importante da última mensagem. | Não verifica se uma **expressão específica** foi usada corretamente. |
| Missão de conversa (`conversationMission.js`) | Detecta, por texto, se as expressões do capítulo apareceram. | Detectar que apareceu não prova que foi usada corretamente. |
| `progressionEngine` | XP, nível e 7 missões por contagem de ações. | Mede esforço, não proficiência. |

## 2. Por que as missões pedagógicas ainda não foram trocadas

Foram propostas duas trocas:
- “Usar 1 expressão sua corretamente com o Neo”.
- “Lembrar 3 expressões na revisão ativa”.

Ambas exigem uma **avaliação confiável**, que ainda não existe:

1. **Uso correto com o Neo**: hoje sabemos se a expressão apareceu (`findUsedTargets`) e se a mensagem teve algum erro (`hasMistake`). Não sabemos se o erro estava na expressão-alvo. Juntar as duas coisas daria falsos positivos.
2. **Recuperação na revisão**: a nota é do próprio aluno. Contar “Lembrei” como prova de retenção seria contar cliques.

A regra combinada foi: sem infraestrutura confiável, nada de simulação. As missões continuam as mesmas. A única mudança foi remover a missão falsa “Aprender a expressão de hoje”, que se completava sozinha.

## 3. O que precisa ser construído

### 3.1 Avaliação de uso de expressão (Neo)
- Na rota `api/chat.js`, quando houver `targets` (expressões do capítulo ou do MindBlock), pedir ao modelo de correção um campo extra por alvo: `{ expression, used: boolean, correct: boolean, evidence: string }`.
- Validar no servidor: `used` precisa bater com `findUsedTargets`. Se não bater, descartar.
- **Contrato novo de API** → precisa de aprovação.

### 3.2 Revisão com verificação
- Quando o aluno digitar uma resposta, chamar `checkAnswerWithAi` **antes** de mostrar a resposta (já é usado no desafio do DailyWorkout e no Insights).
- Registrar `verified: true` e o veredito no evento de revisão, separado da autoavaliação.

### 3.3 Eventos para o progressionEngine
Novas ações, sem mexer nas existentes:
- `expressionUsedCorrectly` (meta: `mindBlockId`, `source: "neo"`)
- `recallVerified` (meta: `mindBlockId`, `verdict`)

Só eventos com `verified: true` contam para as novas missões.

### 3.4 Migração segura das missões
- As missões são recriadas por dia (`resetDailyMissionsIfNewDay`). Trocar os templates afeta só **o dia seguinte**. Missões já concluídas e o XP ficam como estão.
- Manter os ids antigos reconhecidos na leitura para o histórico continuar legível.
- Liberar por flag (`extra.pedagogicalMissions`) para testar com poucos usuários antes.
- O XP por missão continua 15, para não inflar nem reduzir o nível de ninguém.

### 3.5 Motor adaptativo (fase seguinte)
Com os eventos verificados, dá para estimar domínio por expressão:
- `p(lembra)` = retrievability do FSRS;
- `p(usa)` = acertos verificados / tentativas no Neo.

A recomendação passa a priorizar expressões com retrievability baixa **e** uso fraco.

**Nível CEFR**: só com avaliação própria (teste de colocação ou amostra de produção corrigida). Nunca deduzido de XP ou de contagem de MindBlocks.

## 4. Dependências e aprovações

| Item | Muda banco? | Muda contrato? | Aprovação |
|---|---|---|---|
| 3.1 Avaliação de uso | Não | Sim (`api/chat.js`) | Necessária |
| 3.2 Revisão verificada | Talvez (`review_events` com campo de veredito) | Sim | Necessária |
| 3.3 Novas ações | Não (localStorage/estado existente) | Não | Recomendada |
| 3.4 Troca de missões | Não | Não | Necessária (regra de negócio) |
| 3.5 Motor adaptativo | Talvez | Sim | Necessária |
