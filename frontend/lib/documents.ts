import { VisibilityMode, visibilityOptions } from "@/lib/groups";

export type DocumentOwner = {
  id: string;
  username: string;
  nickname: string;
};

export type DocumentSummary = {
  id: string;
  group_id: string | null;
  title: string;
  summary: string | null;
  category: string | null;
  file_name: string;
  file_type: string;
  mime_type: string;
  file_extension: string;
  file_size: number;
  visibility_mode: VisibilityMode;
  status: string;
  preview_status: string;
  allow_download: boolean;
  read_count: number;
  like_count: number;
  coin_count: number;
  download_count: number;
  password_enabled: boolean;
  my_liked: boolean;
  owner: DocumentOwner;
  created_at: string;
  updated_at: string;
};

export type DocumentDetail = DocumentSummary & {
  specific_usernames: string[];
  latest_storage_key: string;
  inline_preview_supported: boolean;
  preview_text_available: boolean;
  preview_strategy: "browser_inline" | "text" | "download_only";
};

export type DocumentListResponse = {
  items: DocumentSummary[];
};

export type DocumentCoinResponse = {
  coin_amount: number;
  my_balance: number;
  document_coin_count: number;
  owner_balance: number;
  message: string;
};

export const documentVisibilityOptions = visibilityOptions;

export const previewStatusLabelMap: Record<string, string> = {
  pending: "待处理",
  processing: "处理中",
  ready: "可预览",
  failed: "处理失败",
};

export function formatFileSize(fileSize: number): string {
  if (fileSize < 1024) {
    return `${fileSize} B`;
  }
  if (fileSize < 1024 * 1024) {
    return `${(fileSize / 1024).toFixed(1)} KB`;
  }
  return `${(fileSize / 1024 / 1024).toFixed(2)} MB`;
}
