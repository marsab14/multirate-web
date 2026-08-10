import { Card, Descriptions, Typography } from "antd";
import { useMemo } from "react";
import { computeDocument, CalcError } from "../lib/calc";
import { formatMoney } from "../lib/format";
import type { EditableLineItem } from "./LineItemsEditor";

interface Props {
  lines: EditableLineItem[];
  currency?: string;
}

export default function TotalsPanel({ lines, currency }: Props) {
  const result = useMemo(() => {
    try {
      return { totals: computeDocument(lines), error: null as string | null };
    } catch (err) {
      const message =
        err instanceof CalcError
          ? `${err.field}: ${err.message}`
          : err instanceof Error
            ? err.message
            : "Invalid line item";
      return { totals: null, error: message };
    }
  }, [lines]);

  if (result.error) {
    return (
      <Card title="Totals" size="small">
        <Typography.Text type="danger">{result.error}</Typography.Text>
      </Card>
    );
  }

  const t = result.totals!;
  const suffix = currency ? ` ${currency}` : "";
  const numeric: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

  return (
    <Card title="Totals" size="small">
      <Descriptions column={1} size="small">
        <Descriptions.Item label="Subtotal">
          <span style={numeric}>
            {formatMoney(t.subtotal)}
            {suffix}
          </span>
        </Descriptions.Item>
        <Descriptions.Item label="Discount">
          <span style={numeric}>
            −{formatMoney(t.discount_total)}
            {suffix}
          </span>
        </Descriptions.Item>
        <Descriptions.Item label="Tax">
          <span style={numeric}>
            {formatMoney(t.tax_total)}
            {suffix}
          </span>
        </Descriptions.Item>
        <Descriptions.Item label="Grand total">
          <Typography.Text strong style={numeric}>
            {formatMoney(t.grand_total)}
            {suffix}
          </Typography.Text>
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );
}
