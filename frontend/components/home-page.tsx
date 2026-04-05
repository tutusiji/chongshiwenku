"use client";

import { Button, Card, Col, Divider, Progress, Row, Space, Tag, Typography } from "antd";
import { FormOutlined, LoginOutlined, TrophyOutlined } from "@ant-design/icons";

const featureCards = [
  {
    icon: "i-lucide-library-big",
    title: "多格式阅读",
    description: "围绕 PDF、Word、Excel、PPT 构建统一上传、转换和在线阅读链路。",
  },
  {
    icon: "i-lucide-shield-check",
    title: "细粒度权限",
    description: "文档和资料组统一支持公开、密码访问、仅自己、组内可见和指定用户可见。",
  },
  {
    icon: "i-lucide-users-round",
    title: "组内协作",
    description: "通过课件组、文档组、考研组等自定义分组，让资料沉淀和共享都更顺手。",
  },
  {
    icon: "i-lucide-coins",
    title: "积分激励",
    description: "注册赠币、每日签到、上传奖励与文档投币共同构成首版活跃体系。",
  },
];

const phaseItems = [
  "积分账户、签到、点赞与投币",
  "账号体系与组管理",
  "文档上传、版本与预览链路",
  "ACL 权限模型与访问判定",
  "后台管理、审计日志与搜索能力"
];

