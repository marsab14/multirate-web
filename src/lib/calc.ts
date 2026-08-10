// Duplicated from billing-api on purpose; server is source of truth. If calc
// policy changes, update both.
//
// Rules (must match billing-api/app/services/calc.py):
//   - All money math uses decimal.js precision 12, HALF_UP rounding.
//   - Final money values rounded to 2 decimal places.
//   - Per line:
//       subtotal        = qty * unit
//       discount:
//         null          → 0
//         '%'           → subtotal * discount_value / 100
//         'fixed'       → discount_value
//       (discount must be <= subtotal, else DISCOUNT_EXCEEDS_SUBTOTAL)
//       taxable         = subtotal - discount
//       tax             = taxable * tax_pct / 100
//       total           = taxable + tax
//   - Document totals are the sum of the rounded line values (sum-of-rounded,
//     to match how invoices are printed).
//   - Stable error codes (mirrored from the backend):
//       INVALID_NUMBER, NEGATIVE_QUANTITY, NEGATIVE_UNIT_PRICE,
//       RATE_OUT_OF_RANGE, DISCOUNT_EXCEEDS_SUBTOTAL

import { Decimal } from "decimal.js";
import type {
  DiscountType,
  DocumentTotals,
  LineItem,
  LineItemTotals,
  MoneyString,
} from "../types/api";

Decimal.set({ precision: 12, rounding: Decimal.ROUND_HALF_UP });

const MONEY_DP = 2;
const HUNDRED = new Decimal(100);
const ZERO = new Decimal(0);

export const CALC_ERROR_CODES = {
  INVALID_NUMBER: "INVALID_NUMBER",
  NEGATIVE_QUANTITY: "NEGATIVE_QUANTITY",
  NEGATIVE_UNIT_PRICE: "NEGATIVE_UNIT_PRICE",
  RATE_OUT_OF_RANGE: "RATE_OUT_OF_RANGE",
  DISCOUNT_EXCEEDS_SUBTOTAL: "DISCOUNT_EXCEEDS_SUBTOTAL",
} as const;

export type CalcErrorCode =
  (typeof CALC_ERROR_CODES)[keyof typeof CALC_ERROR_CODES];

export class CalcError extends Error {
  code: CalcErrorCode;
  field: string;
  constructor(code: CalcErrorCode, field: string, message: string) {
    super(message);
    this.name = "CalcError";
    this.code = code;
    this.field = field;
  }
}

function toDecimal(
  value: number | string | null | undefined,
  field: string,
): Decimal {
  if (value === null || value === undefined || value === "") return ZERO;
  try {
    const d = new Decimal(value);
    if (!d.isFinite()) {
      throw new CalcError(
        CALC_ERROR_CODES.INVALID_NUMBER,
        field,
        `${field} must be a finite number`,
      );
    }
    return d;
  } catch (err) {
    if (err instanceof CalcError) throw err;
    throw new CalcError(
      CALC_ERROR_CODES.INVALID_NUMBER,
      field,
      `${field} is not a valid number: ${String(value)}`,
    );
  }
}

function money(d: Decimal): MoneyString {
  return d.toDecimalPlaces(MONEY_DP, Decimal.ROUND_HALF_UP).toFixed(MONEY_DP);
}

export interface LineComputeInput {
  qty: number | string | null | undefined;
  unit: number | string | null | undefined;
  discount_type: DiscountType;
  discount_value: number | string | null | undefined;
  tax_pct: number | string | null | undefined;
}

export function computeLine(item: LineComputeInput): LineItemTotals {
  const qty = toDecimal(item.qty, "qty");
  const unit = toDecimal(item.unit, "unit");
  const tax_pct = toDecimal(item.tax_pct, "tax_pct");

  if (qty.lt(0)) {
    throw new CalcError(
      CALC_ERROR_CODES.NEGATIVE_QUANTITY,
      "qty",
      "qty must be >= 0",
    );
  }
  if (unit.lt(0)) {
    throw new CalcError(
      CALC_ERROR_CODES.NEGATIVE_UNIT_PRICE,
      "unit",
      "unit must be >= 0",
    );
  }
  if (tax_pct.lt(0) || tax_pct.gt(HUNDRED)) {
    throw new CalcError(
      CALC_ERROR_CODES.RATE_OUT_OF_RANGE,
      "tax_pct",
      "tax_pct must be between 0 and 100",
    );
  }

  const subtotal = qty.mul(unit);

  let discount: Decimal;
  if (item.discount_type === "%") {
    const pct = toDecimal(item.discount_value, "discount_value");
    if (pct.lt(0) || pct.gt(HUNDRED)) {
      throw new CalcError(
        CALC_ERROR_CODES.RATE_OUT_OF_RANGE,
        "discount_value",
        "percentage discount must be between 0 and 100",
      );
    }
    discount = subtotal.mul(pct).div(HUNDRED);
  } else if (item.discount_type === "fixed") {
    discount = toDecimal(item.discount_value, "discount_value");
    if (discount.lt(0)) {
      throw new CalcError(
        CALC_ERROR_CODES.RATE_OUT_OF_RANGE,
        "discount_value",
        "fixed discount must be >= 0",
      );
    }
  } else {
    discount = ZERO;
  }

  if (discount.gt(subtotal)) {
    throw new CalcError(
      CALC_ERROR_CODES.DISCOUNT_EXCEEDS_SUBTOTAL,
      "discount_value",
      "discount cannot exceed line subtotal",
    );
  }

  const taxable = subtotal.sub(discount);
  const tax = taxable.mul(tax_pct).div(HUNDRED);
  const total = taxable.add(tax);

  return {
    subtotal: money(subtotal),
    discount: money(discount),
    taxable: money(taxable),
    tax: money(tax),
    total: money(total),
  };
}

export function computeDocument(
  lines: Array<
    Pick<
      LineItem,
      "qty" | "unit" | "discount_type" | "discount_value" | "tax_pct"
    >
  >,
): DocumentTotals {
  const line_totals = lines.map(computeLine);

  let subtotal = ZERO;
  let total_discount = ZERO;
  let total_tax = ZERO;
  let grand_total = ZERO;

  for (const lt of line_totals) {
    subtotal = subtotal.add(new Decimal(lt.subtotal));
    total_discount = total_discount.add(new Decimal(lt.discount));
    total_tax = total_tax.add(new Decimal(lt.tax));
    grand_total = grand_total.add(new Decimal(lt.total));
  }

  return {
    subtotal: money(subtotal),
    total_discount: money(total_discount),
    total_tax: money(total_tax),
    grand_total: money(grand_total),
    lines: line_totals,
  };
}
