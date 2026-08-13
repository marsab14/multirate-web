// In-browser mock backend. Installed as an axios adapter so the rest of the
// app has no idea it's not talking to a real API. Enable via
// VITE_MOCK_API=true. All state persists in localStorage under
// `billing.mock.db` — clear that key to reset.

import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { computeDocument, CalcError } from "./calc";
import type {
  Document,
  DocumentListResponse,
  LineItem,
  Session,
} from "../types/api";

const DB_KEY = "billing.mock.db";
const DB_VERSION = 3; // bumped when the line-item field shapes changed
const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "password";
// 15 minutes — long enough to click around, short enough to exercise the
// refresh flow within a normal QA session.
const ACCESS_TTL_SEC = 15 * 60;

interface MockUser {
  id: string;
  email: string;
  password: string;
}

interface MockDb {
  version: number;
  users: MockUser[];
  documents: Document[];
  // refresh_token → user_id
  refresh_tokens: Record<string, string>;
}

// --- utilities ----------------------------------------------------------

const uid = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const nowSec = () => Math.floor(Date.now() / 1000);
const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Access token format: mock.v1.<userId>.<expiresAtSec>
const makeAccessToken = (userId: string) =>
  `mock.v1.${userId}.${nowSec() + ACCESS_TTL_SEC}`;

interface ParsedToken {
  userId: string;
  expiresAt: number;
}

const parseAccessToken = (token: string): ParsedToken | null => {
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "mock" || parts[1] !== "v1") return null;
  const [, , userId, exp] = parts;
  const expiresAt = Number(exp);
  if (!userId || !Number.isFinite(expiresAt)) return null;
  return { userId, expiresAt };
};

const getAuthHeader = (
  config: InternalAxiosRequestConfig,
): string | undefined => {
  const h = config.headers as unknown;
  if (h && typeof h === "object") {
    const anyH = h as {
      get?: (k: string) => string | undefined | null;
      Authorization?: string;
      authorization?: string;
    };
    if (typeof anyH.get === "function") {
      const v = anyH.get("Authorization");
      if (typeof v === "string") return v;
    }
    return anyH.Authorization ?? anyH.authorization;
  }
  return undefined;
};

function parseBody<T>(config: InternalAxiosRequestConfig): T {
  const raw = config.data;
  if (raw === undefined || raw === null) return {} as T;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return {} as T;
    }
  }
  return raw as T;
}

// --- seed ---------------------------------------------------------------

function seed(): MockDb {
  const userId = uid();
  const created = nowIso();

  const doc1Id = uid();
  const doc1: Document = {
    id: doc1Id,
    owner_id: userId,
    status: "draft",
    title: "Sample invoice — widgets",
    customer: "Acme Corp",
    issue_date: today(),
    finalized_at: null,
    created_at: created,
    updated_at: created,
    lines: [
      {
        id: uid(),
        document_id: doc1Id,
        description: "Widget A",
        quantity: 2,
        unit_price: 50,
        discount_type: null,
        discount_value: null,
        tax_percent: 10,
        position: 0,
      },
      {
        id: uid(),
        document_id: doc1Id,
        description: "Widget B",
        quantity: 3,
        unit_price: 30,
        discount_type: "percent",
        discount_value: 10,
        tax_percent: 10,
        position: 1,
      },
      {
        id: uid(),
        document_id: doc1Id,
        description: "Service fee",
        quantity: 1,
        unit_price: 250,
        discount_type: "fixed",
        discount_value: 25,
        tax_percent: 10,
        position: 2,
      },
    ],
  };

  const doc2Id = uid();
  const doc2: Document = {
    id: doc2Id,
    owner_id: userId,
    status: "finalized",
    title: "March consulting",
    customer: "Globex",
    issue_date: today(),
    finalized_at: created,
    created_at: created,
    updated_at: created,
    lines: [
      {
        id: uid(),
        document_id: doc2Id,
        description: "Consulting hours",
        quantity: 40,
        unit_price: 100,
        discount_type: null,
        discount_value: null,
        tax_percent: 5,
        position: 0,
      },
    ],
  };

  const doc3Id = uid();
  const doc3: Document = {
    id: doc3Id,
    owner_id: userId,
    status: "draft",
    title: "Design revamp",
    customer: "Initech",
    issue_date: today(),
    finalized_at: null,
    created_at: created,
    updated_at: created,
    lines: [
      {
        id: uid(),
        document_id: doc3Id,
        description: "Logo redesign",
        quantity: 1,
        unit_price: 800,
        discount_type: "percent",
        discount_value: 12.5,
        tax_percent: 5,
        position: 0,
      },
    ],
  };

  return {
    version: DB_VERSION,
    users: [{ id: userId, email: DEMO_EMAIL, password: DEMO_PASSWORD }],
    documents: [doc1, doc2, doc3],
    refresh_tokens: {},
  };
}

