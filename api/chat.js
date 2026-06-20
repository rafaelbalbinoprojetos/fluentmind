/* eslint-env node */
import { createClient } from "@supabase/supabase-js";
import { OpenAI } from "openai";
import { requireUser } from "./_utils/auth.js";
import { consumeAiUsage, resolveAiPlan } from "./_utils/aiUsage.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("Supabase admin credentials are missing. Define SUPABASE_URL and SUPABASE_SERVICE_KEY.");
} else {
  try {
    const payloadSegment = supabaseServiceKey.split(".")[1];
    const normalized = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const payloadJson = Buffer.from(normalized, "base64").toString("utf8");
    const payload = JSON.parse(payloadJson);
    console.log("[chat] Supabase service key role:", payload.role);
  } catch (error) {
    console.warn("[chat] Não foi possível inspecionar SUPABASE_SERVICE_KEY:", error.message);
  }
}

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    })
  : null;

const EXPENSE_CATEGORY_KEYWORDS = {
  alimentacao: [
    "alimenta",
    "comida",
    "lanche",
    "restaurante",
    "padaria",
    "supermercado",
    "mercado",
    "cafe",
    "bebida",
    "snack",
  ],
  transporte: [
    "transporte",
    "uber",
    "taxi",
    "combustivel",
    "gasolina",
    "etanol",
    "estacionamento",
    "passagem",
    "metro",
    "onibus",
    "carro",
  ],
  moradia: [
    "aluguel",
    "condominio",
    "luz",
    "energia",
    "agua",
    "internet",
    "iptu",
    "ipva",
    "gas",
  ],
  lazer: [
    "lazer",
    "cinema",
    "streaming",
    "viagem",
    "passeio",
    "show",
    "bar",
    "festa",
    "jogo",
    "netflix",
    "spotify",
  ],
  saude: [
    "saude",
    "farmacia",
    "remedio",
    "medic",
    "hospital",
    "consulta",
    "dentista",
    "academia",
    "psicologo",
  ],
};

const REVENUE_CATEGORY_KEYWORDS = {
  salario: ["salario", "pagamento", "folha", "holerite"],
  freelance: ["freelance", "job", "servico", "consultoria", "projeto"],
  investimento: ["dividendo", "juros", "rendimento", "aluguel"],
};

const INVESTMENT_TYPE_KEYWORDS = {
  renda_fixa: ["cdb", "tesouro", "renda fixa", "lci", "lca"],
  renda_variavel: ["acao", "ações", "stock", "bolsa", "trader"],
  fundos: ["fundo", "fii", "etf"],
  criptomoedas: ["cripto", "bitcoin", "ethereum", "criptoativo"],
};

function normalizeText(value) {
  return (value ?? "").toString().toLowerCase();
}

function defaultDateISO() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

function defaultDateTimeISO() {
  return new Date().toISOString();
}

function normalizeExpenseCategory(rawCategory, description = "") {
  const source = `${rawCategory ?? ""} ${description ?? ""}`.toLowerCase();
  for (const [category, keywords] of Object.entries(EXPENSE_CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => source.includes(keyword))) {
      return category;
    }
  }
  const clean = normalizeText(rawCategory);
  if (clean && Object.keys(EXPENSE_CATEGORY_KEYWORDS).includes(clean)) {
    return clean;
  }
  return "outros";
}

function normalizeRevenueCategory(rawCategory, description = "") {
  const source = `${rawCategory ?? ""} ${description ?? ""}`.toLowerCase();
  for (const [category, keywords] of Object.entries(REVENUE_CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => source.includes(keyword))) {
      return category;
    }
  }
  const clean = normalizeText(rawCategory);
  if (clean && Object.keys(REVENUE_CATEGORY_KEYWORDS).includes(clean)) {
    return clean;
  }
  return "outros";
}

function normalizeInvestmentType(rawType, description = "") {
  const source = `${rawType ?? ""} ${description ?? ""}`.toLowerCase();
  for (const [type, keywords] of Object.entries(INVESTMENT_TYPE_KEYWORDS)) {
    if (keywords.some((keyword) => source.includes(keyword))) {
      return type;
    }
  }
  const clean = normalizeText(rawType);
  if (clean && Object.keys(INVESTMENT_TYPE_KEYWORDS).includes(clean)) {
    return clean;
  }
  return "outros";
}

