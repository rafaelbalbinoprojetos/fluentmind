export const LEARNING_JOURNEY_KEY = "fluentmind_learning_journey_progress";

const baseLearningJourneyChapters = [
  {
    id: "about-me",
    order: 1,
    title: "About Me",
    objective: "Introduce yourself naturally.",
    difficulty: "Beginner",
    duration: "15 min",
    xp: 120,
    masteryRequired: 0,
    vocabulary: ["name", "from", "live", "work", "like", "Brazil"],
    intro: "Today you'll learn how to introduce yourself naturally and confidently.",
    neoPrompt: "The student is studying About Me. Practice introductions with beginner vocabulary. Correct gently and use today's MindBlocks.",
    finalChallenge: "Introduce yourself in 4 short sentences.",
    mindBlocks: [
      ["My name is Rafael.", "Meu nome e Rafael."],
      ["I'm from Brazil.", "Eu sou do Brasil."],
      ["I live in Brazil.", "Eu moro no Brasil."],
      ["I work in technology.", "Eu trabalho com tecnologia."],
      ["I like learning English.", "Eu gosto de aprender ingles."],
      ["I speak Portuguese.", "Eu falo portugues."],
      ["I'm learning English.", "Eu estou aprendendo ingles."],
      ["I want to speak naturally.", "Eu quero falar naturalmente."],
      ["Nice to meet you.", "Prazer em conhecer voce."],
      ["That's a little about me.", "Isso e um pouco sobre mim."],
    ],
  },
  {
    id: "daily-routine",
    order: 2,
    title: "Daily Routine",
    objective: "Talk about your day and habits.",
    difficulty: "Beginner",
    duration: "18 min",
    xp: 140,
    masteryRequired: 10,
    vocabulary: ["wake up", "work", "eat", "sleep", "shift", "night"],
    intro: "Today you'll describe your routine with simple, useful sentences.",
    neoPrompt: "The student is studying Daily Routine. Ask about their day using simple English and correct gently.",
    finalChallenge: "Describe your routine from waking up to sleeping.",
    mindBlocks: [
      ["I wake up early.", "Eu acordo cedo."],
      ["I go to work.", "Eu vou trabalhar."],
      ["I eat lunch at work.", "Eu almoco no trabalho."],
      ["I sleep during the day.", "Eu durmo durante o dia."],
      ["I work the night shift.", "Eu trabalho no turno da noite."],
      ["I get home in the morning.", "Eu chego em casa de manha."],
      ["I study English every day.", "Eu estudo ingles todos os dias."],
      ["My routine is busy.", "Minha rotina e corrida."],
    ],
  },
  {
    id: "questions",
    order: 3,
    title: "Questions",
    objective: "Ask and answer common questions.",
    difficulty: "Beginner",
    duration: "16 min",
    xp: 130,
    masteryRequired: 20,
    vocabulary: ["what", "where", "how", "do", "name", "from"],
    intro: "Today you'll learn questions that start real conversations.",
    neoPrompt: "The student is studying Questions. Practice short Q&A with beginner vocabulary.",
    finalChallenge: "Ask Neo 3 questions and answer 3 questions.",
    mindBlocks: [
      ["What's your name?", "Qual e o seu nome?"],
      ["Where are you from?", "De onde voce e?"],
      ["What do you do?", "O que voce faz?"],
      ["How old are you?", "Quantos anos voce tem?"],
      ["Do you speak English?", "Voce fala ingles?"],
      ["Where do you live?", "Onde voce mora?"],
      ["What do you like?", "Do que voce gosta?"],
      ["How are you today?", "Como voce esta hoje?"],
    ],
  },
  {
    id: "family",
    order: 4,
    title: "Family",
    objective: "Talk about family simply.",
    difficulty: "Beginner",
    duration: "15 min",
    xp: 120,
    masteryRequired: 30,
    vocabulary: ["family", "mother", "father", "brother", "sister", "have"],
    intro: "Today you'll talk about your family using simple structures.",
    neoPrompt: "The student is studying Family. Ask simple family questions and keep vocabulary beginner-friendly.",
    finalChallenge: "Say 4 sentences about your family.",
    mindBlocks: [
      ["I have a family.", "Eu tenho uma familia."],
      ["My mother is kind.", "Minha mae e gentil."],
      ["My father works a lot.", "Meu pai trabalha muito."],
      ["I have a brother.", "Eu tenho um irmao."],
      ["I have a sister.", "Eu tenho uma irma."],
      ["My family is important to me.", "Minha familia e importante para mim."],
    ],
  },
  {
    id: "feelings",
    order: 5,
    title: "Feelings",
    objective: "Say how you feel naturally.",
    difficulty: "Elementary",
    duration: "18 min",
    xp: 150,
    masteryRequired: 40,
    vocabulary: ["tired", "happy", "worried", "excited", "exhausted", "feel"],
    intro: "Today you'll describe feelings without translating word by word.",
    neoPrompt: "The student is studying Feelings. Practice emotional sentences and correct gently.",
    finalChallenge: "Describe how you feel today and why.",
    mindBlocks: [
      ["I'm tired.", "Eu estou cansado."],
      ["I'm exhausted.", "Eu estou exausto."],
      ["I'm happy today.", "Eu estou feliz hoje."],
      ["I'm a little worried.", "Eu estou um pouco preocupado."],
      ["I'm excited about this.", "Eu estou animado com isso."],
      ["I feel better now.", "Eu me sinto melhor agora."],
      ["I need some rest.", "Eu preciso descansar um pouco."],
    ],
  },
  {
    id: "work-english",
    order: 6,
    title: "Work English",
    objective: "Talk about work, shifts and tasks.",
    difficulty: "Elementary",
    duration: "22 min",
    xp: 180,
    masteryRequired: 50,
    vocabulary: ["factory", "shift", "meeting", "report", "machine", "engineer", "programmer"],
    intro: "Today you'll build useful English for your work context.",
    neoPrompt: "The student is studying Work English. Practice factory, shifts, meetings and reports with simple corrections.",
    finalChallenge: "Explain your job and one task you do at work.",
    mindBlocks: [
      ["I work in a factory.", "Eu trabalho em uma fabrica."],
      ["I work the night shift.", "Eu trabalho no turno da noite."],
      ["I have a meeting today.", "Eu tenho uma reuniao hoje."],
      ["I need to write a report.", "Eu preciso escrever um relatorio."],
      ["This machine is important.", "Esta maquina e importante."],
      ["I'm a programmer.", "Eu sou programador."],
      ["I work with engineers.", "Eu trabalho com engenheiros."],
    ],
  },
  {
    id: "technology",
    order: 7,
    title: "Technology",
    objective: "Use English for technology and development.",
    difficulty: "Elementary",
    duration: "22 min",
    xp: 180,
    masteryRequired: 60,
    vocabulary: ["computer", "software", "API", "database", "React", "bug", "deploy"],
    intro: "Today you'll connect English with programming and technology.",
    neoPrompt: "The student is studying Technology. Practice developer vocabulary in simple sentences.",
    finalChallenge: "Explain a simple software problem in English.",
    mindBlocks: [
      ["My computer is slow.", "Meu computador esta lento."],
      ["This software is useful.", "Este software e util."],
      ["The API is not working.", "A API nao esta funcionando."],
      ["The database is online.", "O banco de dados esta online."],
      ["I use React.", "Eu uso React."],
      ["There is a bug here.", "Ha um bug aqui."],
      ["I need to deploy the app.", "Eu preciso fazer deploy do app."],
    ],
  },
  {
    id: "travel",
    order: 8,
    title: "Travel",
    objective: "Handle basic travel situations.",
    difficulty: "Intermediate",
    duration: "20 min",
    xp: 170,
    masteryRequired: 70,
    vocabulary: ["airport", "hotel", "restaurant", "taxi", "passport", "ticket"],
    intro: "Today you'll learn survival English for travel.",
    neoPrompt: "The student is studying Travel. Simulate airport, hotel and restaurant situations.",
    finalChallenge: "Ask for help at an airport or hotel.",
    mindBlocks: [
      ["Where is the airport?", "Onde fica o aeroporto?"],
      ["I have a reservation.", "Eu tenho uma reserva."],
      ["Can I see the menu?", "Posso ver o cardapio?"],
      ["I need a taxi.", "Eu preciso de um taxi."],
      ["Here is my passport.", "Aqui esta meu passaporte."],
      ["Where is my ticket?", "Onde esta minha passagem?"],
    ],
  },
  {
    id: "small-talk",
    order: 9,
    title: "Small Talk",
    objective: "Start and maintain light conversations.",
    difficulty: "Intermediate",
    duration: "18 min",
    xp: 160,
    masteryRequired: 80,
    vocabulary: ["nice", "meet", "day", "weather", "weekend", "going"],
    intro: "Today you'll sound more natural in everyday small talk.",
    neoPrompt: "The student is studying Small Talk. Practice casual conversation with natural short replies.",
    finalChallenge: "Start a casual conversation and keep it going for 5 turns.",
    mindBlocks: [
      ["How are you?", "Como voce esta?"],
      ["Nice to meet you.", "Prazer em conhecer voce."],
      ["How's your day going?", "Como esta indo o seu dia?"],
      ["The weather is nice today.", "O clima esta bom hoje."],
      ["What are you doing this weekend?", "O que voce vai fazer neste fim de semana?"],
      ["That sounds great.", "Isso parece otimo."],
    ],
  },
  {
    id: "real-conversations",
    order: 10,
    title: "Real Conversations",
    objective: "Combine everything in complete simulations.",
    difficulty: "Advanced",
    duration: "30 min",
    xp: 250,
    masteryRequired: 90,
    vocabulary: ["introduce", "explain", "answer", "ask", "continue", "naturally"],
    intro: "Today you'll combine your MindBlocks into real conversations.",
    neoPrompt: "The student is studying Real Conversations. Run complete simulations and correct only what matters most.",
    finalChallenge: "Complete a simulated conversation using introduction, routine, work and small talk.",
    mindBlocks: [
      ["Let me introduce myself.", "Deixe-me me apresentar."],
      ["I can explain that.", "Eu consigo explicar isso."],
      ["Can you repeat that, please?", "Voce pode repetir, por favor?"],
      ["Let me think for a second.", "Deixe-me pensar por um segundo."],
      ["That makes sense.", "Isso faz sentido."],
      ["I want to continue practicing.", "Eu quero continuar praticando."],
    ],
  },
];

