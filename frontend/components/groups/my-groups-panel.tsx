"use client";

import { useEffect, useState } from "react";
import {
  FolderOpenOutlined,
  LockOutlined,
  PlusOutlined,
  ReloadOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Empty, Space, Tag, Typography } from "antd";
import { apiBaseUrl, getStoredAccessToken, requestJson } from "@/lib/api";
import { GroupListResponse, GroupSummary, groupRoleLabelMap, visibilityLabelMap } from "@/lib/groups";

export function MyGroupsPanel() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGroups = async () => {
    const token = getStoredAccessToken();
    if (!token) {
      setError("当前还没有登录令牌，请先登录后再查看或创建资料组。");
      setGroups([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await requestJson<GroupListResponse>("/groups?scope=my", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setGroups(response.items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "加载资料组失败");
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadGroups();
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-6 md:px-8 md:py-8">
      <section className="panel-shell mb-6 rounded-[30px] p-8">
        <Typography.Title className="!mb-3 !text-4xl !text-ink">我的资料组</Typography.Title>
        <Typography.Paragraph className="!mb-0 !text-base !leading-8 !text-ink-soft">
          这里已经接上真实的分组列表接口。你可以集中查看自己创建或参与的课件组、文档组、考研组，
          并继续进入详情页管理成员、可见性与访问策略。
        </Typography.Paragraph>
      </section>

      <section className="mb-6 flex flex-wrap gap-3">
        <Button type="primary" icon={<PlusOutlined />} href="/groups/new">
          创建资料组
        </Button>
        <Button icon={<ReloadOutlined />} onClick={() => void loadGroups()} loading={loading}>
          刷新列表
        </Button>
        <Button href="/auth/login">去登录</Button>
        <Button href="/auth/register">去注册</Button>
      </section>

      {error ? <Alert className="mb-6" type="warning" showIcon message={error} /> : null}

      {groups.length === 0 && !loading ? (
        <Card variant="borderless" className="panel-shell rounded-[30px]">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="还没有资料组，可以先创建一个课件组或考研组。"
          >
            <Button type="primary" href="/groups/new" icon={<PlusOutlined />}>
              去创建
            </Button>
          </Empty>
        </Card>
      ) : (
        <section className="grid gap-5 lg:grid-cols-2">
          {groups.map((group) => (
            <Card
              key={group.id}
              variant="borderless"
              className="panel-shell rounded-[28px]"
              loading={loading}
              styles={{ body: { padding: 28 } }}
            >
              <Space size={[8, 12]} wrap className="!mb-4">
                <Tag color="blue">{visibilityLabelMap[group.visibility_mode]}</Tag>
                {group.my_role ? <Tag color="geekblue">{groupRoleLabelMap[group.my_role]}</Tag> : null}
                {group.password_enabled ? (
                  <Tag color="gold" icon={<LockOutlined />}>
                    已启用访问密码
                  </Tag>
                ) : null}
              </Space>

              <Typography.Title level={3} className="!mb-3 !text-2xl !text-ink">
                {group.name}
              </Typography.Title>
              <Typography.Paragraph className="!mb-5 min-h-[72px] !text-base !leading-7 !text-ink-soft">
                {group.description || "这个资料组还没有填写简介，可以进入详情页继续完善。"}
              </Typography.Paragraph>

              <div className="mb-6 grid gap-3 text-sm text-ink-soft md:grid-cols-2">
                <div className="rounded-2xl bg-white/70 px-4 py-4">
                  <div className="mb-1 flex items-center gap-2 text-ink">
                    <TeamOutlined />
                    <span>成员规模</span>
                  </div>
                  <div>{group.member_count} 人</div>
                </div>
                <div className="rounded-2xl bg-white/70 px-4 py-4">
                  <div className="mb-1 flex items-center gap-2 text-ink">
                    <FolderOpenOutlined />
                    <span>组别标识</span>
                  </div>
                  <div>{group.slug}</div>
                </div>
              </div>

              <Typography.Paragraph className="!mb-5 !text-sm !text-ink-soft">
                拥有者：{group.owner.nickname}（{group.owner.username}）
                <br />
                接口地址：{apiBaseUrl}/groups/{group.id}
              </Typography.Paragraph>

              <Space wrap>
                <Button type="primary" href={`/me/groups/${group.id}`}>
                  查看详情
                </Button>
                <Button href="/groups/new" icon={<PlusOutlined />}>
                  再建一个组
                </Button>
              </Space>
            </Card>
          ))}
        </section>
      )}
    </main>
  );
}