function loadDb(): MockDb {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw) as MockDb;
    if (parsed?.version !== DB_VERSION) throw new Error("stale");
    return parsed;
  } catch {
    // Version mismatch or corrupted data: wipe the session too, since any
    // active login's user_id belongs to the previous seed generation.
    localStorage.removeItem("billing.session");
    const fresh = seed();
    saveDb(fresh);
    return fresh;
  }
}

function saveDb(db: MockDb) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

// --- response helpers ---------------------------------------------------

function response<T>(
  config: InternalAxiosRequestConfig,
  status: number,
  data: T,
): AxiosResponse<T> {
  return {
    status,
    statusText: status >= 200 && status < 300 ? "OK" : "Error",
    data,
    headers: { "content-type": "application/json" },
    config,
  };
}

function errorResponse(
  config: InternalAxiosRequestConfig,
  status: number,
  code: string,
  message: string,
  field?: string,
) {
  return response(config, status, {
    error: { code, message, ...(field ? { field } : {}) },
  });
}

function makeSession(user: MockUser, db: MockDb): Session {
  const refresh_token = uid();
  db.refresh_tokens[refresh_token] = user.id;
  return {
    access_token: makeAccessToken(user.id),
    refresh_token,
    expires_at: nowSec() + ACCESS_TTL_SEC,
    user: { id: user.id, email: user.email },
  };
}

// --- validation & totals ------------------------------------------------

function validateLines(lines: LineItem[]) {
  // Returns null on OK, or a CalcError. computeDocument runs the same rules
  // the UI uses live, so the mock's rejections match the frontend's calc.
  try {
    computeDocument(lines);
    return null;
  } catch (err) {
    if (err instanceof CalcError) return err;
    throw err;
  }
}

function withGrand(doc: Document): Document {
  try {
    const t = computeDocument(doc.lines);
    return { ...doc, grand_total: t.grand_total };
  } catch {
    return { ...doc, grand_total: "0.00" };
  }
}

function normalizeIncomingLine(
  li: Partial<LineItem>,
  documentId: string,
  idx: number,
): LineItem {
  return {
    id: uid(),
    document_id: documentId,
    description: String(li.description ?? ""),
    quantity: Number(li.quantity ?? 0),
    unit_price: Number(li.unit_price ?? 0),
    discount_type: li.discount_type ?? null,
    discount_value:
      li.discount_value === null || li.discount_value === undefined
        ? null
        : Number(li.discount_value),
    tax_percent: Number(li.tax_percent ?? 0),
    position: idx,
  };
}

// --- adapter ------------------------------------------------------------

