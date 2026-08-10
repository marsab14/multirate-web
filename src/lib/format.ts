import dayjs from "dayjs";
import type { ISODate, ISODateTime, MoneyString } from "../types/api";

export function formatMoney(
  amount: MoneyString | number,
  currency = "INR",
  locale = "en-IN",
): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return String(amount);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export function formatDate(
  value: ISODate | ISODateTime | Date | null | undefined,
  format = "DD MMM YYYY",
): string {
  if (!value) return "—";
  const d = dayjs(value);
  return d.isValid() ? d.format(format) : "—";
}
