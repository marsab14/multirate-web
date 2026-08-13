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
  | "quantity"
  | "unit_price"
  | "discount_type"
  | "discount_value"
  | "tax_percent"
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
  // Defensive: server may omit `lines` when the document has none.
  lines: (doc.lines ?? []).map((li) => ({
    id: li.id,
    description: li.description,
    quantity: li.quantity,
    unit_price: li.unit_price,
    discount_type: li.discount_type,
    discount_value: li.discount_value,
    tax_percent: li.tax_percent,
  })),
});

// The backend wraps single-document responses in `{ document }` (mirroring the
// list envelope) and returns some numeric fields as strings (e.g.
// `"unit_price": "12"`). The mock, in contrast, returns the raw Document with
// numbers. Normalize both at the API boundary so the rest of the app can trust
// the declared types.
const toN = (v: unknown): number => {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const normalizeDocument = (raw: unknown): Document => {
  const r = raw as { document?: Document } & Document;
  const d = (r?.document ?? r) as Document;
  return {
    ...d,
    issue_date: d.issue_date
      ? dayjs(d.issue_date).format("YYYY-MM-DD")
      : d.issue_date,
    lines: (d.lines ?? []).map((li) => ({
      ...li,
      quantity: toN(li.quantity),
      unit_price: toN(li.unit_price),
      discount_value:
        li.discount_value === null || li.discount_value === undefined
          ? null
          : toN(li.discount_value),
      tax_percent: toN(li.tax_percent),
    })),
  };
};

// The body payload the backend expects for POST / PATCH on a single line.
// Kept in one place so create + update stay in sync.
const lineBody = (l: LineFormValues) => ({
  description: l.description,
  quantity: l.quantity,
  unit_price: l.unit_price,
  discount_type: l.discount_type,
  discount_value: l.discount_value,
  tax_percent: l.tax_percent,
});

// Returns true if any user-editable field on the line differs from the server
// copy. Numeric fields are compared as numbers so `"12"` (server string)
// matches `12` (form number) after normalization.
const nEq = (a: unknown, b: unknown): boolean => {
  const an = a == null || a === "" ? null : Number(a);
  const bn = b == null || b === "" ? null : Number(b);
  return an === bn;
};
const lineChanged = (orig: LineItem, curr: LineFormValues): boolean =>
  orig.description !== curr.description ||
  !nEq(orig.quantity, curr.quantity) ||
  !nEq(orig.unit_price, curr.unit_price) ||
  orig.discount_type !== curr.discount_type ||
  !nEq(orig.discount_value, curr.discount_value) ||
  !nEq(orig.tax_percent, curr.tax_percent);

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
      const { data } = await api.get(`/api/documents/${id}`);
      return normalizeDocument(data);
    },
    enabled: !isNew,
  });

  // For same-id refetches (e.g., after a 409 invalidation) the Form is already
  // mounted, so we need to sync new server data into the fields. Initial
  // hydration is handled via `initialValues` below — not this effect — so we
  // avoid the race where setFieldsValue on a freshly-mounted Form.List doesn't
  // reliably populate its rows.
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
        const { data } = await api.post("/api/documents", {
          title: values.title,
          customer: values.customer,
          issue_date: values.issue_date,
          lines: values.lines.map((l) => lineBody(l)),
        });
        return normalizeDocument(data);
      }

      // For existing docs: PATCH metadata (only if it changed), then diff the
      // lines against the last-known server state. Only the lines that were
      // added / removed / modified generate an API call — no wholesale replace,
      // and per-line ids are preserved on updates.
      const metaChanged =
        !doc ||
        doc.title !== values.title ||
        doc.customer !== values.customer ||
        doc.issue_date !== values.issue_date;
      if (metaChanged) {
        await api.patch(`/api/documents/${id}`, {
          title: values.title,
          customer: values.customer,
          issue_date: values.issue_date,
        });
      }

      const originalLines = (doc?.lines ?? []).filter(
        (l): l is LineItem & { id: string } => !!l.id,
      );
      const currentIds = new Set(
        values.lines.map((l) => l.id).filter((v): v is string => !!v),
      );
      const originalById = new Map(originalLines.map((l) => [l.id, l]));

      // Deletions first — they can't collide with each other, run in parallel.
      const toDelete = originalLines.filter((o) => !currentIds.has(o.id));
      await Promise.all(
        toDelete.map((l) =>
          api.delete(`/api/documents/${id}/lines/${l.id}`),
        ),
      );

      // Updates + creates run sequentially by array position. Sequential is a
      // little slower but avoids racing the backend's per-op doc recompute.
      for (let i = 0; i < values.lines.length; i++) {
        const line = values.lines[i];
        if (!line.id) {
          await api.post(`/api/documents/${id}/lines`, {
            ...lineBody(line),
            position: i,
          });
          continue;
        }
        const orig = originalById.get(line.id);
        if (orig && lineChanged(orig, line)) {
          await api.patch(
            `/api/documents/${id}/lines/${line.id}`,
            lineBody(line),
          );
        }
      }

      const { data } = await api.get(`/api/documents/${id}`);
      return normalizeDocument(data);
    },
    onSuccess: (saved) => {
      form.setFieldsValue(docToForm(saved));
      setIsDirty(false);
      setErrorLineIndex(null);
      // Seed the query cache so the target route mounts with data (no Spin
      // flash) when we redirect after creating a new doc.
      qc.setQueryData(["document", saved.id], saved);
      qc.invalidateQueries({ queryKey: ["documents"] });
      message.success("Saved");
      if (isNew) navigate(`/documents/${saved.id}`, { replace: true });
    },
    onError: (err) => handleApiError(err, "save"),
  });

  const finalize = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/api/documents/${id}/finalize`);
      return normalizeDocument(data);
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
        quantity: l?.quantity ?? 0,
        unit_price: l?.unit_price ?? 0,
        discount_type: l?.discount_type ?? null,
        discount_value: l?.discount_value ?? null,
        tax_percent: l?.tax_percent ?? 0,
      })),
    [lines],
  );

  // Wait until we have initial values before mounting the Form. AntD Form
  // reads initialValues on mount only — if we mount it with `undefined` and
  // try to setFieldsValue afterwards, Form.List's row bookkeeping can miss
  // the first hydration.
  if (!isNew && (isLoading || !doc)) {
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

  const initialValues: EditorFormValues = isNew
    ? NEW_INITIAL
    : docToForm(doc as Document);

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
          key={id ?? "new"}
          form={form}
          layout="vertical"
          disabled={finalized}
          initialValues={initialValues}
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
