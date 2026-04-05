"use client";

import { Button, Checkbox, Form, Input, Select, Typography } from "antd";

type VisibilityMode = "public" | "password" | "owner_only" | "group_members" | "specific_users";

type GroupCreateFormValues = {
  name: string;
  description?: string;
  visibilityMode: VisibilityMode;
  password?: string;
  allowMemberInvite: boolean;
};

export function GroupCreateForm() {
  const [form] = Form.useForm<GroupCreateFormValues>();

  const handleFinish = (values: GroupCreateFormValues) => {
    console.log("group-create-submit", values);
  };

  return (
    <Form<GroupCreateFormValues>
      form={form}
      layout="vertical"
      size="large"
      initialValues={{ visibilityMode: "public", allowMemberInvite: true }}
      onFinish={handleFinish}
    >
      <Form.Item
        label="资料组名称"
        name="name"
        rules={[{ required: true, message: "请输入资料组名称" }]}
      >
        <Input placeholder="例如：考研组、课件组、文档组" />
      </Form.Item>

      <Form.Item label="简介" name="description">
        <Input.TextArea placeholder="简单介绍这个资料组的用途" autoSize={{ minRows: 3, maxRows: 5 }} />
      </Form.Item>

      <Form.Item
        label="可见性"
        name="visibilityMode"
        rules={[{ required: true, message: "请选择组可见性" }]}
      >
        <Select
          options={[
            { label: "公开", value: "public" },
            { label: "密码访问", value: "password" },
            { label: "仅自己可见", value: "owner_only" },
            { label: "组内可见", value: "group_members" },
            { label: "指定用户可见", value: "specific_users" },
          ]}
        />
      </Form.Item>

      <Form.Item label="访问密码" name="password">
        <Input.Password placeholder="如果选择密码访问，可填写访问密码" />
      </Form.Item>

      <Form.Item label="允许成员邀请" name="allowMemberInvite" valuePropName="checked">
        <Checkbox>允许成员邀请</Checkbox>
      </Form.Item>

      <Form.Item className="!mb-0">
        <Button type="primary" htmlType="submit" block>
          创建资料组
        </Button>
      </Form.Item>

      <Typography.Paragraph className="!mb-0 !mt-4 !text-sm !text-ink-soft">
        当前表单用于统一业务表单规范，后续将接入组创建接口与权限策略。
      </Typography.Paragraph>
    </Form>
  );
}
