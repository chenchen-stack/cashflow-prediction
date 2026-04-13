
"""
agent_core.py — DataAgent 工具与提示词（业务库读数）
由 agent_langchain.py 使用 LangChain ChatOpenAI 编排多轮工具调用（Harness 模式）。
"""

import importlib.util
import json
import os
import re
import subprocess
import sys
from database import SessionLocal, CashflowRecord, FxExposure, CapitalPlan, AnalysisReport, CashflowSubject, CashflowBusiness

_BACKEND_ROOT = os.path.abspath(os.path.dirname(__file__))
_BACKEND_ROOT_REAL = os.path.realpath(_BACKEND_ROOT)
_SKIP_SEARCH_DIRS = {"__pycache__", ".git", "venv", ".venv", "node_modules", "dist", "build", ".mypy_cache", ".pytest_cache"}
from calculator import build_analysis

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "") or ""
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")

SYSTEM_PROMPT = """你是 **DataAgent（数据智能体）**，服务于 **资金预测 · Accio 工作台**（亿流 Work 侧栏与主台共用数据）。
你必须通过 **Function Calling（服务端已注册 tools）** 读取数据库中的真实数据后再回答，禁止编造数字。**禁止**仅用自然语言或 Markdown 假装已执行 query_position、run_forecast 等工具；若需这些结论，必须在本轮或下一轮产生 **tool_calls** 并由系统返回真实结果。

## 交互与反问（先澄清再工具）
- 若用户问题缺少**单位、时间范围、币种、主体**等关键条件，**先输出 1～2 句简短追问**（用列表列出），再按需调用工具；不要猜测。
- 若工具返回数据不足以回答，**反问**用户需要补充什么。

## 单步引导与自动执行（与侧栏一致，必须遵守）
- **每轮只推进一步**：不要在一次回复中输出「第一步、第二步…」完整清单或「数据全景 + 全部缺口 + 全套建议」；复杂流程拆成多轮，本轮只说**当前要做的一件事**（约 120～220 字内为宜，追问可更短）。需要用户确认、同意或二选一时，**不要**只写「请回复确认」「请回复启用或禁用」——必须在回复**末尾**附加 ```user-choices``` 代码块（JSON 数组，每项含 `label` 与 `cmd`，`cmd` 与浏览器 JSON 指令同款，如 `api_post`、`toast`），由侧栏渲染为**可点击按钮**。用户通过**点击按钮**进入下一步即可，**不要**要求用户离开侧栏去主台找按钮点击。
- **优先 Function Calling 与 JSON 前端指令**：需要读数时先调工具；需要打开页面或触发分析/同步时，在回复**末尾**附加 ```json``` 代码块（见下），由前端**自动执行**。**禁止**把「请用户自己去主台点点点」作为主要交互方式。
- **对话确认例外（仅在侧栏确认）**：批量确认资金流、强制覆盖取数、删除/禁用、资金计划填充且存在多草稿需选定、用户关键条件缺失——本回合仅简短追问，并用 ```user-choices``` 提供按钮；用户**点击**即表示确认或选择。**不要**让用户去主台完成确认。普通 navigate / run_analysis / reload_data / integration_sync **不要**无故要求确认。
- **利用多轮上下文**：勿重复已说过的统计与口径，只补充新进展或下一问。

## 关键数据与趋势（展示与可读性）
- 所有金额、百分比、笔数等关键数字用 **加粗**；趋势用「上升/下降/回升/收窄/波动」等词，与数据结论对应。
- **表格输出**：多列数据（如按日头寸、期初/期末对比）必须使用 **GitHub 风格 Markdown 表格**：第一行表头、第二行分隔线如 `| --- | --- |`，数据行每行一条 `| 列1 | 列2 |`；**不要在表格行前加列表符号 `- `**，否则前端无法渲染为表格。
- 每个主题小节（如「## 资金计划状态汇总」）末尾，用一行 **快捷操作** 并附 Markdown 链接：`[打开资金计划](cf-page:plan)` 等；**同时**若需自动跳转，在文末附 JSON（见「回复规范」），避免只写「请前往某页」而无自动执行路径。
- 涉及单位名称（如总部、华东子公司）时，在首次出现处可加 **可点击链接**（如 `[总部](cf-page:plan)`），或统一在文末给 `[打开资金计划](cf-page:plan)`。

用户可见的七项能力与工具对应关系（务必按需调用，勿空答）：
1. **资金头寸**：query_position / dashboard_summary — 总流入、总流出、净头寸
2. **资金预测**：run_forecast — 复合区间分析结果摘要
3. **外汇敞口**：query_fx_exposure — 敞口笔数、名义额、对冲情况
4. **异常资金流**：detect_anomalies — 偏离均值的异常单据
5. **资金计划**：query_plans — 草稿/审批状态与偏差相关
6. **决策建议**：suggest_liquidity_decision — 流动性与调度方向建议
7. **预警汇总**：collect_exception_alerts — 异常条数、未对冲、草稿计划等待办

其他工具：query_subjects、query_records 用于科目/明细；需要时再调用。

## 研发 / 联调（代码与依赖）
- **search_backend_code**：在 `backend/` 目录内按关键字搜索源码（只读，不含 venv）。
- **read_backend_file**：读取 `backend/` 下相对路径文件的前若干行（如 `agent_core.py`、`main.py`）。
- **check_python_import**：检查 Python 模块是否可被当前运行环境导入。
- **install_python_package**：仅在服务端设置环境变量 **`CF_AGENT_ALLOW_PIP=1`** 且包名在 **`CF_AGENT_PIP_ALLOWLIST`**（逗号分隔白名单）中时才会真实执行 `pip install`；否则返回**建议命令**，禁止编造已安装。

回复规范：
- 简洁中文；金额可用万元/亿元表述；可用 ## 作为小节标题
- **Markdown 链接**（正文内可点击，与 JSON 指令可同时使用）：
  - 站内页面：`[打开分析预测](cf-page:analysis)`、`[资金流](cf-page:cashflow)`、`[总览看板](cf-page:dashboard)`、`[外汇](cf-page:fx)`、`[资金计划](cf-page:plan)`
  - 常用操作：`[重新运行分析](cf-action:run_analysis)`、`[导出 CSV](cf-action:export_csv)`、`[批量确认](cf-action:batch_confirm)`
  - 外链：`[文档](https://example.com)`
- 输出预测/分析结论时，建议在文末用一行「**快捷操作**」并附 1～2 个 `cf-page` 或 `cf-action` 链接
- 涉及资金计划草稿/审批时，务必给出可点击跳转：`[打开资金计划](cf-page:plan)` 或 `[新建计划](cf-action:new_plan)`，避免仅文字写「前往某页」
- 需要自动执行某操作时，在回复**末尾**附加 JSON 代码块（前端自动执行）：
```json
{"action":"navigate","page":"dashboard"}
```
可选 page：dashboard, cashflow, analysis, plan, fx, basedata, integration
其他 action：run_analysis, refresh_dashboard, batch_confirm, export_csv, new_plan, fetch_data, toast（含 type/message）

**PRD 闭环（与亿流 Work 前端对齐）**：基础数据 → 资金流 → 数据整合 → 分析预测 → 动态预测 → 资金计划。
前端另支持：bd_tab、open_workbench、integration_sync / integration_bank、reload_data、liquidity_predict、api_post（仅白名单：`/api/integrations/fetch`、`/api/plans/{id}/fill-from-*`、`/api/fetch-tasks/{id}/run`、`/api/analysis/run`）。
多步任务分轮输出；每轮可带 1～多个 ```json``` 块由浏览器顺序执行。
"""


