"use client";

import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { getStoredAccessToken, requestJson, requestVoid, setStoredAuthUser, type StoredAuthUser } from "@/lib/api";
import {
  AdminAIProvider,
  AdminAIProviderListResponse,
  AdminDocument,
  AdminDocumentListResponse,
  AdminOverview,
  AdminUser,
  AdminUserListResponse,
  adminDocumentStatusOptions,
  adminUserStatusOptions,
  aiWireApiOptions,
} from "@/lib/admin";
import { documentVisibilityOptions, formatFileSize } from "@/lib/documents";

type MeResponse = {
  user: StoredAuthUser;
};

type UserFormValues = {
  username: string;
  nickname: string;
  email?: string;
  phone?: string;
  status: string;
  isAdmin: boolean;
  password?: string;
};

type DocumentFormValues = {
  title: string;
  summary?: string;
  category?: string;
  visibilityMode: string;
  status: string;
  allowDownload: boolean;
  password?: string;
  passwordHint?: string;
  specificUsernames?: string[];
};

type ProviderFormValues = {
  name: string;
  providerCode: string;
  providerType: string;
  baseUrl: string;
  apiKey?: string;
  wireApi: string;
  modelName: string;
  reasoningEffort?: string;
  isEnabled: boolean;
  isDefault: boolean;
  notes?: string;
  extraMetadataText?: string;
};

function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("zh-CN");
}

function parseMetadataJson(rawValue: string | undefined): Record<string, unknown> {
  const normalized = rawValue?.trim();
  if (!normalized) {
    return {};
  }
  return JSON.parse(normalized) as Record<string, unknown>;
}

