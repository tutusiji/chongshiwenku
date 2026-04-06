"use client";

import { LockOutlined, LoginOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, Button, Checkbox, Form, Input, Space, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestJson, setStoredAccessToken } from "@/lib/api";

type LoginFormValues = {
  account: string;
  password: string;
  remember: boolean;
};

type LoginResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: {
    username: string;
    nickname: string;
  };
  coin_account: {
    balance: number;
  };
};

export function LoginForm() {
  const [form] = Form.useForm<LoginFormValues>();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleFinish = async (values: LoginFormValues) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await requestJson<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          account: values.account,
          password: values.password,
        }),
      });
      setStoredAccessToken(response.access_token);
      router.push("/me/coins");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form<LoginFormValues>
      form={form}
      layout="vertical"
      size="large"
      initialValues={{ remember: true }}
      onFinish={handleFinish}
    >
      {submitError ? <Alert className="!mb-4" type="error" showIcon message={submitError} /> : null}

      <Form.Item
        label="账号"
        name="account"
        rules={[{ required: true, message: "请输入用户名、邮箱或手机号" }]}
      >
        <Input placeholder="请输入用户名、邮箱或手机号" prefix={<UserOutlined />} />
      </Form.Item>

      <Form.Item
        label="密码"
        name="password"
        rules={[{ required: true, message: "请输入登录密码" }]}
      >
        <Input.Password placeholder="请输入密码" prefix={<LockOutlined />} />
      </Form.Item>

      <Form.Item name="remember" valuePropName="checked">
        <Checkbox>记住登录状态</Checkbox>
      </Form.Item>

      <Form.Item className="!mb-0">
        <Button type="primary" htmlType="submit" block icon={<LoginOutlined />} loading={submitting}>
          登录
        </Button>
      </Form.Item>

      <Form.Item className="!mb-0 !mt-3">
        <Button block href="/auth/register">
          还没有账号，去注册
        </Button>
      </Form.Item>

      <Space direction="vertical" size={6} className="!mt-4">
        <Typography.Paragraph className="!mb-0 !text-sm !text-ink-soft">
          登录成功后会把访问令牌暂存在浏览器本地，并跳转到积分中心。
        </Typography.Paragraph>
        <Typography.Paragraph className="!mb-0 !text-sm !text-ink-soft">
          如果还没有账号，可以直接点击上面的“去注册”完成新用户注册。
        </Typography.Paragraph>
      </Space>
    </Form>
  );
}
