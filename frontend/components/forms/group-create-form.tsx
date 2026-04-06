"use client";

import {
  LockOutlined,
  PlusCircleOutlined,
  TeamOutlined,
  UserSwitchOutlined,
} from "@ant-design/icons";
import { Alert, Button, Checkbox, Form, Input, Select, Typography, message } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getStoredAccessToken, requestJson } from "@/lib/api";
import { GroupDetail, VisibilityMode, normalizeUsernameTags, visibilityOptions } from "@/lib/groups";

type GroupCreateFormValues = {
  name: string;
  description?: string;
  visibilityMode: VisibilityMode;
  password?: string;
  passwordHint?: string;
  allowMemberInvite: boolean;
  specificUsernames?: string[];
};

export function GroupCreateForm() {
  const [form] = Form.useForm<GroupCreateFormValues>();
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const visibilityMode = Form.useWatch("visibilityMode", form) ?? "public";

  const handleFinish = async (values: GroupCreateFormValues) => {
    const token = getStoredAccessToken();
    if (!token) {
      setSubmitError("请先登录后再创建资料组。");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await requestJson<GroupDetail>("/groups", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: values.name.trim(),
          description: values.description?.trim() || undefined,
          visibility_mode: values.visibilityMode,
          allow_member_invite: values.allowMemberInvite,
          password: values.visibilityMode === "password" ? values.password?.trim() || undefined : undefined,
          password_hint:
            values.visibilityMode === "password" ? values.passwordHint?.trim() || undefined : undefined,
          specific_usernames:
            values.visibilityMode === "specific_users"
              ? normalizeUsernameTags(values.specificUsernames)
              : undefined,
        }),
      });

      messageApi.success("资料组创建成功");
      router.push(`/me/groups/${response.id}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "创建资料组失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {contextHolder}
      <Form<GroupCreateFormValues>
        form={form}
        layout="vertical"
        size="large"
        initialValues={{ visibilityMode: "public", allowMemberInvite: true, specificUsernames: [] }}
        onFinish={handleFinish}
      >
        {submitError ? <Alert className="!mb-4" type="error" showIcon message={submitError} /> : null}

        <Form.Item
          label="资料组名称"
          name="name"
          rules={[
            { required: true, message: "请输入资料组名称" },
            { min: 2, message: "资料组名称至少 2 个字符" },
          ]}
        >
          <Input placeholder="例如：考研组、课件组、文档组" prefix={<TeamOutlined />} />
        </Form.Item>

        <Form.Item label="简介" name="description">
          <Input.TextArea placeholder="简单介绍这个资料组的用途" autoSize={{ minRows: 3, maxRows: 5 }} />
        </Form.Item>

        <Form.Item
          label="可见性"
          name="visibilityMode"
          rules={[{ required: true, message: "请选择组可见性" }]}
        >
          <Select options={visibilityOptions} />
        </Form.Item>

        {visibilityMode === "password" ? (
          <>
            <Form.Item
              label="访问密码"
              name="password"
              rules={[
                { required: true, message: "密码访问模式下必须填写访问密码" },
                { min: 4, message: "访问密码至少 4 位" },
              ]}
            >
              <Input.Password placeholder="请输入访问密码" prefix={<LockOutlined />} />
            </Form.Item>

            <Form.Item label="密码提示" name="passwordHint">
              <Input placeholder="可选，例如：四位数字" prefix={<UserSwitchOutlined />} />
            </Form.Item>
          </>
        ) : null}

        {visibilityMode === "specific_users" ? (
          <Form.Item
            label="指定可见用户"
            name="specificUsernames"
            rules={[
              {
                validator(_, value: string[] | undefined) {
                  if (normalizeUsernameTags(value).length > 0) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("请至少填写一个可访问用户名"));
                },
              },
            ]}
          >
            <Select
              mode="tags"
              tokenSeparators={[",", " "]}
              placeholder="输入用户名后按回车，可连续添加多个用户"
              suffixIcon={<UserSwitchOutlined />}
            />
          </Form.Item>
        ) : null}

        <Form.Item label="允许成员邀请" name="allowMemberInvite" valuePropName="checked">
          <Checkbox>允许成员邀请</Checkbox>
        </Form.Item>

        <Form.Item className="!mb-0">
          <Button
            type="primary"
            htmlType="submit"
            block
            icon={<PlusCircleOutlined />}
            loading={submitting}
          >
            创建资料组
          </Button>
        </Form.Item>

        <Typography.Paragraph className="!mb-0 !mt-4 !text-sm !text-ink-soft">
          当前表单已经接入真实创建接口，成功后会跳转到资料组详情页继续管理成员与权限。
        </Typography.Paragraph>
      </Form>
    </>
  );
}
