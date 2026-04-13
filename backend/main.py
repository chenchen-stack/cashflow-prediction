"""
main.py — FastAPI REST API + 静态文件
资金预测智能体 · 全栈系统（URS 对齐：持久化、软删、集成取数、计划取数）
"""

import json
import os
import random
import time
import uuid
from datetime import date, datetime
from typing import Optional, List

from fastapi import FastAPI, HTTPException, Query, File, UploadFile, Form
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import or_

from database import (
    init_db, SessionLocal,
    CashflowSubject, CashflowBusiness, BizFlowInfo,
    SubjectCategoryMap, SubjectPlanMap,
    TimePeriodConfig, CashflowCollection, CashflowRecord,
    AnalysisReport, CapitalPlan, FxExposure, MappingRule, FetchTask,
    BankAccount, AccountBalanceFlow,
    LiquidityModelCatalog, LiquidityForecastScheme, LiquidityForecastMonthly,
    SyncLog,
)
from liquidity_engine import (
    run_scheme_forecast,
    monthly_from_records,
    run_holdout_backtest,
    compute_holdout_split,
    run_mvp_daily_forecast,
    resolve_month_subject_detail,
)
from calculator import build_analysis
from api_helpers import (
    validate_periods_json,
    build_plan_data_from_cashflow,
    build_plan_data_from_analysis,
    build_plan_subject_execution_detail,
    build_budget_forecast_matrix,
    build_budget_month_drill,
    default_flows_json,
)
from excel_import import run_excel_import
from agent_platform_api import router as agent_platform_router
from requirements_matrix import get_requirements_matrix
from prd_rules import (
    validate_subject_code_format,
    validate_subject_parent_chain,
    validate_biz_type,
    assert_category_map_unique_subject,
    validate_category_biz_codes_unique,
    assert_plan_map_no_subject_overlap,
    validate_plan_subject_name_unique,
    validate_fetch_task_body,
)

