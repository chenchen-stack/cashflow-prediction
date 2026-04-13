"""
智能财务中台 REST：付款池、往来、预警、ML 时序、归因、排程、银企模拟
"""
from __future__ import annotations

import json
from collections import defaultdict
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from database import (
    SessionLocal,
    PaymentPoolItem,
    PaymentStrategy,
    ArapDocument,
    FundAlert,
    BankPaymentOrder,
    CashflowRecord,
    CapitalPlan,
    ForecastSnapshot,
)
try:
    from services.ml_timeseries import combined_forecast, build_daily_net_from_records
except ImportError:  # numpy / pandas 未安装时仍可启动主服务

    def combined_forecast(dates, values, horizon=14, methods=None):
        return {
            "error": "ML 依赖未安装",
            "hint": "pip install numpy pandas scikit-learn",
            "prophet": {"meta": {"backend": "unavailable"}},
            "lstm": {"meta": {"backend": "unavailable"}},
        }

    def build_daily_net_from_records(records):
        return [], []


try:
    from services.cashflow_scenario import run_scenario, build_snapshot_parts
except ImportError:

    def run_scenario(*args, **kwargs):
        return {"error": "scenario_module_unavailable", "message": "cashflow_scenario 不可用"}

    def build_snapshot_parts(*args, **kwargs):
        raise RuntimeError("scenario_module_unavailable")


from services.bank_gateway import submit_payments, query_status
from services.agent_intel import attribute_plan_deviation, schedule_rank

router = APIRouter(tags=["智能财务中台"])


