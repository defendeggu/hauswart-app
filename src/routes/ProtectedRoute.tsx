import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth, type Rolle } from "../lib/auth";

interface ProtectedRouteProps {
  children: ReactNode;
  requireRolle?: Rolle;
}

export function ProtectedRoute({ children, requireRolle }: ProtectedRouteProps) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center text-sm text-slate-400">
        Lädt…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!profile || !profile.aktiv) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center px-4 text-center text-sm text-slate-500">
        Dieses Login ist gesperrt. Bitte beim Verwalter melden.
      </div>
    );
  }

  if (requireRolle && profile.rolle !== requireRolle) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
