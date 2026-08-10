import { Card, Descriptions, Typography } from "antd";
import { useMemo } from "react";
import { computeDocument, CalcError } from "../lib/calc";
import { formatMoney } from "../lib/format";
import type { EditableLineItem } from "./LineItemsEditor";

interface Props {
  lines: EditableLineItem[];
  currency?: string;
}

export default function TotalsPanel({ lines, currency = "INR" }: Props) {
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

  return (
    <Card title="Totals" size="small">
      <Descriptions column={1} size="small">
        <Descriptions.Item label="Subtotal">
          {formatMoney(t.subtotal, currency)}
        </Descriptions.Item>
        <Descriptions.Item label="Discount">
          −{formatMoney(t.discount_total, currency)}
        </Descriptions.Item>
        <Descriptions.Item label="Tax">
          {formatMoney(t.tax_total, currency)}
        </Descriptions.Item>
        <Descriptions.Item label="Grand total">
          <Typography.Text strong>
            {formatMoney(t.grand_total, currency)}
          </Typography.Text>
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );
}
