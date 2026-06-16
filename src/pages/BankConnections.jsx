import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, RefreshCw, Trash2, Plus, AlertCircle, Lock, CheckCircle2, Clock } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext.jsx";
import {
  listBankConnections,
  createBankConnection,
  fetchConnectToken,
  syncBankConnection,
  disconnectBankConnection,
  listBankTransactions,
} from "../services/bankConnections.js";

// ─── Helpers ──────────────────────────────────────────────────────────────

const STATUS_LABEL = {
  connected: "Conectado",
  error: "Erro na conexão",
  outdated: "Atualização necessária",
};

const STATUS_COLOR = {
  connected: "text-emerald-500",
  error: "text-red-500",
  outdated: "text-amber-500",
};

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value ?? 0);
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

// ─── Carrega SDK via import() dinâmico (Vite faz o bundle, sem CDN) ───────
let sdkCache = null;
async function loadPluggySDK() {
  if (sdkCache) return sdkCache;
  const mod = await import("pluggy-connect-sdk");
  sdkCache = mod.default ?? mod.PluggyConnect ?? mod;
  return sdkCache;
}

// ─── Premium Gate ─────────────────────────────────────────────────────────

function PremiumGate() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
        <Lock className="w-7 h-7 text-zinc-400" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Recurso Premium</h2>
        <p className="text-zinc-500 dark:text-zinc-400 max-w-sm">
          A conexão com bancos é exclusiva para assinantes premium. Atualize seu plano para vincular
          suas contas do Nubank, Itaú, Santander, Bradesco e muito mais.
        </p>
      </div>
    </div>
  );
}

// ─── Card de conexão ──────────────────────────────────────────────────────