function buildInteractiveCourseMaterial(chapter) {
  const [primaryExpression, primaryTranslation] = chapter.mindBlocks[0] || ["", ""];
  const [secondExpression, secondTranslation] = chapter.mindBlocks[1] || chapter.mindBlocks[0] || ["", ""];
  const [thirdExpression, thirdTranslation] = chapter.mindBlocks[2] || chapter.mindBlocks[0] || ["", ""];
  const topic = chapter.title;

  return {
    lessonTitle: `Como usar ${topic} em conversas reais`,
    lesson: [
      `Neste capítulo, o objetivo não é decorar palavras soltas. Você vai treinar blocos prontos de pensamento para conseguir responder com mais naturalidade quando o assunto for ${topic}.`,
      `Leia a frase em inglês, entenda a ideia em português e repita o bloco inteiro em voz alta. O foco é criar reflexo: situação, frase útil e resposta natural.`,
      `Quando praticar com o Neo, tente usar pelo menos duas frases deste capítulo. Se errar, salve a correção como um novo MindBlock para revisar depois.`,
    ],
    examples: [
      {
        expression: primaryExpression,
        translation: primaryTranslation,
        context: "Use como frase principal quando quiser começar uma resposta simples.",
      },
      {
        expression: secondExpression,
        translation: secondTranslation,
        context: "Use como variação para deixar a conversa continuar sem travar.",
      },
      {
        expression: thirdExpression,
        translation: thirdTranslation,
        context: "Use quando precisar responder de forma curta, clara e natural.",
      },
    ],
    commonMistakes: [
      {
        wrong: "I am have...",
        correct: "I have...",
        reason: "Em inglês, use 'I have' para posse. Não misture 'am' com 'have'.",
      },
      {
        wrong: "I from Brazil.",
        correct: "I'm from Brazil.",
        reason: "Para dizer origem, use 'I'm from...' porque a frase precisa do verbo 'to be'.",
      },
    ],
    practiceDrills: [
      `Complete em inglês usando uma frase do capítulo: "${primaryTranslation}"`,
      `Crie uma frase pessoal começando com: "${primaryExpression.split(" ").slice(0, 3).join(" ")}..."`,
      `Envie uma resposta curta para o Neo usando duas palavras do vocabulário: ${chapter.vocabulary.slice(0, 2).join(" + ")}.`,
    ],
    miniQuiz: {
      question: `Como você usaria "${primaryExpression}" em uma situação real?`,
      hint: "Responda com uma frase curta, pessoal e natural. Depois peça para o Neo corrigir.",
    },
    studyTip: "Estude em três ciclos: ler, ouvir/repetir e usar em uma frase pessoal.",
  };
}

