import { Alert, Button, Card, Empty, Space, Tag, Typography } from "antd";
import { FileSearchOutlined, HomeOutlined, ReloadOutlined } from "@ant-design/icons";
import { formatFileSize, type DocumentSummary } from "@/lib/documents";
import { visibilityLabelMap } from "@/lib/groups";

export const dynamic = "force-dynamic";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
    category?: string;
  }>;
};

async function searchDocuments(keyword: string, category: string | undefined) {
  try {
    const params = new URLSearchParams();
    params.set("limit", "36");
    if (keyword.trim()) {
      params.set("q", keyword.trim());
    }
    if (category?.trim()) {
      params.set("category", category.trim());
    }

    const response = await fetch(`${apiBaseUrl}/documents/discover?${params.toString()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        items: [] as DocumentSummary[],
        error: "搜索结果加载失败",
      };
    }

    return {
      items: ((await response.json()) as { items: DocumentSummary[] }).items,
      error: null,
    };
  } catch {
    return {
      items: [] as DocumentSummary[],
      error: "搜索结果加载失败",
    };
  }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const resolvedSearchParams = await searchParams;
  const keyword = resolvedSearchParams.q ?? "";
  const category = resolvedSearchParams.category;
  const { items, error } = await searchDocuments(keyword, category);

  return (
    <main className="mx-auto min-h-[calc(100vh-180px)] max-w-7xl px-5 py-6 md:px-8 md:py-8">
      <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[#dbe4ef] bg-white px-5 py-4">
        <Space wrap>
          <Tag color="blue">搜索结果</Tag>
          {keyword.trim() ? <Tag color="geekblue">关键词：{keyword.trim()}</Tag> : <Tag>全部文档</Tag>}
          {category?.trim() ? <Tag color="gold">分类：{category.trim()}</Tag> : null}
        </Space>
        <Typography.Text className="text-[#6b7e98]">共找到 {items.length} 条匹配文档</Typography.Text>
      </section>

      <section className="mb-6 flex flex-wrap gap-3">
        <Button href="/" icon={<HomeOutlined />}>
          返回首页
        </Button>
        <Button href="/search" icon={<ReloadOutlined />}>
          清空筛选
        </Button>
      </section>

      {error ? <Alert className="mb-6" type="warning" showIcon message={error} /> : null}

      {items.length > 0 ? (
        <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <Card
              key={item.id}
              variant="borderless"
              className="panel-shell rounded-[28px]"
              styles={{ body: { padding: 26 } }}
            >
              <Space size={[8, 8]} wrap className="!mb-3">
                <Tag color="blue">{visibilityLabelMap[item.visibility_mode]}</Tag>
                <Tag color="geekblue">{item.file_extension.toUpperCase()}</Tag>
                {item.category ? <Tag>{item.category}</Tag> : null}
              </Space>

              <Typography.Title level={4} className="!mb-3 !text-xl !leading-8 !text-[#17314c]">
                <a href={`/documents/${item.id}`}>{item.title}</a>
              </Typography.Title>
              <Typography.Paragraph className="!mb-4 min-h-[72px] !text-[#667892]">
                {item.summary || "该文档暂无摘要描述。"}
              </Typography.Paragraph>

              <div className="mb-5 grid gap-2 text-sm text-[#687c97]">
                <div>上传者：{item.owner.username}</div>
                <div>文件大小：{formatFileSize(item.file_size)}</div>
                <div>阅读 {item.read_count} · 点赞 {item.like_count} · 投币 {item.coin_count}</div>
              </div>

              <Space wrap>
                <Button type="primary" href={`/documents/${item.id}`} icon={<FileSearchOutlined />}>
                  查看详情
                </Button>
              </Space>
            </Card>
          ))}
        </section>
      ) : (
        <Card variant="borderless" className="panel-shell rounded-[28px]">
          <Empty description="没有找到匹配的文档，可以换个关键词再试试。" />
        </Card>
      )}
    </main>
  );
}
