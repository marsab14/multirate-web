import { Button, Card, Form, Input, Typography, message } from "antd";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { api } from "../lib/api";
import { setSession } from "../lib/session";
import type { AuthResponse } from "../types/api";

interface FormValues {
  email: string;
  password: string;
}

export default function Login() {
  const navigate = useNavigate();
  const [form] = Form.useForm<FormValues>();

  const onSubmit = async (values: FormValues) => {
    try {
      const { data } = await api.post<AuthResponse>("/api/auth/login", values);
      if (!data.session) {
        message.error("Login failed. Please try again.");
        return;
      }
      setSession(data.session);
      navigate("/documents");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const code = err.response?.data?.error?.code;
        if (code === "INVALID_CREDENTIALS") {
          message.error("Invalid email or password");
        } else {
          message.error(err.response?.data?.error?.message ?? "Login failed");
        }
      } else {
        message.error("Login failed");
      }
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
        padding: 16,
      }}
    >
      <Card style={{ width: 380 }}>
        <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 24 }}>
          Sign in
        </Typography.Title>
        <Form<FormValues>
          form={form}
          layout="vertical"
          onFinish={onSubmit}
          requiredMark={false}
        >
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: "Please enter your email" },
              { type: "email", message: "Enter a valid email address" },
            ]}
          >
            <Input autoComplete="email" placeholder="you@example.com" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: "Please enter your password" }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block>
              Sign in
            </Button>
          </Form.Item>
        </Form>
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <Typography.Text type="secondary">
            Don&apos;t have an account? <Link to="/signup">Sign up</Link>
          </Typography.Text>
        </div>
      </Card>
    </div>
  );
}
