import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

export type Rolle = "hauswart" | "admin";

export interface Profile {
  id: string;
  family_id: string | null;
  username: string;
  name: string;
  rolle: Rolle;
  aktiv: boolean;
}

export type Aal = "aal1" | "aal2";

/** Sicherheitsstufe der Sitzung: current = erreicht, next = möglich (2FA eingerichtet). */
export interface AalState {
  current: Aal | null;
  next: Aal | null;
}

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  aal: AalState;
  loading: boolean;
  refreshAal: () => Promise<void>;
  signInWithUsername: (username: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const GENERIC_LOGIN_ERROR = "Benutzername oder Passwort ist falsch.";

async function resolveLoginEmail(username: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke<{ email: string }>(
    "resolve-login-email",
    { body: { username } },
  );
  if (error || !data?.email) {
    return null;
  }
  return data.email;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [aal, setAal] = useState<AalState>({ current: null, next: null });
  const [loading, setLoading] = useState(true);
  const loadedUserId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (!session) {
      loadedUserId.current = null;
      setProfile(null);
      setAal({ current: null, next: null });
      setLoading(false);
      return;
    }

    // Token-Refresh oder 2FA-Bestätigung: im Hintergrund neu laden, ohne die
    // Seite durch eine Ladeanzeige zu ersetzen (sonst gingen Eingaben verloren).
    if (loadedUserId.current !== session.user.id) {
      setLoading(true);
    }
    Promise.all([
      supabase
        .from("profiles")
        .select("id, family_id, username, name, rolle, aktiv")
        .eq("id", session.user.id)
        .maybeSingle(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]).then(([profileResult, aalResult]) => {
      if (!active) return;
      loadedUserId.current = session.user.id;
      setProfile(profileResult.error || !profileResult.data ? null : (profileResult.data as Profile));
      setAal({
        current: (aalResult.data?.currentLevel as Aal | null) ?? null,
        next: (aalResult.data?.nextLevel as Aal | null) ?? null,
      });
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [session]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      aal,
      loading,
      async refreshAal() {
        const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        setAal({
          current: (data?.currentLevel as Aal | null) ?? null,
          next: (data?.nextLevel as Aal | null) ?? null,
        });
      },
      async signInWithUsername(username, password) {
        const email = await resolveLoginEmail(username.trim());
        if (!email) {
          return { error: GENERIC_LOGIN_ERROR };
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          return { error: GENERIC_LOGIN_ERROR };
        }
        return { error: null };
      },
      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [session, profile, aal, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth muss innerhalb von <AuthProvider> verwendet werden.");
  }
  return ctx;
}
