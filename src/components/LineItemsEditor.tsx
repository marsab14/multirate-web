import { Button, Input, InputNumber, Table } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import type { LineItem, MoneyString } from "../types/api";

export type EditableLineItem = Pick<
  LineItem,
  "description" | "quantity" | "unit_price" | "tax_rate" | "discount_rate"
> & { id?: string; key: string };

interface Props {
  value: EditableLineItem[];
  onChange: (next: EditableLineItem[]) => void;
  disabled?: boolean;
}

function toMoneyString(n: number | null): MoneyString {
  if (n === null || n === undefined || Number.isNaN(n)) return "0";
  return String(n);
}

export default function LineItemsEditor({ value, onChange, disabled }: Props) {
  const update = (key: string, patch: Partial<EditableLineItem>) => {
    onChange(value.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const remove = (key: string) => {
    onChange(value.filter((row) => row.key !== key));
  };

  const add = () => {
    onChange([
      ...value,
      {
        key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        description: "",
        quantity: "1",
        unit_price: "0",
        tax_rate: "0",
        discount_rate: "0",
      },
    ]);
  };

  return (
    <>
      <Table<EditableLineItem>
        dataSource={value}
        pagination={false}
        rowKey="key"
        size="small"
        columns={[
          {
            title: "Description",
            dataIndex: "description",
            render: (_, row) => (
              <Input
                value={row.description}
                disabled={disabled}
                placeholder="Item description"
                onChange={(e) =>
                  update(row.key, { description: e.target.value })
                }
              />
            ),
          },
          {
            title: "Qty",
            dataIndex: "quantity",
            width: 120,
            render: (_, row) => (
              <InputNumber
                value={Number(row.quantity)}
                min={0}
                step={1}
                disabled={disabled}
                style={{ width: "100%" }}
                onChange={(v) => update(row.key, { quantity: toMoneyString(v) })}
              />
            ),
          },
          {
            title: "Unit price",
            dataIndex: "unit_price",
            width: 140,
            render: (_, row) => (
              <InputNumber
                value={Number(row.unit_price)}
                min={0}
                step={0.01}
                disabled={disabled}
                style={{ width: "100%" }}
                onChange={(v) =>
                  update(row.key, { unit_price: toMoneyString(v) })
                }
              />
            ),
          },
          {
            title: "Discount %",
            dataIndex: "discount_rate",
            width: 120,
            render: (_, row) => (
              <InputNumber
                value={Number(row.discount_rate)}
                min={0}
                max={100}
                step={0.5}
                disabled={disabled}
                style={{ width: "100%" }}
                onChange={(v) =>
                  update(row.key, { discount_rate: toMoneyString(v) })
                }
              />
            ),
          },
          {
            title: "Tax %",
            dataIndex: "tax_rate",
            width: 120,
            render: (_, row) => (
              <InputNumber
                value={Number(row.tax_rate)}
                min={0}
                max={100}
                step={0.5}
                disabled={disabled}
                style={{ width: "100%" }}
                onChange={(v) => update(row.key, { tax_rate: toMoneyString(v) })}
              />
            ),
          },
          {
            title: "",
            width: 60,
            render: (_, row) => (
              <Button
                type="text"
                icon={<DeleteOutlined />}
                disabled={disabled}
                onClick={() => remove(row.key)}
                aria-label="Remove line"
              />
            ),
          },
        ]}
      />
      <div style={{ marginTop: 12 }}>
        <Button
          icon={<PlusOutlined />}
          onClick={add}
          disabled={disabled}
          type="dashed"
          block
        >
          Add line item
        </Button>
      </div>
    </>
  );
}
