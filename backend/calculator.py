"""
calculator.py — 资金预测分析计算引擎
区间段生成 · 行列构建 · 格子计算 · 头寸递推
"""

import json
from datetime import date, datetime, timedelta
from collections import defaultdict
from typing import Optional
from database import (
    CashflowRecord, CashflowSubject,
    TimePeriodConfig,
    BankAccount, AccountBalanceFlow,
)


# ═══════════════════════════════════════════
#  1. 区间段生成
# ═══════════════════════════════════════════

def _monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _month_start(d: date) -> date:
    return d.replace(day=1)


def _quarter_start(d: date) -> date:
    m = ((d.month - 1) // 3) * 3 + 1
    return d.replace(month=m, day=1)


def _year_start(d: date) -> date:
    return d.replace(month=1, day=1)


def _next_month(d: date) -> date:
    if d.month == 12:
        return d.replace(year=d.year + 1, month=1, day=1)
    return d.replace(month=d.month + 1, day=1)


def _next_quarter(d: date) -> date:
    m = ((d.month - 1) // 3) * 3 + 4
    if m > 12:
        return date(d.year + 1, m - 12, 1)
    return date(d.year, m, 1)


def generate_periods(start: date, config_json: list) -> list:
    """
    生成时间区间列表。
    config_json: [{"freq":"天","length":7}, {"freq":"周","length":4}, ...]
    返回 [{"label":"03/25", "start":"2026-03-25", "end":"2026-03-25", "freq":"天"}, ...]
    """
    periods = []
    cursor = start

    for seg in config_json:
        freq = seg["freq"]
        length = seg["length"]
        for _ in range(length):
            if freq == "天":
                periods.append({
                    "label": cursor.strftime("%m/%d"),
                    "start": cursor.isoformat(),
                    "end": cursor.isoformat(),
                    "freq": freq,
                })
                cursor += timedelta(days=1)
            elif freq == "周":
                week_end = cursor + timedelta(days=6)
                periods.append({
                    "label": f"{cursor.strftime('%m/%d')}~{week_end.strftime('%m/%d')}",
                    "start": cursor.isoformat(),
                    "end": week_end.isoformat(),
                    "freq": freq,
                })
                cursor = week_end + timedelta(days=1)
            elif freq == "月":
                month_end = _next_month(cursor) - timedelta(days=1)
                periods.append({
                    "label": cursor.strftime("%Y-%m"),
                    "start": cursor.isoformat(),
                    "end": month_end.isoformat(),
                    "freq": freq,
                })
                cursor = _next_month(cursor)
            elif freq == "季":
                quarter_end = _next_quarter(cursor) - timedelta(days=1)
                periods.append({
                    "label": f"{cursor.year}Q{(cursor.month - 1)//3 + 1}",
                    "start": cursor.isoformat(),
                    "end": quarter_end.isoformat(),
                    "freq": freq,
                })
                cursor = _next_quarter(cursor)
            elif freq == "年":
                year_end = date(cursor.year, 12, 31)
                periods.append({
                    "label": str(cursor.year),
                    "start": cursor.isoformat(),
                    "end": year_end.isoformat(),
                    "freq": freq,
                })
                cursor = date(cursor.year + 1, 1, 1)
    return periods


# ═══════════════════════════════════════════
#  2. 行结构构建
# ═══════════════════════════════════════════

def build_row_tree(db) -> list:
    """
    从 CashflowSubject 表构造行树。
    返回 [{"id":1, "code":"100", "name":"期初余额", "children":[], "direction":"流入", ...}, ...]
    """
    subjects = (
        db.query(CashflowSubject)
        .filter(CashflowSubject.valid == True, CashflowSubject.is_deleted == False)
        .all()
    )
    by_id = {}
    for s in subjects:
        by_id[s.id] = {
            "id": s.id, "code": s.code, "name": s.name,
            "direction": s.direction, "is_period": s.is_period,
            "parent_id": s.parent_id, "children": [],
        }
    roots = []
    for node in by_id.values():
        pid = node["parent_id"]
        if pid and pid in by_id:
            by_id[pid]["children"].append(node)
        else:
            roots.append(node)
    roots.sort(key=lambda x: x["code"])
    return roots


# ═══════════════════════════════════════════
#  3. 格子计算 — 按科目 × 时间段聚合金额
# ═══════════════════════════════════════════

def _collect_leaf_ids(node) -> list:
    if not node["children"]:
        return [node["id"]]
    ids = []
    for ch in node["children"]:
        ids.extend(_collect_leaf_ids(ch))
    return ids


def compute_cells(db, rows: list, periods: list, unit=None, currency=None) -> dict:
    """
    返回 cells = { subject_id: [amount_per_period_0, amount_per_period_1, ...], ... }
    先聚合叶子科目, 再自底向上汇总父科目。
    """
    q = db.query(CashflowRecord).filter(CashflowRecord.is_deleted == False)
    if unit:
        q = q.filter(CashflowRecord.unit == unit)
    if currency:
        q = q.filter(CashflowRecord.currency == currency)
    records = q.all()

    leaf_cells = defaultdict(lambda: [0.0] * len(periods))

    for rec in records:
        flows = json.loads(rec.flows_json or "[]")
        for fl in flows:
            fd = fl.get("flow_date")
            sid = fl.get("subject_id")
            amt = fl.get("amount", 0)
            fcur = fl.get("currency") or rec.currency
            if currency and fcur and fcur != currency:
                continue
            if not fd or not sid:
                continue
            flow_date = date.fromisoformat(fd) if isinstance(fd, str) else fd
            for pi, p in enumerate(periods):
                ps = date.fromisoformat(p["start"])
                pe = date.fromisoformat(p["end"])
                if ps <= flow_date <= pe:
                    leaf_cells[sid][pi] += amt
                    break

    cells = {}

    def _aggregate(node):
        nid = node["id"]
        if not node["children"]:
            cells[nid] = list(leaf_cells[nid])
        else:
            for ch in node["children"]:
                _aggregate(ch)
            cells[nid] = [0.0] * len(periods)
            for ch in node["children"]:
                for pi in range(len(periods)):
                    cells[nid][pi] += cells[ch["id"]][pi]

    for r in rows:
        _aggregate(r)

    return cells


def aggregate_bank_flows_by_period(db, periods: list, unit: Optional[str], currency: Optional[str]) -> list:
    """
    银行账户流水（AccountBalanceFlow）按区间汇总，供 PRD 3.1.4 数据源「银行流水」与资金流并列输出。
    """
    q = (
        db.query(AccountBalanceFlow)
        .join(BankAccount, AccountBalanceFlow.account_id == BankAccount.id)
        .filter(BankAccount.is_deleted == False)
    )
    if unit:
        q = q.filter(BankAccount.unit == unit)
    if currency:
        q = q.filter(BankAccount.currency == currency)
    tot = [0.0] * len(periods)
    for row in q.all():
        fd = row.flow_date
        if not fd:
            continue
        for pi, p in enumerate(periods):
            ps = date.fromisoformat(p["start"])
            pe = date.fromisoformat(p["end"])
            if ps <= fd <= pe:
                tot[pi] += float(row.net_amount or 0)
                break
    return tot


# ═══════════════════════════════════════════
#  4. 头寸递推
# ═══════════════════════════════════════════

def compute_position(rows: list, cells: dict, num_periods: int, opening_balance: float = 0) -> dict:
    """
    期初余额 + 流入 − 流出 = 期末余额
    逐期递推。
    返回 position = { "opening": [...], "inflow": [...], "outflow": [...], "closing": [...] }
    """
    opening = [0.0] * num_periods
    inflow = [0.0] * num_periods
    outflow = [0.0] * num_periods
    closing = [0.0] * num_periods

    row_by_code = {}
    def _index_by_code(node):
        row_by_code[node["code"]] = node
        for ch in node["children"]:
            _index_by_code(ch)
    for r in rows:
        _index_by_code(r)

    inflow_roots = [n for n in rows if n["direction"] == "流入" and n["is_period"] == "否"]
    outflow_roots = [n for n in rows if n["direction"] == "流出" and n["is_period"] == "否"]

    for pi in range(num_periods):
        opening[pi] = opening_balance if pi == 0 else closing[pi - 1]
        for node in inflow_roots:
            inflow[pi] += cells.get(node["id"], [0.0] * num_periods)[pi]
        for node in outflow_roots:
            outflow[pi] += abs(cells.get(node["id"], [0.0] * num_periods)[pi])
        closing[pi] = opening[pi] + inflow[pi] - outflow[pi]

    return {"opening": opening, "inflow": inflow, "outflow": outflow, "closing": closing}


# ═══════════════════════════════════════════
#  5. 主入口 — build_analysis
# ═══════════════════════════════════════════

def build_analysis(db, params: dict) -> dict:
    """
    接收 params:
    {unit, date_from, date_to, period_config_code, opening_balance}
    返回完整分析结果。
    """
    config_code = params.get("period_config_code", "TP0001")
    tpc = (
        db.query(TimePeriodConfig)
        .filter(TimePeriodConfig.code == config_code, TimePeriodConfig.is_deleted == False)
        .first()
    )
    if not tpc:
        periods_cfg = [{"freq": "天", "length": 14}, {"freq": "月", "length": 2}]
    else:
        periods_cfg = json.loads(tpc.periods_json)

    start_date = date.today()
    if params.get("date_from"):
        start_date = date.fromisoformat(params["date_from"])

    periods = generate_periods(start_date, periods_cfg)
    rows = build_row_tree(db)
    cells = compute_cells(
        db, rows, periods,
        unit=params.get("unit"),
        currency=params.get("currency"),
    )
    opening = params.get("opening_balance", 0) or 0
    position = compute_position(rows, cells, len(periods), opening)
    bank_period_flows = aggregate_bank_flows_by_period(
        db, periods, params.get("unit"), params.get("currency")
    )

    def _serialize_rows(nodes):
        out = []
        for n in nodes:
            out.append({
                "id": n["id"], "code": n["code"], "name": n["name"],
                "direction": n["direction"], "is_period": n["is_period"],
                "values": cells.get(n["id"], [0.0] * len(periods)),
                "children": _serialize_rows(n["children"]),
            })
        return out

    return {
        "periods": periods,
        "rows": _serialize_rows(rows),
        "position": position,
        "bank_statement_period_totals": bank_period_flows,
        "data_sources": {
            "cashflow_records": True,
            "bank_account_flows": bool(sum(abs(x) for x in bank_period_flows) > 1e-9),
            "third_party_balances": False,
        },
    }
