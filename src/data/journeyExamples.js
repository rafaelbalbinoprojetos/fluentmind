// Exemplos reais da Jornada: cada MindBlock aparece dentro de um mini diálogo, numa situação concreta.
// "expression" precisa aparecer literalmente (sem a pontuação final) em uma das falas de "you".
export const journeyExamples = {
  "about-me": [
    {
      expression: "I'm from Brazil.",
      situation: "Primeiro dia num curso online, apresentando-se ao grupo",
      dialogue: [
        { speaker: "teacher", en: "Welcome! Where are you from?", pt: "Bem-vindo! De onde você é?" },
        { speaker: "you", en: "Hi everyone! I'm from Brazil, from a small city in Minas Gerais.", pt: "Oi, pessoal! Eu sou do Brasil, de uma cidade pequena em Minas Gerais." },
      ],
      note: "Depois de \"I'm from\", acrescente um detalhe (cidade, estado) para a resposta soar natural.",
    },
    {
      expression: "I work in technology.",
      situation: "Conversa com um colega estrangeiro numa reunião",
      dialogue: [
        { speaker: "other", en: "So, what do you do?", pt: "E aí, o que você faz?" },
        { speaker: "you", en: "I work in technology. I build websites for small businesses.", pt: "Eu trabalho com tecnologia. Eu crio sites para pequenas empresas." },
      ],
      note: "\"I work in\" + área. Logo depois, uma frase curta explicando o que você faz de fato.",
    },
    {
      expression: "Nice to meet you.",
      situation: "Sendo apresentado a alguém",
      dialogue: [
        { speaker: "other", en: "This is Anna, she's our new designer.", pt: "Esta é a Anna, a nossa nova designer." },
        { speaker: "you", en: "Hi Anna, nice to meet you. I'm Lucas.", pt: "Oi, Anna, prazer em te conhecer. Eu sou o Lucas." },
      ],
      note: "Use só no primeiro encontro. Ao se despedir, diga \"Nice meeting you\".",
    },
  ],
  "daily-routine": [
    {
      expression: "I wake up early.",
      situation: "Um amigo pergunta por que você sempre responde cedo",
      dialogue: [
        { speaker: "other", en: "You always answer my messages at 6 a.m.!", pt: "Você sempre responde minhas mensagens às 6 da manhã!" },
        { speaker: "you", en: "Yeah, I wake up early. I like to have a quiet coffee before work.", pt: "É, eu acordo cedo. Gosto de tomar um café tranquilo antes do trabalho." },
      ],
      note: "Troque \"early\" por um horário: \"I wake up at six.\"",
    },
    {
      expression: "I work the night shift.",
      situation: "Marcando um encontro com alguém",
      dialogue: [
        { speaker: "other", en: "Can we meet tonight at eight?", pt: "Podemos nos encontrar hoje às oito da noite?" },
        { speaker: "you", en: "Sorry, I can't. I work the night shift this week. How about Saturday?", pt: "Desculpe, não posso. Eu trabalho no turno da noite esta semana. Que tal sábado?" },
      ],
      note: "É \"work the night shift\", com \"the\". Sem \"in\".",
    },
    {
      expression: "I eat lunch at work.",
      situation: "Colega convidando para almoçar fora",
      dialogue: [
        { speaker: "other", en: "Do you want to grab lunch downtown?", pt: "Quer almoçar lá no centro?" },
        { speaker: "you", en: "On most days I eat lunch at work, but today I can go!", pt: "Na maioria dos dias eu almoço no trabalho, mas hoje eu posso ir!" },
      ],
      note: "Para falar de hábito, acrescente frequência: \"On most days...\", \"Every day...\".",
    },
  ],
  questions: [
    {
      expression: "What do you do?",
      situation: "Puxando assunto numa festa",
      dialogue: [
        { speaker: "you", en: "So, what do you do?", pt: "E então, o que você faz?" },
        { speaker: "other", en: "I'm a nurse. I work at the city hospital.", pt: "Sou enfermeira. Trabalho no hospital da cidade." },
      ],
      note: "Pergunta sobre profissão. Não confunda com \"What are you doing?\" (o que você está fazendo agora).",
    },
    {
      expression: "Where are you from?",
      situation: "Conhecendo alguém num hostel",
      dialogue: [
        { speaker: "you", en: "I love your accent! Where are you from?", pt: "Adorei seu sotaque! De onde você é?" },
        { speaker: "other", en: "Thanks! I'm from Ireland, near Dublin.", pt: "Obrigado! Sou da Irlanda, perto de Dublin." },
      ],
      note: "A resposta usa a mesma estrutura: \"I'm from...\"",
    },
    {
      expression: "How are you today?",
      situation: "Começando uma aula ou reunião",
      dialogue: [
        { speaker: "you", en: "Good morning, Mark! How are you today?", pt: "Bom dia, Mark! Como você está hoje?" },
        { speaker: "other", en: "Pretty good, thanks. A bit tired, but good!", pt: "Bem, obrigado. Um pouco cansado, mas bem!" },
      ],
      note: "\"Today\" deixa a pergunta mais pessoal do que só \"How are you?\".",
    },
  ],
  family: [
    {
      expression: "I have a sister.",
      situation: "Mostrando uma foto no celular",
      dialogue: [
        { speaker: "other", en: "Who's that in the picture?", pt: "Quem é essa na foto?" },
        { speaker: "you", en: "That's Julia. I have a sister, and she's two years younger than me.", pt: "É a Julia. Eu tenho uma irmã, e ela é dois anos mais nova que eu." },
      ],
      note: "Para mais de um: \"I have two sisters\" (plural com -s).",
    },
    {
      expression: "My father works a lot.",
      situation: "Explicando por que seu pai não veio",
      dialogue: [
        { speaker: "other", en: "Is your dad coming to the party?", pt: "Seu pai vem para a festa?" },
        { speaker: "you", en: "Probably not. My father works a lot, even on weekends.", pt: "Provavelmente não. Meu pai trabalha muito, até nos fins de semana." },
      ],
      note: "Com he/she, o verbo ganha -s: \"works\", \"has\", \"goes\".",
    },
    {
      expression: "My family is important to me.",
      situation: "Recusando uma vaga que exige mudar de cidade",
      dialogue: [
        { speaker: "other", en: "Why don't you move to São Paulo for the job?", pt: "Por que você não se muda para São Paulo pelo emprego?" },
        { speaker: "you", en: "My family is important to me, and they all live here.", pt: "Minha família é importante para mim, e todos eles moram aqui." },
      ],
      note: "\"Family\" é singular: \"my family is\", não \"are\".",
    },
  ],
  feelings: [
    {
      expression: "I'm exhausted.",
      situation: "Chegando em casa depois de um plantão",
      dialogue: [
        { speaker: "other", en: "You look tired. Long day?", pt: "Você parece cansado. Dia longo?" },
        { speaker: "you", en: "Very long. I'm exhausted. I just want to sleep.", pt: "Muito longo. Estou exausto. Só quero dormir." },
      ],
      note: "\"Exhausted\" já é muito cansado. Não diga \"very exhausted\".",
    },
    {
      expression: "I'm a little worried.",
      situation: "Antes de uma entrevista de emprego",
      dialogue: [
        { speaker: "other", en: "Are you ready for the interview tomorrow?", pt: "Está pronto para a entrevista amanhã?" },
        { speaker: "you", en: "I think so, but I'm a little worried about my English.", pt: "Acho que sim, mas estou um pouco preocupado com o meu inglês." },
      ],
      note: "\"Worried about\" + o motivo da preocupação.",
    },
    {
      expression: "I feel better now.",
      situation: "Um amigo pergunta como você está depois de ficar doente",
      dialogue: [
        { speaker: "other", en: "Are you still sick?", pt: "Você ainda está doente?" },
        { speaker: "you", en: "No, I feel better now. Thanks for asking!", pt: "Não, eu me sinto melhor agora. Obrigado por perguntar!" },
      ],
      note: "\"Feel\" + adjetivo: \"I feel tired / better / great\".",
    },
  ],
  "work-english": [
    {
      expression: "I have a meeting today.",
      situation: "Recusando uma ligação",
      dialogue: [
        { speaker: "other", en: "Can I call you at three?", pt: "Posso te ligar às três?" },
        { speaker: "you", en: "I have a meeting today at three. Can you call me at four?", pt: "Eu tenho uma reunião hoje às três. Pode me ligar às quatro?" },
      ],
      note: "Use \"have\" para compromissos: \"I have a meeting / an appointment\".",
    },
    {
      expression: "I need to write a report.",
      situation: "Explicando por que vai ficar até mais tarde",
      dialogue: [
        { speaker: "other", en: "Aren't you going home?", pt: "Você não vai para casa?" },
        { speaker: "you", en: "Not yet. I need to write a report for tomorrow's meeting.", pt: "Ainda não. Eu preciso escrever um relatório para a reunião de amanhã." },
      ],
      note: "Depois de \"need\" vem \"to\" + verbo: \"need to write\".",
    },
    {
      expression: "I work with engineers.",
      situation: "Contando sobre a equipe numa entrevista",
      dialogue: [
        { speaker: "other", en: "Tell me about your team.", pt: "Fale um pouco sobre a sua equipe." },
        { speaker: "you", en: "I work with engineers and designers. We meet every morning.", pt: "Eu trabalho com engenheiros e designers. A gente se reúne toda manhã." },
      ],
      note: "\"Work with\" = trabalhar junto com pessoas. \"Work in\" = área ou lugar.",
    },
  ],
  technology: [
    {
      expression: "The API is not working.",
      situation: "Avisando o time no chat",
      dialogue: [
        { speaker: "you", en: "Hey team, the API is not working. Users can't log in.", pt: "Oi, pessoal, a API não está funcionando. Os usuários não conseguem entrar." },
        { speaker: "other", en: "Thanks! I'm checking the server now.", pt: "Valeu! Estou verificando o servidor agora." },
      ],
      note: "Na fala, é mais comum a contração: \"The API isn't working\".",
    },
    {
      expression: "There is a bug here.",
      situation: "Revisando código com um colega",
      dialogue: [
        { speaker: "you", en: "Look at this line. There is a bug here: the total is always zero.", pt: "Olha esta linha. Tem um bug aqui: o total sempre dá zero." },
        { speaker: "other", en: "Good catch! Let's fix it.", pt: "Boa! Vamos corrigir." },
      ],
      note: "\"There is\" apresenta algo novo. Depois, explique o problema.",
    },
    {
      expression: "I need to deploy the app.",
      situation: "Fim do dia de trabalho",
      dialogue: [
        { speaker: "other", en: "Do you want to grab a beer?", pt: "Quer tomar uma cerveja?" },
        { speaker: "you", en: "In thirty minutes. I need to deploy the app first.", pt: "Daqui a trinta minutos. Eu preciso fazer o deploy do app primeiro." },
      ],
      note: "\"First\" no final indica o que vem antes do resto.",
    },
  ],
  travel: [
    {
      expression: "I have a reservation.",
      situation: "Chegando à recepção do hotel",
      dialogue: [
        { speaker: "other", en: "Good evening! How can I help you?", pt: "Boa noite! Como posso ajudar?" },
        { speaker: "you", en: "Hi, I have a reservation under the name Silva.", pt: "Oi, eu tenho uma reserva no nome de Silva." },
      ],
      note: "\"Under the name\" + sobrenome é a forma natural de dizer em nome de quem está a reserva.",
    },
    {
      expression: "Can I see the menu?",
      situation: "Sentando num restaurante",
      dialogue: [
        { speaker: "other", en: "Hello! Are you ready to order?", pt: "Olá! Já posso anotar o pedido?" },
        { speaker: "you", en: "Not yet, sorry. Can I see the menu, please?", pt: "Ainda não, desculpe. Posso ver o cardápio, por favor?" },
      ],
      note: "\"Please\" no final deixa o pedido mais educado.",
    },
    {
      expression: "Where is the airport?",
      situation: "Pedindo informação na rua",
      dialogue: [
        { speaker: "you", en: "Excuse me, where is the airport? Is it far from here?", pt: "Com licença, onde fica o aeroporto? É longe daqui?" },
        { speaker: "other", en: "About twenty minutes by taxi.", pt: "Uns vinte minutos de táxi." },
      ],
      note: "Comece com \"Excuse me\" para chamar a atenção de um desconhecido.",
    },
  ],
  "small-talk": [
    {
      expression: "How's your day going?",
      situation: "Encontrando um colega no café",
      dialogue: [
        { speaker: "you", en: "Hey Tom! How's your day going?", pt: "Oi, Tom! Como está indo o seu dia?" },
        { speaker: "other", en: "Busy, but good. And you?", pt: "Corrido, mas bem. E o seu?" },
      ],
      note: "Uma pergunta mais calorosa do que só \"How are you?\".",
    },
    {
      expression: "What are you doing this weekend?",
      situation: "Sexta-feira no fim do expediente",
      dialogue: [
        { speaker: "you", en: "Finally Friday! What are you doing this weekend?", pt: "Enfim sexta! O que você vai fazer neste fim de semana?" },
        { speaker: "other", en: "I'm going to the beach with my kids.", pt: "Vou à praia com os meus filhos." },
      ],
      note: "Em inglês, o presente contínuo também fala de planos próximos.",
    },
    {
      expression: "That sounds great.",
      situation: "Reagindo ao plano de alguém",
      dialogue: [
        { speaker: "other", en: "We're having a barbecue on Sunday. Want to come?", pt: "Vamos fazer um churrasco no domingo. Quer vir?" },
        { speaker: "you", en: "That sounds great! What time should I be there?", pt: "Parece ótimo! Que horas eu devo chegar?" },
      ],
      note: "Reaja e já faça uma pergunta: assim a conversa continua.",
    },
  ],
  "real-conversations": [
    {
      expression: "Can you repeat that, please?",
      situation: "Não entendeu o que o atendente disse",
      dialogue: [
        { speaker: "other", en: "Your total is forty-two fifty, card or cash?", pt: "Dá quarenta e dois e cinquenta, cartão ou dinheiro?" },
        { speaker: "you", en: "Sorry, can you repeat that, please? A little slower?", pt: "Desculpe, pode repetir, por favor? Um pouco mais devagar?" },
      ],
      note: "Pedir para repetir é normal. \"A little slower\" ajuda muito no começo.",
    },
    {
      expression: "Let me think for a second.",
      situation: "Uma pergunta difícil numa entrevista",
      dialogue: [
        { speaker: "other", en: "What's your biggest weakness?", pt: "Qual é o seu maior ponto fraco?" },
        { speaker: "you", en: "Hmm, let me think for a second... I sometimes take on too many tasks.", pt: "Hmm, deixa eu pensar um segundo... Às vezes eu assumo tarefas demais." },
      ],
      note: "Ganha tempo para pensar em inglês, sem silêncio constrangedor.",
    },
    {
      expression: "That makes sense.",
      situation: "Depois de uma explicação",
      dialogue: [
        { speaker: "other", en: "We changed the deadline because the client needs more time.", pt: "Mudamos o prazo porque o cliente precisa de mais tempo." },
        { speaker: "you", en: "Oh, okay. That makes sense. Thanks for explaining.", pt: "Ah, entendi. Faz sentido. Obrigado por explicar." },
      ],
      note: "Mostra que você entendeu e concorda com o raciocínio.",
    },
  ],
};
