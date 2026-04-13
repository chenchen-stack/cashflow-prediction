"""校验与计划取数辅助逻辑"""
import json
from datetime import date
from typing import Any, Dict, List, Optional, Tuple

FREQ_ORDER = ["天", "周", "月", "季", "年"]
MAX_LEN = {"天": 30, "周": 31, "月": 36, "季": 20, "年": 5}


def validate_periods_json(s: str) -> Tuple[bool, str]:
    try:
        arr = json.loads(s)
    except Exception:
        return False, "时间段 JSON 无效"
    if not isinstance(arr, list):
        return False, "时间段须为数组"
    last_idx = -1
    for seg in arr:
        if not isinstance(seg, dict):
            return False, "时间段每项须为对象"
        freq = seg.get("freq")
        try:
            ln = int(seg.get("length", 0))
        except (TypeError, ValueError):
            return False, "长度须为整数"
        if freq not in FREQ_ORDER:
            return False, "频率只能是天/周/月/季/年"
        idx = FREQ_ORDER.index(freq)
        if last_idx >= 0 and idx <= last_idx:
            return False, "频率请按天、周、月、季、年的顺序录入"
        last_idx = idx
        if ln < 1 or ln > MAX_LEN.get(freq, 99):
            return False, "天、周、月、季、年支持的最大长度分别为30、31、36、20、5，请修改"
    return True, ""


def sum_flows_for_subjects(records: List[Any], subject_ids: set) -> float:
    t = 0.0
    for r in records:
        try:
            flows = json.loads(r.flows_json or "[]")
        except Exception:
            continue
        for fl in flows:
            sid = fl.get("subject_id")
            if sid in subject_ids:
                t += abs(float(fl.get("amount", 0) or 0))
    return t


def sum_analysis_for_subjects(rows: List[dict], subject_ids: set, num_periods: int) -> float:
    total = 0.0

    def walk(ns: Optional[List[dict]]):
        nonlocal total
        for n in ns or []:
            if n.get("id") in subject_ids:
                vals = n.get("values") or [0] * num_periods
                total += sum(float(x or 0) for x in vals)
            walk(n.get("children"))

    walk(rows)
    return total


def actual_by_plan_subject_for_unit(db, unit: str, SubjectPlanMap, CashflowRecord) -> Dict[str, float]:
    """
    按「计划科目」汇总该单位在资金流中的实际执行额（与 build_plan_data_from_cashflow 同源逻辑）。
    """
    maps = (
        db.query(SubjectPlanMap)
        .filter(SubjectPlanMap.valid == True, SubjectPlanMap.is_deleted == False)
        .all()
    )
    recs = (
        db.query(CashflowRecord)
        .filter(
            CashflowRecord.unit == unit,
            CashflowRecord.is_deleted == False,
        )
        .all()
    )
    data: Dict[str, float] = {}
    for m in maps:
        pname = (m.plan_subject_name or "").strip() or "未命名"
        try:
            sids = set(json.loads(m.subject_ids or "[]"))
        except Exception:
            sids = set()
        if not sids:
            continue
        amt = sum_flows_for_subjects(recs, sids)
        sign = -1.0 if m.direction == "流出" else 1.0
        data[pname] = round(sign * amt, 2)
    return data


def budget_by_plan_subject_for_unit(db, unit: str, CapitalPlan, period_label: Optional[str]) -> Dict[str, float]:
    """从资金计划快照读取各计划科目的批复预算（data_json）。"""
    q = (
        db.query(CapitalPlan)
        .filter(CapitalPlan.unit == unit, CapitalPlan.is_deleted == False)
    )
    if period_label:
        q = q.filter(CapitalPlan.period_label == period_label)
    plan = q.order_by(CapitalPlan.id.desc()).first()
    if not plan:
        return {}
    try:
        raw = json.loads(plan.data_json or "{}")
    except Exception:
        return {}
    if not isinstance(raw, dict):
        return {}
    out: Dict[str, float] = {}
    for k, v in raw.items():
        try:
            out[str(k)] = round(float(v or 0), 2)
        except (TypeError, ValueError):
            continue
    return out


def merge_sum_float_dicts(dicts: List[Dict[str, float]]) -> Dict[str, float]:
    out: Dict[str, float] = {}
    for d in dicts:
        for k, v in d.items():
            out[k] = round(out.get(k, 0.0) + float(v or 0), 2)
    return out


