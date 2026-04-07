"use client";

import {
  FileTextOutlined,
  FolderAddOutlined,
  InboxOutlined,
  LockOutlined,
  PlusOutlined,
  SaveOutlined,
  TagsOutlined,
  TeamOutlined,
  UserSwitchOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  TreeSelect,
  Typography,
  Upload,
  message,
} from "antd";
import type { UploadChangeParam, UploadFile } from "antd/es/upload";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { getStoredAccessToken, requestFormDataJson, requestJson } from "@/lib/api";
import { DocumentDetail, documentVisibilityOptions, formatFileSize } from "@/lib/documents";
import { buildGroupTree, GroupListResponse, GroupSummary, normalizeUsernameTags, VisibilityMode, visibilityOptions } from "@/lib/groups";

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

type DocumentAnalyzeResponse = {
  file_name: string;
  suggested_title: string;
  file_type: string;
  mime_type: string;
  file_extension: string;
  file_size: number;
  page_count: number | null;
  preview_text_available: boolean;
  preview_excerpt: string | null;
  ai_summary: string | null;
  ai_provider_name: string | null;
  inline_preview_supported: boolean;
  preview_strategy: string;
};

type GroupCreateModalValues = {
  name: string;
  description?: string;
  parentGroupId?: string;
  visibilityMode: VisibilityMode;
  allowMemberInvite: boolean;
  password?: string;
  passwordHint?: string;
  specificUsernames?: string[];
};

const previewStrategyLabelMap: Record<string, string> = {
  browser_inline: "页内原文件预览",
  text: "文本抽取预览",
  download_only: "仅支持下载",
};

function buildTokenHeaders(token: string | null): HeadersInit | undefined {
  if (!token) {
    return undefined;
  }
  return {
    Authorization: `Bearer ${token}`,
  };
}