def _d(obj):
    d = {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
    for k, v in list(d.items()):
        if isinstance(v, (date, datetime)):
            d[k] = v.isoformat()
    return d


# ── 付款池 / 策略 ─────────────────────────────


@router.get("/api/payment-pool")
def list_payment_pool():
    db = SessionLocal()
    try:
        q = db.query(PaymentPoolItem).filter(PaymentPoolItem.is_deleted == False)
        return [_d(r) for r in q.order_by(PaymentPoolItem.expect_date, PaymentPoolItem.id).all()]
    finally:
        db.close()


class PaymentPoolIn(BaseModel):
    unit: str
    biz_type: str
    counterparty: str = ""
    amount: float = 0
    expect_date: Optional[str] = None
    priority: str = "P1"
    status: str = "待排程"
    run_at: str = ""
    source_doc: str = ""


@router.post("/api/payment-pool")
def create_payment_pool(body: PaymentPoolIn):
    db = SessionLocal()
    try:
        ed = None
        if body.expect_date:
            ed = date.fromisoformat(body.expect_date[:10])
        obj = PaymentPoolItem(
            unit=body.unit,
            biz_type=body.biz_type,
            counterparty=body.counterparty,
            amount=body.amount,
            expect_date=ed,
            priority=body.priority,
            status=body.status,
            run_at=body.run_at,
            source_doc=body.source_doc,
        )
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return _d(obj)
    finally:
        db.close()


@router.get("/api/payment-strategies")
def list_payment_strategies():
    db = SessionLocal()
    try:
        q = db.query(PaymentStrategy).filter(PaymentStrategy.is_deleted == False)
        return [_d(r) for r in q.all()]
    finally:
        db.close()


# ── 往来款 ─────────────────────────────


def _arap_list(ar_type: str):
    db = SessionLocal()
    try:
        q = db.query(ArapDocument).filter(ArapDocument.is_deleted == False, ArapDocument.ar_type == ar_type.upper())
        rows = [_d(r) for r in q.all()]
        for r in rows:
            nm = r.get("name", "")
            if ar_type.upper() == "AR":
                r["customer"] = nm
            elif ar_type.upper() == "AP":
                r["vendor"] = nm
            else:
                r["project"] = nm
        return rows
    finally:
        db.close()


@router.get("/api/receivables")
def list_receivables():
    return _arap_list("AR")


@router.get("/api/payables")
def list_payables():
    return _arap_list("AP")


@router.get("/api/prepaids")
def list_prepaids():
    return _arap_list("PRE")


# ── 预警 ─────────────────────────────


@router.get("/api/fund-alerts")
def list_fund_alerts(cleared: Optional[bool] = False):
    db = SessionLocal()
    try:
        q = db.query(FundAlert).filter(FundAlert.is_cleared == cleared)
        rows = [_d(r) for r in q.order_by(FundAlert.id.desc()).all()]
        for r in rows:
            r["time"] = r.get("alert_time", "")
            r["page"] = r.get("link_page", "payment")
        return rows
    finally:
        db.close()


# ── ML 时序 ─────────────────────────────


class TimeseriesIn(BaseModel):
    dates: List[str] = Field(default_factory=list)
    values: List[float] = Field(default_factory=list)
    horizon: int = 14
    methods: Optional[List[str]] = Field(default=None, description="prophet / lstm")


@router.post("/api/ml/timeseries")
def ml_timeseries(body: TimeseriesIn):
    m = body.methods or ["prophet", "lstm"]
    return combined_forecast(body.dates, body.values, body.horizon, m)


@router.get("/api/ml/timeseries/from-records")
def ml_timeseries_from_records(unit: Optional[str] = None, horizon: int = 14, methods: str = "prophet,lstm"):
    db = SessionLocal()
    try:
        q = db.query(CashflowRecord).filter(CashflowRecord.is_deleted == False)
        if unit:
            q = q.filter(CashflowRecord.unit == unit)
        recs = q.all()
        dates, values = build_daily_net_from_records(recs)
        mlist = [x.strip() for x in methods.split(",") if x.strip()]
        return {
            "unit": unit or "全部",
            "series": {"dates": dates, "values": values},
            "forecast": combined_forecast(dates, values, horizon, mlist),
        }
    finally:
        db.close()


def _actual_daily_net_map(db, unit: Optional[str]) -> Dict[str, float]:
    q = db.query(CashflowRecord).filter(CashflowRecord.is_deleted == False)
    if unit:
        q = q.filter(CashflowRecord.unit == unit)
    daily: Dict[str, float] = defaultdict(float)
    for r in q.all():
        if not r.trade_date:
            continue
        k = r.trade_date.isoformat()[:10]
        amt = r.amount_cny if r.amount_cny is not None else (r.amount or 0)
        daily[k] += float(amt)
    return daily


class ScenarioIn(BaseModel):
    unit: Optional[str] = None
    horizon: int = 30
    opening_balance: float = 0
    methods: List[str] = Field(default_factory=lambda: ["prophet", "lstm"])
    recharge_decline_pct: float = 0
    supplier_surge_pct: float = 0
    supplier_surge_spread_days: int = 5
    supplier_lump_outflow: float = 0
    lump_outflow_offset: int = 0
    new_business_capex: float = 0
    capex_offset: int = 0
    rider_payroll_daily_extra: float = 0
    rider_payroll_days: int = 0
    collection_delay_days: int = 0
    fx_stress_pct: float = 0


@router.post("/api/ml/scenario/run")
def ml_scenario_run(body: ScenarioIn):
    """现金流情景压力测试：在 ML 基线日净额上叠加 PRD 假设，返回累计头寸与说明。"""
    db = SessionLocal()
    try:
        q = db.query(CashflowRecord).filter(CashflowRecord.is_deleted == False)
        if body.unit:
            q = q.filter(CashflowRecord.unit == body.unit)
        dates, values = build_daily_net_from_records(q.all())
        if not dates:
            raise HTTPException(400, "当前无资金流日净额数据，请先导入或录入单据")
        raw = body.dict()
        params = {
            k: raw[k]
            for k in (
                "recharge_decline_pct",
                "supplier_surge_pct",
                "supplier_surge_spread_days",
                "supplier_lump_outflow",
                "lump_outflow_offset",
                "new_business_capex",
                "capex_offset",
                "rider_payroll_daily_extra",
                "rider_payroll_days",
                "collection_delay_days",
                "fx_stress_pct",
            )
        }
        out = run_scenario(
            dates,
            values,
            horizon=body.horizon,
            opening_balance=body.opening_balance,
            params=params,
            methods=body.methods,
        )
        if out.get("error"):
            raise HTTPException(400, out.get("message", "scenario failed"))
        out["unit"] = body.unit or "全部"
        return out
    finally:
        db.close()


class ForecastSnapshotIn(BaseModel):
    unit: Optional[str] = None
    horizon: int = 14
    opening_balance: float = 0
    methods: List[str] = Field(default_factory=lambda: ["prophet", "lstm"])
    scenario_params: Optional[Dict[str, Any]] = None


@router.post("/api/ml/forecast-snapshot")
def ml_forecast_snapshot_save(body: ForecastSnapshotIn):
    """保存当前 blended 预测曲线，供后续与实际日净额对比（偏差分析 / 自学习入口）。"""
    db = SessionLocal()
    try:
        q = db.query(CashflowRecord).filter(CashflowRecord.is_deleted == False)
        if body.unit:
            q = q.filter(CashflowRecord.unit == body.unit)
        dates, values = build_daily_net_from_records(q.all())
        if not dates:
            raise HTTPException(400, "无历史数据，无法保存快照")
        try:
            fc, blended, fds, last = build_snapshot_parts(dates, values, body.horizon, body.methods)
        except RuntimeError as e:
            raise HTTPException(503, str(e)) from e
        snap = ForecastSnapshot(
            unit=body.unit,
            horizon=body.horizon,
            opening_balance=body.opening_balance,
            last_hist_date=last,
            history_length=len(dates),
            methods_json=json.dumps(body.methods, ensure_ascii=False),
            forecast_json=json.dumps(fc, ensure_ascii=False),
            blended_yhat_json=json.dumps(blended, ensure_ascii=False),
            future_dates_json=json.dumps(fds, ensure_ascii=False),
            scenario_params_json=json.dumps(body.scenario_params or {}, ensure_ascii=False),
        )
        db.add(snap)
        db.commit()
        db.refresh(snap)
        return {
            "id": snap.id,
            "created_at": snap.created_at.isoformat() if snap.created_at else "",
            "last_hist_date": last,
            "future_points": len(blended),
            "message": "预测快照已落库，可用于偏差对比",
        }
    finally:
        db.close()


@router.get("/api/ml/forecast-snapshot/list")
def ml_forecast_snapshot_list(limit: int = 20, unit: Optional[str] = None):
    db = SessionLocal()
    try:
        q = db.query(ForecastSnapshot).order_by(ForecastSnapshot.id.desc())
        if unit:
            q = q.filter(ForecastSnapshot.unit == unit)
        rows = q.limit(min(limit, 100)).all()
        out = []
        for s in rows:
            out.append(
                {
                    "id": s.id,
                    "created_at": s.created_at.isoformat() if s.created_at else "",
                    "unit": s.unit,
                    "horizon": s.horizon,
                    "last_hist_date": s.last_hist_date,
                    "history_length": s.history_length,
                }
            )
        return out
    finally:
        db.close()


@router.get("/api/ml/forecast-deviation")
def ml_forecast_deviation(
    snapshot_id: Optional[int] = None,
    unit: Optional[str] = None,
):
    """将快照中的未来日预测净额与已发生实际单据日净额对比（有重叠日才计算指标）。"""
    db = SessionLocal()
    try:
        if snapshot_id is not None:
            snap = db.query(ForecastSnapshot).filter(ForecastSnapshot.id == snapshot_id).first()
        else:
            q = db.query(ForecastSnapshot).order_by(ForecastSnapshot.id.desc())
            snap = q.filter(ForecastSnapshot.unit == unit).first() if unit else q.first()
        if not snap:
            return {
                "error": "no_snapshot",
                "message": "尚无预测快照，请先调用 POST /api/ml/forecast-snapshot",
                "pairs": [],
            }
        fds = json.loads(snap.future_dates_json or "[]")
        yhat = json.loads(snap.blended_yhat_json or "[]")
        u = snap.unit or unit
        daily = _actual_daily_net_map(db, u)
        pairs: List[Dict[str, Any]] = []
        for d, pred in zip(fds, yhat):
            if d in daily:
                act = daily[d]
                pairs.append({"date": d, "predicted": float(pred), "actual": float(act), "error": float(act) - float(pred)})
        if not pairs:
            return {
                "snapshot_id": snap.id,
                "unit": snap.unit,
                "overlap_days": 0,
                "message": "预测区间内尚无实际发生日可与预测逐日对齐",
                "pairs": [],
            }
        errs = [abs(p["error"]) for p in pairs]
        mae = sum(errs) / len(errs)
        mape_terms = [abs(p["error"]) / max(abs(p["actual"]), 1.0) for p in pairs]
        mape = 100.0 * sum(mape_terms) / len(mape_terms)
        return {
            "snapshot_id": snap.id,
            "unit": snap.unit,
            "overlap_days": len(pairs),
            "mae": round(mae, 4),
            "mape_pct": round(mape, 4),
            "pairs": pairs,
            "hint": "MAPE 为简化口径（|误差|/|实际|）；可用于跟踪预测质量并驱动特征/权重迭代",
        }
    finally:
        db.close()


# ── 归因 / 排程 ─────────────────────────────


class AttributionIn(BaseModel):
    plan_id: int
    actual_json: Optional[Dict[str, float]] = None


@router.post("/api/ml/attribution")
def ml_attribution(body: AttributionIn):
    db = SessionLocal()
    try:
        plan = db.query(CapitalPlan).filter(CapitalPlan.id == body.plan_id, CapitalPlan.is_deleted == False).first()
        if not plan:
            raise HTTPException(404, "计划不存在")
        plan_data = json.loads(plan.data_json or "{}")
        actual = body.actual_json or {}
        if not actual:
            import random

            actual = {k: float(v) * (0.85 + 0.3 * random.random()) for k, v in plan_data.items() if isinstance(v, (int, float))}
        return attribute_plan_deviation({k: float(v) for k, v in plan_data.items() if isinstance(v, (int, float))}, actual)
    finally:
        db.close()


class SchedulingIn(BaseModel):
    pool_ids: Optional[List[int]] = None


@router.post("/api/ml/scheduling")
def ml_scheduling(body: SchedulingIn):
    db = SessionLocal()
    try:
        q = db.query(PaymentPoolItem).filter(PaymentPoolItem.is_deleted == False)
        if body.pool_ids:
            q = q.filter(PaymentPoolItem.id.in_(body.pool_ids))
        rows = [_d(r) for r in q.all()]
        return schedule_rank(rows)
    finally:
        db.close()


# ── 银企模拟 ─────────────────────────────


class BankSubmitIn(BaseModel):
    pool_ids: List[int]
    payer_account: str = "6222000000000001"
    bank_code: str = "MOCK-ICBC"


@router.post("/api/bank/payments/submit")
def bank_submit(body: BankSubmitIn):
    db = SessionLocal()
    try:
        items = []
        for pid in body.pool_ids:
            p = db.query(PaymentPoolItem).filter(PaymentPoolItem.id == pid, PaymentPoolItem.is_deleted == False).first()
            if not p:
                continue
            items.append(
                {
                    "pool_item_id": p.id,
                    "payee_name": p.counterparty or p.biz_type,
                    "payee_account": "",
                    "amount": p.amount,
                    "currency": "CNY",
                }
            )
        gw = submit_payments(items, payer_account=body.payer_account, bank_code=body.bank_code)
        batch = gw["batch_id"]
        for o in gw.get("orders", []):
            db.add(
                BankPaymentOrder(
                    batch_id=batch,
                    pool_item_id=o.get("pool_item_id"),
                    payer_account=body.payer_account,
                    payee_name=o.get("payee_name", ""),
                    payee_account=o.get("payee_account", ""),
                    amount=o.get("amount", 0),
                    status="success",
                    bank_ref=o.get("bank_ref"),
                    raw_response_json=json.dumps(o, ensure_ascii=False),
                )
            )
        db.commit()
        return gw
    finally:
        db.close()


@router.get("/api/bank/payments/{order_id}")
def bank_payment_get(order_id: str):
    db = SessionLocal()
    try:
        # order_id 存在 BankPaymentOrder.id 或 网关 order_id — 简化为按 id
        if order_id.isdigit():
            obj = db.query(BankPaymentOrder).filter(BankPaymentOrder.id == int(order_id)).first()
            if obj:
                return _d(obj)
        return query_status(order_id)
    finally:
        db.close()


@router.get("/api/bank/payments")
def bank_payment_list(batch_id: Optional[str] = None):
    db = SessionLocal()
    try:
        q = db.query(BankPaymentOrder)
        if batch_id:
            q = q.filter(BankPaymentOrder.batch_id == batch_id)
        return [_d(r) for r in q.order_by(BankPaymentOrder.id.desc()).limit(200).all()]
    finally:
        db.close()
