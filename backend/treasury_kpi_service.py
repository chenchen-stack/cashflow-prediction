"""
司库 KPI 计算服务 — 将「数据映射与计算逻辑表」中的部分指标与现有库表打通（可演示、可扩展）。
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict, List

from sqlalchemy import func
from sqlalchemy.orm import Session

from database import (
    BankAccount,
    AccountBalanceFlow,
    CashflowRecord,
    FxExposure,
)


def _latest_closing_by_account(db: Session) -> Dict[int, float]:
    """各账户最近一条流水的期末余额。"""
    subq = (
        db.query(
            AccountBalanceFlow.account_id.label("aid"),
            func.max(AccountBalanceFlow.flow_date).label("mx"),
        )
        .group_by(AccountBalanceFlow.account_id)
        .subquery()
    )
    rows = (
        db.query(AccountBalanceFlow)
        .join(
            subq,
            (AccountBalanceFlow.account_id == subq.c.aid)
            & (AccountBalanceFlow.flow_date == subq.c.mx),
        )
        .all()
    )
    return {r.account_id: float(r.closing_balance or 0) for r in rows if r.closing_balance is not None}


def compute_treasury_kpi_snapshot(db: Session) -> Dict[str, Any]:
    """
    基于当前库内真实数据计算快照；缺表项返回 0 并注明说明。
    对齐附图逻辑中的可落地部分：账户余额汇总、账户数、收付汇总、敞口公式结构。
    """
    today = date.today()
    accs = db.query(BankAccount).filter(BankAccount.is_deleted == False).all()
    latest = _latest_closing_by_account(db)

    cny_general = 0.0
    fx_by_ccy: Dict[str, float] = {}
    normal_ct = 0
    for a in accs:
        if (a.status or "") == "启用" or (a.status or "") == "正常":
            normal_ct += 1
        bal = latest.get(a.id, 0.0)
        ccy = (a.currency or "CNY").upper()
        if ccy == "CNY":
            cny_general += bal
        else:
            fx_by_ccy[ccy] = fx_by_ccy.get(ccy, 0.0) + bal

    # 资金流：本月实际（简化：按记录日期过滤）
    month_start = date(today.year, today.month, 1)
    recs = (
        db.query(CashflowRecord)
        .filter(CashflowRecord.is_deleted == False)
        .filter(CashflowRecord.flow_date >= month_start)
        .all()
    )
    inflow = 0.0
    outflow = 0.0
    for r in recs:
        amt = float(r.amount or 0)
        if (r.direction or "") == "流入":
            inflow += amt
        else:
            outflow += amt

    monthly_gap = inflow - outflow

    fx_rows = db.query(FxExposure).all()
    fx_notional = sum(float(x.notional or 0) for x in fx_rows)

    return {
        "as_of": datetime.now().isoformat(timespec="seconds"),
        "group_liquidity": {
            "account_balance_cny_sum": round(cny_general, 2),
            "fx_balances_by_currency": {k: round(v, 2) for k, v in sorted(fx_by_ccy.items())},
            "note_bills_supply_placeholder": "持有票据/供应链金融需承兑汇票业务表；演示库未建专表时显示占位",
            "bills_held_demo": 0.0,
            "scf_held_demo": 0.0,
        },
        "account_stats": {
            "total_accounts": len(accs),
            "normal_accounts": normal_ct,
            "dormant_accounts_demo": max(0, len(accs) - normal_ct),
        },
        "collections_payments_mtd": {
            "period": f"{today.year}-{today.month:02d}",
            "inflow_from_records": round(inflow, 2),
            "outflow_from_records": round(outflow, 2),
            "monthly_gap": round(monthly_gap, 2),
        },
        "fx_watch": {
            "exposure_lines": len(fx_rows),
            "total_notional_cny_approx": round(fx_notional, 2),
        },
        "forecast_position_formula": {
            "monthly_gap": "当月总流入 − 总流出（来自 cashflow_records 当月汇总）",
            "cumulative_gap": "本月 gap + 上月累计敞口（需月度结转表；当前仅返回本月）",
            "cumulative_gap_demo": round(monthly_gap, 2),
        },
    }
