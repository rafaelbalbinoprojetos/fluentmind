export const RADAR_SIGNAL_DEFINITIONS = {
  momentum: {
    id: "momentum",
    title: "Tendencia Forte",
    description: "Ativos com forca de preco e volume para acompanhar de perto.",
  },
  new_high: {
    id: "new_high",
    title: "Nova Maxima Anual",
    description: "Ativos que romperam maxima de 52 semanas.",
  },
  drawdown: {
    id: "drawdown",
    title: "Queda Relevante",
    description: "Ativos liquidos com queda expressiva recente.",
  },
  dividends: {
    id: "dividends",
    title: "Dividendos Consistentes",
    description: "Pagadores recorrentes para observacao de renda.",
  },
  low_vol: {
    id: "low_vol",
    title: "Baixa Volatilidade",
    description: "Ativos que oscilam menos que seus indices de referencia.",
  },
  intl_diversification: {
    id: "intl_diversification",
    title: "Diversificacao Internacional",
    description: "Ativos internacionais para ampliar o mapa geografico da carteira.",
  },
};

export const RADAR_UNIVERSE = [
  { symbol: "ITUB4.SA", name: "Itaú Unibanco", country: "BR", assetType: "Acoes Brasil", sector: "Financeiro", currency: "BRL", liquidityScore: 95, dividendProfile: true, lowVol: true },
  { symbol: "VALE3.SA", name: "Vale", country: "BR", assetType: "Acoes Brasil", sector: "Materiais", currency: "BRL", liquidityScore: 98, dividendProfile: true, lowVol: false },
  { symbol: "PETR4.SA", name: "Petrobras", country: "BR", assetType: "Acoes Brasil", sector: "Energia", currency: "BRL", liquidityScore: 99, dividendProfile: true, lowVol: false },
  { symbol: "WEGE3.SA", name: "WEG", country: "BR", assetType: "Acoes Brasil", sector: "Industria", currency: "BRL", liquidityScore: 92, dividendProfile: true, lowVol: true },
  { symbol: "BBAS3.SA", name: "Banco do Brasil", country: "BR", assetType: "Acoes Brasil", sector: "Financeiro", currency: "BRL", liquidityScore: 90, dividendProfile: true, lowVol: true },
  { symbol: "BOVA11.SA", name: "iShares Ibovespa", country: "BR", assetType: "ETF Brasil", sector: "Indice", currency: "BRL", liquidityScore: 96, dividendProfile: false, lowVol: true },
  { symbol: "SMAL11.SA", name: "iShares Small Caps", country: "BR", assetType: "ETF Brasil", sector: "Indice", currency: "BRL", liquidityScore: 80, dividendProfile: false, lowVol: false },
  { symbol: "IVVB11.SA", name: "iShares S&P 500", country: "BR", assetType: "ETF Brasil", sector: "Internacional", currency: "BRL", liquidityScore: 88, dividendProfile: false, lowVol: true },
  { symbol: "SPY", name: "SPDR S&P 500 ETF", country: "US", assetType: "ETF EUA", sector: "Indice", currency: "USD", liquidityScore: 99, dividendProfile: true, lowVol: true },
  { symbol: "QQQ", name: "Invesco QQQ Trust", country: "US", assetType: "ETF EUA", sector: "Tecnologia", currency: "USD", liquidityScore: 98, dividendProfile: true, lowVol: false },
  { symbol: "VTI", name: "Vanguard Total Stock Market ETF", country: "US", assetType: "ETF EUA", sector: "Indice", currency: "USD", liquidityScore: 95, dividendProfile: true, lowVol: true },
  { symbol: "VXUS", name: "Vanguard Total International Stock ETF", country: "US", assetType: "ETF EUA", sector: "Internacional", currency: "USD", liquidityScore: 85, dividendProfile: true, lowVol: true },
  { symbol: "SCHD", name: "Schwab US Dividend Equity ETF", country: "US", assetType: "ETF EUA", sector: "Dividendos", currency: "USD", liquidityScore: 84, dividendProfile: true, lowVol: true },
  { symbol: "AAPL", name: "Apple", country: "US", assetType: "Acoes EUA", sector: "Tecnologia", currency: "USD", liquidityScore: 99, dividendProfile: true, lowVol: true },
  { symbol: "MSFT", name: "Microsoft", country: "US", assetType: "Acoes EUA", sector: "Tecnologia", currency: "USD", liquidityScore: 99, dividendProfile: true, lowVol: true },
  { symbol: "NVDA", name: "NVIDIA", country: "US", assetType: "Acoes EUA", sector: "Semicondutores", currency: "USD", liquidityScore: 99, dividendProfile: false, lowVol: false },
  { symbol: "JPM", name: "JPMorgan Chase", country: "US", assetType: "Acoes EUA", sector: "Financeiro", currency: "USD", liquidityScore: 92, dividendProfile: true, lowVol: true },
  { symbol: "KO", name: "Coca-Cola", country: "US", assetType: "Acoes EUA", sector: "Consumo", currency: "USD", liquidityScore: 88, dividendProfile: true, lowVol: true },
  { symbol: "PG", name: "Procter & Gamble", country: "US", assetType: "Acoes EUA", sector: "Consumo", currency: "USD", liquidityScore: 86, dividendProfile: true, lowVol: true },
  { symbol: "XOM", name: "Exxon Mobil", country: "US", assetType: "Acoes EUA", sector: "Energia", currency: "USD", liquidityScore: 91, dividendProfile: true, lowVol: false },
  { symbol: "V", name: "Visa", country: "US", assetType: "Acoes EUA", sector: "Financeiro", currency: "USD", liquidityScore: 90, dividendProfile: true, lowVol: true },
  { symbol: "UNH", name: "UnitedHealth", country: "US", assetType: "Acoes EUA", sector: "Saude", currency: "USD", liquidityScore: 85, dividendProfile: true, lowVol: true },
  { symbol: "AMZN", name: "Amazon", country: "US", assetType: "Acoes EUA", sector: "Consumo", currency: "USD", liquidityScore: 98, dividendProfile: false, lowVol: false },
  { symbol: "MELI", name: "MercadoLibre", country: "US", assetType: "Acoes EUA", sector: "Tecnologia", currency: "USD", liquidityScore: 77, dividendProfile: false, lowVol: false },
];