app = FastAPI(title="资金预测智能体 API", version="2.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ProcessTimeMiddleware(BaseHTTPMiddleware):
    """NFR：响应头携带处理耗时（毫秒），便于 APM/压测采样。"""

    async def dispatch(self, request, call_next):
        t0 = time.perf_counter()
        response = await call_next(request)
        ms = int((time.perf_counter() - t0) * 1000)
        response.headers["X-Process-Time-Ms"] = str(ms)
        return response


app.add_middleware(ProcessTimeMiddleware)

app.include_router(agent_platform_router)


@app.get("/api/meta/requirements-matrix", tags=["元数据"])
def api_requirements_matrix():
    """能力矩阵 JSON（供中台能力页与自动化验收使用）。"""
    return get_requirements_matrix()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def open_db():
    """Direct session getter (non-generator) for endpoints using next(get_db())."""
    return SessionLocal()


def _dictify(obj):
    d = {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
    for k, v in d.items():
        if isinstance(v, (date, datetime)):
            d[k] = v.isoformat()
    return d


def _rows(model, db, **filters):
    q = db.query(model)
    if hasattr(model, "is_deleted"):
        q = q.filter(model.is_deleted == False)
    for k, v in filters.items():
        if v is not None:
            q = q.filter(getattr(model, k) == v)
    return [_dictify(r) for r in q.all()]


# PRD 数据集成：来源权威性（数字越小越高）
SOURCE_AUTHORITY_RANK = {
    "银企直连": 1,
    "资金管理系统": 2,
    "TMS": 2,
    "ERP系统": 3,
    "ERP": 3,
    "手工新增": 4,
    "手工录入": 4,
    "手工修正": 4,
}


def _authority_rank(source_name: str) -> int:
    return SOURCE_AUTHORITY_RANK.get((source_name or "").strip(), 4)


def _append_sync_log(
    db,
    run_id: str,
    action_type: str,
    source_system: str,
    message: str,
    snapshot_json: Optional[str] = None,
    target_record_id: Optional[int] = None,
    source_doc_id: Optional[str] = None,
) -> None:
    db.add(
        SyncLog(
            run_id=run_id,
            action_type=action_type,
            source_system=source_system or "",
            message=message[:500],
            snapshot_json=snapshot_json or "{}",
            target_record_id=target_record_id,
            source_doc_id=source_doc_id,
        )
    )


def _record_snapshot_json(db_row: CashflowRecord) -> str:
    return json.dumps(_dictify(db_row), ensure_ascii=False, default=str)


# ══════════════════════════════════════════════
#  1. 资金流科目
# ══════════════════════════════════════════════

@app.get("/api/subjects")
def list_subjects(
    direction: Optional[str] = None,
    valid: Optional[bool] = None,
    q_code: Optional[str] = None,
    q_name: Optional[str] = None,
):
    db = next(get_db())
    q = db.query(CashflowSubject).filter(CashflowSubject.is_deleted == False)
    if direction:
        q = q.filter(CashflowSubject.direction == direction)
    if valid is not None:
        q = q.filter(CashflowSubject.valid == valid)
    if q_code:
        q = q.filter(CashflowSubject.code.contains(q_code))
    if q_name:
        q = q.filter(CashflowSubject.name.contains(q_name))
    return [_dictify(r) for r in q.order_by(CashflowSubject.code).all()]


@app.get("/api/subjects/{sid}")
def get_subject(sid: int):
    db = next(get_db())
    obj = db.query(CashflowSubject).filter(CashflowSubject.id == sid, CashflowSubject.is_deleted == False).first()
    if not obj:
        raise HTTPException(404, "科目不存在")
    return _dictify(obj)


class SubjectIn(BaseModel):
    code: str
    name: str
    direction: str = "流入"
    unit_name: Optional[str] = ""
    parent_id: Optional[int] = None
    is_period: str = "否"
    valid: bool = True


@app.post("/api/subjects")
def create_subject(body: SubjectIn):
    db = next(get_db())
    ok, msg = validate_subject_code_format(body.code)
    if not ok:
        raise HTTPException(400, msg)
    ok, msg = validate_subject_parent_chain(db, body.parent_id, body.code.strip())
    if not ok:
        raise HTTPException(400, msg)
    if body.is_period in ("期初", "期末"):
        ex = (
            db.query(CashflowSubject)
            .filter(
                CashflowSubject.is_period == body.is_period,
                CashflowSubject.valid == True,
                CashflowSubject.is_deleted == False,
            )
            .first()
        )
        if ex:
            raise HTTPException(400, f"已存在其它{body.is_period}资金流科目，不允许再次新增。")
    obj = CashflowSubject(**body.dict(), is_deleted=False)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _dictify(obj)


@app.put("/api/subjects/{sid}")
def update_subject(sid: int, body: SubjectIn):
    db = next(get_db())
    obj = db.query(CashflowSubject).filter(CashflowSubject.id == sid, CashflowSubject.is_deleted == False).first()
    if not obj:
        raise HTTPException(404)
    ok, msg = validate_subject_code_format(body.code)
    if not ok:
        raise HTTPException(400, msg)
    ok, msg = validate_subject_parent_chain(db, body.parent_id, body.code.strip())
    if not ok:
        raise HTTPException(400, msg)
    if body.is_period in ("期初", "期末"):
        ex = (
            db.query(CashflowSubject)
            .filter(
                CashflowSubject.is_period == body.is_period,
                CashflowSubject.id != sid,
                CashflowSubject.valid == True,
                CashflowSubject.is_deleted == False,
            )
            .first()
        )
        if ex:
            raise HTTPException(400, f"已存在其它{body.is_period}资金流科目，不允许再次新增。")
    for k, v in body.dict().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return _dictify(obj)


@app.delete("/api/subjects/{sid}")
def delete_subject(sid: int):
    db = next(get_db())
    obj = db.query(CashflowSubject).filter(CashflowSubject.id == sid, CashflowSubject.is_deleted == False).first()
    if not obj:
        raise HTTPException(404)
    obj.is_deleted = True
    db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════
#  2. 资金业务
# ══════════════════════════════════════════════

@app.get("/api/businesses")
def list_businesses(biz_type: Optional[str] = None, q: Optional[str] = None):
    db = next(get_db())
    qr = db.query(CashflowBusiness).filter(CashflowBusiness.is_deleted == False)
    if biz_type:
        qr = qr.filter(CashflowBusiness.biz_type == biz_type)
    if q:
        qr = qr.filter(
            or_(CashflowBusiness.code.contains(q), CashflowBusiness.name.contains(q))
        )
    return [_dictify(r) for r in qr.order_by(CashflowBusiness.code).all()]


@app.get("/api/businesses/{bid}")
def get_business(bid: int):
    db = next(get_db())
    obj = db.query(CashflowBusiness).filter(CashflowBusiness.id == bid, CashflowBusiness.is_deleted == False).first()
    if not obj:
        raise HTTPException(404)
    return _dictify(obj)


class BusinessIn(BaseModel):
    code: str
    name: str
    biz_type: str = "一般资金流"
    valid: bool = True


@app.post("/api/businesses")
def create_business(body: BusinessIn):
    db = next(get_db())
    ok, msg = validate_biz_type(body.biz_type)
    if not ok:
        raise HTTPException(400, msg)
    if db.query(CashflowBusiness).filter(CashflowBusiness.code == body.code, CashflowBusiness.is_deleted == False).first():
        raise HTTPException(400, "业务编码已存在")
    obj = CashflowBusiness(**body.dict(), is_deleted=False)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _dictify(obj)


@app.put("/api/businesses/{bid}")
def update_business(bid: int, body: BusinessIn):
    db = next(get_db())
    obj = db.query(CashflowBusiness).filter(CashflowBusiness.id == bid, CashflowBusiness.is_deleted == False).first()
    if not obj:
        raise HTTPException(404)
    ok, msg = validate_biz_type(body.biz_type)
    if not ok:
        raise HTTPException(400, msg)
    for k, v in body.dict().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return _dictify(obj)


@app.delete("/api/businesses/{bid}")
def delete_business(bid: int):
    db = next(get_db())
    obj = db.query(CashflowBusiness).filter(CashflowBusiness.id == bid, CashflowBusiness.is_deleted == False).first()
    if not obj:
        raise HTTPException(404)
    obj.is_deleted = True
    db.commit()
    return {"ok": True}


@app.get("/api/biz-flows")
def list_biz_flows(biz_id: Optional[int] = None):
    db = next(get_db())
    q = db.query(BizFlowInfo)
    if biz_id:
        q = q.filter(BizFlowInfo.biz_id == biz_id)
    return [_dictify(r) for r in q.all()]


# ══════════════════════════════════════════════
#  3. 科目映射（含展开字段）
# ══════════════════════════════════════════════

def _enrich_category_maps(db):
    maps = (
        db.query(SubjectCategoryMap)
        .filter(SubjectCategoryMap.is_deleted == False)
        .all()
    )
    out = []
    for m in maps:
        s = db.query(CashflowSubject).get(m.subject_id)
        try:
            codes = json.loads(m.category_ids or "[]")
        except Exception:
            codes = []
        out.append({
            "id": m.id,
            "subject_id": m.subject_id,
            "subject_code": s.code if s else "",
            "subject_name": s.name if s else "",
            "direction": s.direction if s else "",
            "biz_codes": codes,
            "valid": m.valid,
        })
    return out


@app.get("/api/subject-category-map")
def list_subject_category_map():
    db = next(get_db())
    return _enrich_category_maps(db)


class CategoryMapIn(BaseModel):
    subject_id: int
    biz_codes: List[str] = Field(default_factory=list)
    valid: bool = True


@app.post("/api/subject-category-map")
def create_category_map(body: CategoryMapIn):
    db = next(get_db())
    assert_category_map_unique_subject(db, body.subject_id)
    validate_category_biz_codes_unique(db, body.subject_id, body.biz_codes or [])
    obj = SubjectCategoryMap(
        subject_id=body.subject_id,
        category_ids=json.dumps(body.biz_codes, ensure_ascii=False),
        valid=body.valid,
        is_deleted=False,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _enrich_category_maps(db)


@app.delete("/api/subject-category-map/{mid}")
def delete_category_map(mid: int):
    db = next(get_db())
    obj = db.query(SubjectCategoryMap).filter(SubjectCategoryMap.id == mid, SubjectCategoryMap.is_deleted == False).first()
    if not obj:
        raise HTTPException(404)
    obj.is_deleted = True
    db.commit()
    return {"ok": True}


class CategoryMapUpdateIn(BaseModel):
    biz_codes: List[str] = Field(default_factory=list)
    valid: bool = True


@app.put("/api/subject-category-map/{mid}")
def update_category_map(mid: int, body: CategoryMapUpdateIn):
    """更新某条映射关联的业务编码列表（前端以业务名称勾选，仍存编码）。"""
    db = next(get_db())
    obj = db.query(SubjectCategoryMap).filter(SubjectCategoryMap.id == mid, SubjectCategoryMap.is_deleted == False).first()
    if not obj:
        raise HTTPException(404)
    validate_category_biz_codes_unique(db, obj.subject_id, body.biz_codes or [], exclude_id=mid)
    obj.category_ids = json.dumps(body.biz_codes or [], ensure_ascii=False)
    obj.valid = body.valid
    db.commit()
    return _enrich_category_maps(db)


def _enrich_plan_maps(db):
    maps = db.query(SubjectPlanMap).filter(SubjectPlanMap.is_deleted == False).all()
    subjects = {s.id: s for s in db.query(CashflowSubject).filter(CashflowSubject.is_deleted == False).all()}
    out = []
    for m in maps:
        try:
            ids = json.loads(m.subject_ids or "[]")
        except Exception:
            ids = []
        names = [f"{subjects[i].code} {subjects[i].name}" for i in ids if i in subjects]
        out.append({
            "id": m.id,
            "subject_ids": ids,
            "direction": m.direction,
            "plan_subject": m.plan_subject_name or str(m.plan_subject_id),
            "plan_subject_name": m.plan_subject_name,
            "valid": m.valid,
            "_names": names,
        })
    return out


@app.get("/api/subject-plan-map")
def list_subject_plan_map():
    db = next(get_db())
    return _enrich_plan_maps(db)


class PlanMapIn(BaseModel):
    subject_ids: List[int]
    direction: str
    plan_subject_name: str
    valid: bool = True


@app.post("/api/subject-plan-map")
def create_plan_map(body: PlanMapIn):
    db = next(get_db())
    assert_plan_map_no_subject_overlap(db, body.subject_ids)
    validate_plan_subject_name_unique(db, body.direction, body.plan_subject_name)
    obj = SubjectPlanMap(
        subject_ids=json.dumps(body.subject_ids, ensure_ascii=False),
        direction=body.direction,
        plan_subject_id=0,
        plan_subject_name=body.plan_subject_name,
        valid=body.valid,
        is_deleted=False,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _enrich_plan_maps(db)


@app.delete("/api/subject-plan-map/{mid}")
def delete_plan_map(mid: int):
    db = next(get_db())
    obj = db.query(SubjectPlanMap).filter(SubjectPlanMap.id == mid, SubjectPlanMap.is_deleted == False).first()
    if not obj:
        raise HTTPException(404)
    obj.is_deleted = True
    db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════
#  4. 时间段配置
# ══════════════════════════════════════════════

@app.get("/api/time-periods")
def list_time_periods():
    db = next(get_db())
    return _rows(TimePeriodConfig, db)


class TimePeriodIn(BaseModel):
    code: str
    name: str
    periods_json: str
    valid: bool = True


@app.post("/api/time-periods")
def create_time_period(body: TimePeriodIn):
    ok, msg = validate_periods_json(body.periods_json)
    if not ok:
        raise HTTPException(400, msg)
    db = next(get_db())
    if db.query(TimePeriodConfig).filter(TimePeriodConfig.code == body.code, TimePeriodConfig.is_deleted == False).first():
        raise HTTPException(400, "编码已存在")
    obj = TimePeriodConfig(**body.dict(), is_deleted=False)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _dictify(obj)


@app.put("/api/time-periods/{tid}")
def update_time_period(tid: int, body: TimePeriodIn):
    ok, msg = validate_periods_json(body.periods_json)
    if not ok:
        raise HTTPException(400, msg)
    db = next(get_db())
    obj = db.query(TimePeriodConfig).filter(TimePeriodConfig.id == tid, TimePeriodConfig.is_deleted == False).first()
    if not obj:
        raise HTTPException(404)
    for k, v in body.dict().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return _dictify(obj)


@app.delete("/api/time-periods/{tid}")
def delete_time_period(tid: int):
    db = next(get_db())
    obj = db.query(TimePeriodConfig).filter(TimePeriodConfig.id == tid, TimePeriodConfig.is_deleted == False).first()
    if not obj:
        raise HTTPException(404)
    obj.is_deleted = True
    db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════
#  5. 资金流集合 & 单据
# ══════════════════════════════════════════════


def _batch_collection_code() -> str:
    """取数批次号：毫秒时间戳，与前端「批次号」展示一致。"""
    return f"BATCH{int(time.time() * 1000)}"


@app.get("/api/collections")
def list_collections():
    db = next(get_db())
    return [_dictify(r) for r in db.query(CashflowCollection).order_by(CashflowCollection.created_at.desc()).all()]


class CollectionIn(BaseModel):
    source_system: str = "资金管理系统"


@app.post("/api/collections")
def create_collection(body: CollectionIn):
    db = next(get_db())
    code = _batch_collection_code()
    obj = CashflowCollection(code=code, source_system=body.source_system)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _dictify(obj)


@app.get("/api/records")
def list_records(
    unit: Optional[str] = None,
    status: Optional[str] = None,
    currency: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
):
    db = next(get_db())
    q = db.query(CashflowRecord).filter(CashflowRecord.is_deleted == False)
    if unit:
        q = q.filter(CashflowRecord.unit == unit)
    if status:
        if status == "待确认":
            q = q.filter(or_(CashflowRecord.status == "待确认", CashflowRecord.status == "未确认"))
        else:
            q = q.filter(CashflowRecord.status == status)
    if currency:
        q = q.filter(CashflowRecord.currency == currency)
    if date_from:
        q = q.filter(CashflowRecord.trade_date >= date_from)
    if date_to:
        q = q.filter(CashflowRecord.trade_date <= date_to)
    total = q.count()
    rows = q.order_by(CashflowRecord.trade_date.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "page": page, "items": [_dictify(r) for r in rows]}


@app.get("/api/records/{rid}")
def get_record(rid: int):
    db = next(get_db())
    obj = db.query(CashflowRecord).filter(CashflowRecord.id == rid, CashflowRecord.is_deleted == False).first()
    if not obj:
        raise HTTPException(404)
    return _dictify(obj)


class RecordIn(BaseModel):
    unit: str
    currency: str = "CNY"
    amount: float = 0
    biz_id: Optional[int] = None
    trade_date: Optional[str] = None
    settle_date: Optional[str] = None
    status: str = "预测"
    source_system: str = "手工新增"
    source_ref: Optional[str] = None
    collection_id: Optional[int] = None
    flows_json: str = "[]"
    self_account_no: Optional[str] = None
    self_account_name: Optional[str] = None
    counterparty_account: Optional[str] = None
    counterparty_name: Optional[str] = None
    bank_name: Optional[str] = None
    summary: Optional[str] = None


@app.post("/api/records")
def create_record(body: RecordIn):
    db = next(get_db())
    count = db.query(CashflowRecord).count()
    code = f"CF{date.today().strftime('%Y%m%d')}{count + 1:08d}"
    td = date.fromisoformat(body.trade_date) if body.trade_date else None
    sd = date.fromisoformat(body.settle_date) if body.settle_date else td
    fj = body.flows_json
    if not fj or fj == "[]":
        fj = default_flows_json(
            db, CashflowBusiness, BizFlowInfo, CashflowSubject,
            body.biz_id, body.amount, body.currency, td or date.today(), body.status,
        )
    obj = CashflowRecord(
        code=code,
        unit=body.unit,
        currency=body.currency,
        amount=body.amount,
        biz_id=body.biz_id,
        trade_date=td,
        settle_date=sd,
        status=body.status,
        source_system=body.source_system,
        source_ref=body.source_ref,
        collection_id=body.collection_id,
        flows_json=fj,
        self_account_no=body.self_account_no,
        self_account_name=body.self_account_name,
        counterparty_account=body.counterparty_account,
        counterparty_name=body.counterparty_name,
        bank_name=body.bank_name,
        summary=body.summary,
        is_deleted=False,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _dictify(obj)


@app.put("/api/records/{rid}")
def update_record(rid: int, body: RecordIn):
    db = next(get_db())
    obj = db.query(CashflowRecord).filter(CashflowRecord.id == rid, CashflowRecord.is_deleted == False).first()
    if not obj:
        raise HTTPException(404)
    td = date.fromisoformat(body.trade_date) if body.trade_date else None
    sd = date.fromisoformat(body.settle_date) if body.settle_date else td
    obj.unit = body.unit
    obj.currency = body.currency
    obj.amount = body.amount
    obj.biz_id = body.biz_id
    obj.trade_date = td
    obj.settle_date = sd
    obj.status = body.status
    obj.source_system = body.source_system
    obj.source_ref = body.source_ref
    obj.collection_id = body.collection_id
    obj.flows_json = body.flows_json if body.flows_json and body.flows_json != "[]" else obj.flows_json
    if body.self_account_no is not None:
        obj.self_account_no = body.self_account_no
    if body.self_account_name is not None:
        obj.self_account_name = body.self_account_name
    if body.counterparty_account is not None:
        obj.counterparty_account = body.counterparty_account
    if body.counterparty_name is not None:
        obj.counterparty_name = body.counterparty_name
    if body.bank_name is not None:
        obj.bank_name = body.bank_name
    if body.summary is not None:
        obj.summary = body.summary
    db.commit()
    db.refresh(obj)
    return _dictify(obj)


@app.delete("/api/records/{rid}")
def delete_record(rid: int):
    db = next(get_db())
    obj = db.query(CashflowRecord).filter(CashflowRecord.id == rid, CashflowRecord.is_deleted == False).first()
    if not obj:
        raise HTTPException(404)
    obj.is_deleted = True
    db.commit()
    return {"ok": True}


@app.post("/api/records/import-excel")
def import_records_excel(
    file: UploadFile = File(...),
    force_override: bool = Form(False),
):
    """手工录入 Excel → 资金流单据（权威性 4）。首行表头需含：单位、金额（或金额万元）；可选币种、交易日期、业务编码、业务名称、状态、备注、单据号。"""
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(400, "请上传 .xlsx / .xlsm 文件")
    db = SessionLocal()
    try:
        content = file.file.read()
        if not content:
            raise HTTPException(400, "空文件")
        return run_excel_import(db, content, force_override, _append_sync_log)
    finally:
        db.close()


# ══════════════════════════════════════════════
#  6. 集成取数（落库）
# ══════════════════════════════════════════════

class IntegrationFetchIn(BaseModel):
    units: List[str] = Field(default_factory=list)
    source_system: str = "资金管理系统"
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    force_override: bool = False  # PRD：管理员强制覆盖


def _integration_fetch_body(db, body: IntegrationFetchIn) -> dict:
    """按 PRD：同源去重、异源权威性覆盖、手工锁定不覆盖、审计快照写入 sync_logs。"""
    rules = (
        db.query(MappingRule)
        .filter(MappingRule.valid == True, MappingRule.is_deleted == False)
        .all()
    )
    if not rules:
        raise HTTPException(400, "暂无有效映射规则")

    run_id = f"{date.today().strftime('%Y%m%d')}-{uuid.uuid4().hex[:10]}"
    src = body.source_system
    rnk_new = _authority_rank(src)

    col_code = _batch_collection_code()
    col = CashflowCollection(code=col_code, source_system=src)
    db.add(col)
    db.flush()

    units = body.units or list({r.unit for r in db.query(CashflowRecord).filter(CashflowRecord.is_deleted == False).all()})
    if not units:
        units = ["总部", "华东子公司", "华南子公司"]

    created = 0
    skipped = 0
    overridden = 0
    rc = db.query(CashflowRecord).count()
    biz_ids = [r.biz_id for r in rules if r.biz_id]

    for u in units:
        k = random.randint(1, 3)
        for j in range(k):
            # 跨批次稳定键：同日同单位同序号 → 不同来源可触发「异源覆盖」演示
            source_doc_id = f"{date.today().isoformat()}|{u}|{j}"
            rc += 1
            bid = random.choice(biz_ids) if biz_ids else None
            is_in = random.random() > 0.45
            amt = round((random.random() * 2e6 + 3e5) * (1 if is_in else -1), 2)
            td = date.today()
            code = f"CF{date.today().strftime('%Y%m%d')}{rc:08d}"
            fj = default_flows_json(
                db, CashflowBusiness, BizFlowInfo, CashflowSubject,
                bid, amt, "CNY", td, "未确认",
            )

            existing = (
                db.query(CashflowRecord)
                .filter(
                    CashflowRecord.source_doc_id == source_doc_id,
                    CashflowRecord.is_deleted == False,
                )
                .first()
            )

            if existing:
                if existing.source_system == src:
                    skipped += 1
                    _append_sync_log(
                        db, run_id, "skip", src,
                        "同源重复：source_doc_id 已存在，跳过",
                        target_record_id=existing.id,
                        source_doc_id=source_doc_id,
                    )
                    continue
                if getattr(existing, "lock_no_auto_overwrite", False):
                    skipped += 1
                    _append_sync_log(
                        db, run_id, "skip", src,
                        "手工锁定记录，不参与自动覆盖",
                        target_record_id=existing.id,
                        source_doc_id=source_doc_id,
                    )
                    continue
                rnk_old = _authority_rank(existing.source_system)
                snap = _record_snapshot_json(existing)
                if body.force_override:
                    existing.unit = u
                    existing.biz_id = bid
                    existing.currency = "CNY"
                    existing.amount = amt
                    existing.trade_date = td
                    existing.settle_date = td
                    existing.source_system = src
                    existing.authority_rank = rnk_new
                    existing.amount_cny = amt
                    existing.flows_json = fj
                    existing.collection_id = col.id
                    overridden += 1
                    _append_sync_log(
                        db, run_id, "forced_override", src,
                        "管理员强制覆盖（忽略权威性）",
                        snapshot_json=snap,
                        target_record_id=existing.id,
                        source_doc_id=source_doc_id,
                    )
                    continue
                if rnk_new < rnk_old:
                    existing.unit = u
                    existing.biz_id = bid
                    existing.currency = "CNY"
                    existing.amount = amt
                    existing.trade_date = td
                    existing.settle_date = td
                    existing.source_system = src
                    existing.authority_rank = rnk_new
                    existing.amount_cny = amt
                    existing.flows_json = fj
                    existing.collection_id = col.id
                    overridden += 1
                    _append_sync_log(
                        db, run_id, "override", src,
                        f"高优先级来源覆盖（{src} 优先于原 {existing.source_system}）",
                        snapshot_json=snap,
                        target_record_id=existing.id,
                        source_doc_id=source_doc_id,
                    )
                    continue
                skipped += 1
                _append_sync_log(
                    db, run_id, "skip", src,
                    f"低优先级来源，保留已有数据（已有 {existing.source_system}）",
                    target_record_id=existing.id,
                    source_doc_id=source_doc_id,
                )
                continue

            obj = CashflowRecord(
                code=code,
                collection_id=col.id,
                unit=u,
                biz_id=bid,
                currency="CNY",
                amount=amt,
                amount_cny=amt,
                trade_date=td,
                settle_date=td,
                source_system=src,
                authority_rank=rnk_new,
                source_doc_id=source_doc_id,
                status="未确认",
                flows_json=fj,
                is_deleted=False,
            )
            db.add(obj)
            db.flush()
            created += 1
            _append_sync_log(
                db, run_id, "insert", src,
                "新单据写入",
                target_record_id=obj.id,
                source_doc_id=source_doc_id,
            )

    db.commit()
    return {
        "collection_id": col.id,
        "collection_code": col_code,
        "run_id": run_id,
        "records_created": created,
        "records_skipped": skipped,
        "records_overridden": overridden,
        "source_system": src,
        "authority_rank": rnk_new,
    }


@app.post("/api/integrations/fetch")
def integration_fetch(body: IntegrationFetchIn):
    db = SessionLocal()
    try:
        return _integration_fetch_body(db, body)
    finally:
        db.close()


@app.get("/api/sync-logs")
def list_sync_logs(limit: int = Query(80, ge=1, le=500)):
    """PRD：同步日志审计（含覆盖前快照 snapshot_json）。"""
    db = next(get_db())
    rows = (
        db.query(SyncLog)
        .order_by(SyncLog.id.desc())
        .limit(limit)
        .all()
    )
    return [_dictify(r) for r in rows]


@app.get("/api/metrics/summary")
def metrics_summary():
    """NFR 自检：关键路径延迟需结合压测；此处提供运行时模式与采样提示。"""
    return {
        "api_version": getattr(app, "version", None) or "2.0.0",
        "analysis_engine": "同步（calculator.build_analysis）",
        "async_queue": "未启用 — 扩展数据集见 PRD TC-PERF-001",
        "sqlite_pool": "StaticPool",
        "nfr_note": "LCP/P95/500 并发需 Lighthouse、k6/Grafana 实测验收",
    }


# ══════════════════════════════════════════════
#  7. 取数映射规则 CRUD
# ══════════════════════════════════════════════

@app.get("/api/mapping-rules")
def list_mapping_rules():
    db = next(get_db())
    return _rows(MappingRule, db)


class MappingRuleIn(BaseModel):
    name: Optional[str] = None
    biz_id: Optional[int] = None
    source_system: str = "资金管理系统"
    source_doc_type: Optional[str] = None
    filters_json: str = "[]"
    field_map_json: str = "{}"
    valid: bool = True


@app.post("/api/mapping-rules")
def create_mapping_rule(body: MappingRuleIn):
    db = next(get_db())
    max_n = 0
    for r in db.query(MappingRule).all():
        if r.code.startswith("MR") and len(r.code) == 8 and r.code[2:].isdigit():
            max_n = max(max_n, int(r.code[2:]))
    code = f"MR{max_n + 1:06d}"
    obj = MappingRule(
        code=code,
        name=body.name,
        biz_id=body.biz_id,
        source_system=body.source_system,
        source_doc_type=body.source_doc_type,
        filters_json=body.filters_json,
        field_map_json=body.field_map_json,
        valid=body.valid,
        is_deleted=False,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _dictify(obj)


@app.put("/api/mapping-rules/{rule_id}")
def update_mapping_rule(rule_id: int, body: MappingRuleIn):
    db = next(get_db())
    obj = db.query(MappingRule).filter(MappingRule.id == rule_id, MappingRule.is_deleted == False).first()
    if not obj:
        raise HTTPException(404)
    obj.name = body.name
    obj.biz_id = body.biz_id
    obj.source_system = body.source_system
    obj.source_doc_type = body.source_doc_type
    obj.filters_json = body.filters_json
    obj.field_map_json = body.field_map_json
    obj.valid = body.valid
    db.commit()
    db.refresh(obj)
    return _dictify(obj)


@app.delete("/api/mapping-rules/{rule_id}")
def delete_mapping_rule(rule_id: int):
    db = next(get_db())
    obj = db.query(MappingRule).filter(MappingRule.id == rule_id, MappingRule.is_deleted == False).first()
    if not obj:
        raise HTTPException(404)
    obj.is_deleted = True
    db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════
#  8. 数据获取任务
# ══════════════════════════════════════════════

@app.get("/api/fetch-tasks")
def list_fetch_tasks():
    db = next(get_db())
    return _rows(FetchTask, db)


class FetchTaskIn(BaseModel):
    name: str
    task_type: str
    enabled: bool = True
    cron_expr: str = "0 0 12 * * ?"
    filters_json: str = "[]"
    extra_json: str = "{}"


@app.post("/api/fetch-tasks")
def create_fetch_task(body: FetchTaskIn):
    ok, msg = validate_fetch_task_body(body.task_type, body.extra_json)
    if not ok:
        raise HTTPException(400, msg)
    db = next(get_db())
    obj = FetchTask(**body.dict(), is_deleted=False)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _dictify(obj)


@app.put("/api/fetch-tasks/{tid}")
def update_fetch_task(tid: int, body: FetchTaskIn):
    ok, msg = validate_fetch_task_body(body.task_type, body.extra_json)
    if not ok:
        raise HTTPException(400, msg)
    db = next(get_db())
    obj = db.query(FetchTask).filter(FetchTask.id == tid, FetchTask.is_deleted == False).first()
    if not obj:
        raise HTTPException(404)
    for k, v in body.dict().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return _dictify(obj)


@app.delete("/api/fetch-tasks/{tid}")
def delete_fetch_task(tid: int):
    db = next(get_db())
    obj = db.query(FetchTask).filter(FetchTask.id == tid, FetchTask.is_deleted == False).first()
    if not obj:
        raise HTTPException(404)
    obj.is_deleted = True
    db.commit()
    return {"ok": True}


@app.post("/api/fetch-tasks/{tid}/run")
def run_fetch_task(tid: int):
    db = SessionLocal()
    try:
        obj = db.query(FetchTask).filter(FetchTask.id == tid, FetchTask.is_deleted == False).first()
        if not obj:
            raise HTTPException(404)
        if obj.task_type == "资金流自动获取":
            res = _integration_fetch_body(db, IntegrationFetchIn(units=[], source_system="资金管理系统"))
            return {"task_id": tid, "result": res}
        latest = db.query(AnalysisReport).order_by(AnalysisReport.created_at.desc()).first()
        if not latest:
            return {"task_id": tid, "message": "暂无分析报表可推送", "result": None}
        plans = db.query(CapitalPlan).filter(CapitalPlan.is_deleted == False, CapitalPlan.status == "草稿").all()
        n = 0
        for p in plans:
            data = build_plan_data_from_analysis(db, p, SubjectPlanMap, AnalysisReport, latest.id)
            if data:
                p.data_json = json.dumps(data, ensure_ascii=False)
                p.data_source = "资金分析与预测数据"
                n += 1
        db.commit()
        return {"task_id": tid, "plans_updated": n, "report_code": latest.code}
    finally:
        db.close()


# ══════════════════════════════════════════════
#  9. 分析与预测
# ══════════════════════════════════════════════

class AnalysisIn(BaseModel):
    unit: Optional[str] = None
    currency: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    period_config_code: str = "TP0001"
    opening_balance: float = 0
    # PRD 3.1.4 单据扩展字段（存入 params_json，计算器可逐步消费）
    report_name: Optional[str] = None
    analysis_dimension: Optional[str] = None
    flow_status: Optional[str] = None
    display_content: Optional[str] = None
    summary_currency: Optional[str] = None
    currency_unit: Optional[str] = None
    actual_date: Optional[str] = None


@app.post("/api/analysis/run")
def run_analysis(body: AnalysisIn):
    db = next(get_db())
    result = build_analysis(db, body.dict())
    count = db.query(AnalysisReport).count()
    code = f"CAF{date.today().strftime('%Y%m%d')}{count + 1:04d}"
    rpt = AnalysisReport(
        code=code,
        name=(body.report_name or "").strip() or f"资金分析预测-{code}",
        params_json=json.dumps(body.dict(), ensure_ascii=False, default=str),
        result_json=json.dumps(result, ensure_ascii=False, default=str),
    )
    db.add(rpt)
    db.commit()
    db.refresh(rpt)
    return {"report_id": rpt.id, "code": rpt.code, **result}


@app.get("/api/analysis/reports")
def list_reports():
    db = next(get_db())
    return [_dictify(r) for r in db.query(AnalysisReport).order_by(AnalysisReport.created_at.desc()).all()]


@app.get("/api/analysis/reports/{report_id}")
def get_report(report_id: int):
    db = next(get_db())
    obj = db.query(AnalysisReport).get(report_id)
    if not obj:
        raise HTTPException(404)
    d = _dictify(obj)
    d["result"] = json.loads(d.get("result_json", "{}"))
    d["params"] = json.loads(d.get("params_json", "{}"))
    return d


@app.get("/api/analysis/plan-subject-detail")
def plan_subject_detail(
    unit: str = Query(..., description="单位名称或「集团汇总」"),
    period_label: Optional[str] = Query(None, description="与资金计划 period_label 一致；不传则取该单位最新计划"),
):
    """计划执行对比 · 科目执行明细：预算（计划快照）vs 实际（资金流汇总），偏差率 (预算-实际)/预算。"""
    db = next(get_db())
    items = build_plan_subject_execution_detail(
        db, unit, period_label, SubjectPlanMap, CashflowRecord, CapitalPlan
    )
    resolved = period_label
    if not resolved:
        u = "总部" if (unit or "").strip() == "集团汇总" else (unit or "").strip() or "总部"
        pl = (
            db.query(CapitalPlan)
            .filter(CapitalPlan.unit == u, CapitalPlan.is_deleted == False)
            .order_by(CapitalPlan.id.desc())
            .first()
        )
        resolved = pl.period_label if pl else None
    return {"unit": unit, "period_label": resolved, "items": items}


@app.get("/api/budget-forecast/matrix")
def budget_forecast_matrix(
    months: int = Query(6, ge=1, le=24),
    anchor: Optional[str] = Query(None, description="锚点日期 YYYY-MM-DD，省略为当前日期"),
):
    """预算预测表：单位 × 最近 N 个月 + 额度 / 计划上报额度 / 执行数。"""
    db = next(get_db())
    ad = date.today()
    if anchor:
        try:
            parts = anchor.strip().split("-")
            if len(parts) >= 2:
                y, mo = int(parts[0]), int(parts[1])
                dd = int(parts[2]) if len(parts) >= 3 else 1
                ad = date(y, mo, dd)
        except Exception:
            ad = date.today()
    return build_budget_forecast_matrix(db, CashflowRecord, CapitalPlan, months, ad)


@app.get("/api/budget-forecast/month-drill")
def budget_forecast_month_drill(
    unit: str = Query(..., description="单位名称"),
    year_month: str = Query(..., description="YYYY-MM"),
):
    """点击预算表月份单元格：科目名称 + 金额（净额），与月度汇总对齐。"""
    db = next(get_db())
    return build_budget_month_drill(db, CashflowRecord, CashflowSubject, unit, year_month)


# ══════════════════════════════════════════════
#  10. 资金计划
# ══════════════════════════════════════════════

@app.get("/api/plans")
def list_plans(unit: Optional[str] = None, status: Optional[str] = None):
    db = next(get_db())
    q = db.query(CapitalPlan).filter(CapitalPlan.is_deleted == False)
    if unit:
        q = q.filter(CapitalPlan.unit == unit)
    if status:
        q = q.filter(CapitalPlan.status == status)
    return [_dictify(r) for r in q.all()]


class PlanIn(BaseModel):
    unit: str
    period_type: str
    period_label: str
    data_json: str = "{}"
    status: str = "草稿"
    data_source: str = "资金流数据"


@app.post("/api/plans")
def create_plan(body: PlanIn):
    if body.data_source not in ("资金流数据", "资金分析与预测数据"):
        raise HTTPException(400, "数据获取来源须为：资金流数据、资金分析与预测数据")
    db = next(get_db())
    obj = CapitalPlan(**body.dict(), is_deleted=False)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _dictify(obj)


@app.put("/api/plans/{pid}")
def update_plan(pid: int, body: PlanIn):
    if body.data_source not in ("资金流数据", "资金分析与预测数据"):
        raise HTTPException(400, "数据获取来源须为：资金流数据、资金分析与预测数据")
    db = next(get_db())
    obj = db.query(CapitalPlan).filter(CapitalPlan.id == pid, CapitalPlan.is_deleted == False).first()
    if not obj:
        raise HTTPException(404)
    for k, v in body.dict().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return _dictify(obj)


@app.delete("/api/plans/{pid}")
def delete_plan(pid: int):
    db = next(get_db())
    obj = db.query(CapitalPlan).filter(CapitalPlan.id == pid, CapitalPlan.is_deleted == False).first()
    if not obj:
        raise HTTPException(404)
    obj.is_deleted = True
    db.commit()
    return {"ok": True}


@app.post("/api/plans/{pid}/fill-from-cashflow")
def plan_fill_cashflow(pid: int):
    db = next(get_db())
    plan = db.query(CapitalPlan).filter(CapitalPlan.id == pid, CapitalPlan.is_deleted == False).first()
    if not plan:
        raise HTTPException(404)
    data = build_plan_data_from_cashflow(db, plan, SubjectPlanMap, CashflowRecord)
    plan.data_json = json.dumps(data, ensure_ascii=False)
    plan.data_source = "资金流数据"
    db.commit()
    return {"plan_id": pid, "data": data}


@app.post("/api/plans/{pid}/fill-from-analysis")
def plan_fill_analysis(pid: int, report_id: int = Query(..., description="分析报表 id")):
    db = next(get_db())
    plan = db.query(CapitalPlan).filter(CapitalPlan.id == pid, CapitalPlan.is_deleted == False).first()
    if not plan:
        raise HTTPException(404)
    data = build_plan_data_from_analysis(db, plan, SubjectPlanMap, AnalysisReport, report_id)
    if not data:
        raise HTTPException(400, "无法从该报表生成计划数据")
    plan.data_json = json.dumps(data, ensure_ascii=False)
    plan.data_source = "资金分析与预测数据"
    db.commit()
    return {"plan_id": pid, "data": data}


# ══════════════════════════════════════════════
#  11. 外汇 & Dashboard & Agent
# ══════════════════════════════════════════════

@app.get("/api/fx-exposures")
def list_fx_exposures(status: Optional[str] = None):
    db = next(get_db())
    return _rows(FxExposure, db)


class FxExposureIn(BaseModel):
    currency_pair: str
    notional: float = 0
    direction: str = "买入"
    maturity: Optional[str] = None
    hedge_ratio: float = 0
    instrument: str = "远期"
    pnl: float = 0
    status: str = "持有"


@app.post("/api/fx-exposures")
def create_fx_exposure(body: FxExposureIn):
    db = next(get_db())
    obj = FxExposure(**body.dict())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _dictify(obj)


# ══════════════════════════════════════════════
#  司库流动性预测 MVP（文章：数据层 t_bank_account / 预测方案 / 结果明细）
# ══════════════════════════════════════════════


@app.get("/api/liquidity/models")
def liquidity_list_models():
    db = next(get_db())
    q = db.query(LiquidityModelCatalog).filter(LiquidityModelCatalog.valid == True)
    return [_dictify(r) for r in q.order_by(LiquidityModelCatalog.code).all()]


@app.get("/api/liquidity/bank-accounts")
def liquidity_list_bank_accounts():
    db = next(get_db())
    return _rows(BankAccount, db)


class BankAccountIn(BaseModel):
    account_no: str
    account_name: str
    bank_name: str = ""
    currency: str = "CNY"
    unit: str = "总部"
    status: str = "启用"


@app.post("/api/liquidity/bank-accounts")
def liquidity_create_bank_account(body: BankAccountIn):
    db = next(get_db())
    if db.query(BankAccount).filter(BankAccount.account_no == body.account_no, BankAccount.is_deleted == False).first():
        raise HTTPException(400, "账号已存在")
    obj = BankAccount(**body.dict(), is_deleted=False)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _dictify(obj)


class BalanceFlowRow(BaseModel):
    account_no: str
    account_name: str = ""
    flow_date: str
    net_amount: float = 0
    closing_balance: Optional[float] = None


class FlowImportIn(BaseModel):
    flows: List[BalanceFlowRow]
    unit: str = "总部"


@app.post("/api/liquidity/import-flows")
def liquidity_import_flows(body: FlowImportIn):
    db = next(get_db())
    created_acc = 0
    created_flow = 0
    for row in body.flows:
        acc = (
            db.query(BankAccount)
            .filter(BankAccount.account_no == row.account_no, BankAccount.is_deleted == False)
            .first()
        )
        if not acc:
            acc = BankAccount(
                account_no=row.account_no,
                account_name=row.account_name or row.account_no,
                bank_name="",
                currency="CNY",
                unit=body.unit,
                status="启用",
                is_deleted=False,
            )
            db.add(acc)
            db.flush()
            created_acc += 1
        try:
            fd = date.fromisoformat(row.flow_date[:10])
        except ValueError:
            raise HTTPException(400, f"日期格式错误: {row.flow_date}")
        db.add(
            AccountBalanceFlow(
                account_id=acc.id,
                flow_date=fd,
                net_amount=row.net_amount,
                closing_balance=row.closing_balance,
                source="import",
            )
        )
        created_flow += 1
    db.commit()
    return {"ok": True, "accounts_created": created_acc, "flows_created": created_flow}


class CsvImportIn(BaseModel):
    """CSV 行: account_no,account_name,flow_date,net_amount[,closing_balance] ；首行可为表头"""
    csv_text: str
    unit: str = "总部"


@app.post("/api/liquidity/import-csv")
def liquidity_import_csv(body: CsvImportIn):
    lines = [ln.strip() for ln in body.csv_text.strip().splitlines() if ln.strip()]
    if not lines:
        raise HTTPException(400, "空文件")
    flows: List[BalanceFlowRow] = []
    start = 0
    if lines[0].lower().startswith("account") or "日期" in lines[0]:
        start = 1
    for ln in lines[start:]:
        parts = [p.strip() for p in ln.split(",")]
        if len(parts) < 4:
            continue
        cb = None
        if len(parts) >= 5 and parts[4]:
            try:
                cb = float(parts[4])
            except ValueError:
                cb = None
        try:
            amt = float(parts[3])
        except ValueError:
            continue
        flows.append(
            BalanceFlowRow(
                account_no=parts[0],
                account_name=parts[1] or parts[0],
                flow_date=parts[2],
                net_amount=amt,
                closing_balance=cb,
            )
        )
    if not flows:
        raise HTTPException(400, "未解析到有效行，请使用 account_no,account_name,flow_date,net_amount")
    return liquidity_import_flows(FlowImportIn(flows=flows, unit=body.unit))


@app.get("/api/liquidity/history-monthly")
def liquidity_history_monthly(unit: Optional[str] = None):
    db = next(get_db())
    return monthly_from_records(db, CashflowRecord, unit)


class LiquidityMvpIn(BaseModel):
    """资金流预测页主路径：与月度流动性引擎同一套滚动模型，按天摊分并输出余额曲线。"""
    horizon_days: int = Field(90, ge=7, le=366)
    unit: Optional[str] = None
    opening_balance: Optional[float] = None
    only_confirmed: bool = True
    smart: bool = True


@app.post("/api/liquidity/mvp-forecast")
def liquidity_mvp_forecast(body: LiquidityMvpIn):
    db = SessionLocal()
    try:
        return run_mvp_daily_forecast(
            db,
            CashflowRecord,
            body.unit,
            body.horizon_days,
            body.opening_balance,
            body.only_confirmed,
            body.smart,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    finally:
        db.close()


@app.get("/api/liquidity/month-subject-detail")
def liquidity_month_subject_detail(
    year_month: str = Query(..., description="自然月 YYYY-MM"),
    unit: Optional[str] = None,
    only_confirmed: bool = Query(True),
    forecast_inflow: Optional[float] = Query(None, description="预测月：与 MVP 月汇总一致时传入，用于按比例分摊科目"),
    forecast_outflow: Optional[float] = Query(None),
):
    """资金流预测 · 月维度科目金额明细（真实流水优先；预测月可按历史结构分摊）。"""
    db = SessionLocal()
    try:
        return resolve_month_subject_detail(
            db,
            CashflowRecord,
            CashflowSubject,
            year_month,
            unit,
            only_confirmed,
            forecast_inflow,
            forecast_outflow,
        )
    finally:
        db.close()


class LiquiditySchemeIn(BaseModel):
    name: str
    unit: Optional[str] = None
    horizon_months: int = 12
    model_code: str = "ROLLING_AVG"
    run_mode: str = "manual"
    target_mape: Optional[float] = Field(None, description="目标准确度，如 8 表示 8%")
    params_json: str = "{}"


@app.get("/api/liquidity/schemes")
def liquidity_list_schemes():
    db = next(get_db())
    q = (
        db.query(LiquidityForecastScheme)
        .filter(LiquidityForecastScheme.is_deleted == False)
        .order_by(LiquidityForecastScheme.created_at.desc())
    )
    return [_dictify(r) for r in q.all()]


@app.post("/api/liquidity/schemes")
def liquidity_create_scheme(body: LiquiditySchemeIn):
    db = next(get_db())
    obj = LiquidityForecastScheme(
        name=body.name,
        unit=body.unit or None,
        horizon_months=body.horizon_months,
        model_code=body.model_code,
        run_mode=body.run_mode,
        target_mape=body.target_mape,
        params_json=body.params_json or "{}",
        status="draft",
        is_deleted=False,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _dictify(obj)


@app.post("/api/liquidity/schemes/{sid}/run")
def liquidity_run_scheme(sid: int):
    db = SessionLocal()
    try:
        scheme = (
            db.query(LiquidityForecastScheme)
            .filter(LiquidityForecastScheme.id == sid, LiquidityForecastScheme.is_deleted == False)
            .first()
        )
        if not scheme:
            raise HTTPException(404)
        try:
            params = {}
            try:
                params = json.loads(scheme.params_json or "{}")
            except Exception:
                pass
            if params.get("backtest"):
                out = run_holdout_backtest(db, scheme, CashflowRecord, LiquidityForecastMonthly)
            else:
                out = run_scheme_forecast(db, scheme, CashflowRecord, LiquidityForecastMonthly)
        except ValueError as e:
            raise HTTPException(400, str(e))
        return out
    finally:
        db.close()


class LiquidityBacktestIn(BaseModel):
    """split_mode：index=按序截取；calendar_years=第1–3日历年训练、第4日历年检验。"""
    name: str = "Hold-out 回测(36+12)"
    unit: Optional[str] = None
    train_months: int = Field(36, ge=6, le=120)
    test_months: int = Field(12, ge=1, le=36)
    split_mode: str = Field(
        "index",
        description="index | calendar_years；亦可写在 params_json.split_mode",
    )
    model_code: str = "ROLLING_AVG"
    run_mode: str = "manual"
    target_mape: Optional[float] = None
    params_json: str = "{}"

    @field_validator("split_mode")
    @classmethod
    def _norm_split_mode(cls, v: str) -> str:
        x = (v or "index").strip().lower()
        if x not in ("index", "calendar_years"):
            raise ValueError("split_mode 仅支持 index 或 calendar_years")
        return x


@app.post("/api/liquidity/backtest")
def liquidity_run_backtest(body: LiquidityBacktestIn):
    """创建带 backtest 标记的方案并执行 hold-out，结果行含 actual_* 与 actual_balance_end。"""
    db = SessionLocal()
    try:
        hist = monthly_from_records(db, CashflowRecord, body.unit or None)
        try:
            extra = json.loads(body.params_json or "{}")
        except Exception:
            raise HTTPException(400, "params_json 不是合法 JSON")
        extra["backtest"] = True
        extra["train_months"] = body.train_months
        extra["test_months"] = body.test_months
        extra["split_mode"] = (body.split_mode or "index").strip().lower()
        try:
            _, test_part, _ = compute_holdout_split(hist, extra)
        except ValueError as e:
            raise HTTPException(400, str(e))
        horizon_init = len(test_part)
        obj = LiquidityForecastScheme(
            name=body.name,
            unit=body.unit or None,
            horizon_months=horizon_init,
            model_code=body.model_code,
            run_mode=body.run_mode,
            target_mape=body.target_mape,
            params_json=json.dumps(extra, ensure_ascii=False),
            status="draft",
            is_deleted=False,
        )
        db.add(obj)
        db.commit()
        db.refresh(obj)
        try:
            out = run_holdout_backtest(db, obj, CashflowRecord, LiquidityForecastMonthly)
        except ValueError as e:
            obj.is_deleted = True
            db.commit()
            raise HTTPException(400, str(e))
        return out
    finally:
        db.close()


@app.get("/api/liquidity/schemes/{sid}/results")
def liquidity_scheme_results(sid: int):
    db = next(get_db())
    sch = (
        db.query(LiquidityForecastScheme)
        .filter(LiquidityForecastScheme.id == sid, LiquidityForecastScheme.is_deleted == False)
        .first()
    )
    if not sch:
        raise HTTPException(404)
    rows = (
        db.query(LiquidityForecastMonthly)
        .filter(LiquidityForecastMonthly.scheme_id == sid)
        .order_by(LiquidityForecastMonthly.year_month)
        .all()
    )
    return {
        "scheme": _dictify(sch),
        "items": [_dictify(r) for r in rows],
    }


def _record_amount_cny(r: CashflowRecord) -> float:
    """PRD：汇总以 CNY；优先 amount_cny / 锁汇折算字段。"""
    if getattr(r, "amount_cny", None) is not None:
        return float(r.amount_cny)
    if r.currency == "CNY":
        return float(r.amount)
    return float(r.amount)


@app.get("/api/dashboard/stats")
def dashboard_stats():
    db = next(get_db())
    records = db.query(CashflowRecord).filter(CashflowRecord.is_deleted == False).all()
    inflow = sum(_record_amount_cny(r) for r in records if r.amount > 0)
    outflow = sum(abs(_record_amount_cny(r)) for r in records if r.amount < 0)
    net = inflow - outflow
    confirmed = sum(1 for r in records if r.status == "已确认")
    predicted = sum(1 for r in records if r.status == "预测")
    unconfirmed = sum(1 for r in records if r.status == "未确认")
    fx_count = db.query(FxExposure).count()
    fx_total = sum(e.notional for e in db.query(FxExposure).all())
    return {
        "total_inflow": inflow,
        "total_outflow": outflow,
        "net_position": net,
        "record_count": len(records),
        "confirmed": confirmed,
        "predicted": predicted,
        "unconfirmed": unconfirmed,
        "fx_exposure_count": fx_count,
        "fx_total_notional": fx_total,
        "units": list(set(r.unit for r in records)),
    }


class ChatIn(BaseModel):
    message: str
    role: str = "treasurer"
    history: List[dict] = Field(default_factory=list)
    deepseek_api_key: Optional[str] = None  # 亿流 Work 前端传入，与服务器环境变量二选一
    system_prompt: Optional[str] = None  # 与前端当前智能体人设一致；未传则后端 DataAgent 基座


@app.post("/api/agent/chat")
async def agent_chat(body: ChatIn):
    from agent import run_agent

    key = (body.deepseek_api_key or "").strip() or None
    out = await run_agent(
        body.message,
        body.role,
        body.history or [],
        api_key_override=key,
        system_prompt=body.system_prompt,
    )
    if isinstance(out, dict):
        return {
            "reply": out.get("reply") or "",
            "trace": out.get("trace") or [],
        }
    return {"reply": str(out), "trace": []}


FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")
# 亿流 Work（Accio）：优先与工程同级的「03-资金预测-Accio风格工作台」（日常改这里即生效）；否则用 frontend/accio 随包副本，避免仅拷 backend 时 404
_ACCIO_EMBED = os.path.join(FRONTEND_DIR, "accio")
_ACCIO_SIBLING = os.path.join(os.path.dirname(__file__), "..", "..", "03-资金预测-Accio风格工作台")
ACCIO_WORKBENCH_DIR = _ACCIO_SIBLING if os.path.isdir(_ACCIO_SIBLING) else _ACCIO_EMBED


@app.get("/")
def serve_index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


@app.get("/app")
def serve_app():
    return FileResponse(os.path.join(FRONTEND_DIR, "app.html"))


@app.get("/workbench")
def redirect_accio_workbench():
    """别名：便于记忆；根路径 / 仍是全栈选角色页，亿流 Work 请用 /accio/。"""
    return RedirectResponse(url="/accio/", status_code=302)


# 必须先挂 /accio、/lf-mvp，再挂根目录静态，否则会被 FRONTEND 抢路由
if os.path.isdir(ACCIO_WORKBENCH_DIR):
    app.mount("/accio", StaticFiles(directory=ACCIO_WORKBENCH_DIR, html=True), name="accio_workbench")

# 司库流动性预测 MVP 静态页（与仓库根目录「04-司库流动性预测-MVP/web」对齐），供 /accio 内 iframe 同源嵌入
_LFMVP_WEB = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "04-司库流动性预测-MVP", "web")
)
if os.path.isdir(_LFMVP_WEB):
    app.mount("/lf-mvp", StaticFiles(directory=_LFMVP_WEB, html=True), name="lf_mvp_web")

if os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="static")

init_db()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