# ═══════════════════════════════════════════
#  Function Tool 定义
# ═══════════════════════════════════════════

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "query_position",
            "description": "查询当前资金头寸概览：总流入、总流出、净头寸、各单位汇总",
            "parameters": {"type": "object", "properties": {
                "unit": {"type": "string", "description": "可选，按单位筛选"},
                "currency": {"type": "string", "description": "币种，默认 CNY"},
            }},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_forecast",
            "description": "运行资金预测分析，返回按时间段的预测头寸",
            "parameters": {"type": "object", "properties": {
                "unit": {"type": "string", "description": "可选，按单位筛选"},
                "period_config_code": {"type": "string", "description": "时间段配置编码，默认 TP0001"},
                "opening_balance": {"type": "number", "description": "期初余额，默认 0"},
            }},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_fx_exposure",
            "description": "查询外汇敞口列表和汇总",
            "parameters": {"type": "object", "properties": {
                "status": {"type": "string", "description": "可选状态筛选：持有/未对冲/已平仓"},
            }},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "detect_anomalies",
            "description": "检测异常资金流（金额偏差大、日期异常等）",
            "parameters": {"type": "object", "properties": {
                "threshold": {"type": "number", "description": "异常阈值倍数，默认 2"},
            }},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_plans",
            "description": "查询资金计划与执行偏差",
            "parameters": {"type": "object", "properties": {
                "unit": {"type": "string", "description": "可选，按单位筛选"},
                "status": {"type": "string", "description": "可选状态筛选"},
            }},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "dashboard_summary",
            "description": "获取看板统计摘要数据",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_subjects",
            "description": "查询资金流科目树",
            "parameters": {"type": "object", "properties": {
                "direction": {"type": "string", "description": "可选：流入/流出"},
            }},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_records",
            "description": "查询资金流单据列表",
            "parameters": {"type": "object", "properties": {
                "unit": {"type": "string", "description": "可选，按单位筛选"},
                "status": {"type": "string", "description": "可选状态筛选"},
                "limit": {"type": "integer", "description": "返回条数限制，默认 20"},
            }},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "suggest_liquidity_decision",
            "description": "决策建议：综合净头寸、外汇敞口与异常检测结果，输出可执行建议（调度/对冲/复核）",
            "parameters": {"type": "object", "properties": {
                "focus": {"type": "string", "description": "可选：流动性 / 外汇 / 计划"},
            }},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "collect_exception_alerts",
            "description": "异常预警汇总：大额异常单据、未对冲敞口、草稿计划等待办",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_backend_code",
            "description": "在 backend 目录内搜索源码关键字（只读，跳过 venv/__pycache__），用于定位实现或配置",
            "parameters": {"type": "object", "properties": {
                "query": {"type": "string", "description": "搜索字符串（子串匹配）"},
                "extension": {"type": "string", "description": "文件后缀，默认 .py"},
                "max_hits": {"type": "integer", "description": "最多返回匹配处数，默认 24，最大 40"},
            }, "required": ["query"]},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_backend_file",
            "description": "读取 backend 目录下文件的文本内容（相对路径，如 agent_langchain.py）",
            "parameters": {"type": "object", "properties": {
                "path": {"type": "string", "description": "相对 backend 的文件路径"},
                "max_lines": {"type": "integer", "description": "最多读取行数，默认 160，最大 400"},
            }, "required": ["path"]},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_python_import",
            "description": "检查 Python 包/模块是否已安装（importlib.find_spec）",
            "parameters": {"type": "object", "properties": {
                "module": {"type": "string", "description": "模块或顶层包名，如 langchain_openai、numpy"},
            }, "required": ["module"]},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "install_python_package",
            "description": "请求安装 pip 包：仅当服务端 CF_AGENT_ALLOW_PIP=1 且包在白名单时真实执行，否则返回建议命令",
            "parameters": {"type": "object", "properties": {
                "package": {"type": "string", "description": "pip 包名，如 httpx"},
            }, "required": ["package"]},
        },
    },
]


