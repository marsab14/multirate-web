import { useMemo } from "react";
import {
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Typography,
} from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { CalcError, computeLine } from "../lib/calc";
import { formatMoney } from "../lib/format";
import type { DiscountType, LineItem } from "../types/api";

interface Props {
  disabled?: boolean;
  errorIndex?: number | null;
}

type LineFormValues = Pick<
  LineItem,
  | "description"
  | "quantity"
  | "unit_price"
  | "discount_type"
  | "discount_value"
  | "tax_percent"
> & { id?: string };

const NEW_LINE: LineFormValues = {
  description: "",
  quantity: 1,
  unit_price: 0,
  discount_type: null,
  discount_value: null,
  tax_percent: 0,
};

const numericStyle: React.CSSProperties = {
  fontVariantNumeric: "tabular-nums",
};

const HEADER: Array<{ label: string; width?: number | string; align?: "right" }> = [
  { label: "Description", width: "1 1 200px" },
  { label: "Qty", width: 70 },
  { label: "Unit price", width: 100 },
  { label: "Discount", width: 90 },
  { label: "Value", width: 90 },
  { label: "Tax %", width: 80 },
  { label: "Total", width: 100, align: "right" },
  { label: "", width: 40 },
];

// Column widths as flex bases. Keep in sync with the input row cols below.
const colProps = (i: number) => {
  const w = HEADER[i].width;
  if (typeof w === "number") return { style: { width: w, flex: `0 0 ${w}px` } };
  return { flex: w };
};

interface RowProps {
  field: { name: number; key: number };
  remove: (index: number) => void;
  disabled?: boolean;
  hasError: boolean;
}

function LineRow({ field, remove, disabled, hasError }: RowProps) {
  const form = Form.useFormInstance();
  const line = Form.useWatch(["lines", field.name], form) as
    | LineFormValues
    | undefined;

  const total = useMemo(() => {
    if (!line) return "0.00";
    try {
      return computeLine(line).total;
    } catch (err) {
      return err instanceof CalcError ? "—" : "—";
    }
  }, [line]);

  const discountType: DiscountType = line?.discount_type ?? null;
  const valueDisabled = disabled || discountType === null;

  return (
    <div
      data-line-index={field.name}
      style={{
        padding: 4,
        borderRadius: 6,
        outline: hasError ? "2px solid #ff4d4f" : "none",
        outlineOffset: 2,
        marginBottom: 4,
      }}
    >
      <Row gutter={8} align="middle" wrap={false}>
        <Col {...colProps(0)}>
          <Form.Item
            name={[field.name, "description"]}
            rules={[{ required: true, message: "Required" }]}
            style={{ marginBottom: 0 }}
          >
            <Input placeholder="Item description" disabled={disabled} />
          </Form.Item>
        </Col>
        <Col {...colProps(1)}>
          <Form.Item
            name={[field.name, "quantity"]}
            rules={[{ required: true, message: "" }]}
            style={{ marginBottom: 0 }}
          >
            <InputNumber
              min={1}
              precision={0}
              disabled={disabled}
              style={{ width: "100%" }}
            />
          </Form.Item>
        </Col>
        <Col {...colProps(2)}>
          <Form.Item
            name={[field.name, "unit_price"]}
            rules={[{ required: true, message: "" }]}
            style={{ marginBottom: 0 }}
          >
            <InputNumber
              min={0}
              precision={2}
              step={0.01}
              disabled={disabled}
              style={{ width: "100%" }}
            />
          </Form.Item>
        </Col>
        <Col {...colProps(3)}>
          <Form.Item
            name={[field.name, "discount_type"]}
            style={{ marginBottom: 0 }}
          >
            <Select<DiscountType>
              disabled={disabled}
              style={{ width: "100%" }}
              options={[
                { value: null, label: "—" },
                { value: "percent", label: "%" },
                { value: "fixed", label: "fixed" },
              ]}
              onChange={(v) => {
                // Clear the value when the user un-picks a discount type.
                if (v === null) {
                  form.setFieldValue(
                    ["lines", field.name, "discount_value"],
                    null,
                  );
                }
              }}
            />
          </Form.Item>
        </Col>
        <Col {...colProps(4)}>
          <Form.Item
            name={[field.name, "discount_value"]}
            style={{ marginBottom: 0 }}
          >
            <InputNumber
              min={0}
              precision={2}
              disabled={valueDisabled}
              style={{ width: "100%" }}
            />
          </Form.Item>
        </Col>
        <Col {...colProps(5)}>
          <Form.Item
            name={[field.name, "tax_percent"]}
            style={{ marginBottom: 0 }}
          >
            <InputNumber
              min={0}
              max={100}
              precision={2}
              disabled={disabled}
              style={{ width: "100%" }}
            />
          </Form.Item>
        </Col>
        <Col {...colProps(6)}>
          <div style={{ textAlign: "right", ...numericStyle }}>
            {formatMoney(total)}
          </div>
        </Col>
        <Col {...colProps(7)}>
          <Button
            type="text"
            icon={<DeleteOutlined />}
            disabled={disabled}
            aria-label="Remove line"
            onClick={() => remove(field.name)}
          />
        </Col>
      </Row>
    </div>
  );
}

export default function LineItemsEditor({ disabled, errorIndex }: Props) {
  return (
    <Form.List name="lines">
      {(fields, { add, remove }) => (
        <div>
          {fields.length > 0 ? (
            <Row
              gutter={8}
              align="middle"
              wrap={false}
              style={{
                padding: "0 4px 8px",
                color: "rgba(0,0,0,0.45)",
                fontSize: 12,
              }}
            >
              {HEADER.map((h, i) => (
                <Col key={i} {...colProps(i)}>
                  <div style={{ textAlign: h.align ?? "left" }}>{h.label}</div>
                </Col>
              ))}
            </Row>
          ) : null}

          {fields.map((field) => (
            <LineRow
              key={field.key}
              field={field}
              remove={remove}
              disabled={disabled}
              hasError={errorIndex === field.name}
            />
          ))}

          {fields.length === 0 ? (
            <div
              style={{
                padding: "16px 0",
                color: "rgba(0,0,0,0.45)",
                textAlign: "center",
              }}
            >
              <Space direction="vertical" size={4}>
                <Typography.Text type="secondary">
                  No line items yet.
                </Typography.Text>
              </Space>
            </div>
          ) : null}

          <Button
            type="dashed"
            icon={<PlusOutlined />}
            block
            disabled={disabled}
            onClick={() => add({ ...NEW_LINE })}
            style={{ marginTop: 12 }}
          >
            Add line
          </Button>
        </div>
      )}
    </Form.List>
  );
}
