"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EyeOutlined,
  LockOutlined,
  ReloadOutlined,
  SaveOutlined,
  TeamOutlined,
  UserAddOutlined,
  UserDeleteOutlined,
  UserSwitchOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Form,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { useRouter } from "next/navigation";
import { getStoredAccessToken, requestJson, requestVoid } from "@/lib/api";
import {
  GroupDetail,
  GroupMember,
  GroupRole,
  VisibilityMode,
  groupRoleLabelMap,
  isGroupManager,
  normalizeUsernameTags,
  visibilityLabelMap,
  visibilityOptions,
} from "@/lib/groups";

type GroupDetailPanelProps = {
  groupId: string;
};

type GroupUpdateFormValues = {
  name: string;
  description?: string;
  visibilityMode: VisibilityMode;
  password?: string;
  passwordHint?: string;
  allowMemberInvite: boolean;
  specificUsernames?: string[];
};

type InviteMemberFormValues = {
  username: string;
  role: Exclude<GroupRole, "owner">;
};

export function GroupDetailPanel({ groupId }: GroupDetailPanelProps) {
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updateForm] = Form.useForm<GroupUpdateFormValues>();
  const [inviteForm] = Form.useForm<InviteMemberFormValues>();
  const visibilityMode = Form.useWatch("visibilityMode", updateForm) ?? detail?.visibility_mode ?? "public";

  const canManage = isGroupManager(detail?.my_role ?? null);
  const specificUserTags = useMemo(
    () => detail?.specific_users.map((item) => item.username) ?? [],
    [detail?.specific_users],
  );

  const loadDetail = async () => {
    const token = getStoredAccessToken();
    if (!token) {
      setError("请先登录后再查看资料组详情。");
      setDetail(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await requestJson<GroupDetail>(`/groups/${groupId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setDetail(response);
      updateForm.setFieldsValue({
        name: response.name,
        description: response.description ?? "",
        visibilityMode: response.visibility_mode,
        allowMemberInvite: response.allow_member_invite,
        password: "",
        passwordHint: "",
        specificUsernames: response.specific_users.map((item) => item.username),
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "加载资料组详情失败");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDetail();
  }, [groupId]);

  const handleUpdateGroup = async (values: GroupUpdateFormValues) => {
    const token = getStoredAccessToken();
    if (!token) {
      setError("请先登录后再保存资料组。");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        visibility_mode: values.visibilityMode,
        allow_member_invite: values.allowMemberInvite,
      };

      if (values.visibilityMode === "password") {
        const password = values.password?.trim();
        const passwordHint = values.passwordHint?.trim();

        if (password) {
          payload.password = password;
        }

        if (passwordHint) {
          payload.password_hint = passwordHint;
        }
      }

      if (values.visibilityMode === "specific_users") {
        payload.specific_usernames = normalizeUsernameTags(values.specificUsernames);
      }

      const response = await requestJson<GroupDetail>(`/groups/${groupId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      setDetail(response);
      updateForm.setFieldsValue({
        name: response.name,
        description: response.description ?? "",
        visibilityMode: response.visibility_mode,
        allowMemberInvite: response.allow_member_invite,
        password: "",
        passwordHint: "",
        specificUsernames: response.specific_users.map((item) => item.username),
      });
      messageApi.success("资料组设置已更新");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "保存资料组失败");
    } finally {
      setSaving(false);
    }
  };

  const handleInviteMember = async (values: InviteMemberFormValues) => {
    const token = getStoredAccessToken();
    if (!token) {
      setError("请先登录后再邀请成员。");
      return;
    }

    setInviting(true);
    setError(null);
    try {
      await requestJson<GroupMember>(`/groups/${groupId}/members`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: values.username.trim(),
          role: values.role,
        }),
      });
      inviteForm.resetFields();
      messageApi.success("成员已加入资料组");
      await loadDetail();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "邀请成员失败");
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    const token = getStoredAccessToken();
    if (!token) {
      setError("请先登录后再移除成员。");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await requestVoid(`/groups/${groupId}/members/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      messageApi.success("成员已移出资料组");
      await loadDetail();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "移除成员失败");
      setLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    const token = getStoredAccessToken();
    if (!token) {
      setError("请先登录后再删除资料组。");
      return;
    }

    setDeletingGroup(true);
    setError(null);
    try {
      await requestVoid(`/groups/${groupId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      messageApi.success("资料组已删除");
      router.push("/me/groups");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "删除资料组失败");
    } finally {
      setDeletingGroup(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-6 md:px-8 md:py-8">
      {contextHolder}

      <section className="mb-5 flex flex-wrap gap-3">
        <Button icon={<ArrowLeftOutlined />} href="/me/groups">
          返回我的资料组
        </Button>
        <Button icon={<ReloadOutlined />} onClick={() => void loadDetail()} loading={loading}>
          刷新详情
        </Button>
        <Button href="/groups/new">新建资料组</Button>
      </section>

      {error ? <Alert className="mb-6" type="warning" showIcon message={error} /> : null}

      {detail ? (
        <>
          <section className="panel-shell mb-6 rounded-[30px] p-8">
            <Space size={[8, 12]} wrap className="!mb-4">
              <Tag color="blue">{visibilityLabelMap[detail.visibility_mode]}</Tag>
              {detail.my_role ? <Tag color="geekblue">{groupRoleLabelMap[detail.my_role]}</Tag> : null}
              {detail.password_enabled ? (
                <Tag color="gold" icon={<LockOutlined />}>
                  密码访问已启用
                </Tag>
              ) : null}
            </Space>
            <Typography.Title className="!mb-3 !text-4xl !text-ink">{detail.name}</Typography.Title>
            <Typography.Paragraph className="!mb-0 !text-base !leading-8 !text-ink-soft">
              {detail.description || "当前资料组还没有简介，你可以在下方通过 Ant Design 表单继续补充。"}
            </Typography.Paragraph>
          </section>

          <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
            <Card variant="borderless" className="panel-shell rounded-[30px]" loading={loading}>
              <Typography.Title level={3} className="!mb-4 !text-2xl !text-ink">
                基础信息
              </Typography.Title>
              <Descriptions column={1} labelStyle={{ width: 120 }}>
                <Descriptions.Item label="拥有者">
                  {detail.owner.nickname}（{detail.owner.username}）
                </Descriptions.Item>
                <Descriptions.Item label="组标识">{detail.slug}</Descriptions.Item>
                <Descriptions.Item label="成员数">{detail.member_count}</Descriptions.Item>
                <Descriptions.Item label="我的角色">
                  {detail.my_role ? groupRoleLabelMap[detail.my_role] : "只读访问"}
                </Descriptions.Item>
                <Descriptions.Item label="可见性">
                  {visibilityLabelMap[detail.visibility_mode]}
                </Descriptions.Item>
                <Descriptions.Item label="指定可见用户">
                  {specificUserTags.length > 0 ? specificUserTags.join("、") : "-"}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card variant="borderless" className="panel-shell rounded-[30px]" loading={loading}>
              <Typography.Title level={3} className="!mb-4 !text-2xl !text-ink">
                资料组设置
              </Typography.Title>

              {canManage ? (
                <Form<GroupUpdateFormValues>
                  form={updateForm}
                  layout="vertical"
                  size="large"
                  onFinish={handleUpdateGroup}
                >
                  <Form.Item
                    label="资料组名称"
                    name="name"
                    rules={[
                      { required: true, message: "请输入资料组名称" },
                      { min: 2, message: "资料组名称至少 2 个字符" },
                    ]}
                  >
                    <Input prefix={<TeamOutlined />} placeholder="请输入资料组名称" />
                  </Form.Item>

                  <Form.Item label="简介" name="description">
                    <Input.TextArea autoSize={{ minRows: 3, maxRows: 5 }} placeholder="简单介绍这个资料组" />
                  </Form.Item>

                  <Form.Item
                    label="可见性"
                    name="visibilityMode"
                    rules={[{ required: true, message: "请选择资料组可见性" }]}
                  >
                    <Select options={visibilityOptions} suffixIcon={<EyeOutlined />} />
                  </Form.Item>

                  {visibilityMode === "password" ? (
                    <>
                      <Form.Item
                        label="新访问密码"
                        name="password"
                        rules={[
                          {
                            validator(_, value: string | undefined) {
                              if (detail.visibility_mode === "password" && !value) {
                                return Promise.resolve();
                              }
                              if (value && value.trim().length >= 4) {
                                return Promise.resolve();
                              }
                              return Promise.reject(new Error("切换为密码访问时，请填写至少 4 位密码"));
                            },
                          },
                        ]}
                      >
                        <Input.Password prefix={<LockOutlined />} placeholder="留空则保留现有密码" />
                      </Form.Item>

                      <Form.Item label="新密码提示" name="passwordHint">
                        <Input prefix={<UserSwitchOutlined />} placeholder="可选，留空则保留原提示" />
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
                        placeholder="输入用户名并回车，可为多个用户授权访问"
                        suffixIcon={<UserSwitchOutlined />}
                      />
                    </Form.Item>
                  ) : null}

                  <Form.Item name="allowMemberInvite" valuePropName="checked">
                    <Checkbox>允许管理员邀请成员</Checkbox>
                  </Form.Item>

                  <Space wrap>
                    <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
                      保存设置
                    </Button>
                    <Popconfirm
                      title="确认删除这个资料组吗？"
                      description="删除后成员关系和访问配置也会一起移除。"
                      okText="确认删除"
                      cancelText="取消"
                      onConfirm={() => void handleDeleteGroup()}
                    >
                      <Button danger icon={<DeleteOutlined />} loading={deletingGroup}>
                        删除资料组
                      </Button>
                    </Popconfirm>
                  </Space>
                </Form>
              ) : (
                <Typography.Paragraph className="!mb-0 !text-base !leading-8 !text-ink-soft">
                  你当前没有这个资料组的管理权限，所以这里只显示资料组信息。拥有者或管理员登录后，
                  可以在这里修改名称、可见性、密码访问与指定用户列表。
                </Typography.Paragraph>
              )}
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
            <Card variant="borderless" className="panel-shell rounded-[30px]" loading={loading}>
              <Typography.Title level={3} className="!mb-4 !text-2xl !text-ink">
                成员列表
              </Typography.Title>
              <Table<GroupMember>
                rowKey={(item) => item.user.id}
                pagination={false}
                dataSource={detail.members}
                columns={[
                  {
                    title: "用户名",
                    dataIndex: ["user", "username"],
                    key: "username",
                  },
                  {
                    title: "昵称",
                    dataIndex: ["user", "nickname"],
                    key: "nickname",
                  },
                  {
                    title: "角色",
                    dataIndex: "role",
                    key: "role",
                    render: (value: GroupRole) => groupRoleLabelMap[value],
                  },
                  {
                    title: "操作",
                    key: "actions",
                    render: (_, record) =>
                      canManage && record.user.id !== detail.owner.id ? (
                        <Popconfirm
                          title={`确认移除 ${record.user.username} 吗？`}
                          okText="确认移除"
                          cancelText="取消"
                          onConfirm={() => void handleRemoveMember(record.user.id)}
                        >
                          <Button danger size="small" icon={<UserDeleteOutlined />}>
                            移除
                          </Button>
                        </Popconfirm>
                      ) : (
                        <span className="text-ink-soft">-</span>
                      ),
                  },
                ]}
              />
            </Card>

            <Card variant="borderless" className="panel-shell rounded-[30px]" loading={loading}>
              <Typography.Title level={3} className="!mb-4 !text-2xl !text-ink">
                邀请成员
              </Typography.Title>
              {canManage ? (
                <Form<InviteMemberFormValues>
                  form={inviteForm}
                  layout="vertical"
                  size="large"
                  initialValues={{ role: "member" }}
                  onFinish={handleInviteMember}
                >
                  <Form.Item
                    label="用户名"
                    name="username"
                    rules={[{ required: true, message: "请输入要邀请的用户名" }]}
                  >
                    <Input placeholder="请输入已注册用户的用户名" prefix={<UserAddOutlined />} />
                  </Form.Item>

                  <Form.Item label="加入角色" name="role" rules={[{ required: true, message: "请选择角色" }]}>
                    <Select
                      options={[
                        { label: "管理员", value: "admin" },
                        { label: "普通成员", value: "member" },
                      ]}
                    />
                  </Form.Item>

                  <Form.Item className="!mb-0">
                    <Button type="primary" htmlType="submit" icon={<UserAddOutlined />} loading={inviting}>
                      邀请加入
                    </Button>
                  </Form.Item>
                </Form>
              ) : (
                <Typography.Paragraph className="!mb-0 !text-base !leading-8 !text-ink-soft">
                  当前账号没有邀请权限。如需邀请新成员，请让该资料组拥有者或管理员来操作。
                </Typography.Paragraph>
              )}
            </Card>
          </div>
        </>
      ) : (
        <Card variant="borderless" className="panel-shell rounded-[30px]" loading={loading}>
          <Typography.Paragraph className="!mb-0 !text-ink-soft">
            当前未加载到资料组信息，请检查登录状态后重试。
          </Typography.Paragraph>
        </Card>
      )}
    </main>
  );
}
