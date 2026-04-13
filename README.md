# 资金预测智能体 · 全栈系统

仓库位置：**`02-工程-现金流预测-全栈系统/`**（与同级目录 **`01-文档-现金流预测/`** 下的 PRD 并列；PRD 内嵌原型通过相对路径 **`../02-工程-现金流预测-全栈系统/frontend/`** 引用）。

企业司库现金流预测 AI Agent 全栈产品 —— **FastAPI + SQLite 后端 + 纯前端 SPA**。

### 后端在哪？「Accio 风格工作台」有没有后端？

- **有后端**，目录为 **`backend/`**，入口 **`backend/main.py`**（`run.bat` 会 `cd backend` 再启动 Uvicorn）。**Accio 工作台**相关后端代码统一在 **`backend/workbench/`**（可选独立端口 8010）。
- **亿流 Work / Accio 式侧栏**在 **`frontend/app.html`** 里，与主台共用同一套页面；数据仍走 **`/api/*`**，不是纯静态假页面。
- 若感觉「没有后端」，常见原因：
  1. **未运行 `run.bat` 或未手动启动 Uvicorn**，前端会退回到 `data.js` 里的 **Mock 数据**；
  2. 用 **`file://` 直接打开 `app.html`**：请仍先启动后端，前端会把 API 指到 `http://127.0.0.1:8000`（见下文）；
  3. 只打开了 **`frontend/` 静态资源**而没有起 **`main.py`**。

**验证是否连上后端**：浏览器访问 **`http://localhost:8000/app`**（或根路径 `/`），在 **资金流 / 数据集成** 等页操作后，数据应写入 **`backend/cashflow_agent.db`**（SQLite）。

### 后端与 PRD 的对应关系（摘要）

| PRD 模块 | 后端能力（示例） |
|----------|------------------|
| 总览看板 | `GET /api/dashboard/stats` |
| 资金流 | `GET/POST/PUT/DELETE /api/records`，集合 `/api/collections` |
| 分析预测 | `POST /api/analysis/run`，报表 `/api/analysis/reports` |
| 资金计划 | `/api/plans`，及从资金流/分析填充的接口 |
| 外汇敞口 | `/api/fx-exposures` |
| 基础数据 | `/api/subjects`、`/api/businesses`、时间段与两类映射 |
| 数据集成 | `/api/mapping-rules`、`POST /api/integrations/fetch`、`GET /api/sync-logs`（权威性/冲突/审计快照） |
| AI 智能体 | `POST /api/agent/chat`（DeepSeek + 工具调用；无 Key 时离线读库） |
| 流动性 MVP（扩展） | `/api/liquidity/*` |
| NFR 自检 | `GET /api/metrics/summary`，响应头 `X-Process-Time-Ms`；脚本 `scripts/nfr_smoke.py` |

更细的规则以 **`01-文档-现金流预测/资金预测-产品需求说明书-PRD.html`** 为准；部分能力在 PRD 中标为 **v3.1 / 规划中**（如大规模异步队列、完整汇率引擎），后端以 **可演示闭环** 为主迭代。

## PRD 产品需求说明书

从本工程根目录出发，产品说明书路径：**`../01-文档-现金流预测/资金预测-产品需求说明书-PRD.html`**（与 `frontend/` 并列时，自 `frontend/` 为 **`../../01-文档-现金流预测/资金预测-产品需求说明书-PRD.html`**）。文中「产品原型」「角色操作指南」可联动打开本仓库前端原型。

## 快速启动

```
双击 run.bat
```

浏览器访问 `http://localhost:8000`。

**Agent 工具轮次（可选）**：侧栏 `POST /api/agent/chat` 中模型与工具的多轮循环默认最多 **5** 轮；深度读代码时易触顶。可在启动后端前设置环境变量 **`CF_AGENT_MAX_TOOL_ROUNDS`**（整数 **1～48**，默认 5），例如 `12`。不设「无限」以防延迟与费用失控。

### 亿流 Work · 工作台专用后端（可选）

协作侧栏（Accio 风格）默认使用主服务上的 `POST /api/agent/chat`。若希望 **对话与会话审计独立进程**，可单独启动工作台 API（**代码已统一放在 `backend/workbench/`**）：

| 项目 | 说明 |
|------|------|
| 目录 | **`backend/workbench/`**（`app.py`、`database_wb.py`、`__main__.py`） |
| 默认端口 | **8010**（主业务仍为 **8000**） |
| 启动 | 双击 **`run-workbench.bat`**，或 `cd backend && python -m workbench` |
| 数据库 | **`backend/workbench/workbench.db`**（仅存协作会话/消息）；业务数据仍在 **`backend/cashflow_agent.db`** |
| 对话引擎 | 复用 **`backend/agent.py`**（同一套工具读业务库） |

