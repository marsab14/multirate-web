import { Button, Card, Form, Input, Typography, message } from "antd";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { api } from "../lib/api";
import { setSession } from "../lib/session";
import type { Session } from "../types/api";

interface FormValues {
  email: string;
  password: string;
  confirm: string;
}

interface SignupResponse {
  session?: Session;
  requires_confirmation?: boolean;
}

export default function Signup() {
  const navigate = useNavigate();
  const [form] = Form.useForm<FormValues>();

  const onSubmit = async (values: FormValues) => {
    try {
      const { data } = await api.post<SignupResponse>("/api/auth/signup", {
        email: values.email,
        password: values.password,
      });
      if (data.requires_confirmation) {
        // Rare — README says to disable email confirmation in Supabase.
        message.info("Check your email to confirm your account.");
        return;
      }
      if (!data.session) {
        message.error("Signup failed. Please try again.");
        return;
      }
      setSession(data.session);
      navigate("/documents");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const code = err.response?.data?.error?.code;
        if (code === "EMAIL_TAKEN") {
          message.error("An account with this email already exists.");
        } else {
          message.error(err.response?.data?.error?.message ?? "Signup failed");
        }
      } else {
        message.error("Signup failed");
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
          Create account
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
            rules={[
              { required: true, message: "Please enter a password" },
              { min: 8, message: "Password must be at least 8 characters" },
            ]}
            hasFeedback
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirm"
            label="Confirm password"
            dependencies={["password"]}
            hasFeedback
            rules={[
              { required: true, message: "Please confirm your password" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("Passwords do not match"));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block>
              Sign up
            </Button>
          </Form.Item>
        </Form>
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <Typography.Text type="secondary">
            Already have an account? <Link to="/login">Sign in</Link>
          </Typography.Text>
        </div>
      </Card>
    </div>
  );
}
