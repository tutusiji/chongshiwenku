# 崇实文库

崇实文库是一个面向校园、机构与学习社群的多用户文档知识库系统，产品定位接近“百度文库 + 组内资料空间”。

当前仓库已先补充以下核心文档，便于后续进入原型设计、数据库设计与前后端开发：

- [需求文档](docs/requirements.md)
- [架构设计文档](docs/architecture.md)
- [数据库设计文档](docs/database-design.md)

## 本阶段目标

首版聚焦以下能力：

- 多用户注册、登录与资料管理
- 文档上传、下载、在线阅读
- 自定义资料组，例如课件组、文档组、考研组
- 文档与组的细粒度权限控制
- 支持 PDF、Word、Excel、PPT 等常见文件格式

## 当前仓库结构

```text
.
├─ docs/                 # 需求、架构、数据库设计文档
├─ frontend/             # Next.js + React + Ant Design + UnoCSS 前端骨架
├─ backend/              # FastAPI 后端骨架与核心领域模型
└─ infra/                # 本地开发基础设施配置
```

## 建议技术路线

- 前端：Next.js + React + Ant Design + UnoCSS + UnoCSS Icons
- 后端：Python + FastAPI
- 数据库：PostgreSQL
- 缓存与异步任务：Redis
- 对象存储：S3 兼容存储（开发环境可使用 MinIO）
- 文档预览转换：LibreOffice Headless + PDF 预览链路

## 已补充内容

- 完成需求文档，明确角色、功能边界、权限模式和业务流程
- 完成架构设计文档，明确单体后端 + 异步任务的首版方案
- 完成数据库设计文档，明确核心表、枚举、索引和权限规则
- 初始化前端工程骨架
- 初始化后端工程骨架
- 初始化本地开发基础设施编排文件

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

## 下一步建议

1. 细化数据库迁移脚本与初始化种子数据
2. 开始实现注册登录、组管理、文档上传与权限模块
3. 接入对象存储、Redis 和异步转换任务
4. 设计页面原型与管理后台信息架构
