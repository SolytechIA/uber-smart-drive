import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  useEffect(() => {
    // 1) Set up listener FIRST. Only update session on meaningful events,
    //    so transient INITIAL_SESSION/TOKEN_REFRESHED with momentarily null
    //    values can't drop the user and trigger a /login redirect.
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === "SIGNED_OUT") {
        setSession(null);
      } else if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED" ||
        event === "INITIAL_SESSION"
      ) {
        // Only overwrite when we actually got a session, OR we have none yet.
        if (newSession) {
          setSession(newSession);
        } else if (!initialized.current) {
          setSession(null);
        }
      }
      if (!initialized.current) {
        initialized.current = true;
        setLoading(false);
      }
    });

    // 2) THEN fetch existing session (restores from storage)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSession(data.session);
      if (!initialized.current) {
        initialized.current = true;
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
