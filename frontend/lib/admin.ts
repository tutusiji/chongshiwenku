import { VisibilityMode } from "@/lib/groups";

export type AdminOverview = {
  users_count: number;
  documents_count: number;
  groups_count: number;
  public_documents_count: number;
  ai_provider_count: number;
  enabled_ai_provider_count: number;
};

export type AdminUser = {
  id: string;
  username: string;
  nickname: string;
  email: string | null;
  phone: string | null;
  status: string;
  is_admin: boolean;
  document_count: number;
  group_count: number;
  coin_balance: number;
  created_at: string;
  updated_at: string;
};

export type AdminUserListResponse = {
  items: AdminUser[];
};

export type AdminDocument = {
  id: string;
  title: string;
  summary: string | null;
  category: string | null;
  owner_username: string;
  group_name: string | null;
  file_name: string;
  file_extension: string;
  file_size: number;
  page_count: number | null;
  visibility_mode: VisibilityMode;
  status: string;
  preview_status: string;
  allow_download: boolean;
  read_count: number;
  like_count: number;
  coin_count: number;
  download_count: number;
  created_at: string;
  updated_at: string;
};

export type AdminDocumentListResponse = {
  items: AdminDocument[];
};

export type AdminAIProvider = {
  id: string;
  name: string;
  provider_code: string;
  provider_type: string;
  base_url: string;
  wire_api: string;
  model_name: string;
  reasoning_effort: string | null;
  api_key_masked: string;
  is_enabled: boolean;
  is_default: boolean;
  usage_count: number;
  last_used_at: string | null;
  last_error: string | null;
  notes: string | null;
  extra_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type AdminAIProviderListResponse = {
  items: AdminAIProvider[];
};

export const adminUserStatusOptions = [
  { label: "待激活", value: "pending" },
  { label: "正常", value: "active" },
  { label: "禁用", value: "disabled" },
  { label: "封禁", value: "banned" },
];

export const adminDocumentStatusOptions = [
  { label: "正常", value: "active" },
  { label: "隐藏", value: "hidden" },
  { label: "归档", value: "archived" },
  { label: "删除", value: "deleted" },
];

export const aiWireApiOptions = [
  { label: "Responses API", value: "responses" },
  { label: "Chat Completions", value: "chat_completions" },
];
