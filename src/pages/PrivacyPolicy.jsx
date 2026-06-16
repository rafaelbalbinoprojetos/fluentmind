import { Link } from "react-router-dom";

const CONTACT_SUPPORT = "suporte@granaapp.com.br";
const CONTACT_PRIVACY = "privacidade@granaapp.com.br";

const PRIVACY_SECTIONS = [
  {
    title: "1. Introdução",
    content: [
      "A KORDEN valoriza sua privacidade e esta Política descreve como tratamos seus dados pessoais durante o uso do nosso aplicativo de gestão financeira.",
    ],
  },
  {
    title: "2. Informações que coletamos",
    content: [
      "Coletamos somente as informações necessárias para manter o funcionamento e a evolução da plataforma.",
    ],
    list: [
      "Dados de cadastro (nome, e-mail e senha).",
      "Dados financeiros inseridos pelos usuários (rendas, despesas, investimentos, horas extras, metas e registros de estudo).",
      "Informações técnicas do dispositivo (navegador, cookies, endereço IP) utilizadas para análises e melhorias.",
    ],
  },
  {
    title: "3. Como utilizamos suas informações",
    content: [
      "Utilizamos os dados pessoais exclusivamente para oferecer uma experiência personalizada e segura.",
    ],
    list: [
      "Fornecer e aprimorar os serviços da KORDEN.",
      "Gerar relatórios, simulações e cálculos financeiros (juros compostos, análises e estatísticas).",
      "Exibir conteúdos educacionais e materiais de estudo relevantes.",
      "Processar pagamentos e assinaturas na integração com o Mercado Pago.",
      "Garantir segurança, autenticação e integridade das contas.",
    ],
  },
  {
    title: "4. Compartilhamento de informações",
    content: [
      "Não vendemos ou alugamos dados pessoais. Compartilhamos informações apenas em situações específicas:",
    ],
    list: [
      "Processamento de pagamentos com o Mercado Pago.",
      "Cumprimento de obrigações legais ou decisões judiciais.",
      "Processos de fusão, aquisição ou reestruturação, sempre com aviso prévio.",
    ],
  },
  {
    title: "5. Armazenamento e segurança",
    content: [
      "Os dados são armazenados em infraestruturas seguras e criptografadas (Supabase e Vercel), com controles técnicos e administrativos que evitam acessos não autorizados.",
    ],
  },
  {
    title: "6. Direitos do usuário",
    content: [
      "Você mantém controle sobre seus dados e pode solicitar a qualquer momento:",
    ],
    list: [
      "Acesso, correção ou exclusão das informações pessoais.",
      "Encerramento da conta e revogação de consentimentos.",
      `Todas as solicitações podem ser feitas pelo e-mail ${CONTACT_SUPPORT} ou por outro canal oficial disponível no aplicativo.`,
    ],
  },
  {
    title: "7. Cookies e tecnologias similares",
    content: [
      "Utilizamos cookies para analisar o uso da plataforma, melhorar o desempenho e personalizar conteúdos. Você pode gerenciar os cookies diretamente no seu navegador.",
    ],
  },
  {
    title: "8. Alterações desta Política",
    content: [
      "Reservamo-nos o direito de atualizar esta Política de Privacidade. As mudanças serão comunicadas dentro do aplicativo ou em nosso site oficial, com data da última atualização.",
    ],
  },
  {
    title: "9. Contato",
    content: [
      `Envie dúvidas sobre privacidade para ${CONTACT_PRIVACY}.`,
      `Questões gerais sobre a conta podem ser endereçadas a ${CONTACT_SUPPORT}.`,
    ],
  },
];

function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-16 sm:px-6 lg:px-8">
        <header className="space-y-4 rounded-3xl border border-slate-200 bg-white/95 p-8 shadow-xl shadow-slate-900/5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
          <p className="text-sm font-medium uppercase tracking-widest text-emerald-500">
            Política de Privacidade
          </p>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">
            Política de Privacidade – KORDEN
          </h1>
          <p className="text-base text-slate-500 dark:text-slate-300">
            Última atualização: Novembro de 2025 · Endereço:{" "}
            <a
              href="https://www.korden.com.br"
              className="font-medium text-emerald-600 underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              www.korden.com.br
            </a>
          </p>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            <span>Dados hospedados em ambiente seguro (Supabase & Vercel)</span>
            <span className="h-1 w-1 rounded-full bg-slate-400" aria-hidden />
            <span>Compromisso com a LGPD</span>
          </div>
        </header>

        <section className="space-y-10 rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-lg shadow-slate-900/5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
          {PRIVACY_SECTIONS.map((section) => (
            <article key={section.title} className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                {section.title}
              </h2>
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

        <footer className="rounded-3xl border border-slate-200 bg-gradient-to-r from-sky-500/10 to-emerald-500/10 p-8 text-slate-700 shadow-lg shadow-slate-900/5 dark:border-slate-800 dark:text-slate-200">
          <p className="text-base">
            Continue navegando na plataforma com transparência. Consulte também os{" "}
            <Link to="/termos-de-uso" className="font-semibold text-emerald-600 underline-offset-4 hover:underline">
              Termos de Uso
            </Link>{" "}
            para entender como utilizamos o KORDEN de forma segura e responsável.
          </p>
        </footer>
      </div>
    </div>
  );
}

export default PrivacyPolicyPage;
