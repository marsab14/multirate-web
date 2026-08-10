import type { Session } from "../types/api";

const KEY = "billing.session";
const listeners = new Set<() => void>();

export const getSession = (): Session | null => {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
};

export const setSession = (s: Session | null) => {
  if (s) localStorage.setItem(KEY, JSON.stringify(s));
  else localStorage.removeItem(KEY);
  listeners.forEach((fn) => fn());
};

export const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

// Cross-tab sync: mirror localStorage 'storage' events into listeners.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) listeners.forEach((fn) => fn());
  });
}
