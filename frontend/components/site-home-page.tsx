"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AppstoreOutlined,
  BookOutlined,
  FileAddOutlined,
  FireOutlined,
  InfoCircleOutlined,
  LoginOutlined,
  ReadOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { getStoredAccessToken, requestJson } from "@/lib/api";
import { DocumentListResponse, DocumentSummary, formatFileSize, previewStatusLabelMap } from "@/lib/documents";
import { visibilityLabelMap } from "@/lib/groups";

type SiteHomePageProps = {
  initialDocuments?: DocumentSummary[];
  initialError?: string | null;
};

type HomeSearchValues = {
  keyword?: string;
};

const defaultCategories = ["全部", "考研", "课件", "教育", "法律", "财经", "AI", "医学", "报告", "文档"];

const quickActions = [
  {
    title: "在线阅读",
    description: "支持公开文档直接在线打开，自动累计阅读量。",
    icon: <ReadOutlined />,
  },
  {
    title: "资料组协作",
    description: "课件组、文档组、考研组都可以沉淀资料与成员关系。",
    icon: <TeamOutlined />,
  },
  {
    title: "上传激励",
    description: "上传文档立即获得 10 币，支持后续点赞与投币互动。",
    icon: <FileAddOutlined />,
  },
  {
    title: "站点介绍",
    description: "如果想看技术方案与功能结构，可以进入功能介绍页。",
    icon: <InfoCircleOutlined />,
  },
];

function buildDiscoverPath(keyword: string, category: string): string {
  const params = new URLSearchParams();
  params.set("limit", "24");

  if (keyword.trim()) {
    params.set("q", keyword.trim());
  }

  if (category && category !== "全部") {
    params.set("category", category);
  }

  return `/documents/discover?${params.toString()}`;
}

