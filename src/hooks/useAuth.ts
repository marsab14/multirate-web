import { useEffect, useState } from "react";
import { getSession, setSession, subscribe } from "../lib/session";
import { api } from "../lib/api";
import type { Session, SessionUser } from "../types/api";

export interface UseAuth {
  session: Session | null;
  user: SessionUser | null;
  signOut: () => Promise<void>;
}

export const useAuth = (): UseAuth => {
  const [session, setSessionState] = useState<Session | null>(() =>
    getSession(),
  );

  useEffect(() => subscribe(() => setSessionState(getSession())), []);

  const signOut = async () => {
    const s = getSession();
    try {
      await api.post("/api/auth/logout", { refresh_token: s?.refresh_token });
    } catch {
      // best effort
    }
    setSession(null);
  };

  return { session, user: session?.user ?? null, signOut };
};