const chapterMaterialOverrides = {
  "about-me": {
    commonMistakes: [
      {
        wrong: "My name Rafael.",
        correct: "My name is Rafael.",
        reason: "Em inglês, a frase precisa do verbo 'is' para ligar o nome à pessoa.",
      },
      {
        wrong: "I have 30 years.",
        correct: "I'm 30 years old.",
        reason: "Idade em inglês usa o verbo 'to be': I am / I'm.",
      },
    ],
    practiceDrills: [
      "Escreva 4 frases sobre você: nome, país, trabalho e objetivo.",
      "Fale em voz alta: My name is... I'm from... I work in...",
      "Peça ao Neo: 'Practice introductions with me slowly.'",
    ],
  },
  "daily-routine": {
    commonMistakes: [
      {
        wrong: "I work in night.",
        correct: "I work at night.",
        reason: "Para período do dia, use 'at night'.",
      },
      {
        wrong: "I go to home.",
        correct: "I go home.",
        reason: "'Home' geralmente não usa 'to' depois de go.",
      },
    ],
  },
  questions: {
    commonMistakes: [
      {
        wrong: "Where you live?",
        correct: "Where do you live?",
        reason: "Perguntas no presente simples usam auxiliar 'do'.",
      },
      {
        wrong: "What you do?",
        correct: "What do you do?",
        reason: "Use 'do' para formar perguntas comuns.",
      },
    ],
  },
  family: {
    commonMistakes: [
      {
        wrong: "I have 2 brothers and 1 sisters.",
        correct: "I have 2 brothers and 1 sister.",
        reason: "Singular e plural precisam concordar com a quantidade.",
      },
      {
        wrong: "My mother have...",
        correct: "My mother has...",
        reason: "He/she/it usa 'has'.",
      },
    ],
  },
  feelings: {
    commonMistakes: [
      {
        wrong: "I am with tired.",
        correct: "I'm tired.",
        reason: "Sentimentos comuns usam 'I'm + adjective'.",
      },
      {
        wrong: "I have afraid.",
        correct: "I'm afraid.",
        reason: "Para emoções, muitas vezes usamos 'I'm'.",
      },
    ],
  },
  "work-english": {
    commonMistakes: [
      {
        wrong: "I work in night shift.",
        correct: "I work the night shift.",
        reason: "Para turno, a forma natural é 'work the night shift'.",
      },
      {
        wrong: "I need do a report.",
        correct: "I need to write a report.",
        reason: "Depois de 'need', use infinitivo: need to + verbo.",
      },
    ],
  },
  technology: {
    commonMistakes: [
      {
        wrong: "The API don't work.",
        correct: "The API doesn't work.",
        reason: "Para it/he/she, use 'doesn't'.",
      },
      {
        wrong: "I need deploy.",
        correct: "I need to deploy.",
        reason: "Depois de 'need', use 'to + verbo'.",
      },
    ],
  },
  travel: {
    commonMistakes: [
      {
        wrong: "I have reservation.",
        correct: "I have a reservation.",
        reason: "Substantivos contáveis no singular geralmente precisam de artigo.",
      },
      {
        wrong: "Where is taxi?",
        correct: "Where is the taxi?",
        reason: "Use 'the' quando fala de algo específico.",
      },
    ],
  },
  "small-talk": {
    commonMistakes: [
      {
        wrong: "How is going?",
        correct: "How's it going?",
        reason: "A expressão natural inclui 'it'.",
      },
      {
        wrong: "The weather is good today?",
        correct: "Is the weather good today?",
        reason: "Perguntas com 'to be' invertem sujeito e verbo.",
      },
    ],
  },
  "real-conversations": {
    commonMistakes: [
      {
        wrong: "Can you repeat, please?",
        correct: "Can you repeat that, please?",
        reason: "Use 'that' para indicar o que precisa ser repetido.",
      },
      {
        wrong: "Let me to think.",
        correct: "Let me think.",
        reason: "Depois de 'let me', use o verbo base, sem 'to'.",
      },
    ],
  },
};