function sortByCreatedAt(items: DocumentSummary[]): DocumentSummary[] {
  return [...items].sort(
    (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );
}

function sortByReadCount(items: DocumentSummary[]): DocumentSummary[] {
  return [...items].sort((left, right) => right.read_count - left.read_count || right.coin_count - left.coin_count);
}

export function SiteHomePage({ initialDocuments = [], initialError = null }: SiteHomePageProps) {
  const [searchForm] = Form.useForm<HomeSearchValues>();
  const [documents, setDocuments] = useState<DocumentSummary[]>(initialDocuments);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [activeCategory, setActiveCategory] = useState("全部");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const loadDocuments = async (keyword: string, category: string) => {
    const token = getStoredAccessToken();
    setLoading(true);
    setError(null);

    try {
      const response = await requestJson<DocumentListResponse>(buildDiscoverPath(keyword, category), {
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : undefined,
      });
      setDocuments(response.items);
      setIsLoggedIn(Boolean(token));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "加载首页文档失败");
      setDocuments([]);
      setIsLoggedIn(Boolean(token));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = getStoredAccessToken();
    setIsLoggedIn(Boolean(token));

    if (token || initialDocuments.length === 0) {
      void loadDocuments("", "全部");
    }
  }, [initialDocuments.length]);

  const topDocuments = useMemo(() => sortByReadCount(documents).slice(0, 8), [documents]);
  const latestDocuments = useMemo(() => sortByCreatedAt(documents).slice(0, 6), [documents]);
  const categoryOptions = useMemo(() => {
    const dynamicCategories = Array.from(
      new Set(
        documents
          .map((item) => item.category?.trim())
          .filter((item): item is string => Boolean(item)),
      ),
    );
    return Array.from(new Set([...defaultCategories, ...dynamicCategories]));
  }, [documents]);

  const categorySections = useMemo(() => {
    const grouped = new Map<string, DocumentSummary[]>();
    for (const item of sortByReadCount(documents)) {
      const key = item.category?.trim() || "未分类";
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      const current = grouped.get(key);
      if (current && current.length < 4) {
        current.push(item);
      }
    }
    return Array.from(grouped.entries()).slice(0, 3);
  }, [documents]);

  const handleSearch = async (values: HomeSearchValues) => {
    await loadDocuments(values.keyword ?? "", activeCategory);
  };

  const handleCategoryChange = async (category: string) => {
    setActiveCategory(category);
    await loadDocuments(searchForm.getFieldValue("keyword") ?? "", category);
  };

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-ink">
      <section className="border-b border-[#dbe5f2] bg-white/92">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 text-sm text-[#52637c] md:px-8">
          <div>崇实文库正在建设中：公开文档、资料组协作、积分激励已进入首版可体验阶段。</div>
          <Space size={12}>
            <a href="/about">功能介绍</a>
            <a href="/auth/login">登录</a>
            <a href="/auth/register">注册</a>
          </Space>
        </div>
      </section>

      <header className="border-b border-[#d8e1ef] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-6 md:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2a7de1] text-2xl font-semibold text-white">
              崇
            </div>
            <div>
              <Typography.Title level={2} className="!mb-1 !text-3xl !font-semibold !text-[#15304b]">
                崇实文库
              </Typography.Title>
              <Typography.Paragraph className="!mb-0 !text-sm !text-[#667892]">
                面向学习、课件与资料沉淀的多用户文档知识平台
              </Typography.Paragraph>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-end">
            <Form<HomeSearchValues> form={searchForm} className="w-full max-w-3xl" onFinish={handleSearch}>
              <div className="flex gap-3">
                <Form.Item name="keyword" className="!mb-0 flex-1">
                  <Input
                    size="large"
                    placeholder="搜索公开文档标题、摘要或分类"
                    prefix={<SearchOutlined className="text-[#7a8ba5]" />}
                  />
                </Form.Item>
                <Button type="primary" htmlType="submit" size="large" loading={loading}>
                  搜索
                </Button>
                <Button size="large" icon={<ReloadOutlined />} onClick={() => void loadDocuments(searchForm.getFieldValue("keyword") ?? "", activeCategory)}>
                  刷新
                </Button>
              </div>
            </Form>
          </div>
        </div>
      </header>

      <section className="bg-[#235ca8] text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-7 gap-y-3 px-5 py-4 md:px-8">
          {categoryOptions.slice(0, 10).map((category) => (
            <button
              key={category}
              type="button"
              className={`cursor-pointer border-0 bg-transparent p-0 text-sm transition ${
                activeCategory === category ? "font-semibold text-[#ffd85e]" : "text-white/90"
              }`}
              onClick={() => void handleCategoryChange(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      <section className="bg-[linear-gradient(135deg,#2f80ed_0%,#2d6cc7_48%,#214f97_100%)] text-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8 md:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:py-10">
          <div className="rounded-[32px] border border-white/14 bg-white/8 p-8 backdrop-blur-sm">
            <Typography.Title className="!mb-4 !text-5xl !leading-tight !text-white">
              首页就是文档广场，
              <br />
              不是功能介绍页
            </Typography.Title>
            <Typography.Paragraph className="!mb-6 !text-lg !leading-8 !text-white/82">
              这里集中展示公开文档、分类入口、最新上传和热门内容。功能介绍已经独立到了 `/about`，
              首页从现在开始就是更接近文库产品的真实门户页面。
            </Typography.Paragraph>

            <div className="grid gap-4 md:grid-cols-2">
              {quickActions.map((item) => (
                <div key={item.title} className="rounded-[24px] border border-white/14 bg-white/10 px-5 py-5">
                  <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-xl">
                    {item.icon}
                  </div>
                  <Typography.Title level={4} className="!mb-2 !text-xl !text-white">
                    {item.title}
                  </Typography.Title>
                  <Typography.Paragraph className="!mb-0 !text-white/72">
                    {item.description}
                  </Typography.Paragraph>
                </div>
              ))}
            </div>
          </div>

          <Card
            variant="borderless"
            className="rounded-[32px] border border-white/14 bg-white text-[#17314c] shadow-[0_22px_60px_rgba(0,0,0,0.16)]"
            styles={{ body: { padding: 28 } }}
          >
            <Typography.Title level={3} className="!mb-2 !text-2xl !text-[#17314c]">
              {isLoggedIn ? "继续使用崇实文库" : "快速进入"}
            </Typography.Title>
            <Typography.Paragraph className="!mb-5 !text-[#667892]">
              {isLoggedIn
                ? "你已经登录，可以直接去上传文档、管理资料组或查看积分中心。"
                : "还没登录也可以浏览公开文档；登录后则可以上传、点赞、投币和创建资料组。"}
            </Typography.Paragraph>

            <div className="grid gap-3">
              <Button type="primary" size="large" icon={<FileAddOutlined />} href="/documents/new">
                我要上传
              </Button>
              <Button size="large" icon={<BookOutlined />} href="/me/documents">
                我的文档
              </Button>
              <Button size="large" icon={<TeamOutlined />} href="/me/groups">
                我的资料组
              </Button>
              {!isLoggedIn ? (
                <>
                  <Button size="large" icon={<LoginOutlined />} href="/auth/login">
                    登录
                  </Button>
                  <Button size="large" icon={<UserAddOutlined />} href="/auth/register">
                    注册
                  </Button>
                </>
              ) : null}
            </div>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        {error ? <Alert className="mb-6" type="warning" showIcon message={error} /> : null}

        <div className="mb-8 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <Card variant="borderless" className="rounded-[28px] border border-[#d8e1ef] bg-white" styles={{ body: { padding: 28 } }}>
            <Typography.Title level={3} className="!mb-4 !text-2xl !text-[#17314c]">
              文档分类
            </Typography.Title>
            <div className="grid gap-3 md:grid-cols-3">
              {categoryOptions.slice(0, 9).map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`flex items-center justify-between rounded-2xl border px-4 py-4 text-left transition ${
                    activeCategory === category
                      ? "border-[#2a7de1] bg-[#edf5ff] text-[#17416b]"
                      : "border-[#e2e8f3] bg-[#fbfcff] text-[#556983]"
                  }`}
                  onClick={() => void handleCategoryChange(category)}
                >
                  <span>{category}</span>
                  <AppstoreOutlined />
                </button>
              ))}
            </div>
          </Card>

          <Card variant="borderless" className="rounded-[28px] border border-[#d8e1ef] bg-white" styles={{ body: { padding: 28 } }}>
            <Typography.Title level={3} className="!mb-4 !text-2xl !text-[#17314c]">
              当前视图
            </Typography.Title>
            <div className="grid gap-3 text-sm text-[#667892]">
              <div className="rounded-2xl bg-[#f6f9ff] px-4 py-4">
                筛选分类：{activeCategory}
              </div>
              <div className="rounded-2xl bg-[#f6f9ff] px-4 py-4">
                文档数量：{documents.length}
              </div>
              <div className="rounded-2xl bg-[#f6f9ff] px-4 py-4">
                展示范围：公开文档
              </div>
            </div>
          </Card>
        </div>

        {loading ? (
          <div className="flex min-h-[220px] items-center justify-center">
            <Spin size="large" />
          </div>
        ) : documents.length === 0 ? (
          <Card variant="borderless" className="rounded-[28px] border border-[#d8e1ef] bg-white">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="当前还没有符合条件的公开文档。你可以先上传一份公开资料来填充首页内容。"
            >
              <Space wrap>
                <Button type="primary" href="/documents/new" icon={<FileAddOutlined />}>
                  上传公开文档
                </Button>
                <Button href="/about">查看功能介绍</Button>
              </Space>
            </Empty>
          </Card>
        ) : (
          <div className="flex flex-col gap-8">
            <section>
              <div className="mb-4 flex items-center justify-between">
                <Typography.Title level={3} className="!mb-0 !text-2xl !text-[#17314c]">
                  热门文档
                </Typography.Title>
                <Tag color="gold" icon={<FireOutlined />}>
                  按阅读量排序
                </Tag>
              </div>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                {topDocuments.map((document) => (
                  <Card
                    key={document.id}
                    variant="borderless"
                    className="rounded-[26px] border border-[#dbe4f1] bg-white shadow-[0_14px_36px_rgba(15,23,42,0.06)]"
                    styles={{ body: { padding: 22 } }}
                  >
                    <Space size={[8, 8]} wrap className="!mb-3">
                      <Tag color="blue">{visibilityLabelMap[document.visibility_mode]}</Tag>
                      <Tag color="geekblue">{document.file_extension.toUpperCase()}</Tag>
                    </Space>
                    <Typography.Title level={4} className="!mb-3 !text-xl !leading-8 !text-[#17314c]">
                      <a href={`/documents/${document.id}`}>{document.title}</a>
                    </Typography.Title>
                    <Typography.Paragraph className="!mb-4 min-h-[66px] !text-[#667892]">
                      {document.summary || "这个文档暂无摘要描述。"}
                    </Typography.Paragraph>
                    <div className="mb-4 grid gap-2 text-sm text-[#6a7d95]">
                      <div>分类：{document.category || "未分类"}</div>
                      <div>文件大小：{formatFileSize(document.file_size)}</div>
                      <div>阅读 {document.read_count} · 点赞 {document.like_count} · 投币 {document.coin_count}</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <Space size={8}>
                        <Avatar size="small">{document.owner.nickname.slice(0, 1)}</Avatar>
                        <span className="text-sm text-[#667892]">{document.owner.nickname}</span>
                      </Space>
                      <Button type="link" href={`/documents/${document.id}`} className="!px-0">
                        查看详情
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <Card variant="borderless" className="rounded-[28px] border border-[#dbe4f1] bg-white" styles={{ body: { padding: 28 } }}>
                <Typography.Title level={3} className="!mb-4 !text-2xl !text-[#17314c]">
                  最新上传
                </Typography.Title>
                <div className="grid gap-4">
                  {latestDocuments.map((document) => (
                    <div
                      key={document.id}
                      className="rounded-[22px] border border-[#e4ebf5] bg-[#fbfdff] px-5 py-5"
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Tag color="processing">{previewStatusLabelMap[document.preview_status] ?? document.preview_status}</Tag>
                        <Tag>{document.category || "未分类"}</Tag>
                      </div>
                      <Typography.Title level={4} className="!mb-2 !text-xl !text-[#17314c]">
                        <a href={`/documents/${document.id}`}>{document.title}</a>
                      </Typography.Title>
                      <Typography.Paragraph className="!mb-3 !text-[#667892]">
                        {document.summary || "上传者暂未填写摘要。"}
                      </Typography.Paragraph>
                      <div className="text-sm text-[#6c7f98]">
                        {document.owner.nickname} · {formatFileSize(document.file_size)} · {new Date(document.created_at).toLocaleDateString("zh-CN")}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card variant="borderless" className="rounded-[28px] border border-[#dbe4f1] bg-white" styles={{ body: { padding: 28 } }}>
                <Typography.Title level={3} className="!mb-4 !text-2xl !text-[#17314c]">
                  分类精选
                </Typography.Title>
                <div className="grid gap-4">
                  {categorySections.map(([category, items]) => (
                    <div key={category} className="rounded-[22px] border border-[#e4ebf5] bg-[#fbfdff] px-5 py-5">
                      <Typography.Title level={4} className="!mb-3 !text-xl !text-[#17314c]">
                        {category}
                      </Typography.Title>
                      <div className="grid gap-3">
                        {items.map((item) => (
                          <a
                            key={item.id}
                            href={`/documents/${item.id}`}
                            className="flex items-start justify-between gap-3 rounded-xl bg-white px-4 py-3 text-sm text-[#4b607b]"
                          >
                            <span className="line-clamp-1 flex-1">{item.title}</span>
                            <span className="text-[#8da0b9]">{item.file_extension.toUpperCase()}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
