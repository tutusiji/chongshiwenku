"use client";

import {
  InboxOutlined,
  LockOutlined,
  SaveOutlined,
  TagsOutlined,
  UserSwitchOutlined,
} from "@ant-design/icons";
import { Alert, Button, Checkbox, Form, Input, Select, Typography, Upload, message } from "antd";
import type { UploadFile } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getStoredAccessToken, requestFormDataJson, requestJson } from "@/lib/api";
import { DocumentDetail } from "@/lib/documents";
import { GroupListResponse, VisibilityMode, groupRoleLabelMap, normalizeUsernameTags } from "@/lib/groups";
import { documentVisibilityOptions } from "@/lib/documents";

type DocumentUploadFormValues = {
  title: string;
  summary?: string;
  category?: string;
  groupId?: string;
  visibilityMode: VisibilityMode;
  allowDownload: boolean;
  password?: string;
  passwordHint?: string;
  specificUsernames?: string[];
  fileList?: UploadFile[];
};

export function DocumentUploadForm() {
  const [form] = Form.useForm<DocumentUploadFormValues>();
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupOptions, setGroupOptions] = useState<Array<{ label: string; value: string }>>([]);
  const visibilityMode = Form.useWatch("visibilityMode", form) ?? "public";

  useEffect(() => {
    const loadGroups = async () => {
      const token = getStoredAccessToken();
      if (!token) {
        setGroupOptions([]);
        return;
      }

      setGroupsLoading(true);
      try {
        const response = await requestJson<GroupListResponse>("/groups?scope=my", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setGroupOptions(
          response.items.map((item) => ({
            label: `${item.name} · ${item.my_role ? groupRoleLabelMap[item.my_role] : "成员"}`,
            value: item.id,
          })),
        );
      } catch {
        setGroupOptions([]);
      } finally {
        setGroupsLoading(false);
      }
    };

    void loadGroups();
  }, []);

  const handleFinish = async (values: DocumentUploadFormValues) => {
    const token = getStoredAccessToken();
    if (!token) {
      setSubmitError("请先登录后再上传文档。");
      return;
    }

    const uploadFile = values.fileList?.[0]?.originFileObj;
    if (!uploadFile) {
      setSubmitError("请先选择要上传的文档文件。");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const formData = new FormData();
      formData.append("title", values.title.trim());
      if (values.summary?.trim()) {
        formData.append("summary", values.summary.trim());
      }
      if (values.category?.trim()) {
        formData.append("category", values.category.trim());
      }
      if (values.groupId) {
        formData.append("group_id", values.groupId);
      }
      formData.append("visibility_mode", values.visibilityMode);
      formData.append("allow_download", String(values.allowDownload));
      if (values.visibilityMode === "password" && values.password?.trim()) {
        formData.append("password", values.password.trim());
      }
      if (values.visibilityMode === "password" && values.passwordHint?.trim()) {
        formData.append("password_hint", values.passwordHint.trim());
      }
      if (values.visibilityMode === "specific_users") {
        formData.append("specific_usernames", JSON.stringify(normalizeUsernameTags(values.specificUsernames)));
      }
      formData.append("upload_file", uploadFile);

      const response = await requestFormDataJson<DocumentDetail>("/documents", formData, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      messageApi.success("文档上传成功，已获得 10 币奖励");
      router.push(`/documents/${response.id}`);
      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "上传文档失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {contextHolder}
      <Form<DocumentUploadFormValues>
        form={form}
        layout="vertical"
        size="large"
        initialValues={{ visibilityMode: "public", allowDownload: true, fileList: [] }}
        onFinish={handleFinish}
      >
        {submitError ? <Alert className="!mb-4" type="error" showIcon message={submitError} /> : null}

        <div className="sticky top-4 z-20 mb-5 rounded-[24px] border border-[#132238]/10 bg-[#132238] px-5 py-4 text-white shadow-[0_18px_48px_rgba(19,34,56,0.22)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <Typography.Title level={4} className="!mb-1 !text-white">
                上传操作区
              </Typography.Title>
              <Typography.Paragraph className="!mb-0 !text-white/72">
                选完文件后，直接点击右侧按钮即可提交上传，不需要滚到页面最底部。
              </Typography.Paragraph>
            </div>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={submitting} size="large">
              立即上传文档
            </Button>
          </div>
        </div>

        <Form.Item
          label="文档标题"
          name="title"
          rules={[
            { required: true, message: "请输入文档标题" },
            { min: 2, message: "文档标题至少 2 个字符" },
          ]}
        >
          <Input placeholder="例如：高等数学笔记、线性代数课件" prefix={<TagsOutlined />} />
        </Form.Item>

        <Form.Item label="摘要" name="summary">
          <Input.TextArea placeholder="简单描述文档内容与用途" autoSize={{ minRows: 3, maxRows: 5 }} />
        </Form.Item>

        <Form.Item label="分类" name="category">
          <Input placeholder="例如：课件、考研、实验报告" prefix={<TagsOutlined />} />
        </Form.Item>

        <Form.Item
          label="所属资料组"
          name="groupId"
          rules={[
            {
              validator(_, value: string | undefined) {
                if (visibilityMode !== "group_members" || value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error("组内可见的文档必须选择所属资料组"));
              },
            },
          ]}
        >
          <Select
            allowClear
            loading={groupsLoading}
            options={groupOptions}
            placeholder="可选，选择后文档会归档到某个资料组"
          />
        </Form.Item>

        <Form.Item
          label="可见性"
          name="visibilityMode"
          rules={[{ required: true, message: "请选择文档可见性" }]}
        >
          <Select options={documentVisibilityOptions} />
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
              <Input placeholder="可选，帮助被授权用户回忆密码" prefix={<UserSwitchOutlined />} />
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

        <Form.Item label="允许下载" name="allowDownload" valuePropName="checked">
          <Checkbox>允许其他有权限的用户下载原文件</Checkbox>
        </Form.Item>

        <Form.Item
          label="上传文件"
          name="fileList"
          valuePropName="fileList"
          getValueFromEvent={(event) => event?.fileList}
          rules={[
            {
              validator(_, value: UploadFile[] | undefined) {
                if (value?.[0]?.originFileObj) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error("请选择一个文档文件"));
              },
            },
          ]}
        >
          <Upload.Dragger beforeUpload={() => false} maxCount={1} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv">
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽上传 Word、PDF、Excel、PPT、TXT 等文件</p>
            <p className="ant-upload-hint">当前为首版直传本地开发存储，上传成功后会记录文档信息并奖励 10 币。</p>
          </Upload.Dragger>
        </Form.Item>

        <Form.Item className="!mb-0">
          <Button type="primary" htmlType="submit" block icon={<SaveOutlined />} loading={submitting}>
            上传文档
          </Button>
        </Form.Item>

        <Typography.Paragraph className="!mb-0 !mt-4 !text-sm !text-ink-soft">
          上传成功后，文档会出现在“我的文档”列表里，并自动获得 10 个上传奖励币。
        </Typography.Paragraph>
      </Form>
    </>
  );
}