export const learningJourneyChapters = baseLearningJourneyChapters.map((chapter) => ({
  ...chapter,
  ...buildInteractiveCourseMaterial(chapter),
  ...(chapterMaterialOverrides[chapter.id] || {}),
}));

export function getInitialJourneyProgress() {
  return {
    activeChapterId: learningJourneyChapters[0].id,
    completedChapterIds: [],
    chapterProgress: {},
    lastUpdatedAt: null,
  };
}

export function getChapterChecklist(chapter, progress = {}) {
  const current = progress.chapterProgress?.[chapter.id] || {};
  return [
    { id: "lesson", label: "Aula", complete: Boolean(current.lesson) },
    { id: "vocabulary", label: "Vocabulário", complete: Boolean(current.vocabulary) },
    { id: "mindblocks", label: "MindBlocks", complete: Boolean(current.mindblocks) },
    { id: "examples", label: "Exemplos", complete: Boolean(current.examples) },
    { id: "mistakes", label: "Erros", complete: Boolean(current.mistakes) },
    { id: "review", label: "Revisão", complete: Boolean(current.review) },
    { id: "listening", label: "Escuta", complete: Boolean(current.listening) },
    { id: "practice", label: "Exercícios", complete: Boolean(current.practice) },
    { id: "conversation", label: "Conversa", complete: Boolean(current.conversation) },
    { id: "challenge", label: "Desafio", complete: Boolean(current.challenge) },
  ];
}

export function getOverallJourneyProgress(progress) {
  const completed = progress.completedChapterIds?.length || 0;
  return Math.round((completed / learningJourneyChapters.length) * 100);
}