# ═══════════════════════════════════════════
#  Tool 实现
# ═══════════════════════════════════════════

def _tool_query_position(args: dict) -> str:
    db = SessionLocal()
    try:
        q = db.query(CashflowRecord).filter(CashflowRecord.is_deleted == False)
        if args.get("unit"):
            q = q.filter(CashflowRecord.unit == args["unit"])
        cur = args.get("currency", "CNY")
        q = q.filter(CashflowRecord.currency == cur)
        records = q.all()
        inflow = sum(r.amount for r in records if r.amount > 0)
        outflow = sum(abs(r.amount) for r in records if r.amount < 0)
        by_unit = {}
        for r in records:
            by_unit.setdefault(r.unit, {"inflow": 0, "outflow": 0})
            if r.amount > 0:
                by_unit[r.unit]["inflow"] += r.amount
            else:
                by_unit[r.unit]["outflow"] += abs(r.amount)
        return json.dumps({
            "currency": cur, "total_inflow": inflow, "total_outflow": outflow,
            "net": inflow - outflow, "by_unit": by_unit,
        }, ensure_ascii=False)
    finally:
        db.close()


def _tool_run_forecast(args: dict) -> str:
    db = SessionLocal()
    try:
        params = {
            "unit": args.get("unit"),
            "period_config_code": args.get("period_config_code", "TP0001"),
            "opening_balance": args.get("opening_balance", 0),
        }
        result = build_analysis(db, params)
        summary = {
            "period_count": len(result["periods"]),
            "periods": [p["label"] for p in result["periods"][:10]],
            "position_opening": result["position"]["opening"][:10],
            "position_closing": result["position"]["closing"][:10],
        }
        return json.dumps(summary, ensure_ascii=False, default=str)
    finally:
        db.close()


