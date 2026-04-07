import type { ReactNode } from "react";
import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { AppProviders } from "@/components/app-providers";
import { SiteChrome } from "@/components/site-chrome";
import "@unocss/reset/tailwind.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "崇实文库",
  description: "面向校园与学习社群的多用户文档知识库系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <AntdRegistry>
          <AppProviders>
            <SiteChrome>{children}</SiteChrome>
          </AppProviders>
        </AntdRegistry>
      </body>
    </html>
  );
}
