"use client";

import { LockOutlined, LoginOutlined, UserOutlined } from "@ant-design/icons";
import { Button, Checkbox, Form, Input, Typography } from "antd";

type LoginFormValues = {
  account: string;
  password: string;
  remember: boolean;
};

export function LoginForm() {
  const [form] = Form.useForm<LoginFormValues>();

  const handleFinish = (values: LoginFormValues) => {
    console.log("login-submit", values);
  };

  return (
    <Form<LoginFormValues>
      form={form}
      layout="vertical"
      size="large"
      initialValues={{ remember: true }}
      onFinish={handleFinish}
    >
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
        <Button type="primary" htmlType="submit" block icon={<LoginOutlined />}>
          登录
        </Button>
      </Form.Item>

      <Typography.Paragraph className="!mb-0 !mt-4 !text-sm !text-ink-soft">
        当前为前端表单骨架，后续将接入真实登录 API。
      </Typography.Paragraph>
    </Form>
  );
}