def _tool_query_fx_exposure(args: dict) -> str:
    db = SessionLocal()
    try:
        q = db.query(FxExposure)
        if args.get("status"):
            q = q.filter(FxExposure.status == args["status"])
        rows = q.all()
        data = []
        for r in rows:
            data.append({
                "currency_pair": r.currency_pair, "notional": r.notional,
                "direction": r.direction, "hedge_ratio": r.hedge_ratio,
                "instrument": r.instrument, "pnl": r.pnl, "status": r.status,
                "maturity": r.maturity.isoformat() if r.maturity else None,
            })
        total = sum(r.notional for r in rows)
        avg_hedge = sum(r.hedge_ratio for r in rows) / max(len(rows), 1)
        total_pnl = sum(r.pnl for r in rows)
        return json.dumps({
            "count": len(data), "total_notional": total,
            "avg_hedge_ratio": round(avg_hedge, 2), "total_pnl": total_pnl,
            "exposures": data,
        }, ensure_ascii=False, default=str)
    finally:
        db.close()


def _tool_detect_anomalies(args: dict) -> str:
    db = SessionLocal()
    try:
        records = db.query(CashflowRecord).filter(
            CashflowRecord.currency == "CNY", CashflowRecord.is_deleted == False
        ).all()
        if not records:
            return json.dumps({"anomalies": [], "message": "无数据"}, ensure_ascii=False)
        amounts = [abs(r.amount) for r in records if r.amount != 0]
        if not amounts:
            return json.dumps({"anomalies": []}, ensure_ascii=False)
        avg = sum(amounts) / len(amounts)
        threshold = args.get("threshold", 2)
        anomalies = []
        for r in records:
            if abs(r.amount) > avg * threshold:
                anomalies.append({
                    "code": r.code, "unit": r.unit, "amount": r.amount,
                    "trade_date": r.trade_date.isoformat() if r.trade_date else None,
                    "reason": f"金额 {abs(r.amount):,.0f} 超过均值 {avg:,.0f} 的 {threshold} 倍",
                })
        return json.dumps({"avg_amount": avg, "threshold": threshold, "anomalies": anomalies}, ensure_ascii=False)
    finally:
        db.close()


def _tool_query_plans(args: dict) -> str:
    db = SessionLocal()
    try:
        q = db.query(CapitalPlan).filter(CapitalPlan.is_deleted == False)
        if args.get("unit"):
            q = q.filter(CapitalPlan.unit == args["unit"])
        if args.get("status"):
            q = q.filter(CapitalPlan.status == args["status"])
        plans = q.all()
        data = []
        for p in plans:
            d = json.loads(p.data_json or "{}")
            data.append({
                "unit": p.unit, "period_type": p.period_type,
                "period_label": p.period_label, "status": p.status, "data": d,
            })
        return json.dumps({"count": len(data), "plans": data}, ensure_ascii=False)
    finally:
        db.close()


def _tool_dashboard_summary(args: dict) -> str:
    db = SessionLocal()
    try:
        records = db.query(CashflowRecord).filter(CashflowRecord.is_deleted == False).all()
        inflow = sum(r.amount for r in records if r.amount > 0 and r.currency == "CNY")
        outflow = sum(abs(r.amount) for r in records if r.amount < 0 and r.currency == "CNY")
        fx_rows = db.query(FxExposure).all()
        return json.dumps({
            "record_count": len(records),
            "cny_inflow": inflow, "cny_outflow": outflow, "cny_net": inflow - outflow,
            "fx_count": len(fx_rows),
            "fx_total_notional": sum(e.notional for e in fx_rows),
        }, ensure_ascii=False)
    finally:
        db.close()


def _tool_query_subjects(args: dict) -> str:
    db = SessionLocal()
    try:
        q = db.query(CashflowSubject).filter(
            CashflowSubject.valid == True, CashflowSubject.is_deleted == False
        )
        if args.get("direction"):
            q = q.filter(CashflowSubject.direction == args["direction"])
        subjects = q.order_by(CashflowSubject.code).all()
        data = [{"id": s.id, "code": s.code, "name": s.name, "direction": s.direction} for s in subjects]
        return json.dumps({"count": len(data), "subjects": data}, ensure_ascii=False)
    finally:
        db.close()