function ConnectionCard({ connection, onSync, onDisconnect, syncing }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
      <div className="flex items-center gap-3">
        {connection.institution_logo ? (
          <img
            src={connection.institution_logo}
            alt={connection.institution_name}
            className="w-10 h-10 rounded-xl object-contain bg-white border border-zinc-200 dark:border-zinc-700 p-1"
          />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-zinc-400" />
          </div>
        )}
        <div>
          <p className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">
            {connection.institution_name}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {connection.status === "connected"
              ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              : <AlertCircle   className="w-3.5 h-3.5 text-red-500" />
            }
            <span className={`text-xs ${STATUS_COLOR[connection.status] ?? "text-zinc-400"}`}>
              {STATUS_LABEL[connection.status] ?? connection.status}
            </span>
            {connection.last_synced_at && (
              <span className="text-xs text-zinc-400 flex items-center gap-1">
                · <Clock className="w-3 h-3" /> {formatDate(connection.last_synced_at)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onSync(connection)}
          disabled={syncing === connection.id}
          title="Sincronizar"
          className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-4 h-4 ${syncing === connection.id ? "animate-spin" : ""}`} />
        </button>
        <button
          onClick={() => onDisconnect(connection)}
          title="Desconectar"
          className="p-2 rounded-xl text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Linha de transação ───────────────────────────────────────────────────

function TransactionRow({ tx }) {
  const isDebit = tx.amount < 0 || tx.type === "DEBIT";
  return (
    <div className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
          {tx.description ?? "Transação"}
        </p>
        <p className="text-xs text-zinc-400 mt-0.5">
          {formatDate(tx.date)}
          {tx.category   ? ` · ${tx.category}`    : ""}
          {tx.account_name ? ` · ${tx.account_name}` : ""}
        </p>
      </div>
      <span className={`text-sm font-semibold ml-4 shrink-0 ${isDebit ? "text-red-500" : "text-emerald-500"}`}>
        {isDebit ? "-" : "+"}{formatCurrency(Math.abs(tx.amount))}
      </span>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────

export default function BankConnectionsPage() {
  const { user, session, subscription } = useAuth();

  const [connections,        setConnections]        = useState([]);
  const [transactions,       setTransactions]       = useState([]);
  const [loading,            setLoading]            = useState(true);
  const [syncing,            setSyncing]            = useState(null);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [txLoading,          setTxLoading]          = useState(false);
  const [tokenLoading,       setTokenLoading]       = useState(false);

  // Guarda referência ao widget ativo para evitar múltiplas instâncias
  const widgetRef = useRef(null);

  if (!subscription.hasPremiumAccess) return <PremiumGate />;

  // ── Carrega conexões ────────────────────────────────────────────────────

  const loadConnections = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await listBankConnections(user.id);
      setConnections(data);
      if (!selectedConnection && data.length > 0) setSelectedConnection(data[0].id);
    } catch {
      toast.error("Erro ao carregar conexões bancárias.");
    } finally {
      setLoading(false);
    }
  }, [user?.id, selectedConnection]);

  useEffect(() => { loadConnections(); }, [loadConnections]);

  // ── Carrega transações ──────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedConnection || !user?.id) return;
    setTxLoading(true);
    listBankTransactions(user.id, { connectionId: selectedConnection, limit: 50 })
      .then(setTransactions)
      .catch(() => toast.error("Erro ao carregar transações."))
      .finally(() => setTxLoading(false));
  }, [selectedConnection, user?.id]);

  // ── Abre widget Pluggy ──────────────────────────────────────────────────

  const openWidget = useCallback(async (existingItemId = null) => {
    if (!session || tokenLoading) return;
    if (widgetRef.current) return; // já aberto

    setTokenLoading(true);
    let connectToken, PluggyConnectSDK;
    try {
      [connectToken, PluggyConnectSDK] = await Promise.all([
        fetchConnectToken(session, existingItemId),
        loadPluggySDK(),
      ]);
    } catch (err) {
      toast.error(err.message ?? "Não foi possível iniciar a conexão.");
      setTokenLoading(false);
      return;
    }
    setTokenLoading(false);

    // SDK vanilla — gerencia seu próprio DOM/iframe, sem conflito com React 19
    const widget = new PluggyConnectSDK({
      connectToken,
      onSuccess: async ({ item }) => {
        widgetRef.current = null;
        try {
          const conn = await createBankConnection({
            userId: user.id,
            itemId: item.id,
            institutionId:   item.connector?.id?.toString() ?? null,
            institutionName: item.connector?.name ?? "Banco",
            institutionLogo: item.connector?.imageUrl ?? null,
          });
          toast.success(`${conn.institution_name} conectado!`);

          // Sync automático após conectar (melhor esforço)
          try {
            await syncBankConnection(session, { itemId: item.id, connectionId: conn.id });
          } catch { /* silencia — usuário sincroniza manualmente */ }

          await loadConnections();
          setSelectedConnection(conn.id);
        } catch (err) {
          toast.error(err.message ?? "Erro ao salvar conexão.");
        }
      },
      onError: (error) => {
        widgetRef.current = null;
        console.error("[PluggyConnect] erro:", error);
        toast.error("Erro ao conectar com o banco.");
      },
      onClose: () => {
        widgetRef.current = null;
      },
    });

    widgetRef.current = widget;
    widget.init();
  }, [session, tokenLoading, user?.id, loadConnections]);

  // ── Sincronizar ─────────────────────────────────────────────────────────

  const handleSync = useCallback(async (connection) => {
    setSyncing(connection.id);
    try {
      const result = await syncBankConnection(session, {
        itemId: connection.item_id,
        connectionId: connection.id,
      });
      toast.success(`${result.synced} transações sincronizadas.`);
      await loadConnections();
      if (selectedConnection === connection.id) {
        const txs = await listBankTransactions(user.id, { connectionId: connection.id, limit: 50 });
        setTransactions(txs);
      }
    } catch (err) {
      toast.error(err.message ?? "Erro ao sincronizar.");
    } finally {
      setSyncing(null);
    }
  }, [session, loadConnections, selectedConnection, user?.id]);

  // ── Desconectar ─────────────────────────────────────────────────────────

  const handleDisconnect = useCallback(async (connection) => {
    if (!window.confirm(`Desconectar ${connection.institution_name}? As transações importadas também serão removidas.`)) return;
    try {
      await disconnectBankConnection(session, connection.id);
      toast.success(`${connection.institution_name} desconectado.`);
      setConnections((prev) => prev.filter((c) => c.id !== connection.id));
      if (selectedConnection === connection.id) {
        setSelectedConnection(null);
        setTransactions([]);
      }
    } catch (err) {
      toast.error(err.message ?? "Erro ao desconectar.");
    }
  }, [session, selectedConnection]);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Contas bancárias</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Vincule seus bancos e importe transações automaticamente.
          </p>
        </div>
        <button
          onClick={() => openWidget(null)}
          disabled={tokenLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          {tokenLoading
            ? <RefreshCw className="w-4 h-4 animate-spin" />
            : <Plus className="w-4 h-4" />
          }
          Conectar banco
        </button>
      </div>

      {/* Lista de conexões */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
          Bancos conectados
        </h2>

        {loading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
            ))}
          </div>
        ) : connections.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Building2 className="w-8 h-8 text-zinc-300 dark:text-zinc-600" />
            <p className="text-sm text-zinc-400">Nenhum banco conectado ainda.</p>
            <button
              onClick={() => openWidget(null)}
              className="text-sm text-zinc-900 dark:text-zinc-100 underline underline-offset-2"
            >
              Conectar agora
            </button>
          </div>
        ) : (
          connections.map((conn) => (
            <ConnectionCard
              key={conn.id}
              connection={conn}
              onSync={handleSync}
              onDisconnect={handleDisconnect}
              syncing={syncing}
            />
          ))
        )}
      </section>

      {/* Transações */}
      {connections.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
              Últimas transações
            </h2>
            {connections.length > 1 && (
              <select
                value={selectedConnection ?? ""}
                onChange={(e) => setSelectedConnection(e.target.value)}
                className="text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-2 py-1 text-zinc-700 dark:text-zinc-300"
              >
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>{c.institution_name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 px-4">
            {txLoading ? (
              <div className="py-8 flex justify-center">
                <RefreshCw className="w-5 h-5 animate-spin text-zinc-400" />
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-8">
                Nenhuma transação encontrada. Clique em sincronizar para importar.
              </p>
            ) : (
              transactions.map((tx) => <TransactionRow key={tx.id} tx={tx} />)
            )}
          </div>
        </section>
      )}
    </div>
  );
}