function parseNumeric(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const normalized = normalizeText(value).replace(/[^\d,-.]/g, "").replace(",", ".");
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function firstDayOfMonthISO() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString().slice(0, 10);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function ensureSupabase() {
  if (!supabase) {
    throw new Error("Supabase client not configured.");
  }
}

async function handleCreateExpense(userId, args) {
  ensureSupabase();
  const amount = parseNumeric(args.amount ?? args.value);
  if (!Number.isFinite(amount)) {
    throw new Error("Não foi possível identificar o valor da despesa.");
  }
  const category = normalizeExpenseCategory(args.category, args.description);
  const description = args.description?.trim() || null;
  const paymentMethod = args.payment_method?.trim() || null;
  const dateISO = args.date ? args.date.slice(0, 10) : defaultDateISO();

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      user_id: userId,
      value: amount,
      date: dateISO,
      category,
      payment_method: paymentMethod,
      description,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message || error.details || "Erro ao salvar despesa.");
  }

  return {
    ok: true,
    type: "expense_created",
    data,
    message: `Despesa de ${toCurrency(amount)} registrada em ${dateISO} na categoria ${category}.`,
  };
}

async function handleCreateRevenue(userId, args) {
  ensureSupabase();
  const amount = parseNumeric(args.amount ?? args.value);
  if (!Number.isFinite(amount)) {
    throw new Error("Não foi possível identificar o valor da renda.");
  }
  const category = normalizeRevenueCategory(args.category, args.description);
  const description = args.description?.trim() || args.origin?.trim() || null;
  const dateISO = args.date ? args.date.slice(0, 10) : defaultDateISO();

  const { data, error } = await supabase
    .from("incomes")
    .insert({
      user_id: userId,
      value: amount,
      category,
      date: dateISO,
      description,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message || error.details || "Erro ao salvar renda.");
  }

  return {
    ok: true,
    type: "revenue_created",
    data,
    message: `Renda de ${toCurrency(amount)} registrada em ${dateISO} na categoria ${category}.`,
  };
}

async function handleCreateInvestment(userId, args) {
  ensureSupabase();
  const amount = parseNumeric(args.amount ?? args.value);
  if (!Number.isFinite(amount)) {
    throw new Error("Não foi possível identificar o valor do investimento.");
  }
  const investmentType = normalizeInvestmentType(args.investment_type, args.description);
  const whereInvested = args.where_invested?.trim() || args.broker?.trim() || "Não especificado";
  const description = args.description?.trim() || null;
  const dateISO = args.date ? args.date.slice(0, 10) : defaultDateISO();

  const { data, error } = await supabase
    .from("investments")
    .insert({
      user_id: userId,
      value: amount,
      investment_type: investmentType,
      where_invested: whereInvested,
      date: dateISO,
      description,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message || error.details || "Erro ao salvar investimento.");
  }

  return {
    ok: true,
    type: "investment_created",
    data,
    message: `Investimento de ${toCurrency(amount)} registrado em ${dateISO} (${investmentType}).`,
  };
}

async function handleCreateOvertime(userId, args) {
  ensureSupabase();
  const hourlyRate = parseNumeric(args.hourly_rate ?? args.rate);
  if (!Number.isFinite(hourlyRate)) {
    throw new Error("Informe o valor da hora.");
  }

  const overtimePercentage = parseNumeric(args.overtime_percentage ?? args.percentage);
  const percentageValue = Number.isFinite(overtimePercentage) ? overtimePercentage : 1.0;

  const startTime = args.start_time ?? defaultDateTimeISO();
  const endTime = args.end_time ?? defaultDateTimeISO();
  const paymentDate = args.payment_date ? args.payment_date.slice(0, 10) : defaultDateISO();

  const totalValue = parseNumeric(args.total_value);

  const { data, error } = await supabase
    .from("overtime_hours")
    .insert({
      user_id: userId,
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      hourly_rate: hourlyRate,
      overtime_percentage: percentageValue,
      payment_date: paymentDate,
      total_value: Number.isFinite(totalValue) ? totalValue : null,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message || error.details || "Erro ao salvar horas extras.");
  }

  return {
    ok: true,
    type: "overtime_created",
    data,
    message: `Registro de horas extras criado (${hourlyRate.toFixed(2)} por hora, percentual ${percentageValue * 100}%).`,
  };
}

