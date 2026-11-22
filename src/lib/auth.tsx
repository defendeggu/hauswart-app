import {
  createContext,
  useContext,
  useEffect,
  useMemo,
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

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
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
  const [loading, setLoading] = useState(true);

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
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    supabase
      .from("profiles")
      .select("id, family_id, username, name, rolle, aktiv")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data) {
          setProfile(null);
        } else {
          setProfile(data as Profile);
        }
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
      loading,
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
    [session, profile, loading],
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
