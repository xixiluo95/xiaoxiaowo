# 小小我 · AI 情绪剧场

黑客松 MVP 工程骨架：H5（React + Vite + TS + Ant Design Mobile）+ FastAPI + SQLite，单容器部署。

## 目录

```text
web/                 H5 前端（业务代码归望舒）
api/                 FastAPI 后端（业务代码归司南）
assets/emotions/     五种情绪视频素材占位：calm / joy / anger / sadness / fear
data/                SQLite 数据文件（运行时生成，不入库）
docs/                架构与流程 mermaid 图源码
```

## 本地开发

```bash
# 前端
cd web && npm install && npm run dev

# 后端
cd api && pip install -r requirements.txt
uvicorn main:app --reload   # http://localhost:8000/api/health
```

## Docker（单容器）

```bash
docker build -t xiaoxiaowo:test .
docker run --rm -p 8000:8000 xiaoxiaowo:test
# 打开 http://localhost:8000/       占位首页
# 打开 http://localhost:8000/api/health  {"status":"ok"}
```

## CI

`.github/workflows/ci.yml`：web build + api pytest + docker build。

环境变量见 `.env.example`（绝不提交真实 Key）。
