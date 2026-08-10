import { Button, Table, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { formatDate, formatMoney } from "../lib/format";
import StatusTag from "../components/StatusTag";
import type { Document, Paginated } from "../types/api";

async function fetchDocuments(): Promise<Paginated<Document>> {
  const { data } = await api.get<Paginated<Document>>("/api/documents", {
    params: { page: 1, page_size: 50 },
  });
  return data;
}

export default function DocumentsList() {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["documents"],
    queryFn: fetchDocuments,
  });

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Typography.Title level={3} style={{ margin: 0 }}>
          Documents
        </Typography.Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate("/documents/new")}
        >
          New document
        </Button>
      </div>
      {isError ? (
        <Typography.Text type="danger">
          {error instanceof Error ? error.message : "Failed to load documents"}
        </Typography.Text>
      ) : null}
      <Table<Document>
        rowKey="id"
        loading={isLoading}
        dataSource={data?.items ?? []}
        pagination={{ pageSize: 20 }}
        columns={[
          {
            title: "Number",
            dataIndex: "number",
            render: (v, row) => <Link to={`/documents/${row.id}`}>{v}</Link>,
          },
          { title: "Customer", dataIndex: "customer_name" },
          {
            title: "Type",
            dataIndex: "type",
            render: (v: string) => v.charAt(0).toUpperCase() + v.slice(1),
          },
          {
            title: "Issue date",
            dataIndex: "issue_date",
            render: (v: string) => formatDate(v),
          },
          {
            title: "Total",
            key: "grand_total",
            render: (_, row) => {
              const grand =
                (row as unknown as { grand_total?: string }).grand_total ?? "0";
              return formatMoney(grand, row.currency);
            },
          },
          {
            title: "Status",
            dataIndex: "status",
            render: (v) => <StatusTag status={v} />,
          },
        ]}
      />
    </div>
  );
}
