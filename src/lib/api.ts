import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { getSession, setSession } from "./session";
import { mockAdapter } from "./mockApi";
import type { ApiErrorEnvelope, Session } from "../types/api";

const mockEnabled = import.meta.env.VITE_MOCK_API === "true";
const configuredBase = import.meta.env.VITE_API_URL;
// When mocking we don't hit the network, but axios still wants a valid
// baseURL to build request URLs against.
const baseURL = configuredBase || (mockEnabled ? "http://mock.local" : "");

if (!baseURL) {
  throw new Error(
    "Missing VITE_API_URL. Copy .env.example to .env.local. " +
      "Set VITE_MOCK_API=true to use the in-browser mock backend instead.",
  );
}

export const api = axios.create({ baseURL });

// A second instance with no interceptors, used for the refresh call so it
// can't recursively trigger the response interceptor. Both instances share
// the mock adapter when mocking is enabled.
const bare = axios.create({ baseURL });

if (mockEnabled) {
  api.defaults.adapter = mockAdapter;
  bare.defaults.adapter = mockAdapter;
  // eslint-disable-next-line no-console
  console.info(
    "[mockApi] In-browser mock backend enabled. " +
      "Demo user: demo@example.com / password. " +
      "State persists in localStorage under `billing.mock.db`. " +
      "Run `__resetMockDb()` in DevTools console to wipe.",
  );
}

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
    const { data } = await bare.post<{ session: Session }>(
      "/api/auth/refresh",
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
