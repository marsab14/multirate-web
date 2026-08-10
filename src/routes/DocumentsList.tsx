import { useMemo } from "react";
import {
  Alert,
  Button,
  Col,
  DatePicker,
  Empty,
  Row,
  Select,
  Table,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { PlusOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import dayjs, { type Dayjs } from "dayjs";
import { api } from "../lib/api";
import { formatDate, formatMoney } from "../lib/format";
import StatusTag from "../components/StatusTag";
import type {
  Document,
  DocumentListResponse,
  DocumentStatus,
} from "../types/api";

type StatusFilter = "all" | DocumentStatus;

const isStatusFilter = (v: string | null): v is StatusFilter =>
  v === "all" || v === "draft" || v === "finalized";

const fetchDocuments = async (
  from?: string,
  to?: string,
): Promise<Document[]> => {
  const { data } = await api.get<DocumentListResponse>("/api/documents", {
    params: { from, to },
  });
  return data.documents;
};

export default function DocumentsList() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const from = params.get("from") ?? undefined;
  const to = params.get("to") ?? undefined;
  const statusParam = params.get("status");
  const status: StatusFilter = isStatusFilter(statusParam) ? statusParam : "all";

  const updateParams = (next: {
    from?: string | null;
    to?: string | null;
    status?: StatusFilter | null;
  }) => {
    const merged = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === undefined || v === "" || v === "all") {
        merged.delete(k);
      } else {
        merged.set(k, v);
      }
    }
    setParams(merged, { replace: true });
  };

  const {
    data = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["documents", from, to],
    queryFn: () => fetchDocuments(from, to),
  });

  const filtered = useMemo(
    () => (status === "all" ? data : data.filter((d) => d.status === status)),
    [data, status],
  );

  const rangeValue: [Dayjs | null, Dayjs | null] | null =
    from || to ? [from ? dayjs(from) : null, to ? dayjs(to) : null] : null;

  const onRangeChange = (
    values: [Dayjs | null, Dayjs | null] | null,
  ) => {
    if (!values || (!values[0] && !values[1])) {
      updateParams({ from: null, to: null });
      return;
    }
    updateParams({
      from: values[0]?.format("YYYY-MM-DD") ?? null,
      to: values[1]?.format("YYYY-MM-DD") ?? null,
    });
  };

  const numericCell: React.CSSProperties = {
    fontVariantNumeric: "tabular-nums",
  };

  const columns: ColumnsType<Document> = [
    {
      title: "Title",
      dataIndex: "title",
      key: "title",
      render: (v: string, row) => <Link to={`/documents/${row.id}`}>{v}</Link>,
    },
    { title: "Customer", dataIndex: "customer", key: "customer" },
    {
      title: "Issue date",
      dataIndex: "issue_date",
      key: "issue_date",
      render: (v: string) => formatDate(v, "DD MMM YYYY"),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (v: DocumentStatus) => <StatusTag status={v} />,
    },
    {
      title: "Grand total",
      dataIndex: "grand_total",
      key: "grand_total",
      align: "right",
      render: (v: string | undefined) => (
        <span style={numericCell}>{formatMoney(v ?? "0")}</span>
      ),
    },
  ];

  return (
    <div>
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        Documents
      </Typography.Title>

      <Row
        gutter={[12, 12]}
        align="middle"
        style={{ marginBottom: 16 }}
        wrap
      >
        <Col>
          <DatePicker.RangePicker
            value={rangeValue}
            onChange={onRangeChange}
            allowEmpty={[true, true]}
            format="YYYY-MM-DD"
          />
        </Col>
        <Col>
          <Select<StatusFilter>
            value={status}
            style={{ width: 160 }}
            onChange={(v) => updateParams({ status: v })}
            options={[
              { value: "all", label: "All" },
              { value: "draft", label: "Draft" },
              { value: "finalized", label: "Finalized" },
            ]}
          />
        </Col>
        <Col flex="auto" style={{ textAlign: "right" }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate("/documents/new")}
          >
            New document
          </Button>
        </Col>
      </Row>

      {isError ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={
            error instanceof Error ? error.message : "Failed to load documents"
          }
        />
      ) : null}

      {!isError && !isLoading && filtered.length === 0 ? (
        <Empty
          description="No documents yet"
          style={{ padding: "48px 0" }}
        >
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate("/documents/new")}
          >
            Create your first document
          </Button>
        </Empty>
      ) : (
        <Table<Document>
          rowKey="id"
          loading={isLoading}
          dataSource={filtered}
          columns={columns}
          pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        />
      )}
    </div>
  );
}
