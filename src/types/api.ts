// Shared API types. Money values are strings to preserve exact decimal
// precision across the wire; convert to Decimal (decimal.js) when computing
// locally.

export type UUID = string;
export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string; // RFC 3339
export type MoneyString = string; // e.g. "1234.56"

export type DocumentType = "invoice" | "quote";
export type DocumentStatus = "draft" | "sent" | "paid" | "void";

export interface SessionUser {
  id: string;
  email: string;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  user: SessionUser;
}

export interface AuthResponse {
  session: Session;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiErrorEnvelope {
  error: ApiError;
}

export interface LineItem {
  id: UUID;
  document_id: UUID;
  description: string;
  quantity: MoneyString;
  unit_price: MoneyString;
  tax_rate: MoneyString; // percentage, e.g. "18.00"
  discount_rate: MoneyString; // percentage
  position: number;
}

export interface Document {
  id: UUID;
  owner_id: UUID;
  type: DocumentType;
  status: DocumentStatus;
  number: string;
  customer_name: string;
  customer_email: string | null;
  issue_date: ISODate;
  due_date: ISODate | null;
  currency: string; // ISO 4217, e.g. "INR", "USD"
  notes: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
  line_items: LineItem[];
}

// Computed totals returned by calc.ts. Sum-of-rounded, not round-of-sum.
export interface LineItemTotals {
  subtotal: MoneyString;
  discount_amount: MoneyString;
  taxable_amount: MoneyString;
  tax_amount: MoneyString;
  total: MoneyString;
}

export interface DocumentTotals {
  subtotal: MoneyString;
  discount_total: MoneyString;
  tax_total: MoneyString;
  grand_total: MoneyString;
  line_totals: LineItemTotals[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
