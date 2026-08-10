import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { getSession, setSession } from "./session";
import type { ApiErrorEnvelope, Session } from "../types/api";

const baseURL = import.meta.env.VITE_API_URL;

if (!baseURL) {
  throw new Error(
    "Missing VITE_API_URL. Copy .env.example to .env.local and fill it in.",
  );
}

export const api = axios.create({ baseURL });

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const session = getSession();
  if (session?.access_token) {
    config.headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  return config;
});

// Single-flight refresh: concurrent 401s share one refresh request.
let refreshPromise: Promise<Session | null> | null = null;

const doRefresh = async (): Promise<Session | null> => {
  const session = getSession();
  if (!session?.refresh_token) return null;
  try {
    const { data } = await axios.post<{ session: Session }>(
      `${baseURL}/api/auth/refresh`,
      { refresh_token: session.refresh_token },
    );
    setSession(data.session);
    return data.session;
  } catch {
    setSession(null);
    return null;
  }
};

type RetryConfig = AxiosRequestConfig & { _retried?: boolean };

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError<ApiErrorEnvelope>) => {
    const original = error.config as RetryConfig | undefined;
    const code = error.response?.data?.error?.code;
    const shouldRefresh =
      !!original &&
      error.response?.status === 401 &&
      (code === "TOKEN_EXPIRED" || code === "INVALID_TOKEN") &&
      !original._retried;

    if (!shouldRefresh) return Promise.reject(error);

    original!._retried = true;
    refreshPromise = refreshPromise ?? doRefresh();
    const newSession = await refreshPromise;
    refreshPromise = null;

    if (!newSession) {
      // Outside the router here — hard redirect resets app state cleanly.
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }
    original!.headers = original!.headers ?? {};
    (original!.headers as Record<string, string>).Authorization =
      `Bearer ${newSession.access_token}`;
    return api(original!);
  },
);
