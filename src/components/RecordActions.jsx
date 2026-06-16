import React from "react";

function ActionButton({ children, onClick, disabled, tone = "neutral" }) {
  const toneClasses = {
    neutral:
      "border-gray-300 text-gray-600 hover:border-temaSky hover:text-temaSky dark:border-gray-700 dark:text-gray-300 dark:hover:border-temaEmerald dark:hover:text-temaEmerald",
    info:
      "border-temaSky/70 text-temaSky hover:bg-temaSky/10 dark:border-temaEmerald/70 dark:text-temaEmerald dark:hover:bg-temaEmerald/10",
    danger:
      "border-rose-400/60 text-rose-500 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
        toneClasses[tone] ?? toneClasses.neutral
      }`}
    >
      {children}
    </button>
  );
}

export default function RecordActions({ onView, onEdit, onDelete, disabled = false }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton onClick={onView} disabled={disabled} tone="info">
        Detalhes
      </ActionButton>
      <ActionButton onClick={onEdit} disabled={disabled}>
        Editar
      </ActionButton>
      <ActionButton onClick={onDelete} disabled={disabled} tone="danger">
        Excluir
      </ActionButton>
    </div>
  );
}
