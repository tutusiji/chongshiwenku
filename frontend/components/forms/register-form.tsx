"use client";

import { LockOutlined, MailOutlined, SafetyCertificateOutlined, UserAddOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, Button, Form, Input, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestJson } from "@/lib/api";

type RegisterFormValues = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type RegisterResponse = {
  message: string;
};

export function RegisterForm() {
  const [form] = Form.useForm<RegisterFormValues>();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleFinish = async (values: RegisterFormValues) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await requestJson<RegisterResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: values.username,
          email: values.email,
          password: values.password,
          nickname: values.username,
        }),
      });
      router.push("/auth/login");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "注册失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form<RegisterFormValues> form={form} layout="vertical" size="large" onFinish={handleFinish}>
      {submitError ? <Alert className="!mb-4" type="error" showIcon message={submitError} /> : null}

      <Form.Item
        label="用户名"
        name="username"
        rules={[
          { required: true, message: "请输入用户名" },
          { min: 3, message: "用户名至少 3 个字符" },
        ]}
      >
        <Input placeholder="请输入用户名" prefix={<UserOutlined />} />
      </Form.Item>

      <Form.Item
        label="邮箱"
        name="email"
        rules={[
          { required: true, message: "请输入邮箱" },
          { type: "email", message: "邮箱格式不正确" },
        ]}
      >
        <Input placeholder="请输入邮箱" prefix={<MailOutlined />} />
      </Form.Item>

      <Form.Item
        label="密码"
        name="password"
        rules={[
          { required: true, message: "请输入密码" },
          { min: 6, message: "密码至少 6 位" },
        ]}
      >
        <Input.Password placeholder="请输入密码" prefix={<LockOutlined />} />
      </Form.Item>

      <Form.Item
        label="确认密码"
        name="confirmPassword"
        dependencies={["password"]}
        rules={[
          { required: true, message: "请再次输入密码" },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue("password") === value) {
                return Promise.resolve();
              }
              return Promise.reject(new Error("两次输入的密码不一致"));
            },
          }),
        ]}
      >
        <Input.Password placeholder="请再次输入密码" prefix={<SafetyCertificateOutlined />} />
      </Form.Item>

      <Form.Item className="!mb-0">
        <Button type="primary" htmlType="submit" block icon={<UserAddOutlined />} loading={submitting}>
          注册并领取 100 币
        </Button>
      </Form.Item>

      <Typography.Paragraph className="!mb-0 !mt-4 !text-sm !text-ink-soft">
        注册成功后会自动创建积分账户，并发放 100 个初始币。
      </Typography.Paragraph>
    </Form>
  );
}