def _tool_query_records(args: dict) -> str:
    db = SessionLocal()
    try:
        q = db.query(CashflowRecord).filter(CashflowRecord.is_deleted == False)
        if args.get("unit"):
            q = q.filter(CashflowRecord.unit == args["unit"])
        if args.get("status"):
            q = q.filter(CashflowRecord.status == args["status"])
        limit = args.get("limit", 20)
        rows = q.order_by(CashflowRecord.trade_date.desc()).limit(limit).all()
        data = []
        for r in rows:
            data.append({
                "code": r.code, "unit": r.unit, "currency": r.currency,
                "amount": r.amount, "status": r.status,
                "trade_date": r.trade_date.isoformat() if r.trade_date else None,
            })
        return json.dumps({"count": len(data), "records": data}, ensure_ascii=False)
    finally:
        db.close()


def _tool_suggest_liquidity_decision(args: dict) -> str:
    pos = json.loads(_tool_query_position({}))
    fx = json.loads(_tool_query_fx_exposure({}))
    anom = json.loads(_tool_detect_anomalies({"threshold": 2}))
    plans = json.loads(_tool_query_plans({}))
    net = float(pos.get("net") or 0)
    suggestions = []
    if net < 0:
        suggestions.append({"type": "流动性", "text": "净头寸为负：优先核对短期流入与内部调拨，必要时启动融资预案。"})
    elif net > float(pos.get("total_inflow", 0) or 0) * 0.5:
        suggestions.append({"type": "流动性", "text": "盈余较高：可考虑理财或提前还款以降低闲置成本。"})
    uh = [e for e in (fx.get("exposures") or []) if float(e.get("hedge_ratio") or 0) < 0.01]
    if uh:
        suggestions.append({"type": "外汇", "text": f"存在 {len(uh)} 笔未充分对冲敞口，建议在外汇敞口页复核对冲工具。"})
    if anom.get("anomalies"):
        suggestions.append({"type": "异常", "text": f"检测到 {len(anom['anomalies'])} 条异常金额单据，建议在资金流页逐笔复核。"})
    drafts = [p for p in (plans.get("plans") or []) if isinstance(p, dict) and p.get("status") == "草稿"]
    if drafts:
        suggestions.append({"type": "计划", "text": f"有 {len(drafts)} 个草稿计划待提交，可跳转资金计划模块处理。"})
    if not suggestions:
        suggestions.append({"type": "综合", "text": "当前未发现高风险信号，可保持常规监控与滚动预测。"})
    return json.dumps({"suggestions": suggestions, "net": net, "fx_count": fx.get("count", 0)}, ensure_ascii=False)


def _tool_collect_exception_alerts(args: dict) -> str:
    anom = json.loads(_tool_detect_anomalies({"threshold": 2}))
    fx = json.loads(_tool_query_fx_exposure({}))
    plans = json.loads(_tool_query_plans({"status": "草稿"}))
    uh = [e for e in (fx.get("exposures") or []) if float(e.get("hedge_ratio") or 0) < 0.01]
    return json.dumps({
        "anomaly_count": len(anom.get("anomalies") or []),
        "anomalies": (anom.get("anomalies") or [])[:8],
        "unhedged_fx": len(uh),
        "draft_plans": plans.get("count", 0),
    }, ensure_ascii=False)


def _resolved_backend_file(rel: str):
    rel = (rel or "").replace("\\", "/").strip().lstrip("/")
    if not rel or ".." in rel.split("/"):
        return None
    full = os.path.realpath(os.path.join(_BACKEND_ROOT, rel))
    try:
        common = os.path.commonpath([full, _BACKEND_ROOT_REAL])
    except ValueError:
        return None
    if common != _BACKEND_ROOT_REAL:
        return None
    return full


