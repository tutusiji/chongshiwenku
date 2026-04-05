# 崇实文库前端

当前前端采用 `Next.js + React + Ant Design + UnoCSS`。

首版骨架目标：

- 提供统一的用户端与管理端承载层
- 集成 Ant Design 组件体系
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
├─ components/           # 业务组件
├─ public/               # 静态资源
├─ .env.example          # 环境变量示例
├─ package.json          # 前端依赖与脚本
└─ uno.config.ts         # UnoCSS 配置
```
