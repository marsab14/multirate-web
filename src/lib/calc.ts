// Duplicated from billing-api on purpose; server is source of truth. If calc
// policy changes, update both.
//
// Rules (must match billing-api/app/services/calc.py):
//   - All money math uses decimal.js with a working precision of 12 significant
//     digits; final money values are rounded HALF_UP to 2 decimal places.
//   - Percentages (tax_rate, discount_rate) are expressed 0..100 (not 0..1).
//   - Per line:
//       subtotal        = quantity * unit_price
//       discount_amount = subtotal * discount_rate / 100
//       taxable_amount  = subtotal - discount_amount
//       tax_amount      = taxable_amount * tax_rate / 100
//       total           = taxable_amount + tax_amount
//   - Document totals are the sum of the corresponding rounded line values
//     (sum-of-rounded, not round-of-sum, to match printed invoices).
//   - Inputs are validated; CalcError is thrown with a stable `code`.

import { Decimal } from "decimal.js";
import type {
  DocumentTotals,
  LineItem,
  LineItemTotals,
  MoneyString,
} from "../types/api";

Decimal.set({ precision: 12, rounding: Decimal.ROUND_HALF_UP });

const MONEY_DP = 2;
const HUNDRED = new Decimal(100);
const ZERO = new Decimal(0);

// Stable error codes shared with billing-api. Keep in sync.
export const CALC_ERROR_CODES = {
  INVALID_NUMBER: "CALC_INVALID_NUMBER",
  NEGATIVE_QUANTITY: "CALC_NEGATIVE_QUANTITY",
  NEGATIVE_UNIT_PRICE: "CALC_NEGATIVE_UNIT_PRICE",
  RATE_OUT_OF_RANGE: "CALC_RATE_OUT_OF_RANGE",
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

function toDecimal(value: MoneyString | number, field: string): Decimal {
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
      `${field} is not a valid number: ${value}`,
    );
  }
}

function money(d: Decimal): MoneyString {
  return d.toDecimalPlaces(MONEY_DP, Decimal.ROUND_HALF_UP).toFixed(MONEY_DP);
}

export function computeLine(item: {
  quantity: MoneyString | number;
  unit_price: MoneyString | number;
  tax_rate: MoneyString | number;
  discount_rate: MoneyString | number;
}): LineItemTotals {
  const quantity = toDecimal(item.quantity, "quantity");
  const unit_price = toDecimal(item.unit_price, "unit_price");
  const tax_rate = toDecimal(item.tax_rate, "tax_rate");
  const discount_rate = toDecimal(item.discount_rate, "discount_rate");

  if (quantity.lt(0)) {
    throw new CalcError(
      CALC_ERROR_CODES.NEGATIVE_QUANTITY,
      "quantity",
      "quantity must be >= 0",
    );
  }
  if (unit_price.lt(0)) {
    throw new CalcError(
      CALC_ERROR_CODES.NEGATIVE_UNIT_PRICE,
      "unit_price",
      "unit_price must be >= 0",
    );
  }
  if (tax_rate.lt(0) || tax_rate.gt(HUNDRED)) {
    throw new CalcError(
      CALC_ERROR_CODES.RATE_OUT_OF_RANGE,
      "tax_rate",
      "tax_rate must be between 0 and 100",
    );
  }
  if (discount_rate.lt(0) || discount_rate.gt(HUNDRED)) {
    throw new CalcError(
      CALC_ERROR_CODES.RATE_OUT_OF_RANGE,
      "discount_rate",
      "discount_rate must be between 0 and 100",
    );
  }

  const subtotal = quantity.mul(unit_price);
  const discount_amount = subtotal.mul(discount_rate).div(HUNDRED);
  const taxable_amount = subtotal.sub(discount_amount);
  const tax_amount = taxable_amount.mul(tax_rate).div(HUNDRED);
  const total = taxable_amount.add(tax_amount);

  return {
    subtotal: money(subtotal),
    discount_amount: money(discount_amount),
    taxable_amount: money(taxable_amount),
    tax_amount: money(tax_amount),
    total: money(total),
  };
}

export function computeDocument(
  lines: Array<
    Pick<LineItem, "quantity" | "unit_price" | "tax_rate" | "discount_rate">
  >,
): DocumentTotals {
  const line_totals = lines.map(computeLine);

  let subtotal = ZERO;
  let discount_total = ZERO;
  let tax_total = ZERO;
  let grand_total = ZERO;

  for (const lt of line_totals) {
    subtotal = subtotal.add(new Decimal(lt.subtotal));
    discount_total = discount_total.add(new Decimal(lt.discount_amount));
    tax_total = tax_total.add(new Decimal(lt.tax_amount));
    grand_total = grand_total.add(new Decimal(lt.total));
  }

  return {
    subtotal: money(subtotal),
    discount_total: money(discount_total),
    tax_total: money(tax_total),
    grand_total: money(grand_total),
    line_totals,
  };
}
