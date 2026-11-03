// Conteúdo pedagógico escrito à mão para cada capítulo da Jornada 2.0.
// lesson: o que o aluno vai conseguir fazer, o padrão da língua e 2-3 pontos curtos.
// produce: situação real para uma resposta pessoal (avaliada pela IA de correção).
// challenge: tarefa final e critérios. "essential" = objetivo comunicativo do capítulo (precisa ser atendido);
// os demais são complementares e entram só na pontuação mínima.
export const journeyCurriculum = {
  "about-me": {
    goal: "Apresentar-se em poucas frases: nome, origem, trabalho e um interesse.",
    pattern: { form: "I'm + origem / I work in + área / I like + atividade", example: "I'm from Brazil. I work in technology. I like music." },
    points: [
      "Use frases curtas e ligue as ideias: primeiro quem você é, depois um detalhe.",
      "Idade usa o verbo to be: I'm 30 (years old). Nunca \"I have 30 years\".",
      "\"Nice to meet you\" é só para o primeiro encontro.",
    ],
    produce: {
      situation: "Você entrou numa chamada de vídeo com colegas novos de outro país. Alguém diz: \"Tell us a little about yourself.\"",
      instruction: "Responda em 2 ou 3 frases, com seus dados reais.",
    },
    challenge: {
      task: "Apresente-se em 4 frases curtas: nome, de onde você é, o que faz e algo de que gosta.",
      criteria: [
        { text: "Diz o nome com \"My name is\" ou \"I'm\"", essential: true },
        { text: "Diz a origem com \"I'm from\"", essential: true },
        { text: "Fala do trabalho ou estudo", essential: false },
        { text: "Frases gramaticais e naturais", essential: false },
      ],
    },
  },
  "daily-routine": {
    goal: "Descrever sua rotina com hábitos e horários.",
    pattern: { form: "I + verbo no presente + quando", example: "I wake up at six. I go to work by bus." },
    points: [
      "O presente simples descreve hábitos: I work, I sleep, I study.",
      "Horários: at six, at night, in the morning. \"Go home\" não leva \"to\".",
      "Palavras de frequência dão naturalidade: usually, every day, on most days.",
    ],
    produce: {
      situation: "Um amigo estrangeiro pergunta: \"What's a normal day like for you?\"",
      instruction: "Descreva três momentos do seu dia, com horários ou frequência.",
    },
    challenge: {
      task: "Descreva sua rotina do momento em que acorda até a hora de dormir, em 4 a 6 frases.",
      criteria: [
        { text: "Usa o presente simples para hábitos", essential: true },
        { text: "Inclui pelo menos dois horários ou palavras de frequência", essential: false },
        { text: "Segue uma ordem do dia", essential: true },
        { text: "Frases gramaticais e naturais", essential: false },
      ],
    },
  },
  questions: {
    goal: "Fazer e responder perguntas básicas para manter uma conversa.",
    pattern: { form: "Palavra de pergunta + do + you + verbo?", example: "Where do you live? What do you do?" },
    points: [
      "No presente simples, a pergunta precisa do auxiliar \"do\": Where do you live?",
      "Com o verbo to be, inverta: Are you tired? Where are you from?",
      "Depois de responder, devolva a pergunta: \"And you?\"",
    ],
    produce: {
      situation: "Você conheceu alguém num evento e quer saber mais sobre a pessoa.",
      instruction: "Escreva 3 perguntas diferentes que você faria a ela.",
    },
    challenge: {
      task: "Escreva um mini diálogo: 3 perguntas suas e as respostas que você daria sobre você mesmo.",
      criteria: [
        { text: "Perguntas com auxiliar \"do\" ou inversão com to be", essential: true },
        { text: "Pelo menos 3 perguntas diferentes", essential: true },
        { text: "Respostas coerentes com as perguntas", essential: false },
        { text: "Frases gramaticais e naturais", essential: false },
      ],
    },
  },
  family: {
    goal: "Falar da sua família com frases simples e corretas.",
    pattern: { form: "I have + número + parente / My + parente + verbo com -s", example: "I have two brothers. My mother works at a school." },
    points: [
      "Para he/she, o verbo ganha -s: my father works, my sister lives.",
      "Plural com número: two brothers, one sister.",
      "Diga algo sobre a pessoa, não só o parentesco: \"My sister is a nurse.\"",
    ],
    produce: {
      situation: "Um colega mostra uma foto da família e pergunta: \"What about your family?\"",
      instruction: "Responda com 2 ou 3 frases sobre pessoas da sua família.",
    },
    challenge: {
      task: "Diga 4 frases sobre a sua família: quem são e um detalhe de cada pessoa.",
      criteria: [
        { text: "Usa \"I have\" ou \"My ... is\" corretamente", essential: true },
        { text: "Concorda o verbo com he/she (works, has)", essential: false },
        { text: "Inclui detalhes sobre as pessoas", essential: true },
        { text: "Frases gramaticais e naturais", essential: false },
      ],
    },
  },
  feelings: {
    goal: "Dizer como você se sente e explicar o motivo.",
    pattern: { form: "I'm + sentimento + because / I feel + sentimento", example: "I'm tired because I worked late." },
    points: [
      "Sentimentos usam o verbo to be: I'm tired, I'm worried. Não \"I have tired\".",
      "Suavize com \"a little\" ou reforce com \"really\": I'm a little worried.",
      "Explique com \"because\" para a conversa continuar.",
    ],
    produce: {
      situation: "Um colega pergunta no começo da reunião: \"How are you feeling today?\"",
      instruction: "Responda dizendo como você está e por quê.",
    },
    challenge: {
      task: "Descreva como você se sente hoje e por quê, em 3 a 5 frases.",
      criteria: [
        { text: "Usa \"I'm\" ou \"I feel\" com um sentimento", essential: true },
        { text: "Explica o motivo (because, so)", essential: true },
        { text: "Usa pelo menos dois sentimentos ou intensidades", essential: false },
        { text: "Frases gramaticais e naturais", essential: false },
      ],
    },
  },
  "work-english": {
    goal: "Explicar o seu trabalho e as tarefas do dia.",
    pattern: { form: "I'm a + profissão / I need to + tarefa / I have a + evento", example: "I'm a programmer. I need to write a report today." },
    points: [
      "Profissão leva artigo: I'm a programmer, I'm an engineer.",
      "Obrigação ou plano: I need to + verbo (sem \"to\" faltando).",
      "Turnos: work the night shift, work the day shift.",
    ],
    produce: {
      situation: "Um novo colega estrangeiro pergunta: \"What do you do here, exactly?\"",
      instruction: "Explique sua função e uma tarefa que você faz hoje.",
    },
    challenge: {
      task: "Explique o seu trabalho e descreva uma tarefa que você faz, em 4 a 6 frases.",
      criteria: [
        { text: "Diz a função com artigo (I'm a/an)", essential: true },
        { text: "Descreve pelo menos uma tarefa concreta", essential: true },
        { text: "Usa \"need to\" ou presente simples corretamente", essential: false },
        { text: "Frases gramaticais e naturais", essential: false },
      ],
    },
  },
  technology: {
    goal: "Relatar um problema técnico simples em inglês.",
    pattern: { form: "The + sistema + isn't working / There is a + problema", example: "The API isn't working. There is a bug in the login." },
    points: [
      "Para it/he/she, a negação é \"doesn't\" ou \"isn't\": The API doesn't respond.",
      "\"There is\" apresenta algo novo: There is a bug here.",
      "Diga o que você vai fazer: I need to fix it / I need to deploy.",
    ],
    produce: {
      situation: "No chat da equipe, alguém pergunta: \"Is everything OK with the app?\"",
      instruction: "Relate um problema e o que você vai fazer.",
    },
    challenge: {
      task: "Explique um problema de software: o que está acontecendo, onde e o que você vai fazer.",
      criteria: [
        { text: "Descreve o problema (isn't working, there is a bug)", essential: true },
        { text: "Diz onde ou quando acontece", essential: false },
        { text: "Diz o próximo passo (I need to...)", essential: true },
        { text: "Frases gramaticais e naturais", essential: false },
      ],
    },
  },
  travel: {
    goal: "Resolver situações de viagem: hotel, aeroporto, restaurante.",
    pattern: { form: "Can I + pedido? / Where is + lugar? / I have a + reserva", example: "Hi, I have a reservation. Can I check in now?" },
    points: [
      "\"Can I...?\" é o jeito simples e educado de pedir.",
      "Substantivo contável no singular leva artigo: a reservation, the taxi.",
      "Comece com \"Excuse me\" para chamar a atenção de alguém.",
    ],
    produce: {
      situation: "Você chega ao hotel à noite e a recepcionista diz: \"Good evening! How can I help you?\"",
      instruction: "Responda e faça um pedido.",
    },
    challenge: {
      task: "Escreva o que você diria para pedir ajuda num aeroporto ou hotel: cumprimente, explique a situação e faça 2 pedidos.",
      criteria: [
        { text: "Cumprimenta ou chama a atenção (Excuse me, Hi)", essential: false },
        { text: "Explica a situação", essential: true },
        { text: "Faz pedidos com \"Can I\" ou \"Where is\"", essential: true },
        { text: "Frases gramaticais e educadas", essential: false },
      ],
    },
  },
  "small-talk": {
    goal: "Começar e manter uma conversa leve.",
    pattern: { form: "Pergunta aberta + reação + nova pergunta", example: "How's your day going? — Pretty good! — That sounds great. Any plans for the weekend?" },
    points: [
      "Prefira perguntas abertas: How's your day going?",
      "Reaja antes de perguntar de novo: That sounds great! / Oh, really?",
      "Pergunta com to be inverte: Is the weather good there?",
    ],
    produce: {
      situation: "Você está esperando o elevador com um colega que mal conhece.",
      instruction: "Puxe assunto e faça uma pergunta para a conversa continuar.",
    },
    challenge: {
      task: "Escreva um small talk de 5 falas (você e outra pessoa), começando a conversa e mantendo-a.",
      criteria: [
        { text: "Abre a conversa com uma pergunta natural", essential: true },
        { text: "Reage ao que a outra pessoa diz", essential: false },
        { text: "Faz pelo menos uma pergunta de continuação", essential: true },
        { text: "Frases gramaticais e naturais", essential: false },
      ],
    },
  },
  "real-conversations": {
    goal: "Juntar tudo e lidar com uma conversa real, inclusive quando não entende.",
    pattern: { form: "Pedir repetição / ganhar tempo / confirmar entendimento", example: "Sorry, can you repeat that, please? ... Let me think for a second. ... OK, that makes sense." },
    points: [
      "Não entendeu? Peça: Can you repeat that, please?",
      "Precisa pensar? Ganhe tempo: Let me think for a second.",
      "Confirme que entendeu: That makes sense.",
    ],
    produce: {
      situation: "Numa entrevista, perguntam rápido demais: \"What would you improve in your current workflow?\"",
      instruction: "Peça para repetir, ganhe tempo e depois responda.",
    },
    challenge: {
      task: "Escreva uma conversa simulada em que você se apresenta, fala da rotina e do trabalho e faz small talk.",
      criteria: [
        { text: "Inclui apresentação pessoal", essential: true },
        { text: "Fala de rotina e trabalho", essential: false },
        { text: "Usa uma estratégia de conversa (repetir, ganhar tempo ou confirmar)", essential: true },
        { text: "Frases gramaticais e naturais", essential: false },
      ],
    },
  },
};
