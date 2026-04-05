# 崇实文库前端

当前前端采用 `Next.js + React + Ant Design + Ant Design Icons + UnoCSS`。

首版骨架目标：

- 提供统一的用户端与管理端承载层
- 集成 Ant Design 组件体系
- 全站表单统一采用 Ant Design Form
- 图标优先使用 Ant Design Icons，额外 SVG 图标可由 UnoCSS Icons 扩展
- 集成 UnoCSS 原子化样式与图标能力
- 提供一个可继续扩展的首页雏形

## 本地启动

```bash
npm install
npm run dev
```

## 目录结构

```text
frontend
├─ app/                  # App Router 页面入口
├─ assets/               # 图片、SVG、视频等静态资源
├─ components/           # 业务组件
├─ public/               # 静态资源
├─ .env.example          # 环境变量示例
├─ package.json          # 前端依赖与脚本
└─ uno.config.ts         # UnoCSS 配置
```

## 当前约定

- 注册、登录以及后续所有业务表单统一使用 Ant Design `Form`
- 业务图标优先使用 `@ant-design/icons`
- 扩展图标可使用 UnoCSS Icons
- 静态资源统一放在 `assets/images`、`assets/svg`、`assets/videos`
