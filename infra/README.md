# 本地开发基础设施

当前提供 `docker-compose.dev.yml`，用于快速启动本地开发需要的基础设施：

- PostgreSQL
- Redis
- MinIO

## 启动

```bash
docker compose -f infra/docker-compose.dev.yml up -d
```

## 访问入口

- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`
