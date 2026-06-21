import { Link } from "react-router-dom";

const CONTACT_SUPPORT = "suporte@fluentmind.app";

const TERMS_SECTIONS = [
  {
    title: "1. Aceitacao dos Termos",
    content: [
      "Ao utilizar o FluentMind, voce concorda com estes Termos de Uso e com a Politica de Privacidade. Se nao concordar com alguma condicao, interrompa o uso da plataforma.",
    ],
  },
  {
    title: "2. Descricao do servico",
    content: [
      "O FluentMind e uma plataforma de aprendizado de idiomas baseada em conversas com IA, expressoes salvas, revisao inteligente e acompanhamento de progresso.",
    ],
    list: [
      "Conversas com IA para pratica contextual.",
      "Biblioteca pessoal de MindBlocks e expressoes uteis.",
      "Revisao de frases, erros corrigidos e playlists de estudo.",
      "Dashboard de progresso e metas de pratica.",
      "O aplicativo tem carater educacional e nao substitui acompanhamento pedagogico profissional quando necessario.",
    ],
  },
  {
    title: "3. Cadastro e seguranca",
    content: [
      "Para acessar todas as funcionalidades e necessario criar uma conta pessoal com informacoes verdadeiras. Voce e responsavel por manter a confidencialidade das credenciais.",
    ],
  },
  {
    title: "4. Uso de IA",
    content: [
      "As respostas geradas por IA podem conter erros, imprecisoes ou sugestoes inadequadas ao contexto. Use o conteudo como apoio de estudo e revise informacoes importantes.",
    ],
  },
  {
    title: "5. Uso responsavel",
    content: [
      "Para preservar a experiencia de todos, e proibido utilizar o FluentMind para:",
    ],
    list: [
      "Atividades ilegais, abusivas ou fraudulentas.",
      "Insercao de dados ofensivos, discriminatorios ou sensiveis de terceiros.",
      "Engenharia reversa, copia, modificacao ou revenda nao autorizada do software.",
      "Tentativas de contornar limites, autenticacao ou mecanismos de seguranca.",
    ],
  },
  {
    title: "6. Limitacao de responsabilidade",
    content: [
      "O FluentMind oferece recursos educacionais e automatizados. Nao garantimos fluencia, certificacoes ou resultados especificos, pois o progresso depende de pratica, contexto e consistencia individual.",
    ],
  },
  {
    title: "7. Propriedade intelectual",
    content: [
      "Marca, logotipo, interface, conteudos e codigo-fonte sao protegidos por leis de direitos autorais e propriedade intelectual.",
    ],
  },
  {
    title: "8. Alteracoes nos termos",
    content: [
      "Estes Termos podem ser atualizados mediante aviso dentro do aplicativo ou por canais oficiais. O uso continuo apos mudancas representa aceite das novas condicoes.",
    ],
  },
  {
    title: "9. Contato",
    content: [
      `Duvidas e solicitacoes podem ser enviadas para ${CONTACT_SUPPORT}.`,
    ],
  },
];

function TermsOfUsePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-16 sm:px-6 lg:px-8">
        <header className="space-y-4 rounded-3xl border border-slate-200 bg-white/95 p-8 shadow-xl shadow-slate-900/5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
          <p className="text-sm font-medium uppercase tracking-widest text-violet-500">Termos de Uso</p>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">
            Termos de Uso - FluentMind
          </h1>
          <p className="text-base text-slate-500 dark:text-slate-300">
            Ultima atualizacao: Junho de 2026
          </p>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            <span>Plataforma educacional de idiomas</span>
            <span className="h-1 w-1 rounded-full bg-slate-400" aria-hidden />
            <span>Conversas, revisoes e progresso com IA</span>
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
            Para mais detalhes sobre tratamento de dados, consulte a{" "}
            <Link
              to="/politica-de-privacidade"
              className="font-semibold text-sky-600 underline-offset-4 hover:underline"
            >
              Politica de Privacidade
            </Link>
            .
          </p>
        </footer>
      </div>
    </div>
  );
}

export default TermsOfUsePage;
