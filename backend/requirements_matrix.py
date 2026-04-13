"""
智能财务中台 · 能力矩阵（结构化能力清单与落地锚点）
GET /api/meta/requirements-matrix — 供中台「能力全景」页展示。
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List


def _row(
    dim: str,
    status: str,
    note: str,
    *,
    backend: str = "",
) -> Dict[str, Any]:
    return {
        "dimension": dim,
        "status": status,
        "note": note,
        "backend_surface": backend,
    }


def get_requirements_matrix() -> Dict[str, Any]:
    """status ∈ implemented | partial | planned | external"""
    layers: List[Dict[str, Any]] = [
        _row(
            "L1 数据集合",
            "partial",
            "REST + SQLite 持久化、映射规则、集成取数、来源权威性；多租户实时湖与外部 ERP/银企生产连接需按项目接入。",
            backend="main.py /api/mapping-rules /api/integrations/fetch /api/records",
        ),
        _row(
            "L2 规则沉淀",
            "partial",
            "PRD 科目编码/父子链、业务类型枚举、映射唯一性、取数任务 extra_json、时间段由细到粗递增等已在 prd_rules/api_helpers 落地；付款排程日历与拆票等可继续扩展。",
            backend="prd_rules.py api_helpers.py /api/payment-strategies / Accio ruleEngine(local)",
        ),
        _row(
            "L3 智能驱动",
            "partial",
            "ML 时序（Prophet/LSTM/sklearn 回退）、情景压力 services/cashflow_scenario.py、预测快照与偏差 API、归因与排程排序、银企模拟；本地大模型与 RAG 可按部署接入。",
            backend="services/ml_timeseries.py services/cashflow_scenario.py /api/ml/* /agent_intel.py",
        ),
        _row(
            "L4 场景落地",
            "partial",
            "工作台业务能力入口与各业务页；移动端原生、定时经营报告、全链路核销回传等可按交付阶段扩展。",
            backend="frontend accio + main.py 静态托管",
        ),
    ]

    constraints: List[Dict[str, Any]] = [
        _row("不替换核心 ERP", "partial", "以对接与映射为主；需客户侧接口契约与联调。"),
        _row("本地化部署", "partial", "FastAPI+SQLite 可内网部署；大模型推理可切换为本地推理服务（如 Ollama/vLLM）。"),
        _row("AI 可解释可追溯", "partial", "对话与工具输出可附依据；统一 trace_id 与数据血缘可继续工程化。"),
    ]

    modules: List[Dict[str, Any]] = [
        _row("智能付款排程", "partial", "待付款池、策略、/api/ml/scheduling、银企 submit；单位+业务类型分时策略、过期改期串行等可迭代。", backend="/api/payment-pool /api/ml/scheduling /api/bank/payments/submit"),
        _row(
            "动态资金预测",
            "partial",
            "已落地：POST /api/ml/scenario/run（多假设压力测试+累计头寸）、POST /api/ml/forecast-snapshot、GET /api/ml/forecast-deviation（预测vs实际 MAE/MAPE）；NL 配参 Agent 与自动调参表可迭代。",
            backend="/api/analysis/* /api/ml/timeseries* /api/ml/scenario/run /api/ml/forecast-*",
        ),
        _row("资金计划", "partial", "计划 CRUD、fill-from-cashflow、归因 API；多级审批与矩阵强控可按流程引擎接入。", backend="/api/plans /api/ml/attribution"),
        _row("往来款", "partial", "应收应付预付 API；催收工作流与黑名单评分模型可迭代。", backend="/api/receivables /api/payables /api/prepaids"),
        _row("驾驶舱与自然语言", "partial", "看板统计、对话；定时报告与消息推送渠道可接入。", backend="/api/dashboard/stats /api/agent/chat"),
        _row("资金预警", "partial", "预警列表与级别；可配置规则与多渠道触达可迭代。", backend="/api/fund-alerts"),
    ]

    cashflow_suite: List[Dict[str, Any]] = [
        _row(
            "基础数据（科目/业务/映射）",
            "implemented",
            "科目代码 3/6/9… 位层级与父子链、业务类型 PRD 枚举、科目↔业务类别/计划映射唯一性与计划科目名唯一；时间段 JSON 频率段严格由细到粗。",
            backend="prd_rules.py api_helpers.py /api/subjects /api/businesses /api/subject-category-map /api/subject-plan-map /api/time-periods",
        ),
        _row(
            "资金流管理",
            "partial",
            "取数批次号（BATCH+时间戳）、单据、flows_json、状态与批量操作；导入双模板、审批级状态机与 ERP 级联查可按项目加深。",
            backend="/api/collections /api/records",
        ),
        _row(
            "资金流数据集成",
            "partial",
            "映射规则 MR、取数任务类型与 extra_json 校验、任务执行；筛选条件行、异常提醒人、周期表达式等可按需补全。",
            backend="prd_rules.py /api/mapping-rules /api/fetch-tasks",
        ),
        _row(
            "资金分析与预测",
            "partial",
            "复合区间、头寸递推、银行流水按区间汇总入报表；第三方余额等数据源与整表公式矩阵项仍以接入/对账为准。",
            backend="/api/analysis/run calculator.py",
        ),
        _row(
            "资金计划（与预测联动）",
            "partial",
            "data_source 限定资金流/分析预测、从两源填充；逐格与预测报表对账、多级审批可建回归与流程接入。",
            backend="/api/plans /fill-from-cashflow /fill-from-analysis",
        ),
    ]

    roadmap: List[Dict[str, Any]] = [
        {
            "phase": "P0",
            "title": "预测与情景 + 数据闭环",
            "items": [
                "能力矩阵接口与关键 API 冒烟纳入 CI",
                "分析报表与样例金额对账用例",
                "情景模拟 API：参数 JSON → 预测序列 + 假设说明（已实现 /api/ml/scenario/run）",
                "预测快照与偏差对比（已实现 forecast-snapshot / forecast-deviation）",
            ],
        },
        {
            "phase": "P1",
            "title": "排程与风控",
            "items": [
                "支付策略：单位×业务类型×运行时刻完整模型与日历",
                "预警规则配置与触发审计日志",
                "排程 trace 贯穿付款池→银企→核销",
            ],
        },
        {
            "phase": "P2",
            "title": "本地智能",
            "items": [
                "兼容本地推理端点，对话可切换",
                "检索增强：制度与科目知识切片入库",
                "预测偏差：实际 vs 预测回写",
            ],
        },
    ]

    return {
        "schema": "cf.capability_matrix.v2",
        "version": "1.3.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": (
            "主数据与 PRD 级校验（prd_rules）、资金流与集成、分析（含银行流水区间汇总）、计划与双源填充已可用；"
            "外部 ERP/银企全量实时、导入双模板、审批状态机、第三方余额全公式等按交付阶段扩展。"
        ),
        "layers": layers,
        "constraints": constraints,
        "modules": modules,
        "cashflow_suite": cashflow_suite,
        "roadmap": roadmap,
        # 与旧客户端字段兼容（同引用）
        "prd_layers": layers,
        "prd_constraints": constraints,
        "prd_modules": modules,
        "urs_sections": cashflow_suite,
    }
