"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeftOutlined,
  BookOutlined,
  CalendarOutlined,
  CopyOutlined,
  DownloadOutlined,
  EyeOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  HeartFilled,
  HeartOutlined,
  LockOutlined,
  MoneyCollectOutlined,
  ReloadOutlined,
  UnlockOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Segmented,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from "antd";
import { apiBaseUrl, getStoredAccessToken, requestJson } from "@/lib/api";
import {
  DocumentCoinResponse,
  DocumentDetail,
  DocumentListResponse,
  DocumentSummary,
  formatFileSize,
  previewStatusLabelMap,
} from "@/lib/documents";
import { visibilityLabelMap } from "@/lib/groups";

type DocumentDetailPanelProps = {
  documentId: string;
};

type AccessFormValues = {
  accessPassword: string;
};

type CoinFormValues = {
  coinAmount: number;
};

type PreviewViewMode = "original" | "text";

type PreviewBlock =
  | {
      kind: "heading";
      text: string;
      level: 2 | 3;
    }
  | {
      kind: "list";
      items: string[];
      ordered: boolean;
    }
  | {
      kind: "table";
      rows: string[][];
    }
  | {
      kind: "paragraph";
      text: string;
    };

const previewModeLabelMap: Record<DocumentDetail["preview_strategy"], string> = {
  browser_inline: "页内原文件预览",
  text: "页内文本预览",
  download_only: "仅支持下载查看",
};

const previewViewportClassName = "h-[72vh] min-h-[520px] md:min-h-[680px]";

function buildAccessQuery(accessPassword: string | null): string {
  if (!accessPassword) {
    return "";
  }
  return `?access_password=${encodeURIComponent(accessPassword)}`;
}

function buildRelatedDocumentsPath(category: string | null): string {
  const params = new URLSearchParams();
  params.set("limit", "8");
  if (category?.trim()) {
    params.set("category", category.trim());
  }
  return `/documents/discover?${params.toString()}`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function hasOriginalPreview(detail: DocumentDetail): boolean {
  return detail.preview_strategy === "browser_inline";
}

function hasTextPreview(detail: DocumentDetail): boolean {
  return detail.preview_text_available;
}

function getDefaultPreviewViewMode(detail: DocumentDetail): PreviewViewMode {
  if (detail.preview_strategy === "text") {
    return "text";
  }
  return "original";
}

function buildPreviewModeOptions(detail: DocumentDetail): Array<{ label: string; value: PreviewViewMode }> {
  const options: Array<{ label: string; value: PreviewViewMode }> = [];

  if (hasOriginalPreview(detail)) {
    options.push({
      label: "原文预览",
      value: "original",
    });
  }

  if (hasTextPreview(detail)) {
    options.push({
      label: "文本模式",
      value: "text",
    });
  }

  return options;
}

function isPdfPreview(contentType: string | null, fileExtension: string): boolean {
  return (contentType ?? "").includes("pdf") || fileExtension.toLowerCase() === "pdf";
}

function buildPreviewHint(detail: DocumentDetail, mode: PreviewViewMode): string {
  if (mode === "text") {
    if (detail.file_type === "spreadsheet") {
      return "当前展示的是结构化文本预览，适合快速浏览表格内容并复制关键数据。";
    }
    return "当前展示的是提取后的正文文本，适合连续阅读、搜索关键词和复制内容。";
  }

  if (isPdfPreview(detail.mime_type, detail.file_extension)) {
    return detail.preview_text_available
      ? "当前展示的是 PDF 原件，若浏览器兼容性不佳，可切换到文本模式继续阅读。"
      : "系统已直接加载 PDF 原件，可在当前页滚动查看完整内容。";
  }

  if (detail.mime_type.startsWith("image/")) {
    return "系统已直接加载原始图片内容，可在当前页查看高清预览。";
  }

  return "系统已直接加载原文件，可在当前页滚动预览内容。";
}

function parsePreviewTableRow(line: string): string[] | null {
  const normalizedLine = line.trim();
  if (!normalizedLine) {
    return null;
  }

  const hasTabs = normalizedLine.includes("\t");
  const hasWideSpaces = /\S\s{2,}\S/.test(normalizedLine);
  if (!hasTabs && !hasWideSpaces) {
    return null;
  }

  const cells = (hasTabs ? normalizedLine.split(/\t+/) : normalizedLine.split(/\s{2,}/))
    .map((cell) => cell.trim())
    .filter(Boolean);

  return cells.length >= 2 ? cells : null;
}

function buildPreviewBlocks(text: string): PreviewBlock[] {
  const rawBlocks = text
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return rawBlocks.map((block) => {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const parsedRows = lines
      .map((line) => parsePreviewTableRow(line))
      .filter((row): row is string[] => Array.isArray(row));

    if (parsedRows.length >= 2) {
      const columnCount = parsedRows[0].length;
      if (parsedRows.every((row) => row.length === columnCount)) {
        return {
          kind: "table",
          rows: parsedRows,
        };
      }
    }

    if (lines.length >= 2 && lines.every((line) => /^\d+[\.\u3001\uff0e)]\s*/.test(line))) {
      return {
        kind: "list",
        ordered: true,
        items: lines.map((line) => line.replace(/^\d+[\.\u3001\uff0e)]\s*/, "")),
      };
    }

    if (lines.length >= 2 && lines.every((line) => /^[-*•·]\s*/.test(line))) {
      return {
        kind: "list",
        ordered: false,
        items: lines.map((line) => line.replace(/^[-*•·]\s*/, "")),
      };
    }

    const headingText = lines.join(" ");
    if (lines.length <= 2 && headingText.length <= 32 && !/[。；！？,.]/.test(headingText)) {
      return {
        kind: "heading",
        text: headingText,
        level: headingText.length <= 14 ? 2 : 3,
      };
    }

    return {
      kind: "paragraph",
      text: lines.join("\n"),
    };
  });
}

