import { useState } from "react";
import {
  Alert,
  Card,
  Col,
  DatePicker,
  Row,
  Skeleton,
  Statistic,
  Table,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useQuery } from "@tanstack/react-query";
import dayjs, { type Dayjs } from "dayjs";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { formatDate, formatMoney } from "../lib/format";
import StatusTag from "../components/StatusTag";
import type { Document, DocumentStatus, MoneyString } from "../types/api";

interface ReportSummary {
  document_count: number;
  total_grand_total: MoneyString | number;
  total_tax: MoneyString | number;
  total_discount: MoneyString | number;
  documents?: Document[];
}

const numericStyle: React.CSSProperties = {
  fontVariantNumeric: "tabular-nums",
};

export default function Reports() {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, "day"),
    dayjs(),
  ]);
  const from = range[0].format("YYYY-MM-DD");
  const to = range[1].format("YYYY-MM-DD");

  const { data, isLoading, isError, error } = useQuery<ReportSummary>({
    queryKey: ["report", from, to],
    queryFn: async () => {
      const { data } = await api.get<ReportSummary>("/api/reports/summary", {
        params: { from, to },
      });
      return data;
    },
  });

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
      render: (v: string | number | undefined) => (
        <span style={numericStyle}>{formatMoney(v ?? 0)}</span>
      ),
    },
  ];

  return (
    <div>
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        Summary report
      </Typography.Title>

      <div style={{ marginBottom: 16 }}>
        <DatePicker.RangePicker
          value={range}
          onChange={(v) => {
            if (v?.[0] && v?.[1]) setRange([v[0], v[1]]);
          }}
          format="YYYY-MM-DD"
          allowClear={false}
        />
      </div>

      {isError ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={
            error instanceof Error ? error.message : "Failed to load report"
          }
        />
      ) : null}

      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Skeleton
              loading={isLoading}
              active
              paragraph={{ rows: 1 }}
              title={{ width: 100 }}
            >
              <Statistic
                title="Documents"
                value={data?.document_count ?? 0}
                valueStyle={numericStyle}
              />
            </Skeleton>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Skeleton
              loading={isLoading}
              active
              paragraph={{ rows: 1 }}
              title={{ width: 100 }}
            >
              <Statistic
                title="Grand total"
                value={formatMoney(data?.total_grand_total ?? 0)}
                suffix="USD"
                valueStyle={numericStyle}
              />
            </Skeleton>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Skeleton
              loading={isLoading}
              active
              paragraph={{ rows: 1 }}
              title={{ width: 100 }}
            >
              <Statistic
                title="Total tax"
                value={formatMoney(data?.total_tax ?? 0)}
                valueStyle={numericStyle}
              />
            </Skeleton>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Skeleton
              loading={isLoading}
              active
              paragraph={{ rows: 1 }}
              title={{ width: 100 }}
            >
              <Statistic
                title="Total discount"
                value={formatMoney(data?.total_discount ?? 0)}
                valueStyle={numericStyle}
              />
            </Skeleton>
          </Card>
        </Col>
      </Row>

      {!isLoading && !isError && data?.document_count === 0 ? (
        <div style={{ marginTop: 16 }}>
          <Typography.Text type="secondary">
            No documents in this range
          </Typography.Text>
        </div>
      ) : null}

      {data?.documents && data.documents.length > 0 ? (
        <Card
          title="Documents in range"
          size="small"
          style={{ marginTop: 24 }}
          styles={{ body: { padding: 0 } }}
        >
          <Table<Document>
            rowKey="id"
            dataSource={data.documents}
            columns={columns}
            pagination={{ defaultPageSize: 20, showSizeChanger: true }}
            size="middle"
          />
        </Card>
      ) : null}
    </div>
  );
}