export function DocumentUploadForm() {
  const [form] = Form.useForm<DocumentUploadFormValues>();
  const [groupForm] = Form.useForm<GroupCreateModalValues>();
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [fileAnalysis, setFileAnalysis] = useState<DocumentAnalyzeResponse | null>(null);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [selectedFileSignature, setSelectedFileSignature] = useState<string | null>(null);
  const autoFilledTitleRef = useRef<string | null>(null);
  const autoFilledSummaryRef = useRef<string | null>(null);

  const visibilityMode = Form.useWatch("visibilityMode", form) ?? "public";
  const groupVisibilityMode = Form.useWatch("visibilityMode", groupForm) ?? "public";
  const groupTreeData = useMemo(() => buildGroupTree(groups), [groups]);

  const loadGroups = async (preferredGroupId?: string) => {
    const token = getStoredAccessToken();
    if (!token) {
      setGroups([]);
      return;
    }

    setGroupsLoading(true);
    try {
      const response = await requestJson<GroupListResponse>("/groups?scope=my", {
        headers: buildTokenHeaders(token),
      });
      setGroups(response.items);
      if (preferredGroupId) {
        form.setFieldValue("groupId", preferredGroupId);
      }
    } catch {
      setGroups([]);
    } finally {
      setGroupsLoading(false);
    }
  };

  useEffect(() => {
    void loadGroups();
  }, []);

  const analyzeFile = async (uploadFile: File) => {
    const token = getStoredAccessToken();
    if (!token) {
      setAnalyzeError("请先登录后再上传文档。");
      return;
    }

    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const analyzeFormData = new FormData();
      analyzeFormData.append("upload_file", uploadFile);

      const response = await requestFormDataJson<DocumentAnalyzeResponse>("/documents/analyze-upload", analyzeFormData, {
        method: "POST",
        headers: buildTokenHeaders(token),
      });

      setFileAnalysis(response);

      const currentTitle = form.getFieldValue("title")?.trim();
      if (!currentTitle || currentTitle === autoFilledTitleRef.current) {
        form.setFieldValue("title", response.suggested_title);
        autoFilledTitleRef.current = response.suggested_title;
      }

      const currentSummary = form.getFieldValue("summary")?.trim();
      if (response.ai_summary && (!currentSummary || currentSummary === autoFilledSummaryRef.current)) {
        form.setFieldValue("summary", response.ai_summary);
        autoFilledSummaryRef.current = response.ai_summary;
      }

      if (!form.getFieldValue("category")) {
        form.setFieldValue("category", response.file_type);
      }
    } catch (error) {
      setFileAnalysis(null);
      setAnalyzeError(error instanceof Error ? error.message : "文件分析失败");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleUploadChange = (info: UploadChangeParam<UploadFile>) => {
    const nextList = info.fileList.slice(-1);
    form.setFieldValue("fileList", nextList);

    const rawFile = nextList[0]?.originFileObj;
    if (!rawFile) {
      setSelectedFileSignature(null);
      setFileAnalysis(null);
      setAnalyzeError(null);
      return;
    }

    const signature = `${rawFile.name}-${rawFile.size}-${rawFile.lastModified}`;
    if (signature === selectedFileSignature) {
      return;
    }

    setSelectedFileSignature(signature);
    void analyzeFile(rawFile);
  };

  const handleCreateGroup = async (values: GroupCreateModalValues) => {
    const token = getStoredAccessToken();
    if (!token) {
      messageApi.warning("请先登录后再创建资料组。");
      return;
    }

    setCreatingGroup(true);
    try {
      const response = await requestJson<{ id: string; name: string }>("/groups", {
        method: "POST",
        headers: buildTokenHeaders(token),
        body: JSON.stringify({
          name: values.name.trim(),
          description: values.description?.trim() || undefined,
          parent_group_id: values.parentGroupId || undefined,
          visibility_mode: values.visibilityMode,
          allow_member_invite: values.allowMemberInvite,
          password: values.visibilityMode === "password" ? values.password?.trim() || undefined : undefined,
          password_hint: values.visibilityMode === "password" ? values.passwordHint?.trim() || undefined : undefined,
          specific_usernames:
            values.visibilityMode === "specific_users" ? normalizeUsernameTags(values.specificUsernames) : undefined,
        }),
      });

      messageApi.success("资料组已创建，并已自动选中");
      setGroupModalOpen(false);
      groupForm.resetFields();
      await loadGroups(response.id);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "创建资料组失败");
    } finally {
      setCreatingGroup(false);
    }
  };

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
        headers: buildTokenHeaders(token),
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

      <main className="mx-auto min-h-[calc(100vh-180px)] max-w-5xl px-5 py-6 md:px-8 md:py-8">
        <section className="panel-shell mb-6 rounded-[30px] p-8">
          <Typography.Title className="!mb-3 !text-4xl !text-ink">上传文档</Typography.Title>
          <Typography.Paragraph className="!mb-0 !text-base !leading-8 !text-ink-soft">
            这是单栏紧凑版上传页面。文件放上来后会先做分析，自动填入标题，并尽量补出大小、页数、预览方式和可选的 AI 摘要。
          </Typography.Paragraph>
        </section>

        {!getStoredAccessToken() ? (
          <Alert
            className="!mb-6"
            type="warning"
            showIcon
            message="当前未检测到登录状态，上传、资料组选择和 AI 分析都需要先登录。"
            action={
              <Space wrap>
                <Button href="/auth/login">去登录</Button>
                <Button type="primary" href="/auth/register">
                  去注册
                </Button>
              </Space>
            }
          />
        ) : null}

        {submitError ? <Alert className="!mb-6" type="error" showIcon message={submitError} /> : null}

        <Form<DocumentUploadFormValues>
          form={form}
          layout="vertical"
          size="large"
          initialValues={{ visibilityMode: "public", allowDownload: true, fileList: [] }}
          onFinish={handleFinish}
        >
          <div className="mb-6 rounded-[30px] border border-[#d9e3f0] bg-white p-5 shadow-[0_18px_46px_rgba(15,23,42,0.06)] md:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <Typography.Title level={3} className="!mb-1 !text-2xl !text-[#17314c]">
                  第一步：选择文档
                </Typography.Title>
                <Typography.Paragraph className="!mb-0 !text-[#6b7e98]">
                  支持 Word、PDF、Excel、PPT、TXT、CSV 等常见学习资料格式。
                </Typography.Paragraph>
              </div>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={submitting}>
                上传文档
              </Button>
            </div>

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
              <Upload.Dragger
                beforeUpload={() => false}
                maxCount={1}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp"
                onChange={handleUploadChange}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">点击或拖拽上传资料文件</p>
                <p className="ant-upload-hint">选中后会自动分析文件信息，并尝试生成摘要与预览建议。</p>
              </Upload.Dragger>
            </Form.Item>

            {analyzing ? (
              <div className="rounded-[22px] border border-dashed border-[#c8d5ea] bg-[#f8fbff] px-5 py-6">
                <Space size={12}>
                  <Spin />
                  <Typography.Text className="text-[#5c6f88]">正在分析文档内容与可预览信息...</Typography.Text>
                </Space>
              </div>
            ) : null}

            {analyzeError ? <Alert className="!mt-4" type="warning" showIcon message={analyzeError} /> : null}

            {fileAnalysis ? (
              <div className="mt-4 grid gap-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[22px] bg-[#f7faff] px-5 py-4">
                    <div className="mb-2 text-sm text-[#7b8ea8]">文件名</div>
                    <div className="break-all text-[#17314c]">{fileAnalysis.file_name}</div>
                  </div>
                  <div className="rounded-[22px] bg-[#f7faff] px-5 py-4">
                    <div className="mb-2 text-sm text-[#7b8ea8]">文件大小</div>
                    <div className="text-[#17314c]">{formatFileSize(fileAnalysis.file_size)}</div>
                  </div>
                  <div className="rounded-[22px] bg-[#f7faff] px-5 py-4">
                    <div className="mb-2 text-sm text-[#7b8ea8]">页数</div>
                    <div className="text-[#17314c]">{fileAnalysis.page_count ?? "暂未识别"}</div>
                  </div>
                  <div className="rounded-[22px] bg-[#f7faff] px-5 py-4">
                    <div className="mb-2 text-sm text-[#7b8ea8]">预览方式</div>
                    <div className="text-[#17314c]">
                      {previewStrategyLabelMap[fileAnalysis.preview_strategy] ?? fileAnalysis.preview_strategy}
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-[#dce6f2] bg-[#fbfdff] px-5 py-5">
                  <div className="mb-2 flex items-center gap-2 text-[#17314c]">
                    <FileTextOutlined />
                    <span className="font-medium">分析建议</span>
                  </div>
                  <div className="grid gap-2 text-sm text-[#6b7e98]">
                    <div>建议标题：{fileAnalysis.suggested_title}</div>
                    <div>文件类型：{fileAnalysis.file_type}</div>
                    <div>MIME：{fileAnalysis.mime_type}</div>
                    <div>
                      AI 摘要：{fileAnalysis.ai_summary ? `已生成${fileAnalysis.ai_provider_name ? `（${fileAnalysis.ai_provider_name}）` : ""}` : "未生成"}
                    </div>
                  </div>
                  {fileAnalysis.preview_excerpt ? (
                    <Typography.Paragraph className="!mb-0 !mt-4 !text-sm !leading-7 !text-[#526782]">
                      内容片段：{fileAnalysis.preview_excerpt.slice(0, 240)}
                      {fileAnalysis.preview_excerpt.length > 240 ? "..." : ""}
                    </Typography.Paragraph>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-[30px] border border-[#d9e3f0] bg-white p-5 shadow-[0_18px_46px_rgba(15,23,42,0.06)] md:p-6">
            <div className="mb-5">
              <Typography.Title level={3} className="!mb-1 !text-2xl !text-[#17314c]">
                第二步：填写发布信息
              </Typography.Title>
              <Typography.Paragraph className="!mb-0 !text-[#6b7e98]">
                标题会优先使用文件名自动填充，你也可以继续修改。下面的所有表单都统一使用 Ant Design Form。
              </Typography.Paragraph>
            </div>

            <Form.Item
              label="文档标题"
              name="title"
              rules={[
                { required: true, message: "请输入文档标题" },
                { min: 2, message: "文档标题至少 2 个字符" },
              ]}
            >
              <Input placeholder="例如：高等数学讲义、政治真题整理" prefix={<TagsOutlined />} />
            </Form.Item>

            <Form.Item label="摘要" name="summary">
              <Input.TextArea placeholder="可手动修改，若已自动生成也可以保留" autoSize={{ minRows: 3, maxRows: 6 }} />
            </Form.Item>

            <Form.Item label="分类" name="category">
              <Input placeholder="例如：课件、考研、实验报告、历年真题" prefix={<TagsOutlined />} />
            </Form.Item>

            <Form.Item
              label={
                <div className="flex w-full items-center justify-between gap-3">
                  <span>所属资料组</span>
                  <Button type="link" icon={<FolderAddOutlined />} onClick={() => setGroupModalOpen(true)}>
                    新建资料组
                  </Button>
                </div>
              }
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
              <TreeSelect
                allowClear
                treeData={groupTreeData}
                loading={groupsLoading}
                placeholder="可选，支持树形资料组选择"
                treeDefaultExpandAll
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

            <Form.Item className="!mb-0">
              <Space wrap>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={submitting}>
                  上传文档
                </Button>
                <Button icon={<PlusOutlined />} href="/me/documents">
                  查看我的文档
                </Button>
              </Space>
            </Form.Item>
          </div>
        </Form>

        <Modal
          title="新建资料组"
          open={groupModalOpen}
          onCancel={() => {
            setGroupModalOpen(false);
            groupForm.resetFields();
          }}
          onOk={() => groupForm.submit()}
          confirmLoading={creatingGroup}
          okText="创建资料组"
          width={720}
        >
          <Form<GroupCreateModalValues>
            form={groupForm}
            layout="vertical"
            size="large"
            initialValues={{ visibilityMode: "public", allowMemberInvite: true }}
            onFinish={handleCreateGroup}
          >
            <Form.Item
              label="资料组名称"
              name="name"
              rules={[
                { required: true, message: "请输入资料组名称" },
                { min: 2, message: "资料组名称至少 2 个字符" },
              ]}
            >
              <Input placeholder="例如：课件组、考研组、文档组" prefix={<TeamOutlined />} />
            </Form.Item>

            <Form.Item label="父级资料组" name="parentGroupId">
              <TreeSelect
                allowClear
                treeData={groupTreeData}
                placeholder="可选，创建为树形资料组中的子组"
                treeDefaultExpandAll
              />
            </Form.Item>

            <Form.Item label="简介" name="description">
              <Input.TextArea placeholder="简单说明这个资料组的用途" autoSize={{ minRows: 3, maxRows: 5 }} />
            </Form.Item>

            <Form.Item
              label="可见性"
              name="visibilityMode"
              rules={[{ required: true, message: "请选择资料组可见性" }]}
            >
              <Select options={visibilityOptions} />
            </Form.Item>

            {groupVisibilityMode === "password" ? (
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
                  <Input placeholder="可选，帮助成员回忆密码" prefix={<UserSwitchOutlined />} />
                </Form.Item>
              </>
            ) : null}

            {groupVisibilityMode === "specific_users" ? (
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
              <Checkbox>允许管理员邀请成员</Checkbox>
            </Form.Item>
          </Form>
        </Modal>
      </main>
    </>
  );
}
