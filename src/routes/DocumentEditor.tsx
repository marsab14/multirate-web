import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  Row,
  Select,
  Space,
  Typography,
  message,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import LineItemsEditor, {
  type EditableLineItem,
} from "../components/LineItemsEditor";
import TotalsPanel from "../components/TotalsPanel";
import type { Document, DocumentStatus, DocumentType } from "../types/api";

interface HeaderFormValues {
  type: DocumentType;
  status: DocumentStatus;
  number: string;
  customer_name: string;
  customer_email: string | null;
  issue_date: Dayjs;
  due_date: Dayjs | null;
  currency: string;
  notes: string | null;
}

async function fetchDocument(id: string): Promise<Document> {
  const { data } = await api.get<Document>(`/api/documents/${id}`);
  return data;
}

async function saveDocument(
  id: string | undefined,
  payload: Partial<Document>,
): Promise<Document> {
  if (id) {
    const { data } = await api.put<Document>(`/api/documents/${id}`, payload);
    return data;
  }
  const { data } = await api.post<Document>("/api/documents", payload);
  return data;
}

export default function DocumentEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form] = Form.useForm<HeaderFormValues>();
  const [lines, setLines] = useState<EditableLineItem[]>([]);
  const [currency, setCurrency] = useState("INR");

  const { data: doc, isLoading } = useQuery({
    queryKey: ["document", id],
    queryFn: () => fetchDocument(id as string),
    enabled: !isNew,
  });

  useEffect(() => {
    if (doc) {
      form.setFieldsValue({
        type: doc.type,
        status: doc.status,
        number: doc.number,
        customer_name: doc.customer_name,
        customer_email: doc.customer_email,
        issue_date: dayjs(doc.issue_date),
        due_date: doc.due_date ? dayjs(doc.due_date) : null,
        currency: doc.currency,
        notes: doc.notes,
      });
      setCurrency(doc.currency);
      setLines(
        doc.line_items.map((li) => ({
          key: li.id,
          id: li.id,
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unit_price,
          tax_rate: li.tax_rate,
          discount_rate: li.discount_rate,
        })),
      );
    }
  }, [doc, form]);

  const initialValues = useMemo<Partial<HeaderFormValues>>(
    () => ({
      type: "invoice",
      status: "draft",
      currency: "INR",
      issue_date: dayjs(),
    }),
    [],
  );

  const save = useMutation({
    mutationFn: async (values: HeaderFormValues) => {
      const payload: Partial<Document> = {
        type: values.type,
        status: values.status,
        number: values.number,
        customer_name: values.customer_name,
        customer_email: values.customer_email,
        issue_date: values.issue_date.format("YYYY-MM-DD"),
        due_date: values.due_date ? values.due_date.format("YYYY-MM-DD") : null,
        currency: values.currency,
        notes: values.notes,
        line_items: lines.map((li, idx) => ({
          id: li.id ?? "",
          document_id: id ?? "",
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unit_price,
          tax_rate: li.tax_rate,
          discount_rate: li.discount_rate,
          position: idx,
        })),
      };
      return saveDocument(isNew ? undefined : id, payload);
    },
    onSuccess: (saved) => {
      message.success("Saved");
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["document", saved.id] });
      if (isNew) navigate(`/documents/${saved.id}`, { replace: true });
    },
    onError: (err) => {
      message.error(err instanceof Error ? err.message : "Failed to save");
    },
  });

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {isNew ? "New document" : `Document ${doc?.number ?? ""}`}
        </Typography.Title>
      </div>
      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <Card loading={!isNew && isLoading} title="Details">
            <Form<HeaderFormValues>
              form={form}
              layout="vertical"
              initialValues={initialValues}
              onValuesChange={(_, all) => {
                if (all.currency) setCurrency(all.currency);
              }}
              onFinish={(v) => save.mutate(v)}
            >
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item name="type" label="Type" rules={[{ required: true }]}>
                    <Select
                      options={[
                        { value: "invoice", label: "Invoice" },
                        { value: "quote", label: "Quote" },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="status"
                    label="Status"
                    rules={[{ required: true }]}
                  >
                    <Select
                      options={[
                        { value: "draft", label: "Draft" },
                        { value: "sent", label: "Sent" },
                        { value: "paid", label: "Paid" },
                        { value: "void", label: "Void" },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="number"
                    label="Number"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="INV-0001" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item
                    name="customer_name"
                    label="Customer"
                    rules={[{ required: true }]}
                  >
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="customer_email"
                    label="Customer email"
                    rules={[{ type: "email" }]}
                  >
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item
                    name="issue_date"
                    label="Issue date"
                    rules={[{ required: true }]}
                  >
                    <DatePicker style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="due_date" label="Due date">
                    <DatePicker style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="currency" label="Currency">
                    <Select
                      options={[
                        { value: "INR", label: "INR" },
                        { value: "USD", label: "USD" },
                        { value: "EUR", label: "EUR" },
                        { value: "GBP", label: "GBP" },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="notes" label="Notes">
                <Input.TextArea rows={3} />
              </Form.Item>

              <Typography.Title level={5}>Line items</Typography.Title>
              <LineItemsEditor value={lines} onChange={setLines} />

              <Space style={{ marginTop: 16 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={save.isPending}
                >
                  Save
                </Button>
                <Button onClick={() => navigate("/documents")}>Cancel</Button>
              </Space>
            </Form>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <TotalsPanel lines={lines} currency={currency} />
        </Col>
      </Row>
    </div>
  );
}
