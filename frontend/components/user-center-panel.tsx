"use client";

import { useEffect, useState } from "react";
import {
  DollarOutlined,
  FileAddOutlined,
  FolderOpenOutlined,
  LogoutOutlined,
  ReloadOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Descriptions, Empty, Space, Typography } from "antd";
import {
  getStoredAccessToken,
  removeStoredAccessToken,
  requestJson,
  setStoredAuthUser,
  type StoredAuthUser,
} from "@/lib/api";

type MeResponse = {
  user: StoredAuthUser;
  coin_account: {
    balance: number;
    total_earned: number;
    total_spent: number;
  } | null;
};

export function UserCenterPanel() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMe = async () => {
    const token = getStoredAccessToken();
    if (!token) {
      setMe(null);
      setError("当前未检测到登录状态，请先登录。");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await requestJson<MeResponse>("/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setStoredAuthUser(response.user);
      setMe(response);
    } catch (requestError) {
      setMe(null);
      setError(requestError instanceof Error ? requestError.message : "用户中心加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMe();
  }, []);

  return (
    <main className="mx-auto min-h-[calc(100vh-180px)] max-w-7xl px-5 py-6 md:px-8 md:py-8">
      <section className="panel-shell mb-6 rounded-[30px] p-8">
        <Typography.Title className="!mb-3 !text-4xl !text-ink">用户中心</Typography.Title>
        <Typography.Paragraph className="!mb-0 !text-base !leading-8 !text-ink-soft">
          这里汇总当前登录账号的基本信息、积分余额和常用入口。后续管理后台、资料组协作和 AI 工具权限也会从这里延展。
        </Typography.Paragraph>
      </section>

      <section className="mb-6 flex flex-wrap gap-3">
        <Button type="primary" icon={<ReloadOutlined />} onClick={() => void loadMe()} loading={loading}>
          刷新信息
        </Button>
        <Button href="/documents/new" icon={<FileAddOutlined />}>
          上传文档
        </Button>
        <Button href="/me/documents" icon={<UserOutlined />}>
          我的文档
        </Button>
        <Button href="/me/groups" icon={<FolderOpenOutlined />}>
          我的资料组
        </Button>
        <Button href="/me/coins" icon={<DollarOutlined />}>
          积分中心
        </Button>
        <Button
          icon={<LogoutOutlined />}
          onClick={() => {
            removeStoredAccessToken();
            window.location.href = "/";
          }}
        >
          退出登录
        </Button>
      </section>

      {error ? <Alert className="mb-6" type="warning" showIcon message={error} /> : null}

      {me ? (
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card variant="borderless" className="panel-shell rounded-[28px]" loading={loading}>
            <Typography.Title level={3} className="!mb-4 !text-2xl !text-ink">
              账号信息
            </Typography.Title>
            <Descriptions column={1} labelStyle={{ width: 110 }}>
              <Descriptions.Item label="用户名">{me.user.username}</Descriptions.Item>
              <Descriptions.Item label="昵称">{me.user.nickname}</Descriptions.Item>
              <Descriptions.Item label="邮箱">{me.user.email ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="状态">{me.user.status ?? "active"}</Descriptions.Item>
              <Descriptions.Item label="管理员">{me.user.is_admin ? "是" : "否"}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card variant="borderless" className="panel-shell rounded-[28px]" loading={loading}>
            <Typography.Title level={3} className="!mb-4 !text-2xl !text-ink">
              快速概览
            </Typography.Title>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[20px] bg-[#f4f8ff] px-5 py-5">
                <div className="mb-2 text-sm text-[#7184a0]">当前余额</div>
                <div className="text-3xl font-semibold text-[#205bc7]">{me.coin_account?.balance ?? 0}</div>
              </div>
              <div className="rounded-[20px] bg-[#f8faf1] px-5 py-5">
                <div className="mb-2 text-sm text-[#7184a0]">累计获得</div>
                <div className="text-3xl font-semibold text-[#2f7c40]">{me.coin_account?.total_earned ?? 0}</div>
              </div>
              <div className="rounded-[20px] bg-[#fff7ef] px-5 py-5">
                <div className="mb-2 text-sm text-[#7184a0]">累计消耗</div>
                <div className="text-3xl font-semibold text-[#cf6f19]">{me.coin_account?.total_spent ?? 0}</div>
              </div>
            </div>

            <Space wrap className="!mt-5">
              <Button type="primary" href="/documents/new">
                去上传文档
              </Button>
              <Button href="/me/documents">管理我的文档</Button>
              <Button href="/me/groups">进入资料组</Button>
              {me.user.is_admin ? <Button href="/admin">进入管理后台</Button> : null}
            </Space>
          </Card>
        </div>
      ) : (
        !loading && (
          <Card variant="borderless" className="panel-shell rounded-[28px]">
            <Empty description="还没有加载到用户中心数据，请先登录。" />
          </Card>
        )
      )}
    </main>
  );
}
