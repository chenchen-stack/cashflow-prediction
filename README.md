# 亿流 · 现金流预测 Agent｜司库级全栈智能体

> **用对话驱动资金流闭环**——从数据整合、现金流事件到分析预测与流动性预警，**DataAgent（亿流 Work）** 与主台一体联动，让司库在**同一套界面**里完成「有据 → 确认 → 判断 → 预案」。

[![Stack](https://img.shields.io/badge/后端-FastAPI-009688?style=flat-square)](https://fastapi.tiangolo.com/)
[![AI](https://img.shields.io/badge/Agent-DeepSeek%20%2B%20Tools-F26522?style=flat-square)]()
[![DB](https://img.shields.io/badge/数据-SQLite-003B57?style=flat-square)]()

---

## 为什么选择这套产品？

| 你关心的 | 我们怎么解决 |
|----------|----------------|
| **流动性看不清** | 总览 KPI、资金流、复合分析、滚动预测与**风险预警**一条链打通 |
| **系统很多、人来回切** | **亿流 Work** 侧栏：自然语言查数、跳转页面、触发同步/分析——**少点菜单，多说目标** |
| **口径不一致** | 基础数据（科目/业务/映射）与**数据整合**同源写入，分析与预测引用同一套事实 |
| **AI 只会聊天** | 后端 **Function Calling**：读库、跑分析、写白名单接口等**可验证动作**，不是纯文案 |

**一句话**：这是面向**企业司库 / 财务 / 资金条线**的 **现金流预测 Agent 全栈交付物**——可演示、可对接、可二次开发，PRD 级需求在仓库同级文档目录可追溯。

---

## 核心业务闭环（先理解这条线，再看点功能）

```mermaid
flowchart LR
  A[数据整合 / 导入] --> B[现金流事件 / 确认]
  B --> C[总览看板]
  C --> D[现金流分析]
  D --> E[现金流预测 / 预警]
  E --> F[亿流 Work Agent]
  F --> B
```

Agent 的定位不是替代司库签字，而是**缩短从「想问数」到「页面已打开、动作已触发」的路径**；敏感操作仍可在主台复核与留痕。

---

## 核心能力一览

- **预测与闭环**：总览看板 → 现金流事件 → 现金流分析 → **现金流预测**（滚动曲线、关键日、预算与风险区）
- **数据与集成**：映射规则、同步/导入、审计日志；与事件页**共用同一本账**
- **AI 智能体**：`POST /api/agent/chat` —— DeepSeek + **多轮工具调用**（读库、检索后端代码、触发白名单 API 等）；支持侧栏 **user-choices** 与 JSON 指令联动主台
- **亿流 Work（Accio 风格协作层）**：可选独立工作台进程（`backend/workbench/`，默认 **8010**），会话与业务库分离、引擎同源
- **角色与权限**：司库 / CFO / 分析师 / 业务财务 / 管理员等多角色演示入口

---

## 技术栈（可信、可落地）

| 层级 | 技术 |
|------|------|
| 后端 | **FastAPI**，**SQLite**（`cashflow_agent.db` 运行生成） |
| 前端 | 纯 **SPA**（`app.html` 壳 + 多页 Hash 路由），静态资源由后端一并托管 |
| AI | **DeepSeek** OpenAI 兼容接口；未配置 Key 时可 **离线工具模式**读库摘要 |
| 可观测 | 关键接口耗时、脚本 `scripts/nfr_smoke.py` 冒烟自检 |

更细的 API 与模块映射见下文 **「后端能力与 PRD 对应」**。

---

## 快速开始（30 秒上手）

```bat
双击 run.bat
```

浏览器打开：**http://localhost:8000**

- 未启动后端时，前端会退回到 `data.js` **演示数据**；**生产/联调请先起后端**。
- **Agent 工具轮次**：默认每轮请求最多 **5** 轮「模型 ↔ 工具」循环。环境变量 **`CF_AGENT_MAX_TOOL_ROUNDS`** 可调大；设为 **`0` / `unlimited`** 表示不按轮次封顶（仍有工程安全上限）。详见下文开发者说明。

---

## 亿流 Work · 可选独立工作台

协作侧栏默认走主服务 **`POST /api/agent/chat`**。若希望**对话审计独立进程**：

| 项目 | 说明 |
|------|------|
| 代码 | `backend/workbench/` |
| 端口 | 默认 **8010**（主业务 **8000**） |
| 启动 | `run-workbench.bat` 或 `cd backend && python -m workbench` |
| 前端连接 | `http://localhost:8000/app?workbenchApi=http://127.0.0.1:8010` 或 `localStorage.setItem('cf_workbench_api','http://127.0.0.1:8010')` |

---

## 后端能力与 PRD 对应（摘要）

| PRD 模块 | 能力示例 |
|----------|----------|
| 总览看板 | `GET /api/dashboard/stats` |
| 资金流 | `/api/records`、`/api/collections` |
| 分析预测 | `POST /api/analysis/run`，报表 `/api/analysis/reports` |
| 资金计划 | `/api/plans` 及与资金流/分析填充相关接口 |
| 外汇敞口 | `/api/fx-exposures` |
| 基础数据 | `/api/subjects`、`/api/businesses`、时间段与映射 |
| 数据集成 | `/api/mapping-rules`、`POST /api/integrations/fetch`、`GET /api/sync-logs` |
| AI 智能体 | `POST /api/agent/chat` |
| 流动性扩展 | `/api/liquidity/*` |
| NFR | `GET /api/metrics/summary`；`scripts/nfr_smoke.py` |

完整需求以同级或上级目录中的 **《资金预测-产品需求说明书 PRD》** 为准；部分能力在 PRD 中标注为 **v3.1 / 规划中**，本仓库以**可演示闭环**为主持续迭代。

**PRD 路径提示**（随你本地目录层级调整）：  
自本工程根目录：`../01-文档-现金流预测/资金预测-产品需求说明书-PRD.html`

---

## 仓库与文档位置说明

本目录 **`02-工程-现金流预测-全栈系统/`** 可与 **`01-文档-现金流预测/`** 并列；PRD 内嵌原型可通过相对路径引用本仓库 **`frontend/`**。

**开源仓库（若已推送）**：<https://github.com/chenchen-stack/cashflow-prediction> —— 欢迎 **Star** 与 **Fork**，便于团队复用与二次开发。

---

## 项目结构（开发者速览）

```
├── backend/           # FastAPI、Agent、流动性引擎、SQLite 模型
│   ├── main.py        # 入口：REST + 静态前端
│   ├── agent*.py      # DeepSeek + 工具链
│   └── workbench/     # 可选协作 API（8010）
├── frontend/          # SPA：app.html、样式与脚本
├── scripts/           # nfr_smoke 等
├── run.bat            # 一键启动
└── README.md
```

---

## DataAgent 配置提示

- 服务端：环境变量 **`DEEPSEEK_API_KEY`**（PowerShell：`$env:DEEPSEEK_API_KEY="sk-xxx"`）。未配置时接口仍可用 **离线工具模式**。
- 浏览器直连大模型仅作备用；**生产环境建议密钥仅在后端**。

**用 `file://` 打开本地 html 时**：前端会将 API 指向 `http://127.0.0.1:8000`（需先起后端）；更推荐直接访问 **`http://localhost:8000`** 同源无跨域。

---

## 演示与汇报材料

- 目录 **`PPT/`**：HTML 幻灯入口；可嵌 `frontend/app.html`（`?embed=1` + Hash）。
- **`PPT/协作导读-产品与演示稿.html`**：给协作同事的产品导读。

---

## 角色预设

司库经理 · 财务总监 · 资金分析师 · 业务财务 · 系统管理员（入口见 `frontend/index.html`）。

---

<p align="center">
  <b>亿流现金流预测 Agent</b> — 让资金预测从「报表」走向「可对话、可执行、可复核」的闭环。<br/>
  <sub>若本 README 与仓库不同步，以当前分支代码与 PRD 为准；欢迎提 Issue 与 PR。</sub>
</p>
