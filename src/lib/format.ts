import dayjs from "dayjs";
import type { ISODate, ISODateTime } from "../types/api";

export const formatMoney = (v: string | number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(typeof v === "string" ? Number(v) : v);

export function formatDate(
  value: ISODate | ISODateTime | Date | null | undefined,
  format = "DD MMM YYYY",
): string {
  if (!value) return "—";
  const d = dayjs(value);
  return d.isValid() ? d.format(format) : "—";
}
