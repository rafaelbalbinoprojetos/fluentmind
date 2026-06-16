const AUTH_ERROR_TRANSLATIONS = [
  {
    test: (message) => message.includes("email not confirmed"),
    message: "Email nao confirmado. Verifique sua caixa de entrada e confirme o cadastro antes de entrar.",
  },
  {
    test: (message) => message.includes("invalid login credentials"),
    message: "Email ou senha invalidos. Verifique os dados e tente novamente.",
  },
  {
    test: (message) => message.includes("user already registered"),
    message: "Este email ja esta cadastrado. Tente entrar com sua senha ou recupere o acesso.",
  },
  {
    test: (message) => message.includes("email rate limit exceeded"),
    message: "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.",
  },
  {
    test: (message) => message.includes("for security purposes") && message.includes("once every"),
    message: "Por seguranca, aguarde um instante antes de solicitar um novo link.",
  },
  {
    test: (message) => message.includes("signup is disabled"),
    message: "No momento, o cadastro de novas contas esta desativado.",
  },
  {
    test: (message) => message.includes("password should be at least"),
    message: "A senha precisa ter pelo menos 6 caracteres.",
  },
  {
    test: (message) => message.includes("unable to validate email address"),
    message: "Nao foi possivel validar este email. Verifique o endereco informado.",
  },
];

export function translateAuthErrorMessage(error, fallbackMessage) {
  const rawMessage = String(error?.message || "").trim();
  const normalizedMessage = rawMessage.toLowerCase();

  for (const translation of AUTH_ERROR_TRANSLATIONS) {
    if (translation.test(normalizedMessage)) {
      return translation.message;
    }
  }

  return rawMessage || fallbackMessage || "Nao foi possivel autenticar agora.";
}

