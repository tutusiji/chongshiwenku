"use client";

import type { ReactNode } from "react";
import { Typography } from "antd";

type FormPageShellProps = {
  title: string;
  description: string;
  asideTitle: string;
  asideDescription: string;
  children: ReactNode;
};

export function FormPageShell({
  title,
  description,
  asideTitle,
  asideDescription,
  children,
}: FormPageShellProps) {
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-6 md:px-8 md:py-8">
      <div className="mb-5">
        <a className="inline-flex items-center rounded-full border border-[#d8c8b0] bg-white/70 px-4 py-2 text-sm text-ink" href="/">
          返回首页
        </a>
      </div>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="panel-shell rounded-[30px] p-8">
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-teal/12 text-2xl text-accent-teal">
            <span className="i-lucide-panel-right-open" />
          </div>
          <Typography.Title className="!mb-4 !text-4xl !leading-tight !text-ink">{title}</Typography.Title>
          <Typography.Paragraph className="!mb-0 !text-base !leading-8 !text-ink-soft">
            {description}
          </Typography.Paragraph>
        </div>

        <div className="panel-shell rounded-[30px] p-8">
          <Typography.Title level={3} className="!mb-3 !text-2xl !text-ink">
            {asideTitle}
          </Typography.Title>
          <Typography.Paragraph className="!mb-6 !text-base !leading-7 !text-ink-soft">
            {asideDescription}
          </Typography.Paragraph>
          {children}
        </div>
      </section>
    </main>
  );
}