def _tool_search_backend_code(args: dict) -> str:
    q = (args.get("query") or "").strip()
    if not q or len(q) > 200:
        return json.dumps({"error": "query 为空或过长"}, ensure_ascii=False)
    ext = (args.get("extension") or ".py").strip()
    if not ext.startswith("."):
        ext = "." + ext
    max_hits = min(max(int(args.get("max_hits", 24) or 24), 1), 40)
    hits = []
    for root, dirs, files in os.walk(_BACKEND_ROOT, topdown=True):
        dirs[:] = [d for d in dirs if d not in _SKIP_SEARCH_DIRS]
        for fn in files:
            if not fn.endswith(ext):
                continue
            path = os.path.join(root, fn)
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    for li, line in enumerate(f, 1):
                        if q in line:
                            rel = os.path.relpath(path, _BACKEND_ROOT).replace("\\", "/")
                            hits.append({"file": rel, "line": li, "snippet": line.strip()[:240]})
                            if len(hits) >= max_hits:
                                break
            except OSError:
                continue
            if len(hits) >= max_hits:
                break
        if len(hits) >= max_hits:
            break
    return json.dumps({"query": q, "hit_count": len(hits), "hits": hits}, ensure_ascii=False)


def _tool_read_backend_file(args: dict) -> str:
    rel = args.get("path") or ""
    max_lines = min(max(int(args.get("max_lines", 160) or 160), 1), 400)
    full = _resolved_backend_file(rel)
    if not full or not os.path.isfile(full):
        return json.dumps({"error": "文件不存在或路径不允许", "path": rel}, ensure_ascii=False)
    try:
        with open(full, "r", encoding="utf-8", errors="replace") as f:
            lines = []
            for i, line in enumerate(f):
                if i >= max_lines:
                    break
                lines.append(line.rstrip("\n"))
    except OSError as e:
        return json.dumps({"error": str(e), "path": rel}, ensure_ascii=False)
    return json.dumps({
        "path": os.path.relpath(full, _BACKEND_ROOT).replace("\\", "/"),
        "lines_read": len(lines),
        "truncated": len(lines) >= max_lines,
        "content": "\n".join(lines),
    }, ensure_ascii=False)


def _tool_check_python_import(args: dict) -> str:
    name = (args.get("module") or "").strip()
    if not name or not re.match(r"^[a-zA-Z_][a-zA-Z0-9_.]*$", name):
        return json.dumps({"ok": False, "error": "非法模块名"}, ensure_ascii=False)
    top = name.split(".")[0]
    spec = importlib.util.find_spec(top)
    ok = spec is not None
    return json.dumps({
        "ok": ok,
        "module": name,
        "top_level": top,
        "origin": getattr(spec, "origin", None) if spec else None,
    }, ensure_ascii=False)


def _tool_install_python_package(args: dict) -> str:
    pkg_raw = (args.get("package") or "").strip()
    pkg_key = pkg_raw.lower()
    if not pkg_raw or not re.match(r"^[A-Za-z0-9][A-Za-z0-9._-]*$", pkg_raw):
        return json.dumps({"installed": False, "error": "非法包名"}, ensure_ascii=False)
    allow_raw = os.getenv("CF_AGENT_PIP_ALLOWLIST", "") or ""
    allow = {x.strip().lower() for x in allow_raw.split(",") if x.strip()}
    pip_on = os.getenv("CF_AGENT_ALLOW_PIP", "").strip().lower() in ("1", "true", "yes")
    suggest = f"{sys.executable} -m pip install {pkg_raw}"
    if not pip_on:
        return json.dumps({
            "installed": False,
            "message": "未开启 CF_AGENT_ALLOW_PIP=1，未执行安装（演示环境安全默认关闭）",
            "suggest_command": suggest,
        }, ensure_ascii=False)
    if pkg_key not in allow:
        return json.dumps({
            "installed": False,
            "message": f"包 {pkg_raw} 不在 CF_AGENT_PIP_ALLOWLIST 中",
            "allowlist": sorted(allow),
            "suggest_command": suggest,
        }, ensure_ascii=False)
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "pip", "install", pkg_raw],
            capture_output=True,
            text=True,
            timeout=180,
            cwd=_BACKEND_ROOT,
        )
    except subprocess.TimeoutExpired:
        return json.dumps({"installed": False, "error": "pip 超时"}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"installed": False, "error": str(e)}, ensure_ascii=False)
    ok = proc.returncode == 0
    out = (proc.stdout or "")[-2000:]
    err = (proc.stderr or "")[-2000:]
    return json.dumps({
        "installed": ok,
        "returncode": proc.returncode,
        "stdout_tail": out,
        "stderr_tail": err,
    }, ensure_ascii=False)


