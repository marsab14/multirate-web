// Shared API types. Money values are numbers here to align with AntD
// InputNumber, which returns/consumes JS numbers with a configured precision.
// The backend accepts either numeric JSON or decimal-string encoded values.

export type UUID = string;
export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string; // RFC 3339
export type MoneyString = string; // e.g. "1234.56"

export type DocumentStatus = "draft" | "finalized";
export type DiscountType = "%" | "fixed" | null;

export interface SessionUser {
  id: string;
  email: string;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: SessionUser;
}

export interface AuthResponse {
  session: Session;
}

export interface ApiError {
  code: string;
  message: string;
  // The backend can point validation errors at a specific field path,
  // e.g. "lines.2.discount_value".
  field?: string;
  details?: Record<string, unknown>;
}

export interface ApiErrorEnvelope {
  error: ApiError;
}

export interface LineItem {
  id?: UUID;
  document_id?: UUID;
  description: string;
  qty: number;
  unit: number;
  discount_type: DiscountType;
  discount_value: number | null;
  tax_pct: number;
  position?: number;
}

export interface Document {
  id: UUID;
  owner_id?: UUID;
  status: DocumentStatus;
  title: string;
  customer: string;
  issue_date: ISODate;
  currency?: string;
  grand_total?: MoneyString | number;
  finalized_at?: ISODateTime | null;
  created_at?: ISODateTime;
  updated_at?: ISODateTime;
  lines: LineItem[];
}

export interface DocumentListResponse {
  documents: Document[];
}

// Computed totals returned by calc.ts (and by the server on demand).
export interface LineItemTotals {
  subtotal: MoneyString;
  discount: MoneyString;
  taxable: MoneyString;
  tax: MoneyString;
  total: MoneyString;
}

export interface DocumentTotals {
  subtotal: MoneyString;
  total_discount: MoneyString;
  total_tax: MoneyString;
  grand_total: MoneyString;
  lines: LineItemTotals[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