async function handleExpenseSummary(userId, args) {
  ensureSupabase();
  const from = args.from ? args.from.slice(0, 10) : firstDayOfMonthISO();
  const to = args.to ? args.to.slice(0, 10) : todayISO();
  const category = args.category ? normalizeExpenseCategory(args.category) : null;

  let query = supabase
    .from("expenses")
    .select("value, category, date")
    .eq("user_id", userId)
    .gte("date", from)
    .lte("date", to);

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || error.details || "Erro ao consultar despesas.");
  }

  const total = (data ?? []).reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const count = data?.length ?? 0;

  return {
    ok: true,
    type: "expense_summary",
    data: { from, to, category: category ?? "todas", total, count },
    message: `Total de despesas ${category ? `em ${category}` : ""} entre ${from} e ${to}: ${toCurrency(total)} (${count} registros).`,
  };
}

async function handleFinancialSummary(userId, args) {
  ensureSupabase();
  const resource = (args.resource ?? "expenses").toLowerCase();
  const from = args.from ? args.from.slice(0, 10) : null;
  const to = args.to ? args.to.slice(0, 10) : null;

  const tables = {
    expenses: "expenses",
    revenues: "incomes",
    investments: "investments",
    overtime: "overtime_hours",
  };

  const table = tables[resource];
  if (!table) {
    throw new Error(`Recurso ${resource} não é suportado.`);
  }

  let query = supabase
    .from(table)
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false });

  if (from) {
    query = query.gte("date", from);
  }

  if (to) {
    query = query.lte("date", to);
  }

  if (resource === "overtime") {
    query = supabase
      .from(table)
      .select("*")
      .eq("user_id", userId)
      .order("payment_date", { ascending: false });

    if (from) {
      query = query.gte("payment_date", from);
    }
    if (to) {
      query = query.lte("payment_date", to);
    }
  }

  if (resource === "expenses" && args.category) {
    query = query.eq("category", normalizeExpenseCategory(args.category));
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || error.details || "Erro ao consultar dados.");
  }

  const values = data ?? [];

  const total =
    resource === "expenses"
      ? values.reduce((sum, item) => sum + (Number(item.value) || 0), 0)
      : resource === "revenues"
      ? values.reduce((sum, item) => sum + (Number(item.value) || 0), 0)
      : resource === "investments"
      ? values.reduce((sum, item) => sum + (Number(item.value) || 0), 0)
      : values.reduce((sum, item) => sum + (Number(item.total_value) || 0), 0);

  const fromLabel = from ?? "o início dos registros";
  const toLabel = to ?? "a data atual";

  return {
    ok: true,
    type: "summary",
    data: { resource, from, to, total, count: values.length },
    message: `Total de ${resource} entre ${fromLabel} e ${toLabel}: ${toCurrency(total)} (${values.length} registros).`,
  };
}

