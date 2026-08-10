import { useSyncExternalStore, useCallback } from "react";
import { getSession, setSession, subscribe } from "../lib/session";
import type { Session, SessionUser } from "../types/api";

export interface UseAuth {
  session: Session | null;
  user: SessionUser | null;
  signOut: () => void;
}

const getSnapshot = () => getSession();
const getServerSnapshot = () => null as Session | null;

export function useAuth(): UseAuth {
  const session = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const signOut = useCallback(() => setSession(null), []);
  return {
    session,
    user: session?.user ?? null,
    signOut,
  };
}
