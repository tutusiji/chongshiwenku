"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Card, Descriptions, Space, Table, Typography } from "antd";
import { DollarOutlined, LogoutOutlined, ReloadOutlined } from "@ant-design/icons";
import { apiBaseUrl, getStoredAccessToken, removeStoredAccessToken, requestJson } from "@/lib/api";

type MeResponse = {
  user: {
    username: string;
    nickname: string;
    email: string | null;
    created_at: string;
  };
  coin_account: {
    balance: number;
    total_earned: number;
    total_spent: number;
  } | null;
};

type CoinLedgerItem = {
  id: string;
  change_amount: number;
  balance_after: number;
  source_type: string;
  remark: string | null;
  created_at: string;
};

type CoinLedgerResponse = {
  items: CoinLedgerItem[];
};

type CheckinResponse = {
  checkin_date: string;
  reward_coins: number;
  balance: number;
  message: string;
};

const sourceLabelMap: Record<string, string> = {
  register_bonus: "注册奖励",
  daily_checkin_reward: "每日签到",
  upload_reward: "上传奖励",
  document_coin_spend: "文档投币支出",
  document_coin_income: "文档投币收入",
  admin_adjustment: "管理员调整",
};

export function CoinCenter() {
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [ledgerItems, setLedgerItems] = useState<CoinLedgerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    const storedToken = getStoredAccessToken();
    setToken(storedToken);

    if (!storedToken) {
      setError("当前还没有登录令牌，请先去登录页完成登录。");
      setMe(null);
      setLedgerItems([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const headers = { Authorization: `Bearer ${storedToken}` };
      const [meData, ledgerData] = await Promise.all([
        requestJson<MeResponse>("/me", { headers }),
        requestJson<CoinLedgerResponse>("/me/coin-ledgers", { headers }),
      ]);
      setMe(meData);
      setLedgerItems(ledgerData.items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "加载积分信息失败");
      setMe(null);
      setLedgerItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleCheckin = async () => {
    if (!token) {
      setError("请先登录后再签到。");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await requestJson<CheckinResponse>("/me/checkins", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "签到失败");
      setLoading(false);
    }
  };

  const handleLogout = () => {
    removeStoredAccessToken();
    setToken(null);
    setMe(null);
    setLedgerItems([]);
    setError("已清除本地登录令牌。");
  };

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-5 py-6 md:px-8 md:py-8">
      <section className="mb-6 panel-shell rounded-[30px] p-8">
        <Typography.Title className="!mb-3 !text-4xl !text-ink">积分中心</Typography.Title>
        <Typography.Paragraph className="!mb-0 !text-base !leading-8 !text-ink-soft">
          当前页面已经接上真实后端接口。注册后会得到 100 币，登录后可以在这里查看余额、流水并执行每日签到。
          当前接口基于本地开发库运行，后续切到 PostgreSQL 后业务代码无需重写。
        </Typography.Paragraph>
      </section>

      <section className="mb-6 flex flex-wrap gap-3">
        <Button type="primary" icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>
          刷新数据
        </Button>
        <Button icon={<DollarOutlined />} onClick={() => void handleCheckin()} loading={loading}>
          每日签到
        </Button>
        <Button icon={<LogoutOutlined />} onClick={handleLogout}>
          清除本地令牌
        </Button>
        <Button href="/auth/login">去登录</Button>
        <Button href="/auth/register">去注册</Button>
      </section>

      {error ? <Alert type="warning" showIcon className="mb-6" message={error} /> : null}

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card variant="borderless" className="panel-shell rounded-[30px]">
          <Typography.Title level={3} className="!mb-4 !text-2xl !text-ink">
            账户信息
          </Typography.Title>
          {me ? (
            <Descriptions column={1} labelStyle={{ width: 120 }}>
              <Descriptions.Item label="用户名">{me.user.username}</Descriptions.Item>
              <Descriptions.Item label="昵称">{me.user.nickname}</Descriptions.Item>
              <Descriptions.Item label="邮箱">{me.user.email ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="当前余额">{me.coin_account?.balance ?? 0}</Descriptions.Item>
              <Descriptions.Item label="累计获得">{me.coin_account?.total_earned ?? 0}</Descriptions.Item>
              <Descriptions.Item label="累计消耗">{me.coin_account?.total_spent ?? 0}</Descriptions.Item>
              <Descriptions.Item label="API 地址">{apiBaseUrl}</Descriptions.Item>
            </Descriptions>
          ) : (
            <Typography.Paragraph className="!mb-0 !text-ink-soft">
              当前未加载到账户信息，请先登录。
            </Typography.Paragraph>
          )}
        </Card>

        <Card variant="borderless" className="panel-shell rounded-[30px]">
          <Typography.Title level={3} className="!mb-4 !text-2xl !text-ink">
            积分流水
          </Typography.Title>
          <Table<CoinLedgerItem>
            rowKey="id"
            pagination={false}
            loading={loading}
            dataSource={ledgerItems}
            columns={[
              {
                title: "类型",
                dataIndex: "source_type",
                key: "source_type",
                render: (value: string) => sourceLabelMap[value] ?? value,
              },
              {
                title: "变动",
                dataIndex: "change_amount",
                key: "change_amount",
              },
              {
                title: "余额",
                dataIndex: "balance_after",
                key: "balance_after",
              },
              {
                title: "备注",
                dataIndex: "remark",
                key: "remark",
                render: (value: string | null) => value ?? "-",
              },
            ]}
          />
        </Card>
      </div>
    </main>
  );
}
