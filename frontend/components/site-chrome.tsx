"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  BookOutlined,
  DatabaseOutlined,
  DownOutlined,
  FileAddOutlined,
  FolderOpenOutlined,
  HomeOutlined,
  LogoutOutlined,
  SearchOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Avatar, Button, Dropdown, Input, Space, Typography } from "antd";
import { usePathname, useRouter } from "next/navigation";
import {
  getStoredAccessToken,
  getStoredAuthUser,
  removeStoredAccessToken,
  requestJson,
  setStoredAuthUser,
  type StoredAuthUser,
} from "@/lib/api";

type SiteChromeProps = {
  children: ReactNode;
};

type MeResponse = {
  user: StoredAuthUser;
};

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

const publicNavItems: NavItem[] = [
  { href: "/", label: "首页", icon: <HomeOutlined /> },
  { href: "/search", label: "搜索", icon: <SearchOutlined /> },
  { href: "/documents/new", label: "上传", icon: <FileAddOutlined /> },
  { href: "/me/documents", label: "文档", icon: <BookOutlined /> },
  { href: "/me/groups", label: "资料组", icon: <FolderOpenOutlined /> },
  { href: "/about", label: "功能介绍", icon: <DatabaseOutlined /> },
];

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteChrome({ children }: SiteChromeProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [authUser, setAuthUser] = useState<StoredAuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const currentKeyword = new URLSearchParams(window.location.search).get("q") ?? "";
    setKeyword(currentKeyword);
  }, [pathname]);

  useEffect(() => {
    const syncAuth = async () => {
      const token = getStoredAccessToken();
      const cachedUser = getStoredAuthUser();

      if (!token) {
        setAuthUser(null);
        setAuthReady(true);
        return;
      }

      if (cachedUser) {
        setAuthUser(cachedUser);
      }

      try {
        const response = await requestJson<MeResponse>("/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setStoredAuthUser(response.user);
        setAuthUser(response.user);
      } catch {
        removeStoredAccessToken();
        setAuthUser(null);
      } finally {
        setAuthReady(true);
      }
    };

    void syncAuth();

    const handleStorage = () => {
      setAuthUser(getStoredAuthUser());
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [pathname]);

  const navItems = useMemo(() => {
    if (authUser?.is_admin) {
      return [...publicNavItems, { href: "/admin", label: "管理后台", icon: <DatabaseOutlined /> }];
    }
    return publicNavItems;
  }, [authUser?.is_admin]);

  const userMenuItems = useMemo(
    () => [
      {
        key: "me",
        label: "用户中心",
        onClick: () => router.push("/me"),
      },
      {
        key: "documents",
        label: "我的文档",
        onClick: () => router.push("/me/documents"),
      },
      {
        key: "groups",
        label: "我的资料组",
        onClick: () => router.push("/me/groups"),
      },
      {
        key: "coins",
        label: "积分中心",
        onClick: () => router.push("/me/coins"),
      },
      ...(authUser?.is_admin
        ? [
            {
              key: "admin",
              label: "管理后台",
              onClick: () => router.push("/admin"),
            },
          ]
        : []),
      {
        type: "divider" as const,
      },
      {
        key: "logout",
        label: "退出登录",
        icon: <LogoutOutlined />,
        onClick: () => {
          removeStoredAccessToken();
          setAuthUser(null);
          router.push("/");
          router.refresh();
        },
      },
    ],
    [authUser?.is_admin, router],
  );

  const handleSearch = () => {
    const normalizedKeyword = keyword.trim();
    if (!normalizedKeyword) {
      router.push("/search");
      return;
    }
    router.push(`/search?q=${encodeURIComponent(normalizedKeyword)}`);
  };

  return (
    <div className="min-h-screen">
      <div className="border-b border-[#d9e3f0] bg-[#173f7a] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-2 text-sm md:px-8">
          <span className="text-white/78">
            崇实文库已进入可联调阶段，支持上传、在线阅读、资料组协作、积分互动与后台管理。
          </span>
          <span className="text-white/78">
            {authReady && authUser ? `当前登录：${authUser.username}` : "欢迎来到崇实文库"}
          </span>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-[#d9e3f0] bg-white/96 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 md:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-6">
            <a href="/" className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#235fc9_0%,#1b4ea4_100%)] text-xl font-semibold text-white shadow-[0_14px_30px_rgba(37,99,235,0.28)]">
                崇
              </div>
              <div>
                <Typography.Title level={3} className="!mb-0 !text-2xl !text-[#17314c]">
                  崇实文库
                </Typography.Title>
                <Typography.Text className="text-[#7386a0]">文档、课件与资料组知识平台</Typography.Text>
              </div>
            </a>

            <nav className="hidden items-center gap-1 lg:flex">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    isNavActive(pathname, item.href)
                      ? "bg-[#edf4ff] font-medium text-[#205bc7]"
                      : "text-[#526782] hover:bg-[#f4f7fb] hover:text-[#17314c]"
                  }`}
                >
                  <Space size={6}>
                    {item.icon}
                    {item.label}
                  </Space>
                </a>
              ))}
            </nav>
          </div>

          <div className="flex flex-col gap-3 lg:min-w-[430px] lg:max-w-[560px] lg:flex-1 lg:flex-row lg:items-center lg:justify-end">
            <Input.Search
              allowClear
              enterButton="搜索"
              size="large"
              placeholder="搜索文档标题、摘要、分类"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onSearch={() => handleSearch()}
            />

            <div className="flex items-center justify-end gap-3">
              {authReady && authUser ? (
                <>
                  <Button type="primary" href="/documents/new" icon={<FileAddOutlined />}>
                    上传
                  </Button>
                  <a
                    href="/me"
                    className="flex items-center gap-3 rounded-full border border-[#d9e3f0] bg-white px-3 py-2 text-left transition hover:border-[#bdd2f3] hover:bg-[#f8fbff]"
                  >
                    <Avatar size="small" className="bg-[#235fc9]">
                      {authUser.username.slice(0, 1).toUpperCase()}
                    </Avatar>
                    <div className="hidden text-sm leading-5 md:block">
                      <div className="font-medium text-[#17314c]">{authUser.username}</div>
                      <div className="text-[#7b8da5]">{authUser.is_admin ? "管理员中心" : "用户中心"}</div>
                    </div>
                  </a>
                  <Dropdown menu={{ items: userMenuItems }} trigger={["click"]}>
                    <Button icon={<DownOutlined />} aria-label="打开用户菜单" />
                  </Dropdown>
                </>
              ) : (
                <>
                  <Button href="/auth/login">登录</Button>
                  <Button type="primary" href="/auth/register">
                    注册
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-[#ecf1f7] px-5 py-3 lg:hidden md:px-8">
          <div className="mx-auto flex max-w-7xl flex-wrap gap-2">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  isNavActive(pathname, item.href)
                    ? "bg-[#edf4ff] font-medium text-[#205bc7]"
                    : "bg-white text-[#526782] hover:bg-[#f4f7fb]"
                }`}
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </header>

      {children}

      <footer className="mt-12 border-t border-[#dbe4ef] bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8 text-sm text-[#687c97] md:px-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Typography.Title level={4} className="!mb-2 !text-xl !text-[#17314c]">
              崇实文库
            </Typography.Title>
            <Typography.Paragraph className="!mb-0 !max-w-2xl !text-sm !leading-7 !text-[#687c97]">
              一个更接近传统文库网站形态的学习资料平台。现在已经支持公共导航、上传下载、在线阅读、资料组协作、
              积分互动、用户中心与后台管理能力的持续扩展。
            </Typography.Paragraph>
          </div>
          <div className="grid gap-2 md:justify-self-end">
            <a href="/">返回首页</a>
            <a href="/search">搜索文档</a>
            <a href="/documents/new">上传资料</a>
            <a href="/me">用户中心</a>
            <a href="/about">功能介绍</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