export const mockAdapter: AxiosAdapter = async (config) => {
  // Simulated network latency.
  await sleep(120 + Math.random() * 180);
  const db = loadDb();

  const method = (config.method ?? "get").toUpperCase();
  const raw = config.url ?? "";
  const url = new URL(raw, config.baseURL ?? "http://mock.local");
  const path = url.pathname;
  const params = url.searchParams;

  // -------- auth routes (unauthenticated) --------
  if (method === "POST" && path === "/api/auth/signup") {
    const body = parseBody<{ email?: string; password?: string }>(config);
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    if (!email || !password) {
      return errorResponse(
        config,
        400,
        "VALIDATION_ERROR",
        "email and password required",
      );
    }
    if (password.length < 8) {
      return errorResponse(
        config,
        400,
        "VALIDATION_ERROR",
        "password must be at least 8 characters",
        "password",
      );
    }
    if (db.users.some((u) => u.email === email)) {
      return errorResponse(
        config,
        400,
        "EMAIL_TAKEN",
        "An account with this email already exists.",
      );
    }
    const user: MockUser = { id: uid(), email, password };
    db.users.push(user);
    const session = makeSession(user, db);
    saveDb(db);
    return response(config, 200, { session });
  }

  if (method === "POST" && path === "/api/auth/login") {
    const body = parseBody<{ email?: string; password?: string }>(config);
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    const user = db.users.find(
      (u) => u.email === email && u.password === password,
    );
    if (!user) {
      return errorResponse(
        config,
        401,
        "INVALID_CREDENTIALS",
        "Invalid email or password",
      );
    }
    const session = makeSession(user, db);
    saveDb(db);
    return response(config, 200, { session });
  }

  if (method === "POST" && path === "/api/auth/refresh") {
    const body = parseBody<{ refresh_token?: string }>(config);
    const rt = body.refresh_token ?? "";
    const userId = db.refresh_tokens[rt];
    if (!userId) {
      return errorResponse(
        config,
        401,
        "INVALID_TOKEN",
        "Invalid refresh token",
      );
    }
    const user = db.users.find((u) => u.id === userId);
    if (!user) {
      return errorResponse(config, 401, "INVALID_TOKEN", "User not found");
    }
    delete db.refresh_tokens[rt]; // rotate
    const session = makeSession(user, db);
    saveDb(db);
    return response(config, 200, { session });
  }

  if (method === "POST" && path === "/api/auth/logout") {
    const body = parseBody<{ refresh_token?: string }>(config);
    if (body.refresh_token) delete db.refresh_tokens[body.refresh_token];
    saveDb(db);
    return response<null>(config, 204, null);
  }

  // -------- authenticated routes --------
  const authHeader = getAuthHeader(config);
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse(config, 401, "INVALID_TOKEN", "Missing access token");
  }
  const parsed = parseAccessToken(authHeader.slice("Bearer ".length));
  if (!parsed) {
    return errorResponse(config, 401, "INVALID_TOKEN", "Invalid access token");
  }
  if (parsed.expiresAt < nowSec()) {
    return errorResponse(config, 401, "TOKEN_EXPIRED", "Access token expired");
  }
  const currentUserId = parsed.userId;
  const myDocs = () =>
    db.documents.filter((d) => d.owner_id === currentUserId);

  // GET /api/documents
  if (method === "GET" && path === "/api/documents") {
    const from = params.get("from");
    const to = params.get("to");
    let docs = myDocs();
    if (from) docs = docs.filter((d) => d.issue_date >= from);
    if (to) docs = docs.filter((d) => d.issue_date <= to);
    docs = docs
      .slice()
      .sort((a, b) => (a.issue_date < b.issue_date ? 1 : -1));
    return response<DocumentListResponse>(config, 200, {
      documents: docs.map(withGrand),
    });
  }

  // GET/PATCH /api/documents/:id
  const singleDoc = /^\/api\/documents\/([^/]+)$/.exec(path);
  if (singleDoc && (method === "GET" || method === "PATCH")) {
    const docId = singleDoc[1];
    const doc = db.documents.find(
      (d) => d.id === docId && d.owner_id === currentUserId,
    );
    if (!doc) {
      return errorResponse(config, 404, "NOT_FOUND", "Document not found");
    }
    if (method === "GET") {
      return response(config, 200, withGrand(doc));
    }
    if (doc.status === "finalized") {
      return errorResponse(
        config,
        409,
        "DOCUMENT_FINALIZED",
        "Document is finalized",
      );
    }
    const body = parseBody<Partial<Document>>(config);
    if (typeof body.title === "string") doc.title = body.title;
    if (typeof body.customer === "string") doc.customer = body.customer;
    if (typeof body.issue_date === "string") doc.issue_date = body.issue_date;
    doc.updated_at = nowIso();
    saveDb(db);
    return response(config, 200, withGrand(doc));
  }

  // POST /api/documents
  if (method === "POST" && path === "/api/documents") {
    const body = parseBody<Partial<Document>>(config);
    const id = uid();
    const created = nowIso();
    const lines = (body.lines ?? []).map((li, idx) =>
      normalizeIncomingLine(li, id, idx),
    );

    const calcErr = validateLines(lines);
    if (calcErr) {
      return errorResponse(
        config,
        400,
        calcErr.code,
        calcErr.message,
        // Include a line-scoped field so the editor can highlight the row.
        // We don't know which line failed here without more info, so leave
        // the field generic; the editor's live calc catches this earlier
        // in practice.
        calcErr.field,
      );
    }

    const doc: Document = {
      id,
      owner_id: currentUserId,
      status: "draft",
      title: body.title ?? "",
      customer: body.customer ?? "",
      issue_date: body.issue_date ?? today(),
      finalized_at: null,
      created_at: created,
      updated_at: created,
      lines,
    };
    db.documents.push(doc);
    saveDb(db);
    return response(config, 200, withGrand(doc));
  }

  // DELETE/POST /api/documents/:id/lines
  const linesRoute = /^\/api\/documents\/([^/]+)\/lines$/.exec(path);
  if (linesRoute && (method === "DELETE" || method === "POST")) {
    const docId = linesRoute[1];
    const doc = db.documents.find(
      (d) => d.id === docId && d.owner_id === currentUserId,
    );
    if (!doc) {
      return errorResponse(config, 404, "NOT_FOUND", "Document not found");
    }
    if (doc.status === "finalized") {
      return errorResponse(
        config,
        409,
        "DOCUMENT_FINALIZED",
        "Document is finalized",
      );
    }
    if (method === "DELETE") {
      doc.lines = [];
      doc.updated_at = nowIso();
      saveDb(db);
      return response<null>(config, 204, null);
    }
    const body = parseBody<{ lines?: Partial<LineItem>[] }>(config);
    const incoming = (body.lines ?? []).map((li, idx) =>
      normalizeIncomingLine(li, doc.id, idx),
    );
    const calcErr = validateLines(incoming);
    if (calcErr) {
      // Best-effort locate the offending line by re-running per line.
      let badIdx = -1;
      for (let i = 0; i < incoming.length; i += 1) {
        try {
          computeDocument([incoming[i]]);
        } catch {
          badIdx = i;
          break;
        }
      }
      return errorResponse(
        config,
        400,
        calcErr.code,
        calcErr.message,
        badIdx >= 0 ? `lines.${badIdx}.${calcErr.field}` : calcErr.field,
      );
    }
    doc.lines = incoming;
    doc.updated_at = nowIso();
    saveDb(db);
    return response(config, 200, withGrand(doc));
  }

  // POST /api/documents/:id/finalize
  const finalizeRoute = /^\/api\/documents\/([^/]+)\/finalize$/.exec(path);
  if (method === "POST" && finalizeRoute) {
    const docId = finalizeRoute[1];
    const doc = db.documents.find(
      (d) => d.id === docId && d.owner_id === currentUserId,
    );
    if (!doc) {
      return errorResponse(config, 404, "NOT_FOUND", "Document not found");
    }
    if (doc.status === "finalized") {
      return errorResponse(
        config,
        409,
        "DOCUMENT_FINALIZED",
        "Document already finalized",
      );
    }
    doc.status = "finalized";
    doc.finalized_at = nowIso();
    doc.updated_at = doc.finalized_at;
    saveDb(db);
    return response(config, 200, withGrand(doc));
  }

  // GET /api/reports/summary
  if (method === "GET" && path === "/api/reports/summary") {
    const from = params.get("from");
    const to = params.get("to");
    let docs = myDocs();
    if (from) docs = docs.filter((d) => d.issue_date >= from);
    if (to) docs = docs.filter((d) => d.issue_date <= to);

    let subtotal = 0;
    let discount = 0;
    let tax = 0;
    let grand = 0;
    for (const d of docs) {
      try {
        const t = computeDocument(d.lines);
        subtotal += Number(t.subtotal);
        discount += Number(t.total_discount);
        tax += Number(t.total_tax);
        grand += Number(t.grand_total);
      } catch {
        // skip malformed doc (shouldn't happen for stored docs)
      }
    }
    return response(config, 200, {
      document_count: docs.length,
      total_subtotal: subtotal.toFixed(2),
      total_grand_total: grand.toFixed(2),
      total_tax: tax.toFixed(2),
      total_discount: discount.toFixed(2),
      documents: docs.map(withGrand),
    });
  }

  return errorResponse(
    config,
    404,
    "NOT_FOUND",
    `Mock backend: no handler for ${method} ${path}`,
  );
};

// Expose a tiny reset helper on window in dev so evaluators can wipe
// state without opening DevTools > Application > Local Storage.
if (typeof window !== "undefined") {
  const anyWin = window as unknown as { __resetMockDb?: () => void };
  anyWin.__resetMockDb = () => {
    localStorage.removeItem(DB_KEY);
    localStorage.removeItem("billing.session");
    // eslint-disable-next-line no-console
    console.info("[mockApi] Wiped mock DB and session. Reload to reseed.");
  };
}
