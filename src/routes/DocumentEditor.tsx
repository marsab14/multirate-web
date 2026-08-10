import { useEffect, useMemo, useState } from "react";
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import axios, { type AxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import LineItemsEditor from "../components/LineItemsEditor";
import TotalsPanel from "../components/TotalsPanel";
import StatusTag from "../components/StatusTag";
import type {
  ApiErrorEnvelope,
  Document,
  DocumentStatus,
  LineItem,
} from "../types/api";

type LineFormValues = Pick<
  LineItem,
  | "description"
  | "qty"
  | "unit"
  | "discount_type"
  | "discount_value"
  | "tax_pct"
> & { id?: string };

interface EditorFormValues {
  title: string;
  customer: string;
  issue_date: string; // YYYY-MM-DD
  status: DocumentStatus;
  lines: LineFormValues[];
}

const NEW_INITIAL: EditorFormValues = {
  title: "",
  customer: "",
  issue_date: dayjs().format("YYYY-MM-DD"),
  status: "draft",
  lines: [],
};

const docToForm = (doc: Document): EditorFormValues => ({
  title: doc.title,
  customer: doc.customer,
  issue_date: doc.issue_date,
  status: doc.status,
  lines: doc.lines.map((li) => ({
    id: li.id,
    description: li.description,
    qty: li.qty,
    unit: li.unit,
    discount_type: li.discount_type,
    discount_value: li.discount_value,
    tax_pct: li.tax_pct,
  })),
});

// Parse an API validation field path like "lines.2.discount_value" → 2.
const parseLineIndex = (field: string | undefined): number | null => {
  if (!field) return null;
  const m = /^lines\.(\d+)(?:\.|$)/.exec(field);
  return m ? Number(m[1]) : null;
};

const scrollToLine = (idx: number) => {
  // Defer to next tick so the DOM has rendered the outline change first.
  setTimeout(() => {
    const el = document.querySelector<HTMLElement>(
      `[data-line-index="${idx}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 0);
};

export default function DocumentEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { message, modal } = App.useApp();
  const [form] = Form.useForm<EditorFormValues>();
  const [isDirty, setIsDirty] = useState(false);
  const [errorLineIndex, setErrorLineIndex] = useState<number | null>(null);

  const { data: doc, isLoading } = useQuery({
    queryKey: ["document", id],
    queryFn: async () => {
      const { data } = await api.get<Document>(`/api/documents/${id}`);
      return data;
    },
    enabled: !isNew,
  });

  useEffect(() => {
    if (doc) {
      form.setFieldsValue(docToForm(doc));
      setIsDirty(false);
      setErrorLineIndex(null);
    }
  }, [doc, form]);

  const status =
    (Form.useWatch("status", form) as DocumentStatus | undefined) ??
    doc?.status ??
    "draft";
  const title = Form.useWatch("title", form) as string | undefined;
  const customer = Form.useWatch("customer", form) as string | undefined;
  const issueDate = Form.useWatch("issue_date", form) as string | undefined;
  const lines =
    (Form.useWatch("lines", form) as LineFormValues[] | undefined) ?? [];

  const finalized = status === "finalized";

  const handleApiError = (err: unknown, context: "save" | "finalize") => {
    if (!axios.isAxiosError(err)) {
      message.error(`${context === "save" ? "Save" : "Finalize"} failed`);
      return;
    }
    const ax = err as AxiosError<ApiErrorEnvelope>;
    const status = ax.response?.status;
    const code = ax.response?.data?.error?.code;
    const apiField = ax.response?.data?.error?.field;
    const apiMsg = ax.response?.data?.error?.message;

    if (status === 409 && code === "DOCUMENT_FINALIZED") {
      message.error("This document was finalized elsewhere.");
      if (!isNew) qc.invalidateQueries({ queryKey: ["document", id] });
      return;
    }

    const lineIdx = parseLineIndex(apiField);
    if (code === "DISCOUNT_EXCEEDS_SUBTOTAL") {
      if (lineIdx !== null) {
        setErrorLineIndex(lineIdx);
        scrollToLine(lineIdx);
        form.setFields([
          {
            name: ["lines", lineIdx, "discount_value"],
            errors: [apiMsg ?? "Discount exceeds line subtotal"],
          },
        ]);
        message.error(
          `Line ${lineIdx + 1}: ${apiMsg ?? "Discount exceeds subtotal"}`,
        );
      } else {
        message.error(apiMsg ?? "Discount exceeds subtotal");
      }
      return;
    }

    if (status === 400 && code === "VALIDATION_ERROR" && apiField) {
      if (lineIdx !== null) {
        setErrorLineIndex(lineIdx);
        scrollToLine(lineIdx);
        const parts = apiField.split(".");
        if (parts[0] === "lines" && parts.length >= 3) {
          const key = parts[2] as keyof LineFormValues;
          form.setFields([
            {
              name: ["lines", Number(parts[1]), key],
              errors: [apiMsg ?? "Invalid value"],
            },
          ]);
        }
      }
      message.error(apiMsg ?? "Please fix the highlighted fields");
      return;
    }

    message.error(
      apiMsg ?? (context === "save" ? "Save failed" : "Finalize failed"),
    );
  };

  const saveDraft = useMutation({
    mutationFn: async (values: EditorFormValues) => {
      if (isNew) {
        const { data } = await api.post<Document>("/api/documents", {
          title: values.title,
          customer: values.customer,
          issue_date: values.issue_date,
          status: "draft",
          lines: values.lines,
        });
        return data;
      }
      // For existing docs: PATCH metadata, then replace lines wholesale.
      // See README ("Line sync strategy") for the tradeoff — we lose per-line
      // id continuity but the code stays trivially simple.
      await api.patch(`/api/documents/${id}`, {
        title: values.title,
        customer: values.customer,
        issue_date: values.issue_date,
      });
      await api.delete(`/api/documents/${id}/lines`);
      await api.post(`/api/documents/${id}/lines`, { lines: values.lines });
      const { data } = await api.get<Document>(`/api/documents/${id}`);
      return data;
    },
    onSuccess: (saved) => {
      form.setFieldsValue(docToForm(saved));
      setIsDirty(false);
      setErrorLineIndex(null);
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["document", saved.id] });
      message.success("Saved");
      if (isNew) navigate(`/documents/${saved.id}`, { replace: true });
    },
    onError: (err) => handleApiError(err, "save"),
  });

  const finalize = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<Document>(
        `/api/documents/${id}/finalize`,
      );
      return data;
    },
    onSuccess: (saved) => {
      form.setFieldsValue(docToForm(saved));
      setIsDirty(false);
      setErrorLineIndex(null);
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["document", saved.id] });
      message.success("Finalized");
    },
    onError: (err) => handleApiError(err, "finalize"),
  });

  const onFinalizeClick = () => {
    modal.confirm({
      title: "Finalize this document?",
      content: "Once finalized, this document can't be edited. Continue?",
      okText: "Finalize",
      cancelText: "Cancel",
      onOk: () => finalize.mutateAsync(),
    });
  };

  const linesForTotals = useMemo(
    () =>
      lines.map((l) => ({
        qty: l?.qty ?? 0,
        unit: l?.unit ?? 0,
        discount_type: l?.discount_type ?? null,
        discount_value: l?.discount_value ?? null,
        tax_pct: l?.tax_pct ?? 0,
      })),
    [lines],
  );

  if (!isNew && isLoading) {
    return (
      <div
        style={{
          minHeight: 240,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/documents")}
        >
          Back to documents
        </Button>
      </div>

      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col flex="1 1 auto" style={{ minWidth: 0 }}>
          <Typography.Title
            level={3}
            style={{ margin: 0 }}
            editable={
              finalized
                ? false
                : {
                    tooltip: "Edit title",
                    onChange: (v: string) => {
                      form.setFieldValue("title", v);
                      setIsDirty(true);
                    },
                  }
            }
          >
            {title || "Untitled document"}
          </Typography.Title>
          <Space size="small" style={{ marginTop: 4 }}>
            <Typography.Text type="secondary">
              {customer || "No customer"}
            </Typography.Text>
            {issueDate ? <Tag>{formatDate(issueDate)}</Tag> : null}
          </Space>
        </Col>
        <Col>
          <Space>
            <StatusTag status={status} />
            {finalized ? (
              <Typography.Text type="secondary">
                Finalized on {formatDate(doc?.finalized_at)}
              </Typography.Text>
            ) : (
              <>
                <Button
                  onClick={() => saveDraft.mutate(form.getFieldsValue(true))}
                  loading={saveDraft.isPending}
                >
                  Save draft
                </Button>
                <Button
                  type="primary"
                  disabled={isDirty || saveDraft.isPending}
                  loading={finalize.isPending}
                  onClick={onFinalizeClick}
                  title={isDirty ? "Save your changes first" : undefined}
                >
                  Finalize
                </Button>
              </>
            )}
          </Space>
        </Col>
      </Row>

      <Card>
        <Form<EditorFormValues>
          form={form}
          layout="vertical"
          disabled={finalized}
          initialValues={isNew ? NEW_INITIAL : undefined}
          onValuesChange={() => {
            setIsDirty(true);
            if (errorLineIndex !== null) setErrorLineIndex(null);
          }}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="title"
                label="Title"
                rules={[{ required: true, message: "Title is required" }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="customer"
                label="Customer"
                rules={[{ required: true, message: "Customer is required" }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="issue_date"
                label="Issue date"
                rules={[{ required: true, message: "Issue date is required" }]}
                getValueProps={(v?: string) => ({
                  value: v ? dayjs(v) : null,
                })}
                normalize={(v: Dayjs | null) =>
                  v ? v.format("YYYY-MM-DD") : null
                }
              >
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Typography.Title level={5} style={{ marginTop: 8 }}>
            Line items
          </Typography.Title>

          <LineItemsEditor
            disabled={finalized}
            errorIndex={errorLineIndex}
          />

          <Row justify="end" style={{ marginTop: 24 }}>
            <Col>
              <TotalsPanel lines={linesForTotals} />
            </Col>
          </Row>
        </Form>
      </Card>
    </div>
  );
}
