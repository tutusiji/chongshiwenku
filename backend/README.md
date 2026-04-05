# 崇实文库后端

当前后端采用 `FastAPI + SQLAlchemy + PostgreSQL + Redis + Celery` 方案，首版先提供：

- API 入口与健康检查接口
- 环境配置加载
- 数据库会话管理
- 核心领域模型骨架

## 本地启动

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -e .[dev]
uvicorn app.main:app --reload --port 8000
```

## 目录结构

```text
backend
├─ app/
│  ├─ api/               # 路由层
│  ├─ core/              # 配置与通用能力
│  ├─ db/                # 数据库会话与模型注册
│  ├─ models/            # SQLAlchemy 领域模型
│  └─ schemas/           # Pydantic 模式
├─ tests/                # 最小测试
├─ .env.example          # 环境变量示例
└─ pyproject.toml        # Python 项目配置
```
