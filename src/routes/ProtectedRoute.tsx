import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth, type Rolle } from "../lib/auth";
import { MfaChallengePage } from "../pages/MfaChallengePage";
import { MfaRequiredPage } from "../pages/MfaRequiredPage";

interface ProtectedRouteProps {
  children: ReactNode;
  requireRolle?: Rolle;
}

export function ProtectedRoute({ children, requireRolle }: ProtectedRouteProps) {
  const { session, profile, aal, loading } = useAuth();

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

  // 2FA eingerichtet, aber in dieser Sitzung noch nicht bestätigt.
  if (aal.next === "aal2" && aal.current !== "aal2") {
    return <MfaChallengePage />;
  }

  // Für Admins ist 2FA Pflicht; die Datenbank gibt Admin-Rechte nur mit aal2.
  if (profile.rolle === "admin" && aal.current !== "aal2") {
    return <MfaRequiredPage />;
  }

  if (requireRolle && profile.rolle !== requireRolle) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
