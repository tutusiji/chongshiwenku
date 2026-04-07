export type VisibilityMode =
  | "public"
  | "password"
  | "owner_only"
  | "group_members"
  | "specific_users";

export type GroupRole = "owner" | "admin" | "member";

export type GroupOwner = {
  id: string;
  username: string;
  nickname: string;
};

export type GroupMemberUser = {
  id: string;
  username: string;
  nickname: string;
  email: string | null;
};

export type GroupMember = {
  role: GroupRole;
  joined_at: string;
  user: GroupMemberUser;
};

export type GroupSummary = {
  id: string;
  parent_group_id?: string | null;
  name: string;
  slug: string;
  description: string | null;
  cover_url: string | null;
  visibility_mode: VisibilityMode;
  status: string;
  allow_member_invite: boolean;
  member_count: number;
  my_role: GroupRole | null;
  password_enabled: boolean;
  owner: GroupOwner;
  created_at: string;
  updated_at: string;
};

export type GroupDetail = GroupSummary & {
  members: GroupMember[];
  specific_users: GroupMemberUser[];
};

export type GroupListResponse = {
  items: GroupSummary[];
};

export type GroupTreeNode = {
  title: string;
  value: string;
  key: string;
  children?: GroupTreeNode[];
};

export const visibilityOptions = [
  { label: "公开", value: "public" },
  { label: "密码访问", value: "password" },
  { label: "仅自己可见", value: "owner_only" },
  { label: "组内可见", value: "group_members" },
  { label: "指定用户可见", value: "specific_users" },
] satisfies Array<{ label: string; value: VisibilityMode }>;

export const visibilityLabelMap: Record<VisibilityMode, string> = {
  public: "公开",
  password: "密码访问",
  owner_only: "仅自己可见",
  group_members: "组内可见",
  specific_users: "指定用户可见",
};

export const groupRoleLabelMap: Record<GroupRole, string> = {
  owner: "拥有者",
  admin: "管理员",
  member: "成员",
};

export function isGroupManager(role: GroupRole | null): boolean {
  return role === "owner" || role === "admin";
}

export function normalizeUsernameTags(values: string[] | undefined): string[] {
  if (!values) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function buildGroupTree(groups: GroupSummary[]): GroupTreeNode[] {
  const nodeMap = new Map<string, GroupTreeNode>();
  const rootNodes: GroupTreeNode[] = [];

  for (const group of groups) {
    nodeMap.set(group.id, {
      title: group.name,
      value: group.id,
      key: group.id,
      children: [],
    });
  }

  for (const group of groups) {
    const currentNode = nodeMap.get(group.id);
    if (!currentNode) {
      continue;
    }

    const parentId = group.parent_group_id ?? null;
    if (parentId && nodeMap.has(parentId) && parentId !== group.id) {
      nodeMap.get(parentId)?.children?.push(currentNode);
      continue;
    }

    rootNodes.push(currentNode);
  }

  const sortNodes = (nodes: GroupTreeNode[]) => {
    nodes.sort((left, right) => left.title.localeCompare(right.title, "zh-CN"));
    for (const node of nodes) {
      if (node.children?.length) {
        sortNodes(node.children);
      } else {
        delete node.children;
      }
    }
  };

  sortNodes(rootNodes);
  return rootNodes;
}
