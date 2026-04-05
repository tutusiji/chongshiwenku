import type { ReactNode } from "react";
import { LeftOutlined } from "@ant-design/icons";
import { Button, Card, Typography } from "antd";

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
        <Button icon={<LeftOutlined />} href="/">
          返回首页
        </Button>
      </div>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card bordered={false} className="panel-shell rounded-[30px]" styles={{ body: { padding: 32 } }}>
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-teal/12 text-2xl text-accent-teal">
            <span className="i-lucide-panel-right-open" />
          </div>
          <Typography.Title className="!mb-4 !text-4xl !leading-tight !text-ink">{title}</Typography.Title>
          <Typography.Paragraph className="!mb-0 !text-base !leading-8 !text-ink-soft">
            {description}
          </Typography.Paragraph>
        </Card>

        <Card bordered={false} className="panel-shell rounded-[30px]" styles={{ body: { padding: 32 } }}>
          <Typography.Title level={3} className="!mb-3 !text-2xl !text-ink">
            {asideTitle}
          </Typography.Title>
          <Typography.Paragraph className="!mb-6 !text-base !leading-7 !text-ink-soft">
            {asideDescription}
          </Typography.Paragraph>
          {children}
        </Card>
      </section>
    </main>
  );
}
