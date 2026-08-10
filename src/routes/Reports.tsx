import { Card, Col, Row, Statistic, Typography } from "antd";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { formatMoney } from "../lib/format";

interface ReportsSummary {
  total_invoiced: string;
  total_paid: string;
  total_outstanding: string;
  currency: string;
}

async function fetchReports(): Promise<ReportsSummary> {
  const { data } = await api.get<ReportsSummary>("/api/reports/summary");
  return data;
}

export default function Reports() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["reports", "summary"],
    queryFn: fetchReports,
  });

  return (
    <div>
      <Typography.Title level={3}>Reports</Typography.Title>
      {isError ? (
        <Typography.Text type="danger">
          {error instanceof Error ? error.message : "Failed to load reports"}
        </Typography.Text>
      ) : null}
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Card loading={isLoading}>
            <Statistic
              title="Invoiced"
              value={data ? formatMoney(data.total_invoiced) : "—"}
              suffix={data?.currency}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card loading={isLoading}>
            <Statistic
              title="Paid"
              value={data ? formatMoney(data.total_paid) : "—"}
              suffix={data?.currency}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card loading={isLoading}>
            <Statistic
              title="Outstanding"
              value={data ? formatMoney(data.total_outstanding) : "—"}
              suffix={data?.currency}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