TOOL_DISPATCH = {
    "query_position": _tool_query_position,
    "run_forecast": _tool_run_forecast,
    "query_fx_exposure": _tool_query_fx_exposure,
    "detect_anomalies": _tool_detect_anomalies,
    "query_plans": _tool_query_plans,
    "dashboard_summary": _tool_dashboard_summary,
    "query_subjects": _tool_query_subjects,
    "query_records": _tool_query_records,
    "suggest_liquidity_decision": _tool_suggest_liquidity_decision,
    "collect_exception_alerts": _tool_collect_exception_alerts,
    "search_backend_code": _tool_search_backend_code,
    "read_backend_file": _tool_read_backend_file,
    "check_python_import": _tool_check_python_import,
    "install_python_package": _tool_install_python_package,
}


# ═══════════════════════════════════════════
#  多轮对话主循环
# ═══════════════════════════════════════════

def _fmt_wan(n: float) -> str:
    if n is None:
        return "-"
    a = abs(n)
    if a >= 1e8:
        return f"{n/1e8:.2f}亿"
    if a >= 1e4:
        return f"{n/1e4:.1f}万"
    return f"{n:,.0f}"


def _fallback(msg: str) -> str:
    """无 DEEPSEEK_API_KEY 时：仍用本地工具读库，返回可读摘要"""
    lower = msg.lower()
    hint = (
        "\n\n> 提示：在亿流主台顶栏「⚙ AI API 配置」保存的密钥会随请求传入后端；或在运行后端的环境中设置 "
        "`DEEPSEEK_API_KEY`，可启用 DataAgent 完整多轮推理与复杂问数。"
    )

    def pack(tool_fn, args, nav_page=None):
        try:
            raw = tool_fn(args)
            data = json.loads(raw)
        except Exception as e:
            return f"本地读库失败：{e}{hint}"
        lines = ["**DataAgent · 离线工具模式**（数据来自本地数据库）"]
        if "net" in data and "total_inflow" in data:
            lines.append(f"- 净头寸：**{_fmt_wan(data.get('net', 0))}**（{data.get('currency', 'CNY')}）")
            lines.append(f"- 总流入：{_fmt_wan(data.get('total_inflow', 0))}，总流出：{_fmt_wan(data.get('total_outflow', 0))}")
        if "cny_net" in data:
            lines.append(f"- 资金流记录：**{data.get('record_count', 0)}** 笔")
            lines.append(f"- CNY 净流入：**{_fmt_wan(data.get('cny_net', 0))}**")
            lines.append(f"- 外汇敞口：**{data.get('fx_count', 0)}** 笔，名义合计 {_fmt_wan(data.get('fx_total_notional', 0))}")
        if "count" in data and "exposures" in data:
            lines.append(f"- 敞口笔数：**{data.get('count', 0)}**，名义总额 {_fmt_wan(data.get('total_notional', 0))}")
        if "anomalies" in data:
            arr = data.get("anomalies") or []
            lines.append(f"- 检测到 **{len(arr)}** 条金额异常资金流（阈值 {data.get('threshold', 2)}×均值）")
        if "plans" in data:
            lines.append(f"- 资金计划：**{data.get('count', 0)}** 个")
        if "period_count" in data:
            lines.append(f"- 预测区间数：**{data.get('period_count', 0)}**（已运行 calculator）")
        body = "\n".join(lines) + hint
        if nav_page:
            body += f"\n\n**快捷操作** [打开对应页面](cf-page:{nav_page})"
            body += f'\n\n```json\n{{"action":"navigate","page":"{nav_page}"}}\n```'
        return body

    if any(k in lower for k in ["头寸", "余额", "流入", "流出", "资金流"]):
        return pack(_tool_query_position, {}, "cashflow")
    if any(k in lower for k in ["预测", "分析"]):
        return pack(_tool_run_forecast, {}, "analysis")
    if any(k in lower for k in ["外汇", "敞口", "汇率"]):
        return pack(_tool_query_fx_exposure, {}, "fx")
    if any(k in lower for k in ["异常", "风险"]):
        return pack(_tool_detect_anomalies, {}, "cashflow")
    if any(k in lower for k in ["计划"]):
        return pack(_tool_query_plans, {}, "plan")
    if any(k in lower for k in ["决策", "建议", "调度优化", "怎么调"]):
        return pack(_tool_suggest_liquidity_decision, {}, "plan")
    if any(k in lower for k in ["预警汇总", "异常汇总", "待办风险"]):
        return pack(_tool_collect_exception_alerts, {}, "dashboard")
    return pack(_tool_dashboard_summary, {}, "dashboard")