**前端如何连接工作台服务**：浏览器打开主应用时加参数：

`http://localhost:8000/app?workbenchApi=http://127.0.0.1:8010`

或控制台执行：`localStorage.setItem('cf_workbench_api','http://127.0.0.1:8010')` 后刷新。

未配置时行为不变，仍走 `http://localhost:8000/api/agent/chat`。

**工作台 API 摘要**：`GET /api/workbench/health`、`GET /api/workbench/capabilities`、`POST /api/workbench/chat`、`GET /api/workbench/sessions/{id}/messages`。

## 项目结构

```
├── backend/
│   ├── database.py      # SQLAlchemy 模型 + SQLite + 种子数据（含 sync_logs 等）
│   ├── main.py          # FastAPI：REST API + 静态托管 frontend
│   ├── calculator.py    # 预测计算引擎（区间段/行列/头寸递推）
│   ├── agent.py         # DeepSeek AI Agent + 10 个 function tools（无 Key 时离线读库）
│   ├── cashflow_agent.db # 运行后生成的 SQLite 库（本地）
│   ├── workbench/        # 亿流 Work 专用 API（可选，默认端口 8010）
│   │   ├── app.py        # FastAPI 应用
│   │   ├── database_wb.py
│   │   └── workbench.db  # 协作会话库（运行后生成）
│   └── requirements.txt
├── scripts/
│   └── nfr_smoke.py     # 关键 API 耗时自检（非压测）
├── run-workbench.bat    # 仅启动工作台后端
├── frontend/
│   ├── index.html       # 角色选择页
│   ├── app.html         # 主应用 SPA 壳
│   ├── css/             # 样式（5 文件）
│   └── js/              # 逻辑（7 文件）
├── run.bat              # 一键启动脚本
└── README.md
```

## 功能模块

| 模块 | 说明 |
|------|------|
| 总览看板 | KPI 卡片 + 头寸走势 + 流量分布 |
| 资金流管理 | 集合/单据 CRUD + 多币种 |
| 分析预测 | 复合区间段 + 行列矩阵 + 头寸递推 |
| 资金计划 | 按周期编制 + 执行对比 |
| 外汇敞口 | 敞口台账 + 对冲比率 + 损益 |
| 基础数据 | 科目树 + 业务类型 + 映射规则 |
| 数据集成 | 取数映射配置 |
| AI 智能体 | DeepSeek 多轮对话 + 10 工具（含决策建议、异常汇总） |

## DataAgent（AI）

后端 `POST /api/agent/chat` 接收 `{ "message", "role", "history": [] }`，使用 DeepSeek + 读库工具（当前 **10** 个 function tools）；**history** 为此前 user/assistant 消息，支持多轮。

设置 API Key（PowerShell）：

```
$env:DEEPSEEK_API_KEY="sk-xxx"
```

未配置 Key 时，接口仍可用 **离线工具模式**（直接读 SQLite 生成中文摘要，无大模型推理）。

浏览器直连 DeepSeek 备用：在页面加载前设置 `window.__DEEPSEEK_API_KEY__ = 'sk-xxx'`（不推荐生产）。

### 用 file:// 直接打开 frontend/*.html 时

相对路径 `/api/...` 会被浏览器当成磁盘根路径。前端已自动在 **file 协议** 下把 API 基址设为 **`http://127.0.0.1:8000`**（请先启动后端）。若后端端口不同，可：

- 地址栏加参数：`app.html?apiBase=http://127.0.0.1:8080`
- 或执行：`localStorage.setItem('cf_api_base','http://127.0.0.1:8080')` 后刷新

仍推荐通过 **`http://localhost:8000`** 访问（与后端同源，无跨域问题）。

## 角色

- 司库经理（Treasurer）
- 财务总监（CFO）
- 资金分析师（Analyst）
- 业务财务（BizFin）
- 系统管理员（Admin）

## 演示稿（PPT）

目录 **`PPT/`**：`index.html` 入口；**精简版 / 详细版** 为高端排版 HTML 幻灯，内嵌 **`frontend/app.html`**（`?embed=1` + Hash 路由；`ai=1` 展开 DataAgent）。

- 将截图放入 **`PPT/assets/`** 同名 PNG 可覆盖 iframe，便于邮件离线演示。
- **`PPT/serve-frontend.bat`**：在 `frontend` 启静态服务（默认端口 **8876**），再把 iframe 改为 `http://127.0.0.1:8876/app.html?embed=1#...` 可规避部分浏览器对 `file://` 嵌套限制。
- **`PPT/协作导读-产品与演示稿.html`**：协作同事读本（产品大白话 + 模块地图 + 与幻灯同名的截图说明，单页纵向滚动）。