export function AdminDashboard() {
  const [messageApi, contextHolder] = message.useMessage();
  const [userForm] = Form.useForm<UserFormValues>();
  const [documentForm] = Form.useForm<DocumentFormValues>();
  const [providerForm] = Form.useForm<ProviderFormValues>();
  const [currentUser, setCurrentUser] = useState<StoredAuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [providers, setProviders] = useState<AdminAIProvider[]>([]);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editingDocument, setEditingDocument] = useState<AdminDocument | null>(null);
  const [editingProvider, setEditingProvider] = useState<AdminAIProvider | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [savingDocument, setSavingDocument] = useState(false);
  const [savingProvider, setSavingProvider] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const documentVisibilityMode = Form.useWatch("visibilityMode", documentForm) ?? "public";

  const loadAdminData = async (token: string) => {
    setPageLoading(true);
    setError(null);
    try {
      const [overviewResponse, usersResponse, documentsResponse, providersResponse] = await Promise.all([
        requestJson<AdminOverview>("/admin/overview", { headers: { Authorization: `Bearer ${token}` } }),
        requestJson<AdminUserListResponse>("/admin/users", { headers: { Authorization: `Bearer ${token}` } }),
        requestJson<AdminDocumentListResponse>("/admin/documents", { headers: { Authorization: `Bearer ${token}` } }),
        requestJson<AdminAIProviderListResponse>("/admin/ai-providers", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setOverview(overviewResponse);
      setUsers(usersResponse.items);
      setDocuments(documentsResponse.items);
      setProviders(providersResponse.items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "管理后台数据加载失败");
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      const token = getStoredAccessToken();
      if (!token) {
        setAuthLoading(false);
        return;
      }

      try {
        const me = await requestJson<MeResponse>("/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setStoredAuthUser(me.user);
        setCurrentUser(me.user);
        if (me.user.is_admin) {
          await loadAdminData(token);
        }
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "管理员身份校验失败");
      } finally {
        setAuthLoading(false);
      }
    };

    void bootstrap();
  }, []);

  const overviewCards = useMemo(
    () =>
      overview
        ? [
            { title: "注册用户", value: overview.users_count, suffix: "人" },
            { title: "文档总数", value: overview.documents_count, suffix: "份" },
            { title: "资料组总数", value: overview.groups_count, suffix: "组" },
            { title: "公开文档", value: overview.public_documents_count, suffix: "份" },
            { title: "AI 工具", value: overview.ai_provider_count, suffix: "个" },
            { title: "已启用 AI", value: overview.enabled_ai_provider_count, suffix: "个" },
          ]
        : [],
    [overview],
  );

  const reloadAll = async () => {
    const token = getStoredAccessToken();
    if (!token) {
      setError("当前未检测到登录状态，请先登录管理员账号。");
      return;
    }
    await loadAdminData(token);
  };

  const openUserEditor = (user: AdminUser) => {
    setEditingUser(user);
    userForm.setFieldsValue({
      username: user.username,
      nickname: user.nickname,
      email: user.email ?? undefined,
      phone: user.phone ?? undefined,
      status: user.status,
      isAdmin: user.is_admin,
      password: "",
    });
    setUserModalOpen(true);
  };

  const openDocumentEditor = (document: AdminDocument) => {
    setEditingDocument(document);
    documentForm.setFieldsValue({
      title: document.title,
      summary: document.summary ?? "",
      category: document.category ?? "",
      visibilityMode: document.visibility_mode,
      status: document.status,
      allowDownload: document.allow_download,
      password: "",
      passwordHint: "",
      specificUsernames: [],
    });
    setDocumentModalOpen(true);
  };

  const openProviderEditor = (provider?: AdminAIProvider) => {
    setEditingProvider(provider ?? null);
    providerForm.setFieldsValue({
      name: provider?.name ?? "",
      providerCode: provider?.provider_code ?? "",
      providerType: provider?.provider_type ?? "",
      baseUrl: provider?.base_url ?? "",
      apiKey: "",
      wireApi: provider?.wire_api ?? "responses",
      modelName: provider?.model_name ?? "",
      reasoningEffort: provider?.reasoning_effort ?? "",
      isEnabled: provider?.is_enabled ?? true,
      isDefault: provider?.is_default ?? false,
      notes: provider?.notes ?? "",
      extraMetadataText: JSON.stringify(provider?.extra_metadata ?? {}, null, 2),
    });
    setProviderModalOpen(true);
  };

  const handleSaveUser = async (values: UserFormValues) => {
    if (!editingUser) {
      return;
    }
    const token = getStoredAccessToken();
    if (!token) {
      setError("请先登录管理员账号。");
      return;
    }

    setSavingUser(true);
    try {
      await requestJson<AdminUser>(`/admin/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          username: values.username.trim(),
          nickname: values.nickname.trim(),
          email: values.email?.trim() || null,
          phone: values.phone?.trim() || null,
          status: values.status,
          is_admin: values.isAdmin,
          password: values.password?.trim() || undefined,
        }),
      });
      messageApi.success("用户信息已更新");
      setUserModalOpen(false);
      await reloadAll();
    } catch (requestError) {
      messageApi.error(requestError instanceof Error ? requestError.message : "用户更新失败");
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async (user: AdminUser) => {
    const token = getStoredAccessToken();
    if (!token) {
      setError("请先登录管理员账号。");
      return;
    }

    setDeletingKey(`user-${user.id}`);
    try {
      await requestVoid(`/admin/users/${user.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      messageApi.success("用户已删除");
      await reloadAll();
    } catch (requestError) {
      messageApi.error(requestError instanceof Error ? requestError.message : "删除用户失败");
    } finally {
      setDeletingKey(null);
    }
  };

  const handleSaveDocument = async (values: DocumentFormValues) => {
    if (!editingDocument) {
      return;
    }
    const token = getStoredAccessToken();
    if (!token) {
      setError("请先登录管理员账号。");
      return;
    }

    setSavingDocument(true);
    try {
      await requestJson<AdminDocument>(`/admin/documents/${editingDocument.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: values.title.trim(),
          summary: values.summary?.trim() || null,
          category: values.category?.trim() || null,
          visibility_mode: values.visibilityMode,
          status: values.status,
          allow_download: values.allowDownload,
          password: values.visibilityMode === "password" ? values.password?.trim() || undefined : undefined,
          password_hint:
            values.visibilityMode === "password" ? values.passwordHint?.trim() || undefined : undefined,
          specific_usernames:
            values.visibilityMode === "specific_users"
              ? values.specificUsernames?.map((item) => item.trim()).filter(Boolean)
              : undefined,
        }),
      });
      messageApi.success("文档信息已更新");
      setDocumentModalOpen(false);
      await reloadAll();
    } catch (requestError) {
      messageApi.error(requestError instanceof Error ? requestError.message : "文档更新失败");
    } finally {
      setSavingDocument(false);
    }
  };

  const handleDeleteDocument = async (document: AdminDocument) => {
    const token = getStoredAccessToken();
    if (!token) {
      setError("请先登录管理员账号。");
      return;
    }

    setDeletingKey(`document-${document.id}`);
    try {
      await requestVoid(`/admin/documents/${document.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      messageApi.success("文档已删除");
      await reloadAll();
    } catch (requestError) {
      messageApi.error(requestError instanceof Error ? requestError.message : "删除文档失败");
    } finally {
      setDeletingKey(null);
    }
  };

  const handleSaveProvider = async (values: ProviderFormValues) => {
    const token = getStoredAccessToken();
    if (!token) {
      setError("请先登录管理员账号。");
      return;
    }

    setSavingProvider(true);
    try {
      const payload = {
        name: values.name.trim(),
        provider_code: values.providerCode.trim(),
        provider_type: values.providerType.trim(),
        base_url: values.baseUrl.trim(),
        api_key: values.apiKey?.trim() || undefined,
        wire_api: values.wireApi,
        model_name: values.modelName.trim(),
        reasoning_effort: values.reasoningEffort?.trim() || null,
        is_enabled: values.isEnabled,
        is_default: values.isDefault,
        notes: values.notes?.trim() || null,
        extra_metadata: parseMetadataJson(values.extraMetadataText),
      };

      if (editingProvider) {
        await requestJson<AdminAIProvider>(`/admin/ai-providers/${editingProvider.id}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        messageApi.success("AI 工具配置已更新");
      } else {
        if (!payload.api_key) {
          throw new Error("新建 AI 工具时必须填写 API Key");
        }
        await requestJson<AdminAIProvider>("/admin/ai-providers", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        messageApi.success("AI 工具已创建");
      }

      setProviderModalOpen(false);
      await reloadAll();
    } catch (requestError) {
      messageApi.error(requestError instanceof Error ? requestError.message : "AI 工具保存失败");
    } finally {
      setSavingProvider(false);
    }
  };

  const handleDeleteProvider = async (provider: AdminAIProvider) => {
    const token = getStoredAccessToken();
    if (!token) {
      setError("请先登录管理员账号。");
      return;
    }

    setDeletingKey(`provider-${provider.id}`);
    try {
      await requestVoid(`/admin/ai-providers/${provider.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      messageApi.success("AI 工具已删除");
      await reloadAll();
    } catch (requestError) {
      messageApi.error(requestError instanceof Error ? requestError.message : "删除 AI 工具失败");
    } finally {
      setDeletingKey(null);
    }
  };

  if (authLoading) {
    return (
      <main className="mx-auto min-h-[calc(100vh-180px)] max-w-7xl px-5 py-10 md:px-8">
        <div className="flex min-h-[320px] items-center justify-center">
          <Spin size="large" />
        </div>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className="mx-auto min-h-[calc(100vh-180px)] max-w-5xl px-5 py-8 md:px-8">
        <Alert type="warning" showIcon message="请先登录管理员账号后再访问管理后台。" />
      </main>
    );
  }

  if (!currentUser.is_admin) {
    return (
      <main className="mx-auto min-h-[calc(100vh-180px)] max-w-5xl px-5 py-8 md:px-8">
        <Alert type="error" showIcon message="当前账号不是管理员，无法访问后台管理。" />
      </main>
    );
  }

  return (
    <>
      {contextHolder}

      <main className="mx-auto min-h-[calc(100vh-180px)] max-w-7xl px-5 py-6 md:px-8 md:py-8">
        <section className="panel-shell mb-6 rounded-[30px] p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Typography.Title className="!mb-2 !text-4xl !text-ink">管理后台</Typography.Title>
              <Typography.Paragraph className="!mb-0 !text-base !leading-8 !text-ink-soft">
                当前已接入用户、文档与 AI 工具三类后台管理能力。
              </Typography.Paragraph>
            </div>
            <Space wrap>
              <Button icon={<ReloadOutlined />} onClick={() => void reloadAll()} loading={pageLoading}>
                刷新全部数据
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openProviderEditor()}>
                新建 AI 工具
              </Button>
            </Space>
          </div>
        </section>

        {error ? <Alert className="!mb-6" type="warning" showIcon message={error} /> : null}

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {overviewCards.map((item) => (
            <Card key={item.title} className="rounded-[24px] border border-[#dbe4ef]">
              <Statistic title={item.title} value={item.value} suffix={item.suffix} />
            </Card>
          ))}
        </section>

        <Tabs
          defaultActiveKey="users"
          items={[
            {
              key: "users",
              label: "用户管理",
              children: (
                <Card className="rounded-[28px] border border-[#dbe4ef]">
                  <Table<AdminUser>
                    rowKey="id"
                    loading={pageLoading}
                    scroll={{ x: 1100 }}
                    dataSource={users}
                    pagination={{ pageSize: 10 }}
                    columns={[
                      { title: "用户名", dataIndex: "username", key: "username" },
                      { title: "昵称", dataIndex: "nickname", key: "nickname" },
                      {
                        title: "邮箱",
                        dataIndex: "email",
                        key: "email",
                        render: (value: string | null) => value || "-",
                      },
                      {
                        title: "状态",
                        dataIndex: "status",
                        key: "status",
                        render: (value: string) => <Tag color={value === "active" ? "green" : "orange"}>{value}</Tag>,
                      },
                      {
                        title: "后台权限",
                        dataIndex: "is_admin",
                        key: "is_admin",
                        render: (value: boolean) => (value ? <Tag color="blue">管理员</Tag> : <Tag>普通用户</Tag>),
                      },
                      {
                        title: "文档/组/币",
                        key: "summary",
                        render: (_, record) => `${record.document_count} / ${record.group_count} / ${record.coin_balance}`,
                      },
                      {
                        title: "注册时间",
                        dataIndex: "created_at",
                        key: "created_at",
                        render: (value: string) => formatDateTime(value),
                      },
                      {
                        title: "操作",
                        key: "actions",
                        fixed: "right",
                        render: (_, record) => (
                          <Space wrap>
                            <Button size="small" icon={<EditOutlined />} onClick={() => openUserEditor(record)}>
                              编辑
                            </Button>
                            <Popconfirm
                              title={`确认删除用户 ${record.username} 吗？`}
                              description="该用户名下的文档与资料组也会一起处理。"
                              okText="确认删除"
                              cancelText="取消"
                              onConfirm={() => void handleDeleteUser(record)}
                            >
                              <Button
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                loading={deletingKey === `user-${record.id}`}
                              >
                                删除
                              </Button>
                            </Popconfirm>
                          </Space>
                        ),
                      },
                    ]}
                  />
                </Card>
              ),
            },
            {
              key: "documents",
              label: "文档管理",
              children: (
                <Card className="rounded-[28px] border border-[#dbe4ef]">
                  <Table<AdminDocument>
                    rowKey="id"
                    loading={pageLoading}
                    scroll={{ x: 1280 }}
                    dataSource={documents}
                    pagination={{ pageSize: 10 }}
                    columns={[
                      {
                        title: "标题",
                        dataIndex: "title",
                        key: "title",
                        render: (value: string, record) => <a href={`/documents/${record.id}`}>{value}</a>,
                      },
                      { title: "上传者", dataIndex: "owner_username", key: "owner_username" },
                      {
                        title: "资料组",
                        dataIndex: "group_name",
                        key: "group_name",
                        render: (value: string | null) => value || "-",
                      },
                      {
                        title: "格式",
                        key: "format",
                        render: (_, record) => `${record.file_extension.toUpperCase()} · ${formatFileSize(record.file_size)}`,
                      },
                      {
                        title: "页数",
                        dataIndex: "page_count",
                        key: "page_count",
                        render: (value: number | null) => value ?? "-",
                      },
                      {
                        title: "状态",
                        key: "state",
                        render: (_, record) => (
                          <Space wrap>
                            <Tag color="blue">{record.visibility_mode}</Tag>
                            <Tag color={record.status === "active" ? "green" : "orange"}>{record.status}</Tag>
                          </Space>
                        ),
                      },
                      {
                        title: "阅读/赞/币",
                        key: "stats",
                        render: (_, record) => `${record.read_count} / ${record.like_count} / ${record.coin_count}`,
                      },
                      {
                        title: "创建时间",
                        dataIndex: "created_at",
                        key: "created_at",
                        render: (value: string) => formatDateTime(value),
                      },
                      {
                        title: "操作",
                        key: "actions",
                        fixed: "right",
                        render: (_, record) => (
                          <Space wrap>
                            <Button size="small" icon={<EditOutlined />} onClick={() => openDocumentEditor(record)}>
                              编辑
                            </Button>
                            <Popconfirm
                              title={`确认删除文档《${record.title}》吗？`}
                              okText="确认删除"
                              cancelText="取消"
                              onConfirm={() => void handleDeleteDocument(record)}
                            >
                              <Button
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                loading={deletingKey === `document-${record.id}`}
                              >
                                删除
                              </Button>
                            </Popconfirm>
                          </Space>
                        ),
                      },
                    ]}
                  />
                </Card>
              ),
            },
            {
              key: "ai",
              label: "AI 工具管理",
              children: (
                <Card className="rounded-[28px] border border-[#dbe4ef]">
                  <Table<AdminAIProvider>
                    rowKey="id"
                    loading={pageLoading}
                    scroll={{ x: 1280 }}
                    dataSource={providers}
                    pagination={{ pageSize: 10 }}
                    columns={[
                      {
                        title: "工具名称",
                        key: "name",
                        render: (_, record) => (
                          <Space wrap>
                            <Tag color={record.is_enabled ? "green" : "default"}>
                              {record.is_enabled ? "已启用" : "已停用"}
                            </Tag>
                            {record.is_default ? <Tag color="gold">默认</Tag> : null}
                            <span>{record.name}</span>
                          </Space>
                        ),
                      },
                      { title: "Provider", dataIndex: "provider_type", key: "provider_type" },
                      {
                        title: "模型",
                        key: "model",
                        render: (_, record) => `${record.model_name} · ${record.wire_api}`,
                      },
                      { title: "API Key", dataIndex: "api_key_masked", key: "api_key_masked" },
                      { title: "使用次数", dataIndex: "usage_count", key: "usage_count" },
                      {
                        title: "最近调用",
                        dataIndex: "last_used_at",
                        key: "last_used_at",
                        render: (value: string | null) => formatDateTime(value),
                      },
                      {
                        title: "最近错误",
                        dataIndex: "last_error",
                        key: "last_error",
                        render: (value: string | null) => (
                          <span className="line-clamp-2 max-w-[280px] text-[#6b7e98]">{value || "-"}</span>
                        ),
                      },
                      {
                        title: "操作",
                        key: "actions",
                        fixed: "right",
                        render: (_, record) => (
                          <Space wrap>
                            <Button size="small" icon={<EditOutlined />} onClick={() => openProviderEditor(record)}>
                              编辑
                            </Button>
                            <Popconfirm
                              title={`确认删除 AI 工具 ${record.name} 吗？`}
                              okText="确认删除"
                              cancelText="取消"
                              onConfirm={() => void handleDeleteProvider(record)}
                            >
                              <Button
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                loading={deletingKey === `provider-${record.id}`}
                              >
                                删除
                              </Button>
                            </Popconfirm>
                          </Space>
                        ),
                      },
                    ]}
                  />
                </Card>
              ),
            },
          ]}
        />
      </main>

      <Modal
        title={`编辑用户：${editingUser?.username ?? ""}`}
        open={userModalOpen}
        onCancel={() => setUserModalOpen(false)}
        onOk={() => userForm.submit()}
        confirmLoading={savingUser}
        okText="保存用户"
        width={720}
      >
        <Form<UserFormValues> form={userForm} layout="vertical" size="large" onFinish={handleSaveUser}>
          <Form.Item label="用户名" name="username" rules={[{ required: true, message: "请输入用户名" }]}>
            <Input prefix={<UserOutlined />} />
          </Form.Item>
          <Form.Item label="昵称" name="nickname" rules={[{ required: true, message: "请输入昵称" }]}>
            <Input />
          </Form.Item>
          <div className="grid gap-4 md:grid-cols-2">
            <Form.Item label="邮箱" name="email">
              <Input />
            </Form.Item>
            <Form.Item label="手机号" name="phone">
              <Input />
            </Form.Item>
          </div>
          <Form.Item label="状态" name="status" rules={[{ required: true, message: "请选择状态" }]}>
            <Select options={adminUserStatusOptions} />
          </Form.Item>
          <Form.Item name="isAdmin" valuePropName="checked">
            <Checkbox>授予后台管理员权限</Checkbox>
          </Form.Item>
          <Form.Item label="重置密码" name="password" extra="留空则不修改密码">
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`编辑文档：${editingDocument?.title ?? ""}`}
        open={documentModalOpen}
        onCancel={() => setDocumentModalOpen(false)}
        onOk={() => documentForm.submit()}
        confirmLoading={savingDocument}
        okText="保存文档"
        width={780}
      >
        <Form<DocumentFormValues> form={documentForm} layout="vertical" size="large" onFinish={handleSaveDocument}>
          <Form.Item label="标题" name="title" rules={[{ required: true, message: "请输入文档标题" }]}>
            <Input />
          </Form.Item>
          <Form.Item label="摘要" name="summary">
            <Input.TextArea autoSize={{ minRows: 3, maxRows: 6 }} />
          </Form.Item>
          <Form.Item label="分类" name="category">
            <Input />
          </Form.Item>
          <div className="grid gap-4 md:grid-cols-2">
            <Form.Item label="可见性" name="visibilityMode" rules={[{ required: true, message: "请选择可见性" }]}>
              <Select options={documentVisibilityOptions} />
            </Form.Item>
            <Form.Item label="资源状态" name="status" rules={[{ required: true, message: "请选择状态" }]}>
              <Select options={adminDocumentStatusOptions} />
            </Form.Item>
          </div>
          {documentVisibilityMode === "password" ? (
            <>
              <Form.Item label="访问密码" name="password" extra="留空则保留现有密码">
                <Input.Password />
              </Form.Item>
              <Form.Item label="密码提示" name="passwordHint">
                <Input />
              </Form.Item>
            </>
          ) : null}
          {documentVisibilityMode === "specific_users" ? (
            <Form.Item label="指定可见用户" name="specificUsernames">
              <Select mode="tags" tokenSeparators={[",", " "]} />
            </Form.Item>
          ) : null}
          <Form.Item name="allowDownload" valuePropName="checked">
            <Checkbox>允许下载原文件</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingProvider ? `编辑 AI 工具：${editingProvider.name}` : "新建 AI 工具"}
        open={providerModalOpen}
        onCancel={() => setProviderModalOpen(false)}
        onOk={() => providerForm.submit()}
        confirmLoading={savingProvider}
        okText={editingProvider ? "保存 AI 工具" : "创建 AI 工具"}
        width={820}
      >
        <Form<ProviderFormValues> form={providerForm} layout="vertical" size="large" onFinish={handleSaveProvider}>
          <div className="grid gap-4 md:grid-cols-2">
            <Form.Item label="工具名称" name="name" rules={[{ required: true, message: "请输入工具名称" }]}>
              <Input prefix={<RobotOutlined />} />
            </Form.Item>
            <Form.Item
              label="Provider Code"
              name="providerCode"
              rules={[{ required: true, message: "请输入 provider code" }]}
            >
              <Input />
            </Form.Item>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Form.Item
              label="Provider Type"
              name="providerType"
              rules={[{ required: true, message: "请输入 provider type" }]}
            >
              <Input />
            </Form.Item>
            <Form.Item label="Wire API" name="wireApi" rules={[{ required: true, message: "请选择 API 类型" }]}>
              <Select options={aiWireApiOptions} />
            </Form.Item>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Form.Item label="Base URL" name="baseUrl" rules={[{ required: true, message: "请输入 Base URL" }]}>
              <Input />
            </Form.Item>
            <Form.Item label="模型名" name="modelName" rules={[{ required: true, message: "请输入模型名" }]}>
              <Input />
            </Form.Item>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Form.Item label="Reasoning Effort" name="reasoningEffort">
              <Input placeholder="例如：xhigh" />
            </Form.Item>
            <Form.Item label="API Key" name="apiKey" extra={editingProvider ? "留空则保留现有 key" : undefined}>
              <Input.Password />
            </Form.Item>
          </div>
          <Form.Item label="备注" name="notes">
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
          </Form.Item>
          <Form.Item label="额外配置 JSON" name="extraMetadataText">
            <Input.TextArea autoSize={{ minRows: 4, maxRows: 8 }} />
          </Form.Item>
          <Space wrap>
            <Form.Item name="isEnabled" valuePropName="checked" className="!mb-0">
              <Checkbox>启用该 AI 工具</Checkbox>
            </Form.Item>
            <Form.Item name="isDefault" valuePropName="checked" className="!mb-0">
              <Checkbox>设为默认 AI 工具</Checkbox>
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </>
  );
}
