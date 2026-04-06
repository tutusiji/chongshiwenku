"use client";

import { useEffect, useState } from "react";
import {
  FileSearchOutlined,
  EyeOutlined,
  FileAddOutlined,
  DownloadOutlined,
  LikeOutlined,
  MoneyCollectOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Empty, Space, Tag, Typography, message } from "antd";
import { apiBaseUrl, getStoredAccessToken, requestJson } from "@/lib/api";
import { DocumentListResponse, DocumentSummary, formatFileSize, previewStatusLabelMap } from "@/lib/documents";
import { visibilityLabelMap } from "@/lib/groups";

export function MyDocumentsPanel() {
  const [messageApi, contextHolder] = message.useMessage();
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = async () => {
    const token = getStoredAccessToken();
    if (!token) {
      setError("当前还没有登录令牌，请先登录后再查看我的文档。");
      setDocuments([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await requestJson<DocumentListResponse>("/documents?scope=my", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setDocuments(response.items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "加载文档列表失败");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDocuments();
  }, []);

  const handleFileAction = async (document: DocumentSummary, inline: boolean) => {
    const token = getStoredAccessToken();
    if (!token) {
      setError("请先登录后再访问文档。");
      return;
    }

    const currentActionKey = `${document.id}:${inline ? "inline" : "download"}`;
    setActionKey(currentActionKey);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/documents/${document.id}/file?inline=${inline}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        let detail = "文档访问失败";
        try {
          const payload = (await response.json()) as { detail?: string };
          detail = payload.detail ?? detail;
        } catch {
          detail = response.statusText || detail;
        }
        throw new Error(detail);
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);

      if (inline) {
        window.open(objectUrl, "_blank", "noopener,noreferrer");
        messageApi.success("已记录一次在线阅读");
      } else {
        const anchor = window.document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = document.file_name;
        anchor.click();
        messageApi.success("下载开始");
      }

      window.setTimeout(() => {
        window.URL.revokeObjectURL(objectUrl);
      }, 60_000);

      await loadDocuments();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "访问文档失败");
    } finally {
      setActionKey(null);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-6 md:px-8 md:py-8">
      {contextHolder}

      <section className="panel-shell mb-6 rounded-[30px] p-8">
        <Typography.Title className="!mb-3 !text-4xl !text-ink">我的文档</Typography.Title>
        <Typography.Paragraph className="!mb-0 !text-base !leading-8 !text-ink-soft">
          当前页面已经接上真实文档接口。你可以查看自己上传的资料、在线打开原文件、下载原文，并直接看到阅读量、
          点赞数、投币数与下载数这些首版互动指标。
        </Typography.Paragraph>
      </section>

      <section className="mb-6 flex flex-wrap gap-3">
        <Button type="primary" icon={<FileAddOutlined />} href="/documents/new">
          上传文档
        </Button>
        <Button icon={<ReloadOutlined />} onClick={() => void loadDocuments()} loading={loading}>
          刷新列表
        </Button>
        <Button href="/auth/login">去登录</Button>
      </section>

      {error ? <Alert className="mb-6" type="warning" showIcon message={error} /> : null}

      {documents.length === 0 && !loading ? (
        <Card variant="borderless" className="panel-shell rounded-[30px]">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="还没有上传文档，可以先发一份课件或学习笔记。"
          >
            <Button type="primary" href="/documents/new" icon={<FileAddOutlined />}>
              去上传
            </Button>
          </Empty>
        </Card>
      ) : (
        <section className="grid gap-5 lg:grid-cols-2">
          {documents.map((document) => {
            const readActionKey = `${document.id}:inline`;
            const downloadActionKey = `${document.id}:download`;

            return (
              <Card
                key={document.id}
                variant="borderless"
                className="panel-shell rounded-[28px]"
                loading={loading}
                styles={{ body: { padding: 28 } }}
              >
                <Space size={[8, 12]} wrap className="!mb-4">
                  <Tag color="blue">{visibilityLabelMap[document.visibility_mode]}</Tag>
                  <Tag color="geekblue">{document.file_extension.toUpperCase()}</Tag>
                  <Tag color={document.preview_status === "ready" ? "green" : "orange"}>
                    {previewStatusLabelMap[document.preview_status] ?? document.preview_status}
                  </Tag>
                </Space>

                <Typography.Title level={3} className="!mb-3 !text-2xl !text-ink">
                  {document.title}
                </Typography.Title>
                <Typography.Paragraph className="!mb-5 min-h-[72px] !text-base !leading-7 !text-ink-soft">
                  {document.summary || "这个文档还没有填写摘要，可以继续补充。"}
                </Typography.Paragraph>

                <div className="mb-5 grid gap-3 text-sm text-ink-soft md:grid-cols-2">
                  <div className="rounded-2xl bg-white/70 px-4 py-4">文件名：{document.file_name}</div>
                  <div className="rounded-2xl bg-white/70 px-4 py-4">文件大小：{formatFileSize(document.file_size)}</div>
                  <div className="rounded-2xl bg-white/70 px-4 py-4">阅读量：{document.read_count}</div>
                  <div className="rounded-2xl bg-white/70 px-4 py-4">下载量：{document.download_count}</div>
                  <div className="rounded-2xl bg-white/70 px-4 py-4">
                    <LikeOutlined /> {document.like_count}
                  </div>
                  <div className="rounded-2xl bg-white/70 px-4 py-4">
                    <MoneyCollectOutlined /> {document.coin_count}
                  </div>
                </div>

                <Space wrap>
                  <Button href={`/documents/${document.id}`} icon={<FileSearchOutlined />}>
                    查看详情
                  </Button>
                  <Button
                    type="primary"
                    icon={<EyeOutlined />}
                    loading={actionKey === readActionKey}
                    onClick={() => void handleFileAction(document, true)}
                  >
                    在线阅读
                  </Button>
                  <Button
                    icon={<DownloadOutlined />}
                    loading={actionKey === downloadActionKey}
                    onClick={() => void handleFileAction(document, false)}
                  >
                    下载原文
                  </Button>
                </Space>
              </Card>
            );
          })}
        </section>
      )}
    </main>
  );
}
