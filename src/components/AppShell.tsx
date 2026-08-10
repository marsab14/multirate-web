import { useMemo } from "react";
import { Avatar, Button, Dropdown, Layout, Menu, Space, Typography } from "antd";
import type { MenuProps } from "antd";
import {
  BarChartOutlined,
  DownOutlined,
  FileTextOutlined,
  LogoutOutlined,
  UserOutlined,
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

  const onSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const menu: MenuProps = {
    items: [
      {
        key: "email",
        label: user?.email ?? "Signed in",
        disabled: true,
      },
      { type: "divider" },
      {
        key: "signout",
        icon: <LogoutOutlined />,
        label: "Sign out",
        onClick: onSignOut,
      },
    ],
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
          <Dropdown menu={menu} trigger={["click"]} placement="bottomRight">
            <Button type="text" style={{ height: 40 }}>
              <Space>
                <Avatar size="small" icon={<UserOutlined />} />
                <Typography.Text>{user?.email ?? "Account"}</Typography.Text>
                <DownOutlined style={{ fontSize: 10 }} />
              </Space>
            </Button>
          </Dropdown>
        </Header>
        <Content style={{ padding: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
