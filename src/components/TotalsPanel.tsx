import { useMemo } from "react";
import { Card, Divider, Space, Typography } from "antd";
import { computeDocument, CalcError } from "../lib/calc";
import { formatMoney } from "../lib/format";
import type { LineItem } from "../types/api";

type ComputeLine = Pick<
  LineItem,
  | "quantity"
  | "unit_price"
  | "discount_type"
  | "discount_value"
  | "tax_percent"
>;

interface Props {
  lines: ComputeLine[];
}

const numericStyle: React.CSSProperties = {
  fontVariantNumeric: "tabular-nums",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
};

export default function TotalsPanel({ lines }: Props) {
  const result = useMemo(() => {
    try {
      return { totals: computeDocument(lines), error: null as string | null };
    } catch (err) {
      const message =
        err instanceof CalcError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Invalid line item";
      return { totals: null, error: message };
    }
  }, [lines]);

  if (result.error) {
    return (
      <Card size="small">
        <Typography.Text type="danger">{result.error}</Typography.Text>
      </Card>
    );
  }

  const t = result.totals!;

  return (
    <Card size="small" style={{ maxWidth: 360 }}>
      <Space direction="vertical" size={8} style={{ width: "100%" }}>
        <div style={rowStyle}>
          <Typography.Text type="secondary">Subtotal</Typography.Text>
          <span style={numericStyle}>{formatMoney(t.subtotal)}</span>
        </div>
        <div style={rowStyle}>
          <Typography.Text type="secondary">Total discount</Typography.Text>
          <span style={numericStyle}>
            {t.total_discount === "0.00" ? "" : "−"}
            {formatMoney(t.total_discount)}
          </span>
        </div>
        <div style={rowStyle}>
          <Typography.Text type="secondary">Total tax</Typography.Text>
          <span style={numericStyle}>
            {t.total_tax === "0.00" ? "" : "+"}
            {formatMoney(t.total_tax)}
          </span>
        </div>
        <Divider style={{ margin: "4px 0" }} />
        <div style={rowStyle}>
          <Typography.Text strong style={{ fontSize: 16 }}>
            Grand total
          </Typography.Text>
          <span style={{ ...numericStyle, fontSize: 16, fontWeight: 500 }}>
            {formatMoney(t.grand_total)}
          </span>
        </div>
      </Space>
    </Card>
  );
}
