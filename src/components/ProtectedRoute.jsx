import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function ProtectedRoute() {
  const { session, loading, error } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        Carregando sessão...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 text-center text-sm text-rose-600 dark:text-rose-300">
        {error.message || "Não foi possível validar a sessão. Tente novamente."}
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/app" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