def build_plan_subject_execution_detail(
    db,
    unit: str,
    period_label: Optional[str],
    SubjectPlanMap,
    CashflowRecord,
    CapitalPlan,
) -> List[Dict[str, Any]]:
    """
    科目级：预算（计划快照）、实际（资金流汇总）、执行偏差率 (预算-实际)/预算。
    unit=集团汇总 时对 总部/华东/华南 聚合。
    """
    group_units = ["总部", "华东子公司", "华南子公司"]
    units = group_units if (unit or "").strip() == "集团汇总" else [(unit or "").strip() or "总部"]

    budget_maps = [budget_by_plan_subject_for_unit(db, u, CapitalPlan, period_label) for u in units]
    actual_maps = [actual_by_plan_subject_for_unit(db, u, SubjectPlanMap, CashflowRecord) for u in units]
    budget_merged = merge_sum_float_dicts(budget_maps)
    actual_merged = merge_sum_float_dicts(actual_maps)

    names_order: List[str] = []
    for m in (
        db.query(SubjectPlanMap)
        .filter(SubjectPlanMap.valid == True, SubjectPlanMap.is_deleted == False)
        .order_by(SubjectPlanMap.id)
        .all()
    ):
        pname = (m.plan_subject_name or "").strip() or "未命名"
        if pname not in names_order:
            names_order.append(pname)

    all_keys = set(names_order) | set(budget_merged.keys()) | set(actual_merged.keys())
    rows: List[Dict[str, Any]] = []
    for pname in all_keys:
        bud = float(budget_merged.get(pname, 0) or 0)
        act = float(actual_merged.get(pname, 0) or 0)
        if bud == 0 and act == 0:
            continue
        if bud != 0:
            dev = round((bud - act) / bud, 6)
        else:
            dev = None
        rows.append({
            "plan_subject": pname,
            "subject_name": pname,
            "budget": bud,
            "actual": act,
            "deviation_rate": dev,
        })

    def _sort_key(r: Dict[str, Any]):
        d = r.get("deviation_rate")
        if d is None:
            return float("-1e9")
        return float(d)

    rows.sort(key=_sort_key, reverse=True)
    return rows


def build_plan_data_from_cashflow(db, plan, SubjectPlanMap, CashflowRecord) -> Dict[str, float]:
    maps = (
        db.query(SubjectPlanMap)
        .filter(SubjectPlanMap.valid == True, SubjectPlanMap.is_deleted == False)
        .all()
    )
    recs = (
        db.query(CashflowRecord)
        .filter(
            CashflowRecord.unit == plan.unit,
            CashflowRecord.is_deleted == False,
        )
        .all()
    )
    data: Dict[str, float] = {}
    for m in maps:
        pname = (m.plan_subject_name or "").strip() or "未命名"
        try:
            sids = set(json.loads(m.subject_ids or "[]"))
        except Exception:
            sids = set()
        if not sids:
            continue
        amt = sum_flows_for_subjects(recs, sids)
        sign = -1.0 if m.direction == "流出" else 1.0
        data[pname] = round(sign * amt, 2)
    return data


def build_plan_data_from_analysis(db, plan, SubjectPlanMap, AnalysisReport, report_id: int) -> Dict[str, float]:
    rpt = db.query(AnalysisReport).get(report_id)
    if not rpt:
        return {}
    try:
        res = json.loads(rpt.result_json or "{}")
    except Exception:
        return {}
    rows = res.get("rows") or []
    periods = res.get("periods") or []
    n = len(periods)
    maps = (
        db.query(SubjectPlanMap)
        .filter(SubjectPlanMap.valid == True, SubjectPlanMap.is_deleted == False)
        .all()
    )
    data: Dict[str, float] = {}
    for m in maps:
        pname = (m.plan_subject_name or "").strip() or "未命名"
        try:
            sids = set(json.loads(m.subject_ids or "[]"))
        except Exception:
            sids = set()
        if not sids:
            continue
        amt = sum_analysis_for_subjects(rows, sids, n)
        sign = -1.0 if m.direction == "流出" else 1.0
        data[pname] = round(sign * abs(amt), 2)
    return data