async function handleInvestmentSummary(userId, args) {
  ensureSupabase();
  const from = args.from ? args.from.slice(0, 10) : null;
  const to = args.to ? args.to.slice(0, 10) : null;
  const investmentType = args.investment_type
    ? normalizeInvestmentType(args.investment_type)
    : null;
  const whereFilter = args.where_invested
    ? args.where_invested.trim().toLowerCase()
    : null;

  let query = supabase
    .from("investments")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false });

  if (from) query = query.gte("date", from);
  if (to)   query = query.lte("date", to);
  if (investmentType) query = query.eq("investment_type", investmentType);

  const { data, error } = await query;
  if (error) throw new Error(error.message || "Erro ao consultar investimentos.");

  let rows = data ?? [];

  // Filtro parcial por where_invested/description (Brasil, EUA, corretora etc.)
  if (whereFilter) {
    rows = rows.filter(
      (row) =>
        (row.where_invested ?? "").toLowerCase().includes(whereFilter) ||
        (row.description ?? "").toLowerCase().includes(whereFilter)
    );
  }

  const total = rows.reduce((sum, item) => sum + (Number(item.value) || 0), 0);

  // Agrupamento por tipo
  const byType = {};
  for (const row of rows) {
    const type = row.investment_type || "outros";
    byType[type] = (byType[type] || 0) + Number(row.value || 0);
  }
  const byTypeLines = Object.entries(byType)
    .map(([type, val]) => `• ${type}: ${toCurrency(val)}`)
    .join("\n");

  // Detalhes individuais (máx 20)
  const details = rows.slice(0, 20).map((row) => {
    const dateLabel = row.date ? row.date.slice(0, 10) : "?";
    const where = row.where_invested || row.description || "";
    return `• ${dateLabel} — ${toCurrency(Number(row.value) || 0)}${where ? ` — ${where}` : ""}`;
  });

  const fromLabel = from ?? "o início dos registros";
  const toLabel = to ?? "a data atual";
  const filterLabel = whereFilter ? ` em "${whereFilter}"` : "";

  const message =
    rows.length > 0
      ? `Total investido${filterLabel} entre ${fromLabel} e ${toLabel}: ${toCurrency(total)} (${rows.length} registros).\n\nPor tipo:\n${byTypeLines}\n\nDetalhes:\n${details.join("\n")}`
      : `Não encontrei investimentos${filterLabel} entre ${fromLabel} e ${toLabel}.`;

  return {
    ok: true,
    type: "investment_summary",
    data: { from, to, total, count: rows.length, byType, whereFilter, investmentType },
    message,
  };
}

async function handleFinancialDetails(userId, args) {
  ensureSupabase();
  const resource = (args.resource ?? "investments").toLowerCase();
  const from = args.from ? args.from.slice(0, 10) : null;
  const to = args.to ? args.to.slice(0, 10) : null;
  const limitRaw = Number(args.limit);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;

  const tables = {
    expenses: { name: "expenses", dateColumn: "date" },
    revenues: { name: "incomes", dateColumn: "date" },
    investments: { name: "investments", dateColumn: "date" },
    overtime: { name: "overtime_hours", dateColumn: "payment_date" },
  };

  const tableConfig = tables[resource];
  if (!tableConfig) {
    throw new Error(`Recurso ${resource} não é suportado.`);
  }

  const { name: table, dateColumn } = tableConfig;
  let query = supabase
    .from(table)
    .select("*")
    .eq("user_id", userId)
    .order(dateColumn, { ascending: false })
    .limit(limit);

  if (from) {
    query = query.gte(dateColumn, from);
  }

  if (to) {
    query = query.lte(dateColumn, to);
  }

  if (resource === "expenses" && args.category) {
    query = query.eq("category", normalizeExpenseCategory(args.category));
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || error.details || "Erro ao listar registros.");
  }

  const rows = data ?? [];

  const resourceLabels = {
    expenses: "despesas",
    revenues: "rendas",
    investments: "investimentos",
    overtime: "registros de horas extras",
  };

  const fromLabel = from ?? "o início dos registros";
  const toLabel = to ?? "a data atual";

  const lines = rows.map((row) => {
    const rawDate = row[dateColumn];
    const dateLabel = rawDate ? rawDate.slice(0, 10) : "Data não informada";

    let valueLabel;
    if (resource === "overtime") {
      valueLabel = toCurrency(Number(row.total_value) || 0);
    } else {
      valueLabel = toCurrency(Number(row.value) || 0);
    }

    let descriptor = "";
    if (resource === "expenses") {
      descriptor = row.description || row.category || "";
    } else if (resource === "revenues") {
      descriptor = row.description || row.category || "";
    } else if (resource === "investments") {
      descriptor = row.description || row.where_invested || row.investment_type || "";
    } else if (resource === "overtime") {
      descriptor = row.description || `${row.overtime_percentage ? `${Number(row.overtime_percentage) * 100}%` : ""}`.trim();
    }

    return `• ${dateLabel} — ${valueLabel}${descriptor ? ` — ${descriptor}` : ""}`;
  });

  const message =
    rows.length > 0
      ? `Aqui estão ${rows.length} ${resourceLabels[resource] ?? "registros"} entre ${fromLabel} e ${toLabel}:\n${lines.join("\n")}`
      : `Não encontrei ${resourceLabels[resource] ?? "registros"} entre ${fromLabel} e ${toLabel}.`;

  return {
    ok: true,
    type: "financial_details",
    data: { resource, from, to, limit, rows },
    message,
  };
}

function toCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
}

const functionHandlers = {
  create_expense: handleCreateExpense,
  create_revenue: handleCreateRevenue,
  create_investment: handleCreateInvestment,
  create_overtime: handleCreateOvertime,
  get_expense_summary: handleExpenseSummary,
  get_financial_summary: handleFinancialSummary,
  get_financial_details: handleFinancialDetails,
  get_investment_summary: handleInvestmentSummary,
};

const tools = [
  {
    name: "create_expense",
    description:
      "Registra uma nova despesa do usuário. Use esta função sempre que uma despesa for mencionada.",
    parameters: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Valor da despesa em reais (positivo)." },
        category: { type: "string", description: "Categoria da despesa. Utilize: alimentacao, transporte, moradia, lazer, saude ou outros." },
        description: { type: "string", description: "Descrição ou observações adicionais." },
        payment_method: { type: "string", description: "Forma de pagamento (ex: cartao, pix, dinheiro)." },
        date: { type: "string", description: "Data da despesa (ISO 8601)." },
      },
      required: ["amount"],
    },
  },
  {
    name: "create_revenue",
    description: "Registra uma nova entrada de renda para o usuário.",
    parameters: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Valor recebido em reais." },
        category: { type: "string", description: "Categoria da renda. Utilize: salario, freelance, investimento ou outros." },
        description: { type: "string", description: "Informações adicionais ou origem." },
        date: { type: "string", description: "Data da renda (ISO 8601)." },
      },
      required: ["amount"],
    },
  },
  {
    name: "create_investment",
    description: "Registra um novo investimento com o valor aplicado.",
    parameters: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Valor investido em reais." },
        investment_type: { type: "string", description: "Tipo do investimento (renda_fixa, renda_variavel, fundos, criptomoedas, outros)." },
        where_invested: { type: "string", description: "Local/corretora ou ativo investido." },
        description: { type: "string", description: "Observações adicionais." },
        date: { type: "string", description: "Data do investimento (ISO 8601)." },
      },
      required: ["amount"],
    },
  },
  {
    name: "create_overtime",
    description: "Registra um período de horas extras executadas.",
    parameters: {
      type: "object",
      properties: {
        hourly_rate: { type: "number", description: "Valor da hora base." },
        overtime_percentage: { type: "number", description: "Percentual adicional (ex: 1 = 100%, 0.5 = 50%)." },
        start_time: { type: "string", description: "Início no formato ISO." },
        end_time: { type: "string", description: "Fim no formato ISO." },
        payment_date: { type: "string", description: "Data prevista de pagamento." },
        total_value: { type: "number", description: "Valor total calculado, se informado." },
      },
      required: ["hourly_rate"],
    },
  },
  {
    name: "get_expense_summary",
    description: "Calcula o total de despesas em um intervalo de datas, opcionalmente filtrando por categoria.",
    parameters: {
      type: "object",
      properties: {
        category: { type: "string", description: "Categoria desejada." },
        from: { type: "string", description: "Data inicial (ISO 8601)." },
        to: { type: "string", description: "Data final (ISO 8601)." },
      },
    },
  },
  {
    name: "get_financial_summary",
    description: "Resumo genérico (receitas, despesas, investimentos ou horas extras) em um período.",
    parameters: {
      type: "object",
      properties: {
        resource: { type: "string", enum: ["expenses", "revenues", "investments", "overtime"] },
        category: { type: "string", description: "Categoria quando se aplica (ex: despesas)." },
        from: { type: "string", description: "Data inicial (ISO 8601)." },
        to: { type: "string", description: "Data final (ISO 8601)." },
      },
      required: ["resource"],
    },
  },
  {
    name: "get_investment_summary",
    description: "Consulta e resume os investimentos do usuário. Use SEMPRE que o usuário perguntar sobre investimentos: 'quanto investi', 'total investido', 'quanto tenho no Brasil', 'quanto tenho nos EUA', 'quanto tenho em renda fixa', 'investimentos na XP', etc. Suporta filtro por tipo de investimento e por local/país/corretora.",
    parameters: {
      type: "object",
      properties: {
        investment_type: {
          type: "string",
          description: "Tipo do investimento: renda_fixa, renda_variavel, fundos, criptomoedas, outros. Omita para consultar todos os tipos.",
        },
        where_invested: {
          type: "string",
          description: "Local, país ou corretora do investimento. Exemplos: 'brasil', 'eua', 'estados unidos', 'nubank', 'xp', 'btg', 'rico'. Use o termo que o usuário mencionou.",
        },
        from: { type: "string", description: "Data inicial (ISO 8601). Omita para consultar desde o início." },
        to:   { type: "string", description: "Data final (ISO 8601). Omita para consultar até hoje." },
      },
    },
  },
  {
    name: "get_financial_details",
    description: "Lista registros detalhados de despesas, rendas, investimentos ou horas extras em um período.",
    parameters: {
      type: "object",
      properties: {
        resource: { type: "string", enum: ["expenses", "revenues", "investments", "overtime"] },
        category: { type: "string", description: "Categoria quando se aplica (ex: despesas)." },
        from: { type: "string", description: "Data inicial (ISO 8601)." },
        to: { type: "string", description: "Data final (ISO 8601)." },
        limit: { type: "integer", description: "Quantidade máxima de registros (1 a 50)." },
      },
      required: ["resource"],
    },
  },
];

