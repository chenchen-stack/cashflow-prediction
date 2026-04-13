"""
智能归因（规则+分解）与排程评分（多因子权重），输出可解释结构。
"""
from __future__ import annotations

import math
from typing import Any, Dict, List, Optional


def math_log1p_safe(x: float) -> float:
    return math.log1p(max(x, 0.0))


def attribute_plan_deviation(plan_data: Dict[str, float], actual_data: Dict[str, float]) -> Dict[str, Any]:
    """对比计划科目与执行（或预测）值，按偏差率排序归因"""
    rows = []
    for k, pv in plan_data.items():
        av = actual_data.get(k, 0.0)
        try:
            pv, av = float(pv), float(av)
        except (TypeError, ValueError):
            continue
        dev = av - pv
        pct = (dev / pv * 100.0) if abs(pv) > 1e-6 else 0.0
        rows.append(
            {
                "subject": k,
                "planned": pv,
                "actual": av,
                "deviation": dev,
                "deviation_pct": round(pct, 2),
            }
        )
    rows.sort(key=lambda x: abs(x["deviation"]), reverse=True)
    return {
        "ranked": rows[:20],
        "summary": "按绝对偏差排序；可下钻至业务单据（需对接 ERP 明细接口）",
        "method": "deterministic_delta",
    }


def schedule_rank(pool_rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    pool_rows: dict 列表含 priority, amount, expect_date, biz_type
    评分 = P0 权重 100 / P1 50 + log1p(amount)/20 + 业务类型微调
    """
    scored = []
    for r in pool_rows:
        pr = (r.get("priority") or "P1").upper()
        w_prio = 100.0 if pr == "P0" else 50.0
        amt = float(r.get("amount") or 0)
        biz = (r.get("biz_type") or "").lower()
        biz_bonus = 5.0 if "薪酬" in biz or "工资" in biz else 0.0
        if "税" in biz:
            biz_bonus += 3.0
        score = w_prio + math_log1p_safe(amt) / 20.0 + biz_bonus
        scored.append(
            {
                **r,
                "score": round(score, 4),
                "factors": {
                    "priority_weight": w_prio,
                    "amount_log": round(math_log1p_safe(amt), 4),
                    "biz_bonus": biz_bonus,
                },
            }
        )
    scored.sort(key=lambda x: -x["score"])
    transfer_suggestion = []
    if scored:
        top = scored[0]
        transfer_suggestion.append(
            {
                "from": "集团归集户",
                "to": top.get("unit", "") + " 支出户",
                "amount": top.get("amount"),
                "reason": "满足首笔高分付款的头寸（演示）",
            }
        )
    return {"ranked": scored, "transfer_suggestions": transfer_suggestion, "method": "weighted_score"}