def default_flows_json(db, CashflowBusiness, BizFlowInfo, CashflowSubject, biz_id: Optional[int], amount: float, currency: str, trade_d: Optional[date], status: str) -> str:
    if not biz_id:
        return json.dumps([], ensure_ascii=False)
    b = db.query(CashflowBusiness).get(biz_id)
    if not b:
        return json.dumps([], ensure_ascii=False)
    fl = (
        db.query(BizFlowInfo)
        .filter(BizFlowInfo.biz_id == biz_id)
        .first()
    )
    sid = fl.subject_id if fl and fl.subject_id else None
    if not sid:
        leaf = (
            db.query(CashflowSubject)
            .filter(CashflowSubject.valid == True, CashflowSubject.is_deleted == False, CashflowSubject.is_period == "否")
            .first()
        )
        sid = leaf.id if leaf else None
    fd = trade_d.isoformat() if trade_d else date.today().isoformat()
    amt = float(amount or 0)
    row = {
        "flow_date": fd,
        "flow_type": fl.flow_type if fl else "本金",
        "currency": currency or "CNY",
        "amount": amt,
        "subject_id": sid,
        "status": status,
    }
    return json.dumps([row], ensure_ascii=False)


def last_n_months_yms(n: int, anchor: date) -> List[str]:
    """从 anchor 所在月起向前共 n 个自然月，升序，格式 YYYY-MM。"""
    y, m = anchor.year, anchor.month
    acc: List[str] = []
    for _ in range(n):
        acc.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    acc.reverse()
    return acc


def build_budget_forecast_matrix(
    db,
    CashflowRecord,
    CapitalPlan,
    n_months: int,
    anchor: date,
) -> Dict[str, Any]:
    """
    预算预测表：单位 × 最近 n 个月净额 + 额度 / 计划上报 / 执行数（演示口径与 PRD 对齐）。
    月度单元格 = 该单位已确认 CNY 单据按月净额汇总。
    """
    from liquidity_engine import monthly_from_records

    months = last_n_months_yms(n_months, anchor)
    units = ["总部", "华东子公司", "华南子公司"]
    rows_out: List[Dict[str, Any]] = []
    for unit in units:
        mlist = monthly_from_records(db, CashflowRecord, unit, ["已确认"])
        ym_to_net = {x["year_month"]: round(float(x["net"]), 2) for x in mlist}
        month_cells = {ym: ym_to_net.get(ym, 0.0) for ym in months}
        executed = round(sum(month_cells.values()), 2)
        pl = (
            db.query(CapitalPlan)
            .filter(CapitalPlan.unit == unit, CapitalPlan.is_deleted == False)
            .order_by(CapitalPlan.id.desc())
            .first()
        )
        plan_report = 0.0
        if pl:
            try:
                dj = json.loads(pl.data_json or "{}")
                if isinstance(dj, dict):
                    plan_report = round(sum(abs(float(v or 0)) for v in dj.values()), 2)
            except Exception:
                plan_report = 0.0
        quota = round(plan_report * 1.05, 2) if plan_report else round(max(executed * 1.05, 0.01), 2)
        if not plan_report:
            plan_report = round(executed * 0.98, 2)
        rows_out.append({
            "unit": unit,
            "month_cells": month_cells,
            "quota": quota,
            "plan_report": plan_report,
            "executed": executed,
        })
    return {"months": months, "rows": rows_out, "anchor": anchor.isoformat()}


def build_budget_month_drill(
    db,
    CashflowRecord,
    CashflowSubject,
    unit: str,
    year_month: str,
) -> Dict[str, Any]:
    """点击预算表某月单元格：科目名称 + 净额，明细之和与月度汇总净额一致。"""
    from liquidity_engine import monthly_from_records, monthly_subject_flows_from_records

    u = (unit or "").strip() or None
    rows = monthly_subject_flows_from_records(db, CashflowRecord, CashflowSubject, year_month, u, True)
    sum_subjects = round(sum(float(r.get("net") or 0) for r in rows), 2)
    mlist = monthly_from_records(db, CashflowRecord, u, ["已确认"])
    cell_total = 0.0
    for m in mlist:
        if m["year_month"] == year_month:
            cell_total = round(float(m["net"]), 2)
            break
    items = [
        {"subject_name": r["subject_name"], "amount": round(float(r["net"]), 2)}
        for r in rows
    ]
    return {
        "unit": unit or "",
        "year_month": year_month,
        "items": items,
        "cell_total": cell_total,
        "sum_subjects": sum_subjects,
        "delta": round(cell_total - sum_subjects, 2),
    }