export function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-5 py-6 md:px-8 md:py-8">
      <section className="panel-shell relative overflow-hidden px-6 py-8 md:px-10 md:py-12">
        <div className="absolute -right-16 top-0 h-44 w-44 rounded-full bg-accent-teal/12 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-52 w-52 rounded-full bg-accent-gold/18 blur-3xl" />

        <div className="relative z-1 grid gap-8 lg:grid-cols-[1.5fr_0.9fr]">
          <div className="flex flex-col gap-6">
            <Space size={[8, 12]} wrap>
              <Tag bordered={false} className="rounded-full px-4 py-1 text-sm text-ink">
                崇实文库 V1 Scaffold
              </Tag>
              <Tag color="gold">Next.js + FastAPI</Tag>
              <Tag color="cyan">PostgreSQL + Redis</Tag>
            </Space>

            <div className="max-w-3xl">
              <Typography.Title className="!mb-4 !text-4xl !leading-tight !text-ink md:!text-6xl">
                面向校园与资料社群的
                <br />
                文档知识库平台
              </Typography.Title>
              <Typography.Paragraph className="!mb-0 !text-lg !leading-8 !text-ink-soft md:!text-xl">
                这是一套围绕资料上传、在线阅读、权限分享和组内协作构建的首版工程骨架。
                我们已经先把需求、架构、数据库设计和前后端目录约定铺好，接下来可以直接进入接口与页面开发。
              </Typography.Paragraph>
            </div>

            <Space size="middle" wrap>
              <Button type="primary" size="large" icon={<LoginOutlined />} href="/auth/login">
                登录表单
              </Button>
              <Button size="large" icon={<FormOutlined />} href="/auth/register">
                注册表单
              </Button>
              <Button size="large" icon={<TrophyOutlined />} href="/groups/new">
                创建资料组
              </Button>
              <Button size="large" href="/me/coins">
                积分中心
              </Button>
            </Space>
          </div>

          <Card
            variant="borderless"
            className="rounded-[24px] bg-[#132238] text-white shadow-[0_22px_80px_rgba(19,34,56,0.28)]"
            styles={{ body: { padding: 28 } }}
          >
            <Typography.Text className="!text-white/70">首版建设进度</Typography.Text>
            <div className="mt-5 flex flex-col gap-5">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm text-white/85">
                  <span>需求与架构基线</span>
                  <span>100%</span>
                </div>
                <Progress percent={100} showInfo={false} strokeColor="#c7842a" trailColor="rgba(255,255,255,0.12)" />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-sm text-white/85">
                  <span>数据库与模型骨架</span>
                  <span>70%</span>
                </div>
                <Progress percent={70} showInfo={false} strokeColor="#42b3b5" trailColor="rgba(255,255,255,0.12)" />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-sm text-white/85">
                  <span>上传、互动与权限业务实现</span>
                  <span>20%</span>
                </div>
                <Progress percent={20} showInfo={false} strokeColor="#efb655" trailColor="rgba(255,255,255,0.12)" />
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {featureCards.map((item) => (
          <Card
            key={item.title}
            variant="borderless"
            className="panel-shell rounded-[26px]"
            styles={{ body: { padding: 28 } }}
          >
            <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-gold/12 text-2xl text-accent-rust">
              <span className={item.icon} />
            </div>
            <Typography.Title level={3} className="!mb-3 !text-2xl !text-ink">
              {item.title}
            </Typography.Title>
            <Typography.Paragraph className="!mb-0 !text-base !leading-7 !text-ink-soft">
              {item.description}
            </Typography.Paragraph>
          </Card>
        ))}
      </section>

      <section className="panel-shell rounded-[30px] px-6 py-8 md:px-8">
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={10}>
            <Typography.Title className="section-title !mb-4">首版模块清单</Typography.Title>
            <Typography.Paragraph className="!mb-0 !text-base !leading-8 !text-ink-soft">
              当前骨架已经把产品的关键路径固定下来。接下来最值得优先实现的，是账号体系、资料组、文档上传、
              异步预览转换，以及围绕组与文档展开的访问控制。
            </Typography.Paragraph>
          </Col>
          <Col xs={24} lg={14}>
            <div className="grid gap-3">
              {phaseItems.map((item, index) => (
                <div
                  key={item}
                  className="flex items-center gap-4 rounded-2xl border border-[#d8c8b0] bg-white/70 px-4 py-4"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#132238] text-sm font-semibold text-white">
                    {index + 1}
                  </div>
                  <span className="text-[15px] text-ink">{item}</span>
                </div>
              ))}
            </div>
          </Col>
        </Row>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Card variant="borderless" className="panel-shell rounded-[28px]" styles={{ body: { padding: 28 } }}>
          <Typography.Title className="section-title !mb-4">信息架构方向</Typography.Title>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-[#f7efe2] p-5">
              <Typography.Title level={4} className="!mb-2 !text-xl !text-ink">
                用户端
              </Typography.Title>
              <Typography.Paragraph className="!mb-0 !text-ink-soft">
                首页、搜索、文档详情、在线阅读、我的上传、我的组、个人中心、积分中心、签到。
              </Typography.Paragraph>
            </div>
            <div className="rounded-2xl bg-[#eef7f6] p-5">
              <Typography.Title level={4} className="!mb-2 !text-xl !text-ink">
                管理端
              </Typography.Title>
              <Typography.Paragraph className="!mb-0 !text-ink-soft">
                用户管理、文档管理、组管理、审计日志、转换任务监控、系统配置。
              </Typography.Paragraph>
            </div>
          </div>
          <Divider />
          <Typography.Paragraph className="!mb-0 !text-base !leading-8 !text-ink-soft">
            资料组将作为核心组织结构，把“课件组、文档组、考研组”这类使用习惯直接映射到产品模型里。
          </Typography.Paragraph>
        </Card>

        <Card
          variant="borderless"
          className="rounded-[28px] border-0 bg-[#3c2a21] text-white shadow-[0_28px_90px_rgba(60,42,33,0.26)]"
          styles={{ body: { padding: 28 } }}
        >
          <Typography.Title className="!mb-4 !text-3xl !text-white">下一步优先级</Typography.Title>
          <div className="grid gap-3">
            <div className="rounded-2xl bg-white/10 px-4 py-4">
              <div className="mb-1 text-sm text-white/70">P0</div>
              <div className="text-base text-white">注册登录、用户模型、JWT 或会话体系、初始积分</div>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-4">
              <div className="mb-1 text-sm text-white/70">P1</div>
              <div className="text-base text-white">签到、积分流水、点赞投币与资料组权限边界校验</div>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-4">
              <div className="mb-1 text-sm text-white/70">P2</div>
              <div className="text-base text-white">对象存储上传、异步转码、PDF 阅读器接入</div>
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}
