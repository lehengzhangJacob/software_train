# 智膳 — AI 食物热量估计与饮食管理系统

基于 **FastAPI + React/Vite + SQLite + 智谱 GLM** 的饮食管理 Web 应用。  
覆盖选题报告中的六大功能：拍照识别、日历记录、营养可视化、运动建议、趋势分析、个人信息（含 BMR）。

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Python FastAPI、SQLite |
| 前端 | React、TypeScript、Vite、Recharts |
| AI | 智谱 GLM 视觉模型（识别）+ 文本模型（运动建议） |

相对原选题报告：大模型由通义千问改为智谱 GLM；后端由 Java 改为 FastAPI。

## 快速开始

### 1. 环境准备

- Python 3.10+
- Node.js 20+（可用 nvm）

```bash
cd food-tracker
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt

cd frontend && npm install && cd ..
```

### 2. 配置 API Key

复制并编辑环境变量：

```bash
cp backend/.env.example backend/.env
# 填入 GLM_API_KEY
```

说明：默认视觉模型为 `glm-4.1v-thinking-flash`（支持本地 base64）。`glm-4v-flash` 通常不支持 base64。可在 `.env` 中修改 `GLM_VISION_MODEL` / `GLM_TEXT_MODEL`。

若本机 DNS 被劫持（如解析到 `198.18.x`），后端会优先用 `curl --resolve` 直连智谱真实 IP，并在启动时修补 `socket.getaddrinfo`。GLM 不可用时，识别页仍可手工填营养素入库；运动建议会回退到本地热量参考表。

### 3. 开发模式（推荐）

```bash
chmod +x scripts/dev.sh backend/run.sh
./scripts/dev.sh
```

- 前端：http://127.0.0.1:5173  
- API 文档：http://127.0.0.1:8000/docs  

> 端口可配置：`PORT` 环境变量指定后端端口（默认 8000），`VITE_API_PROXY` 指定 Vite 代理目标（默认 http://127.0.0.1:8000）。
> 若本机 8000 端口被系统保留（如 `netsh interface ipv4 show excludedportrange` 显示 8000 在排除范围内），可用
> `PORT=8001 VITE_API_PROXY=http://127.0.0.1:8001 ./scripts/dev.sh` 换端口运行。

### 4. 生产 / 公网模式（单端口）

```bash
chmod +x scripts/serve_public.sh
./scripts/serve_public.sh
```

或手动：

```bash
source .venv/bin/activate
cd frontend && npm run build && cd ..
export PYTHONPATH=backend
uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000
```

- 本机：http://127.0.0.1:8000  
- 公网（需安全组放行 TCP 8000）：http://8.148.206.131:8000  

前端由 FastAPI 托管 `frontend/dist`。

## 功能入口

- `/` 今日仪表盘（热量环、营养素饼图）
- `/recognize` 拍照/上传识别并入库
- `/calendar` 月历与餐别记录
- `/trends` 近 7/30 日热量趋势
- `/exercise` GLM 个性化运动建议
- `/profile` 身体参数与目标（BMR 自动计算）

默认演示用户 `user_id=1`（数据库初始化脚本中的测试用户）。

## 目录

```
food-tracker/
  backend/          # FastAPI
  frontend/         # React SPA
  database/         # schema.sql / init_data.sql
  data/             # SQLite 与上传图片（运行时生成）
  scripts/dev.sh    # 一键开发启动
```

## API 概览

- `GET/PUT /api/profile`
- `GET/POST /api/meals`，`PUT/DELETE /api/meals/{id}`
- `GET /api/nutrition/daily`，`GET /api/nutrition/range`
- `POST /api/recognize`（multipart 图片）
- `POST /api/exercise/suggest`，`GET /api/exercise/suggestions`
