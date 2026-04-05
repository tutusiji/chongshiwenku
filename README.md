# 崇实文库

崇实文库是一个面向校园、机构与学习社群的多用户文档知识库系统，产品定位接近“百度文库 + 组内资料空间”。

当前仓库已补充以下核心文档，便于后续进入原型设计、数据库设计、接口开发与前后端联调：

- [需求文档](docs/requirements.md)
- [架构设计文档](docs/architecture.md)
- [数据库设计文档](docs/database-design.md)

## 本阶段目标

首版聚焦以下能力：

- 多用户注册、登录与个人资料管理
- 文档上传、下载、在线阅读
- 自定义资料组，例如课件组、文档组、考研组
- 文档与组的细粒度权限控制
- 阅读量、点赞、投币、签到与积分激励
- 支持 PDF、Word、Excel、PPT 等常见文件格式

## 当前仓库结构

```text
.
├─ docs/                 # 需求、架构、数据库设计文档
├─ frontend/             # Next.js + React + Ant Design + UnoCSS 前端骨架
│  └─ assets/            # image / svg / video 等静态资源目录
├─ backend/              # FastAPI 后端骨架与核心领域模型
└─ infra/                # 本地开发基础设施配置
```

## 建议技术路线

- 前端：Next.js + React + Ant Design + Ant Design Icons + UnoCSS + UnoCSS Icons
- 后端：Python + FastAPI
- 数据库：PostgreSQL
- 缓存与异步任务：Redis
- 对象存储：S3 兼容存储，开发环境可使用 MinIO
- 文档预览转换：LibreOffice Headless + PDF 预览链路

## 已补充内容

- 完成需求文档，明确角色、功能边界、互动机制和权限模式
- 完成架构设计文档，明确单体后端 + 异步任务的首版方案
- 完成数据库设计文档，明确核心表、枚举、索引和积分流水模型
- 初始化前端工程骨架
- 初始化后端工程骨架
- 初始化本地开发基础设施编排文件
- 明确前端表单统一使用 Ant Design Form
- 明确图标系统以 Ant Design Icons 为主，UnoCSS Icons 作为补充

## 前端约定

- 注册、登录以及后续所有业务表单统一使用 Ant Design 的 `Form` 组件体系实现
- 图标优先使用 Ant Design Icons
- 额外 SVG 图标可通过 UnoCSS Icons 扩展，资源统一归档在 `frontend/assets/svg`
- 静态资源目录按类型划分为 `frontend/assets/images`、`frontend/assets/svg`、`frontend/assets/videos`

## 本地开发建议

### 1. 启动基础设施

```bash
docker compose -f infra/docker-compose.dev.yml up -d
```

### 2. 启动后端

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -e .[dev]
uvicorn app.main:app --reload --port 8000
```

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
```

## 当前积分规则

- 用户注册成功后赠送 100 币
- 用户每日签到成功后增加 2 币
- 用户上传文档成功后增加 10 币
- 用户可对他人文档进行投币
- V1 默认不允许用户给自己的文档投币

## 下一步建议

1. 细化 Alembic 迁移脚本与初始化种子数据
2. 开始实现注册登录、积分账户、签到与组管理接口
3. 接入对象存储、Redis 和异步转换任务
4. 完成上传、点赞、投币、阅读量统计与预览链路