async function fetchDiscoverDocuments(
  path: string,
  token: string | null,
): Promise<DocumentSummary[]> {
  const response = await requestJson<DocumentListResponse>(path, {
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });
  return response.items;
}

export function DocumentDetailPanel({ documentId }: DocumentDetailPanelProps) {
  const [accessForm] = Form.useForm<AccessFormValues>();
  const [coinForm] = Form.useForm<CoinFormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accessRequired, setAccessRequired] = useState(false);
  const [accessPassword, setAccessPassword] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewNotice, setPreviewNotice] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewContentType, setPreviewContentType] = useState<string | null>(null);
  const [previewViewMode, setPreviewViewMode] = useState<PreviewViewMode>("original");
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedError, setRelatedError] = useState<string | null>(null);
  const [relatedDocuments, setRelatedDocuments] = useState<DocumentSummary[]>([]);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  const loadDetail = async (password: string | null = accessPassword) => {
    const token = getStoredAccessToken();

    setLoading(true);
    setError(null);
    try {
      const query = buildAccessQuery(password);
      const response = await requestJson<DocumentDetail>(`/documents/${documentId}${query}`, {
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : undefined,
      });
      setDetail(response);
      setAccessRequired(false);
      setAccessPassword(password);
    } catch (requestError) {
      const messageText = requestError instanceof Error ? requestError.message : "加载文档详情失败";
      setError(messageText);
      setDetail(null);
      setAccessRequired(messageText.includes("密码"));
    } finally {
      setLoading(false);
    }
  };

  const loadRelatedDocuments = async (category: string | null, excludeId: string) => {
    const token = getStoredAccessToken();
    setRelatedLoading(true);
    setRelatedError(null);

    try {
      let items = await fetchDiscoverDocuments(buildRelatedDocumentsPath(category), token);
      items = items.filter((item) => item.id !== excludeId);

      if (items.length === 0 && category?.trim()) {
        items = await fetchDiscoverDocuments(buildRelatedDocumentsPath(null), token);
        items = items.filter((item) => item.id !== excludeId);
      }

      setRelatedDocuments(items.slice(0, 8));
    } catch (requestError) {
      setRelatedDocuments([]);
      setRelatedError(requestError instanceof Error ? requestError.message : "相关文档加载失败");
    } finally {
      setRelatedLoading(false);
    }
  };

  useEffect(() => {
    void loadDetail(null);
  }, [documentId]);

  useEffect(() => {
    if (!detail || accessRequired) {
      setRelatedDocuments([]);
      setRelatedError(null);
      return;
    }

    void loadRelatedDocuments(detail.category, detail.id);
  }, [accessRequired, detail?.category, detail?.id]);

  useEffect(() => {
    if (!detail || accessRequired) {
      setPreviewNotice(null);
      setPreviewViewMode("original");
      return;
    }

    setPreviewNotice(null);
    setPreviewViewMode(getDefaultPreviewViewMode(detail));
  }, [accessRequired, detail?.id, detail?.preview_strategy]);

  useEffect(() => {
    if (!detail || accessRequired) {
      setPreviewNotice(null);
      setPreviewError(null);
      setPreviewText(null);
      setPreviewContentType(null);
      setPreviewUrl((current) => {
        if (current) {
          window.URL.revokeObjectURL(current);
        }
        return null;
      });
      return;
    }

    let active = true;
    let objectUrl: string | null = null;

    const loadPreview = async () => {
      const token = getStoredAccessToken();
      const canUseOriginalPreview = hasOriginalPreview(detail);
      const canUseTextPreview = hasTextPreview(detail);

      setPreviewLoading(true);
      setPreviewError(null);
      setPreviewText(null);
      setPreviewContentType(null);
      setPreviewUrl((current) => {
        if (current) {
          window.URL.revokeObjectURL(current);
        }
        return null;
      });

      try {
        if (previewViewMode === "original") {
          if (!canUseOriginalPreview) {
            if (canUseTextPreview) {
              setPreviewNotice("当前文件没有稳定的原文页内预览，已自动切换到文本模式。");
              setPreviewViewMode("text");
              return;
            }

            setPreviewError("当前文档暂不支持页内预览，请使用下载按钮查看原文件。");
            return;
          }

          const response = await fetch(
            `${apiBaseUrl}/documents/${documentId}/file?inline=true${accessPassword ? `&access_password=${encodeURIComponent(accessPassword)}` : ""}`,
            {
              headers: token
                ? {
                    Authorization: `Bearer ${token}`,
                  }
                : undefined,
              cache: "no-store",
            },
          );

          if (!response.ok) {
            let detailMessage = "文档内容加载失败";
            try {
              const payload = (await response.json()) as { detail?: string };
              detailMessage = payload.detail ?? detailMessage;
            } catch {
              detailMessage = response.statusText || detailMessage;
            }
            throw new Error(detailMessage);
          }

          const blob = await response.blob();
          objectUrl = window.URL.createObjectURL(blob);

          if (!active) {
            return;
          }

          setPreviewContentType(response.headers.get("content-type") ?? detail.mime_type);
          setPreviewUrl(objectUrl);
          setDetail((current) => (current ? { ...current, read_count: current.read_count + 1 } : current));
          return;
        }

        if (previewViewMode === "text") {
          if (!canUseTextPreview) {
            if (canUseOriginalPreview) {
              setPreviewNotice("当前文件没有可用的文本内容，已自动切换到原文模式。");
              setPreviewViewMode("original");
              return;
            }

            setPreviewError("当前文档暂未生成文本预览，请使用下载按钮查看原文件。");
            return;
          }

          const response = await fetch(
            `${apiBaseUrl}/documents/${documentId}/preview-text${accessPassword ? `?access_password=${encodeURIComponent(accessPassword)}` : ""}`,
            {
              headers: token
                ? {
                    Authorization: `Bearer ${token}`,
                  }
                : undefined,
              cache: "no-store",
            },
          );

          if (!response.ok) {
            let detailMessage = "文档文本预览加载失败";
            try {
              const payload = (await response.json()) as { detail?: string };
              detailMessage = payload.detail ?? detailMessage;
            } catch {
              detailMessage = response.statusText || detailMessage;
            }
            throw new Error(detailMessage);
          }

          const text = await response.text();
          if (!active) {
            return;
          }

          setPreviewText(text);
          setDetail((current) => (current ? { ...current, read_count: current.read_count + 1 } : current));
          return;
        }

        setPreviewError("当前文档暂不支持页内预览，请使用下载按钮查看原文件。");
      } catch (requestError) {
        if (!active) {
          return;
        }

        if (previewViewMode === "original" && canUseTextPreview) {
          setPreviewNotice("原文预览加载失败，已自动切换到文本模式继续阅读。");
          setPreviewViewMode("text");
          return;
        }

        if (previewViewMode === "text" && canUseOriginalPreview) {
          setPreviewNotice("文本模式加载失败，已自动切换到原文模式继续阅读。");
          setPreviewViewMode("original");
          return;
        }

        setPreviewError(requestError instanceof Error ? requestError.message : "文档内容加载失败");
      } finally {
        if (active) {
          setPreviewLoading(false);
        } else if (objectUrl) {
          window.URL.revokeObjectURL(objectUrl);
        }
      }
    };

    void loadPreview();

    return () => {
      active = false;
      if (objectUrl) {
        window.URL.revokeObjectURL(objectUrl);
      }
    };
  }, [
    accessPassword,
    accessRequired,
    detail?.id,
    detail?.mime_type,
    detail?.preview_strategy,
    detail?.preview_text_available,
    documentId,
    previewViewMode,
  ]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setPreviewFullscreen(document.fullscreenElement === previewContainerRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const handleAccessSubmit = async (values: AccessFormValues) => {
    const password = values.accessPassword.trim();
    await loadDetail(password);
  };

  const handleOpenFile = async (inline: boolean) => {
    const token = getStoredAccessToken();
    if (!detail) {
      setError("文档详情尚未加载完成。");
      return;
    }

    const actionKey = inline ? "inline" : "download";
    setActionLoading(actionKey);
    setError(null);

    try {
      const separator = accessPassword ? "&" : "?";
      const response = await fetch(
        `${apiBaseUrl}/documents/${documentId}/file?inline=${inline}${accessPassword ? `${separator}access_password=${encodeURIComponent(accessPassword)}` : ""}`,
        {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : undefined,
          cache: "no-store",
        },
      );

      if (!response.ok) {
        let detailMessage = "文档访问失败";
        try {
          const payload = (await response.json()) as { detail?: string };
          detailMessage = payload.detail ?? detailMessage;
        } catch {
          detailMessage = response.statusText || detailMessage;
        }
        throw new Error(detailMessage);
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);

      if (inline) {
        window.open(objectUrl, "_blank", "noopener,noreferrer");
        messageApi.success("已在新窗口打开文档");
      } else {
        const anchor = window.document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = detail.file_name;
        anchor.click();
        messageApi.success("已开始下载");
      }

      window.setTimeout(() => {
        window.URL.revokeObjectURL(objectUrl);
      }, 60_000);

      await loadDetail(accessPassword);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "访问文档失败");
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleLike = async () => {
    const token = getStoredAccessToken();
    if (!token || !detail) {
      setError("请先登录后再点赞文档。");
      return;
    }

    setActionLoading("like");
    setError(null);
    try {
      const response = await requestJson<{ liked: boolean; like_count: number }>(`/documents/${documentId}/likes`, {
        method: detail.my_liked ? "DELETE" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setDetail({
        ...detail,
        my_liked: response.liked,
        like_count: response.like_count,
      });
      messageApi.success(response.liked ? "点赞成功" : "已取消点赞");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "点赞操作失败");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCoinSubmit = async (values: CoinFormValues) => {
    const token = getStoredAccessToken();
    if (!token || !detail) {
      setError("请先登录后再投币。");
      return;
    }

    setActionLoading("coin");
    setError(null);
    try {
      const response = await requestJson<DocumentCoinResponse>(`/documents/${documentId}/coins`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          coin_amount: values.coinAmount,
        }),
      });
      coinForm.setFieldValue("coinAmount", 1);
      messageApi.success(`${response.message}，你当前余额 ${response.my_balance} 币`);
      await loadDetail(accessPassword);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "投币失败");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      messageApi.success("文档链接已复制");
    } catch {
      messageApi.warning("当前环境不支持自动复制，请手动复制地址栏链接");
    }
  };

  const handleTogglePreviewFullscreen = async () => {
    const previewElement = previewContainerRef.current;
    if (!previewElement) {
      return;
    }

    try {
      if (document.fullscreenElement === previewElement) {
        await document.exitFullscreen();
        return;
      }
      await previewElement.requestFullscreen();
    } catch {
      messageApi.warning("当前浏览器暂不支持全屏预览，可以改用外部打开。");
    }
  };

  const previewModeOptions = detail ? buildPreviewModeOptions(detail) : [];
  const previewBlocks = previewText ? buildPreviewBlocks(previewText) : [];

  return (
    <main className="min-h-screen bg-[#eef2f7] text-[#17314c]">
      {contextHolder}

      <div className="mx-auto max-w-7xl px-5 py-6 md:px-8 md:py-8">
        <section className="mb-5 flex flex-wrap items-center gap-2 text-sm text-[#6f829c]">
          <a href="/" className="hover:text-[#2f6fdb]">
            首页
          </a>
          <span>/</span>
          <span>{detail?.category || "文档详情"}</span>
          {detail ? (
            <>
              <span>/</span>
              <span className="line-clamp-1 max-w-[60ch] text-[#50637f]">{detail.title}</span>
            </>
          ) : null}
        </section>

        <section className="mb-5 flex flex-wrap gap-3">
          <Button icon={<ArrowLeftOutlined />} href="/">
            返回首页
          </Button>
          <Button href="/me/documents">我的文档</Button>
          <Button icon={<ReloadOutlined />} onClick={() => void loadDetail(accessPassword)} loading={loading}>
            刷新详情
          </Button>
          <Button href="/documents/new">继续上传</Button>
        </section>

        {error ? <Alert className="mb-6" type="warning" showIcon message={error} /> : null}

        {accessRequired && !detail ? (
          <Card variant="borderless" className="panel-shell rounded-[30px]">
            <Typography.Title level={3} className="!mb-3 !text-2xl !text-ink">
              这个文档需要访问密码
            </Typography.Title>
            <Typography.Paragraph className="!mb-6 !text-base !leading-8 !text-ink-soft">
              当前文档被设置为密码访问。输入正确密码后，就可以查看文档详情、在线阅读和下载原文件。
            </Typography.Paragraph>

            <Form<AccessFormValues> form={accessForm} layout="vertical" size="large" onFinish={handleAccessSubmit}>
              <Form.Item
                label="访问密码"
                name="accessPassword"
                rules={[
                  { required: true, message: "请输入访问密码" },
                  { min: 4, message: "访问密码至少 4 位" },
                ]}
              >
                <Input.Password prefix={<UnlockOutlined />} placeholder="请输入访问密码" />
              </Form.Item>

              <Form.Item className="!mb-0">
                <Button type="primary" htmlType="submit" icon={<LockOutlined />} loading={loading}>
                  验证并查看
                </Button>
              </Form.Item>
            </Form>
          </Card>
        ) : detail ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section className="min-w-0">
              <div className="overflow-hidden rounded-[30px] border border-[#d9e3f0] bg-white shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
                <div className="border-b border-[#e6edf7] px-6 py-6 md:px-8 md:py-8">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <Tag color="blue">{visibilityLabelMap[detail.visibility_mode]}</Tag>
                    <Tag color="geekblue">{detail.file_extension.toUpperCase()}</Tag>
                    <Tag color={detail.preview_status === "ready" ? "green" : "orange"}>
                      {previewStatusLabelMap[detail.preview_status] ?? detail.preview_status}
                    </Tag>
                    {detail.password_enabled ? (
                      <Tag color="gold" icon={<LockOutlined />}>
                        已启用访问密码
                      </Tag>
                    ) : null}
                  </div>

                  <Typography.Title className="!mb-4 !text-3xl !leading-tight !text-[#16314b] md:!text-4xl">
                    {detail.title}
                  </Typography.Title>

                  <div className="mb-5 flex flex-wrap gap-x-5 gap-y-3 text-sm text-[#697d97]">
                    <span className="flex items-center gap-2">
                      <EyeOutlined />
                      {detail.read_count} 次阅读
                    </span>
                    <span className="flex items-center gap-2">
                      <MoneyCollectOutlined />
                      {detail.coin_count} 个投币
                    </span>
                    <span className="flex items-center gap-2">
                      <HeartOutlined />
                      {detail.like_count} 次点赞
                    </span>
                    <span className="flex items-center gap-2">
                      <UserOutlined />
                      {detail.owner.username}
                    </span>
                    <span className="flex items-center gap-2">
                      <CalendarOutlined />
                      上传于 {formatDateTime(detail.created_at)}
                    </span>
                  </div>

                  <Typography.Paragraph className="!mb-6 !max-w-4xl !text-base !leading-8 !text-[#5f7390]">
                    {detail.summary || "当前文档还没有摘要说明，阅读区已经直接接入真实文档预览。"}
                  </Typography.Paragraph>

                  <Space wrap size={[12, 12]}>
                    <Button
                      type="primary"
                      size="large"
                      icon={<DownloadOutlined />}
                      loading={actionLoading === "download"}
                      onClick={() => void handleOpenFile(false)}
                    >
                      下载文档
                    </Button>
                    <Button
                      size="large"
                      icon={<FullscreenOutlined />}
                      loading={actionLoading === "inline"}
                      onClick={() => void handleOpenFile(true)}
                    >
                      新窗口阅读
                    </Button>
                    <Button size="large" icon={<CopyOutlined />} onClick={() => void handleCopyLink()}>
                      复制链接
                    </Button>
                  </Space>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6edf7] bg-[#f7faff] px-5 py-4">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                    <Space wrap size={[8, 8]}>
                      <Tag color="processing">{previewModeLabelMap[detail.preview_strategy]}</Tag>
                      <Tag color={previewViewMode === "original" ? "blue" : "cyan"}>
                        当前: {previewViewMode === "original" ? "原文模式" : "文本模式"}
                      </Tag>
                      <Tag color="default">{detail.mime_type}</Tag>
                    </Space>
                    {previewModeOptions.length > 1 ? (
                      <Segmented
                        size="middle"
                        options={previewModeOptions}
                        value={previewViewMode}
                        onChange={(value) => {
                          setPreviewNotice(null);
                          setPreviewViewMode(value as PreviewViewMode);
                        }}
                      />
                    ) : null}
                    <span className="text-sm text-[#667b95]">{buildPreviewHint(detail, previewViewMode)}</span>
                  </div>
                  <Space wrap size={[8, 8]}>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={() => void loadDetail(accessPassword)}
                      loading={loading || previewLoading}
                    >
                      重新载入
                    </Button>
                    <Button
                      icon={previewFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                      onClick={() => void handleTogglePreviewFullscreen()}
                    >
                      {previewFullscreen ? "退出全屏" : "全屏预览"}
                    </Button>
                    <Button icon={<EyeOutlined />} onClick={() => void handleOpenFile(true)}>
                      外部打开
                    </Button>
                  </Space>
                </div>

                <div
                  ref={previewContainerRef}
                  className="bg-[linear-gradient(180deg,#f4f7fb_0%,#eef3f9_100%)] p-4 md:p-6"
                >
                  {previewNotice ? (
                    <Alert
                      className="mb-4"
                      type="info"
                      showIcon
                      closable
                      message={previewNotice}
                      onClose={() => setPreviewNotice(null)}
                    />
                  ) : null}

                  {previewLoading ? (
                    <div className={`flex ${previewViewportClassName} items-center justify-center rounded-[26px] border border-[#dae5f3] bg-white`}>
                      <Space direction="vertical" size={18} align="center">
                        <Spin size="large" />
                        <Typography.Text className="text-[#5f7390]">正在加载文档预览内容...</Typography.Text>
                      </Space>
                    </div>
                  ) : previewError ? (
                    <div className={`flex ${previewViewportClassName} items-center rounded-[26px] border border-[#dae5f3] bg-white p-6`}>
                      <Alert
                        type="info"
                        showIcon
                        message={previewError}
                        action={
                          <Button size="small" onClick={() => void handleOpenFile(false)}>
                            下载原文
                          </Button>
                        }
                      />
                    </div>
                  ) : previewUrl ? (
                    previewContentType?.startsWith("image/") ? (
                      <div
                        className={`flex ${previewViewportClassName} items-center justify-center rounded-[26px] border border-[#dbe4f1] bg-[#0f172a] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]`}
                      >
                        <img
                          src={previewUrl}
                          alt={detail.title}
                          className="max-h-full w-auto max-w-full rounded-[18px] object-contain"
                        />
                      </div>
                    ) : isPdfPreview(previewContentType, detail.file_extension) ? (
                      <div className="overflow-hidden rounded-[26px] border border-[#dbe4f1] bg-white shadow-[0_26px_60px_rgba(15,23,42,0.08)]">
                        <object
                          data={previewUrl}
                          type={previewContentType ?? "application/pdf"}
                          className={`${previewViewportClassName} w-full bg-white`}
                        >
                          <div className={`flex ${previewViewportClassName} items-center rounded-[26px] bg-white p-6`}>
                            <Alert
                              type="info"
                              showIcon
                              message="当前浏览器未能直接渲染 PDF，可切换到文本模式继续阅读，或在新窗口打开原文。"
                              action={
                                <Space size={8}>
                                  {detail.preview_text_available ? (
                                    <Button
                                      size="small"
                                      onClick={() => {
                                        setPreviewNotice(null);
                                        setPreviewViewMode("text");
                                      }}
                                    >
                                      切换文本模式
                                    </Button>
                                  ) : null}
                                  <Button size="small" onClick={() => void handleOpenFile(true)}>
                                    新窗口打开
                                  </Button>
                                </Space>
                              }
                            />
                          </div>
                        </object>
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-[26px] border border-[#dbe4f1] bg-white shadow-[0_26px_60px_rgba(15,23,42,0.08)]">
                        <iframe
                          title={`${detail.title}-preview`}
                          src={previewUrl}
                          className={`${previewViewportClassName} w-full bg-white`}
                        />
                      </div>
                    )
                  ) : previewText ? (
                    <div className={`${previewViewportClassName} overflow-auto rounded-[26px] border border-[#dbe4f1] bg-[#edf2f8] p-4 md:p-6`}>
                      <div className="mx-auto max-w-4xl rounded-[20px] border border-[#e5ebf4] bg-white px-6 py-8 shadow-[0_24px_50px_rgba(15,23,42,0.08)] md:px-10 md:py-10">
                        <div className="mb-8 border-b border-[#edf2f8] pb-6">
                          <Typography.Title level={2} className="!mb-3 !text-center !text-4xl !leading-tight !text-[#1957d2]">
                            {detail.title}
                          </Typography.Title>
                          <Typography.Paragraph className="!mb-0 !text-center !text-sm !leading-7 !text-[#7386a0]">
                            当前阅读区展示的是系统自动抽取并整理后的正文内容，更适合连续阅读、搜索和复制。
                          </Typography.Paragraph>
                        </div>
                        <div className="space-y-6">
                          {previewBlocks.length > 0 ? (
                            previewBlocks.map((block, index) => {
                              if (block.kind === "heading") {
                                return (
                                  <Typography.Title
                                    key={`${block.kind}-${index}`}
                                    level={block.level === 2 ? 3 : 4}
                                    className="!mb-0 !text-[#17314c]"
                                  >
                                    {block.text}
                                  </Typography.Title>
                                );
                              }

                              if (block.kind === "list") {
                                const ListTag = block.ordered ? "ol" : "ul";
                                return (
                                  <ListTag
                                    key={`${block.kind}-${index}`}
                                    className="m-0 space-y-2 pl-6 font-serif text-[17px] leading-9 text-[#21364f]"
                                  >
                                    {block.items.map((item, itemIndex) => (
                                      <li key={`${block.kind}-${index}-${itemIndex}`}>{item}</li>
                                    ))}
                                  </ListTag>
                                );
                              }

                              if (block.kind === "table") {
                                const [headerRow, ...bodyRows] = block.rows;
                                const useHeader = detail.file_type === "spreadsheet" && bodyRows.length > 0;

                                return (
                                  <div
                                    key={`${block.kind}-${index}`}
                                    className="overflow-x-auto rounded-[18px] border border-[#dbe4f1] bg-[#fbfdff]"
                                  >
                                    <table className="min-w-full border-collapse text-left text-sm text-[#21364f]">
                                      {useHeader ? (
                                        <thead className="bg-[#eef4ff] text-[#17314c]">
                                          <tr>
                                            {headerRow.map((cell, cellIndex) => (
                                              <th
                                                key={`${block.kind}-${index}-head-${cellIndex}`}
                                                className="border-b border-[#dbe4f1] px-4 py-3 font-semibold"
                                              >
                                                {cell}
                                              </th>
                                            ))}
                                          </tr>
                                        </thead>
                                      ) : null}
                                      <tbody>
                                        {(useHeader ? bodyRows : block.rows).map((row, rowIndex) => (
                                          <tr key={`${block.kind}-${index}-row-${rowIndex}`} className="odd:bg-white even:bg-[#f8fbff]">
                                            {row.map((cell, cellIndex) => (
                                              <td
                                                key={`${block.kind}-${index}-row-${rowIndex}-cell-${cellIndex}`}
                                                className="border-b border-[#e8eef7] px-4 py-3 align-top leading-7"
                                              >
                                                {cell}
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                );
                              }

                              return (
                                <Typography.Paragraph
                                  key={`${block.kind}-${index}`}
                                  className="!mb-0 whitespace-pre-wrap break-words font-serif !text-[17px] !leading-9 !text-[#21364f]"
                                >
                                  {block.text}
                                </Typography.Paragraph>
                              );
                            })
                          ) : (
                            <Typography.Paragraph className="!mb-0 whitespace-pre-wrap break-words font-serif !text-[17px] !leading-9 !text-[#21364f]">
                              {previewText}
                            </Typography.Paragraph>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={`flex ${previewViewportClassName} items-center justify-center rounded-[26px] border border-[#dae5f3] bg-white`}>
                      <Empty description="当前文档暂未生成可直接展示的内容预览。" />
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e6edf7] bg-white px-5 py-4 text-sm text-[#687d98]">
                  <Space wrap size={[10, 10]}>
                    <span className="flex items-center gap-2">
                      <BookOutlined />
                      文件大小 {formatFileSize(detail.file_size)}
                    </span>
                    <span className="flex items-center gap-2">
                      <EyeOutlined />
                      在线预览会累计阅读量
                    </span>
                  </Space>
                  <Space wrap size={[8, 8]}>
                    <Button type="primary" icon={<DownloadOutlined />} onClick={() => void handleOpenFile(false)}>
                      下载文档
                    </Button>
                    <Button icon={<HeartOutlined />} onClick={() => void handleToggleLike()}>
                      {detail.my_liked ? "取消点赞" : "点赞收藏"}
                    </Button>
                  </Space>
                </div>
              </div>
            </section>

            <aside className="space-y-6">
              <Card variant="borderless" className="rounded-[28px] border border-[#dbe4f1] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]" loading={loading}>
                <Typography.Title level={3} className="!mb-4 !text-2xl !text-[#17314c]">
                  文档信息
                </Typography.Title>
                <Descriptions column={1} size="small" labelStyle={{ width: 96, color: "#6a7d95" }}>
                  <Descriptions.Item label="上传者">
                    {detail.owner.username}
                  </Descriptions.Item>
                  <Descriptions.Item label="分类">{detail.category || "-"}</Descriptions.Item>
                  <Descriptions.Item label="文件名">{detail.file_name}</Descriptions.Item>
                  <Descriptions.Item label="文件类型">{detail.file_type}</Descriptions.Item>
                  <Descriptions.Item label="预览方式">{previewModeLabelMap[detail.preview_strategy]}</Descriptions.Item>
                  <Descriptions.Item label="下载量">{detail.download_count}</Descriptions.Item>
                </Descriptions>
              </Card>

              <Card variant="borderless" className="rounded-[28px] border border-[#dbe4f1] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]" loading={loading}>
                <Typography.Title level={3} className="!mb-4 !text-2xl !text-[#17314c]">
                  文档操作
                </Typography.Title>

                <Space direction="vertical" size={12} className="!mb-5 !w-full">
                  <Button
                    type="primary"
                    block
                    icon={<DownloadOutlined />}
                    loading={actionLoading === "download"}
                    onClick={() => void handleOpenFile(false)}
                  >
                    下载原文
                  </Button>
                  <Button
                    block
                    icon={<EyeOutlined />}
                    loading={actionLoading === "inline"}
                    onClick={() => void handleOpenFile(true)}
                  >
                    新窗口阅读
                  </Button>
                  <Button
                    block
                    icon={detail.my_liked ? <HeartFilled /> : <HeartOutlined />}
                    loading={actionLoading === "like"}
                    onClick={() => void handleToggleLike()}
                  >
                    {detail.my_liked ? "取消点赞" : "点赞文档"}
                  </Button>
                </Space>

                <Typography.Title level={4} className="!mb-3 !text-xl !text-[#17314c]">
                  投币支持
                </Typography.Title>
                <Form<CoinFormValues>
                  form={coinForm}
                  layout="vertical"
                  initialValues={{ coinAmount: 1 }}
                  onFinish={handleCoinSubmit}
                >
                  <Form.Item name="coinAmount" rules={[{ required: true, message: "请输入投币数量" }]}>
                    <InputNumber min={1} max={100} precision={0} className="!w-full" prefix={<MoneyCollectOutlined />} />
                  </Form.Item>
                  <Form.Item className="!mb-0">
                    <Button type="primary" htmlType="submit" block loading={actionLoading === "coin"}>
                      投币
                    </Button>
                  </Form.Item>
                </Form>

                <Typography.Paragraph className="!mb-0 !mt-4 !text-sm !leading-7 !text-[#6c7f99]">
                  当前页会优先直接展示文档内容，PDF 以内嵌阅读器展示，Word 类文档以文本提取结果展示。
                </Typography.Paragraph>
              </Card>

              <Card variant="borderless" className="rounded-[28px] border border-[#dbe4f1] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]" loading={relatedLoading}>
                <div className="mb-4 flex items-center justify-between">
                  <Typography.Title level={3} className="!mb-0 !text-2xl !text-[#17314c]">
                    相关文档
                  </Typography.Title>
                  {detail.category ? <Tag color="blue">{detail.category}</Tag> : null}
                </div>

                {relatedError ? <Alert className="mb-4" type="warning" showIcon message={relatedError} /> : null}

                {relatedDocuments.length > 0 ? (
                  <div className="grid gap-3">
                    {relatedDocuments.map((item) => (
                      <a
                        key={item.id}
                        href={`/documents/${item.id}`}
                        className="rounded-[18px] border border-[#e3ebf6] bg-[#fbfdff] px-4 py-4 transition hover:border-[#b8cdf2] hover:bg-[#f6f9ff]"
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Tag color="geekblue">{item.file_extension.toUpperCase()}</Tag>
                          <Tag>{item.category || "未分类"}</Tag>
                        </div>
                        <Typography.Title level={5} className="!mb-2 !line-clamp-2 !text-base !leading-7 !text-[#17314c]">
                          {item.title}
                        </Typography.Title>
                        <Typography.Paragraph className="!mb-2 !line-clamp-2 !text-sm !leading-6 !text-[#6b7e98]">
                          {item.summary || "这个文档暂无摘要描述。"}
                        </Typography.Paragraph>
                        <div className="text-xs text-[#8ca0ba]">
                          阅读 {item.read_count} · 点赞 {item.like_count} · {formatFileSize(item.file_size)}
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无可推荐的相关文档" />
                )}
              </Card>
            </aside>
          </div>
        ) : (
          <Card variant="borderless" className="panel-shell rounded-[30px]" loading={loading}>
            <Typography.Paragraph className="!mb-0 !text-base !leading-8 !text-ink-soft">
              当前未加载到文档详情，请检查登录状态或文档权限后重试。
            </Typography.Paragraph>
          </Card>
        )}
      </div>
    </main>
  );
}
