import { Link } from "react-router-dom";

const CONTACT_SUPPORT = "suporte@granaapp.com.br";

const TERMS_SECTIONS = [
  {
    title: "1. Aceitação dos Termos",
    content: [
      "Ao utilizar o KORDEN, você concorda integralmente com estes Termos de Uso e com a Política de Privacidade. Se não concordar com alguma condição, interrompa o uso do aplicativo.",
    ],
  },
  {
    title: "2. Descrição do serviço",
    content: [
      "A KORDEN é uma plataforma de gestão financeira pessoal que oferece recursos para acompanhar renda, despesas e metas.",
    ],
    list: [
      "Controle detalhado de rendas e despesas.",
      "Gestão de despesas fixas e investimentos.",
      "Cálculos automáticos de juros compostos e simulações.",
      "Registro de horas extras, ganhos pontuais e metas.",
      "Biblioteca com conteúdos e materiais de estudo.",
      "Chatbot financeiro para dúvidas rápidas e sugestões.",
      "O aplicativo tem caráter educacional e não configura consultoria financeira formal.",
    ],
  },
  {
    title: "3. Cadastro e segurança",
    content: [
      "Para acessar todas as funcionalidades é necessário criar uma conta pessoal com informações verdadeiras. Você é responsável por manter a confidencialidade das credenciais e não compartilhar sua conta.",
    ],
  },
  {
    title: "4. Planos e pagamentos",
    content: [
      "Oferecemos recursos gratuitos e planos Premium com pagamento via Mercado Pago.",
    ],
    list: [
      "As assinaturas são processadas com segurança pelo Mercado Pago.",
      "O cancelamento pode ser feito a qualquer momento, mas valores já pagos não são reembolsados após o período ativo.",
    ],
  },
  {
    title: "5. Uso responsável",
    content: [
      "Para preservar a experiência de todos, é proibido utilizar o KORDEN para:",
    ],
    list: [
      "Atividades ilegais ou fraudulentas.",
      "Inserção de dados falsos, ofensivos ou sensíveis.",
      "Engenharia reversa, cópia, modificação ou revenda do software.",
      "Qualquer tentativa de contornar mecanismos de segurança.",
    ],
  },
  {
    title: "6. Limitação de responsabilidade",
    content: [
      "Os dados e projeções exibidos são estimativas automáticas. A KORDEN não se responsabiliza por perdas financeiras decorrentes de decisões tomadas com base nas informações do aplicativo.",
    ],
  },
  {
    title: "7. Propriedade intelectual",
    content: [
      "Marca, logotipo, interface, conteúdos e código-fonte são propriedade exclusiva da KORDEN e protegidos por leis de direitos autorais.",
    ],
  },
  {
    title: "8. Alterações nos termos",
    content: [
      "Estes Termos podem ser atualizados mediante aviso dentro do aplicativo. O uso contínuo após mudanças representa aceite automático das novas condições.",
    ],
  },
  {
    title: "9. Contato",
    content: [
      `Dúvidas e solicitações podem ser enviadas para ${CONTACT_SUPPORT}. Estamos à disposição para ajudar.`,
    ],
  },
];

function TermsOfUsePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-16 sm:px-6 lg:px-8">
        <header className="space-y-4 rounded-3xl border border-slate-200 bg-white/95 p-8 shadow-xl shadow-slate-900/5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
          <p className="text-sm font-medium uppercase tracking-widest text-sky-500">
            Termos de Uso
          </p>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">
            Termos de Uso – KORDEN
          </h1>
          <p className="text-base text-slate-500 dark:text-slate-300">
            Última atualização: Novembro de 2025 · Endereço:{" "}
            <a
              href="https://www.korden.com.br"
              className="font-medium text-sky-600 underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              www.korden.com.br
            </a>
          </p>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            <span>Serviço educacional e organizador financeiro</span>
            <span className="h-1 w-1 rounded-full bg-slate-400" aria-hidden />
            <span>Conectado ao Mercado Pago</span>
          </div>
        </header>

        <section className="space-y-10 rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-lg shadow-slate-900/5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
          {TERMS_SECTIONS.map((section) => (
            <article key={section.title} className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{section.title}</h2>
              {section.content.map((paragraph) => (
                <p key={paragraph} className="text-base leading-relaxed text-slate-600 dark:text-slate-300">
                  {paragraph}
                </p>
              ))}
              {section.list && (
                <ul className="list-disc space-y-2 pl-6 text-base text-slate-600 dark:text-slate-300">
                  {section.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </section>

        <footer className="rounded-3xl border border-slate-200 bg-gradient-to-r from-violet-500/10 to-sky-500/10 p-8 text-slate-700 shadow-lg shadow-slate-900/5 dark:border-slate-800 dark:text-slate-200">
          <p className="text-base">
            Para mais detalhes sobre como tratamos os seus dados, consulte a{" "}
            <Link
              to="/politica-de-privacidade"
              className="font-semibold text-sky-600 underline-offset-4 hover:underline"
            >
              Política de Privacidade
            </Link>
            .
          </p>
        </footer>
      </div>
    </div>
  );
}

export default TermsOfUsePage;
