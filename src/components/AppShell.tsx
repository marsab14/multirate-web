import { useMemo } from "react";
import { Layout, Menu, Typography, Button, Space } from "antd";
import {
  FileTextOutlined,
  BarChartOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const { Header, Sider, Content } = Layout;

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();

  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith("/reports")) return "reports";
    return "documents";
  }, [location.pathname]);

  const onSignOut = () => {
    signOut();
    navigate("/login", { replace: true });
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider breakpoint="lg" collapsedWidth={0}>
        <div
          style={{
            color: "#fff",
            padding: 16,
            fontWeight: 600,
            fontSize: 16,
          }}
        >
          Multirate
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={[
            {
              key: "documents",
              icon: <FileTextOutlined />,
              label: "Documents",
              onClick: () => navigate("/documents"),
            },
            {
              key: "reports",
              icon: <BarChartOutlined />,
              label: "Reports",
              onClick: () => navigate("/reports"),
            },
          ]}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: "#fff",
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography.Title level={4} style={{ margin: 0 }}>
            Multi-rate Pricing
          </Typography.Title>
          <Space>
            {user?.email ? (
              <Typography.Text type="secondary">{user.email}</Typography.Text>
            ) : null}
            <Button icon={<LogoutOutlined />} onClick={onSignOut}>
              Sign out
            </Button>
          </Space>
        </Header>
        <Content style={{ padding: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
