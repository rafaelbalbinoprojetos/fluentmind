import { Link } from "react-router-dom";

const CONTACT_SUPPORT = "suporte@fluentmind.app";
const CONTACT_PRIVACY = "privacidade@fluentmind.app";

const PRIVACY_SECTIONS = [
  {
    title: "1. Introducao",
    content: [
      "O FluentMind valoriza sua privacidade. Esta Politica descreve como tratamos dados pessoais durante o uso da plataforma de aprendizado de idiomas.",
    ],
  },
  {
    title: "2. Informacoes que coletamos",
    content: [
      "Coletamos somente as informacoes necessarias para manter o funcionamento e a evolucao da plataforma.",
    ],
    list: [
      "Dados de cadastro, como nome, e-mail e senha.",
      "Conteudos de aprendizado criados pelo usuario, como expressoes salvas, conversas, revisoes, playlists, notas e erros corrigidos.",
      "Informacoes tecnicas do dispositivo, navegador, cookies e endereco IP para seguranca, analise e melhoria da experiencia.",
    ],
  },
  {
    title: "3. Como utilizamos suas informacoes",
    content: [
      "Utilizamos os dados pessoais para oferecer uma experiencia personalizada, segura e orientada ao aprendizado.",
    ],
    list: [
      "Fornecer e aprimorar os recursos do FluentMind.",
      "Personalizar conversas com IA, revisoes e sugestoes de estudo.",
      "Salvar expressoes, progresso e preferencias do usuario.",
      "Garantir autenticacao, seguranca e integridade das contas.",
    ],
  },
  {
    title: "4. Compartilhamento de informacoes",
    content: [
      "Nao vendemos ou alugamos dados pessoais. Compartilhamos informacoes apenas quando necessario para operacao, seguranca ou cumprimento legal.",
    ],
    list: [
      "Hospedagem, autenticacao e banco de dados em provedores de infraestrutura como Supabase e Vercel.",
      "Processamento de recursos de IA por provedores configurados no ambiente do projeto.",
      "Cumprimento de obrigacoes legais ou decisoes judiciais.",
    ],
  },
  {
    title: "5. Armazenamento e seguranca",
    content: [
      "Os dados sao armazenados em infraestruturas seguras, com controles tecnicos e administrativos para reduzir riscos de acesso nao autorizado.",
    ],
  },
  {
    title: "6. Direitos do usuario",
    content: [
      "Voce mantem controle sobre seus dados e pode solicitar acesso, correcao, exclusao, encerramento de conta ou revogacao de consentimentos.",
      `Solicitacoes podem ser enviadas para ${CONTACT_SUPPORT} ou outro canal oficial disponivel no aplicativo.`,
    ],
  },
  {
    title: "7. Cookies e tecnologias similares",
    content: [
      "Utilizamos cookies e tecnologias similares para manter sessao, melhorar desempenho, analisar uso e personalizar a experiencia.",
    ],
  },
  {
    title: "8. Alteracoes desta Politica",
    content: [
      "Esta Politica pode ser atualizada. Mudancas relevantes serao comunicadas dentro do aplicativo ou por canais oficiais.",
    ],
  },
  {
    title: "9. Contato",
    content: [
      `Envie duvidas sobre privacidade para ${CONTACT_PRIVACY}.`,
      `Questoes gerais sobre a conta podem ser enviadas para ${CONTACT_SUPPORT}.`,
    ],
  },
];

function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-16 sm:px-6 lg:px-8">
        <header className="space-y-4 rounded-3xl border border-slate-200 bg-white/95 p-8 shadow-xl shadow-slate-900/5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
          <p className="text-sm font-medium uppercase tracking-widest text-sky-500">Politica de Privacidade</p>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">
            Politica de Privacidade - FluentMind
          </h1>
          <p className="text-base text-slate-500 dark:text-slate-300">
            Ultima atualizacao: Junho de 2026
          </p>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            <span>Dados hospedados em ambiente seguro</span>
            <span className="h-1 w-1 rounded-full bg-slate-400" aria-hidden />
            <span>Compromisso com a LGPD</span>
          </div>
        </header>

        <section className="space-y-10 rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-lg shadow-slate-900/5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
          {PRIVACY_SECTIONS.map((section) => (
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

        <footer className="rounded-3xl border border-slate-200 bg-gradient-to-r from-sky-500/10 to-violet-500/10 p-8 text-slate-700 shadow-lg shadow-slate-900/5 dark:border-slate-800 dark:text-slate-200">
          <p className="text-base">
            Consulte tambem os{" "}
            <Link to="/termos-de-uso" className="font-semibold text-sky-600 underline-offset-4 hover:underline">
              Termos de Uso
            </Link>{" "}
            para entender as regras da plataforma.
          </p>
        </footer>
      </div>
    </div>
  );
}

export default PrivacyPolicyPage;
