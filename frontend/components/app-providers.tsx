"use client";

import type { ReactNode } from "react";
import { App as AntdApp, ConfigProvider } from "antd";

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#2563eb",
          colorInfo: "#2563eb",
          colorLink: "#2563eb",
          colorSuccess: "#16a34a",
          colorWarning: "#d97706",
          colorError: "#dc2626",
          borderRadius: 16,
          fontFamily:
            '"IBM Plex Sans","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif',
          colorText: "#17314c",
          colorTextSecondary: "#6b7e98",
        },
        components: {
          Button: {
            borderRadius: 14,
            controlHeight: 42,
            controlHeightLG: 46,
            primaryShadow: "none",
          },
          Card: {
            borderRadiusLG: 24,
          },
          Input: {
            borderRadius: 14,
            controlHeight: 44,
          },
          Select: {
            borderRadius: 14,
            controlHeight: 44,
          },
        },
      }}
    >
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  );
}