function buildSystemPrompt(userName, chatTone) {
  const nameClause = userName
    ? `O nome do usuário é ${userName}. Chame-o pelo primeiro nome quando for natural e adequado ao contexto.`
    : "Não temos o nome do usuário cadastrado. Refira-se a ele de forma genérica.";

  const toneInstructions = {
    formal: `
TOM: FORMAL
- Utilize linguagem profissional e elegante.
- Seja objetivo e direto.
- Evite gírias, regionalismos e brincadeiras.
- Mantenha postura de mentor de fluência especializado.
- Explique padrões de idioma com clareza e precisão.
Exemplo de resposta correta: "You can say: I'm getting used to it. Meaning: Estou me acostumando com isso."`,

    natural: `
TOM: NATURAL
- Converse como um amigo inteligente e próximo.
- Use frases leves e fluidas.
- Demonstre proximidade sem ser excessivamente informal.
- Contextualize a expressão dentro de situações reais.
- Quando fizer sentido, chame o usuário pelo primeiro nome.
Exemplo de resposta correta: "${userName || "Você"}, a forma mais natural é: I'm a little tired."`,

    mineiro_descontraido: `
TOM: DESCONTRAÍDO MINEIRO
- Converse de forma extremamente humana e acolhedora.
- Use expressões típicas de Minas Gerais de forma LEVE e OCASIONAL (não em toda frase): uai, sô, trem, bão demais, cê, danado, pois é, vixe.
- NUNCA force o sotaque nem escreva palavras com grafia caricata.
- O humor deve ser sutil e espontâneo.
- Transmita acolhimento, simplicidade e proximidade.
- Sempre preserve a precisão das explicações de inglês.
- Além de informar os dados, quando fizer sentido, acrescente uma observação breve e natural baseada no contexto.
- Faça parecer uma conversa real, não uma consulta a banco de dados.
Exemplo de resposta correta: "${userName || "Cê"} pode falar: I'm getting used to it. Fica bem natural, uai."`,
  };

  const tone = toneInstructions[chatTone] ?? toneInstructions.natural;

  return `Você é Neo, mentor de fluência do FluentMind.

O FluentMind ensina inglês e outros idiomas por conversas, MindBlocks, expressões salvas, correções, revisão e prática ativa.

${nameClause}

PERSONALIDADE E TOM:
- Nunca pareça um robô lendo dados.
- Nunca repita a pergunta do usuário integralmente.
- Seja um mentor de fluência, não apenas um chatbot.
- Ajude o usuário a parar de traduzir palavra por palavra e começar a pensar em blocos mentais.
- Se o usuário perguntar "como dizer X em inglês", responda diretamente com a forma natural.
- Sempre que útil, organize a resposta com:
  - You can say
  - Meaning
  - Examples
  - Related expressions
  - Common mistakes
  - Practice prompt
- Corrija erros com gentileza e clareza.
- Não invente dados pessoais do usuário.
- Não fale sobre finanças, despesas, rendas ou investimentos, a menos que seja apenas vocabulário em inglês.
- Quando detectar uma expressão útil, sugira salvá-la como MindBlock.
${tone}

Data atual: ${new Date().toISOString()}`;
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não suportado." });
  }

  if (!openai.apiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY não configurada." });
  }

  try {
    const body = parseBody(req);
    const { messages = [], userName = null, chatTone = "natural" } = body;
    const user = await requireUser(req);
    const userId = user.id;
    let plan = "pro";
    try {
      plan = await resolveAiPlan(user);
    } catch (usageError) {
      console.warn("[chat] Could not resolve AI plan. Continuing in mock-friendly mode.", usageError?.message || usageError);
    }

    try {
      await consumeAiUsage({
        userId,
        plan,
        deltas: { ai_chat: 1 },
      });
    } catch (usageError) {
      console.warn("[chat] Could not register AI usage. Continuing without blocking chat.", usageError?.message || usageError);
    }

    const systemPrompt = buildSystemPrompt(userName, chatTone);

    const conversation = [
      { role: "system", content: systemPrompt },
      ...messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ];

    let response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      messages: conversation,
    });

    let assistantMessage = response.choices[0]?.message;

    while (assistantMessage?.function_call) {
      const { name, arguments: argsJson } = assistantMessage.function_call;
      const handler = functionHandlers[name];
      let toolResult;

      if (!handler) {
        toolResult = { ok: false, error: `Função ${name} não implementada.` };
      } else {
        try {
          const parsedArgs = argsJson ? JSON.parse(argsJson) : {};
          if (["create_expense", "create_revenue", "create_investment", "create_overtime"].includes(name)) {
            await consumeAiUsage({
              userId,
              plan,
              deltas: { ai_registros: 1 },
            }).catch((usageError) => {
              console.warn("[chat] Could not register AI record usage.", usageError?.message || usageError);
            });
          }
          if (["get_expense_summary", "get_financial_summary", "get_financial_details"].includes(name)) {
            await consumeAiUsage({
              userId,
              plan,
              deltas: { ai_analises: 1 },
            }).catch((usageError) => {
              console.warn("[chat] Could not register AI analysis usage.", usageError?.message || usageError);
            });
          }
          console.log(`[chat] Chamando função ${name} com`, parsedArgs);
          toolResult = await handler(userId, parsedArgs);
          console.log(`[chat] Resultado da função ${name}:`, toolResult);
        } catch (error) {
          console.error(`[chat] Erro na função ${name}:`, error);
          toolResult = {
            ok: false,
            error: error.message || "Erro ao executar função.",
            details: error,
          };
        }
      }

      if (!toolResult.ok) {
        console.error(`[chat] Função ${name} retornou erro:`, toolResult.error);
        const friendlyMessage =
          toolResult.error ||
          "Ocorreu um erro ao executar essa operação. Verifique os dados informados e tente novamente.";
        assistantMessage = {
          role: "assistant",
          content: friendlyMessage,
        };
        conversation.push(assistantMessage);
        break;
      }

      conversation.push(assistantMessage);
      conversation.push({
        role: "function",
        name,
        content: JSON.stringify(toolResult),
      });

      response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        messages: conversation,
        functions: tools,
        function_call: "auto",
      });

      assistantMessage = response.choices[0]?.message;
    }

    const reply = assistantMessage?.content?.trim();

    if (!reply) {
      return res.status(200).json({
        reply: "Não consegui gerar uma resposta agora. Pode tentar reformular?",
      });
    }

    return res.status(200).json({ reply });
  } catch (error) {
    console.error(error);
    const status = error.statusCode || 500;
    const errorMessage = status < 500 ? error.message : "Não foi possível processar sua mensagem.";
    return res.status(status).json({
      error: errorMessage,
      details: status < 500 ? undefined : error.message,
    });
  }
}
