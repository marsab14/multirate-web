import { useState } from "react";
import { Button, Card, Form, Input, Typography, message } from "antd";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { api } from "../lib/api";
import { setSession } from "../lib/session";
import type { AuthResponse } from "../types/api";

interface FormValues {
  email: string;
  password: string;
}

export default function Login() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: string } | null)?.from ?? "/documents";

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      const { data } = await api.post<AuthResponse>("/api/auth/login", values);
      setSession(data.session);
      navigate(from, { replace: true });
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.error?.message
          ? err.response.data.error.message
          : "Sign in failed";
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f5f5",
      }}
    >
      <Card style={{ width: 360 }}>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          Sign in
        </Typography.Title>
        <Form<FormValues> layout="vertical" onFinish={onSubmit}>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, type: "email" }]}
          >
            <Input autoComplete="email" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, min: 6 }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            Sign in
          </Button>
        </Form>
        <div style={{ marginTop: 12, textAlign: "center" }}>
          <Typography.Text type="secondary">
            No account? <Link to="/signup">Create one</Link>
          </Typography.Text>
        </div>
      </Card>
    </div>
  );
}
