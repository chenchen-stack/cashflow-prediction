"""
database.py — SQLAlchemy 模型（12 张表）+ init_db 种子数据
资金预测智能体 · 全栈系统
"""

import json, os
from datetime import date, datetime, timedelta
from sqlalchemy import (
    create_engine, Column, Integer, Float, String, Text, Boolean, Date, DateTime,
    ForeignKey, text, inspect,
)
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool

DB_PATH = os.path.join(os.path.dirname(__file__), "cashflow_agent.db")
engine = create_engine(
    f"sqlite:///{DB_PATH}",
    echo=False,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


# ═══════════════════════════════════════════
#  1. 资金流科目
# ═══════════════════════════════════════════
class CashflowSubject(Base):
    __tablename__ = "cashflow_subjects"
    id        = Column(Integer, primary_key=True, autoincrement=True)
    code      = Column(String(30), unique=True, nullable=False)
    name      = Column(String(100), nullable=False)
    parent_id = Column(Integer, ForeignKey("cashflow_subjects.id"), nullable=True)
    direction = Column(String(10), nullable=False)   # 流入 / 流出
    unit_name = Column(String(120), nullable=True, default="")  # 归属单位 / 数据来源主体（PRD）
    is_period = Column(String(10), default="否")      # 否 / 期初 / 期末
    valid     = Column(Boolean, default=True)
    is_deleted = Column(Boolean, default=False)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


# ═══════════════════════════════════════════
#  2. 资金业务
# ═══════════════════════════════════════════
class CashflowBusiness(Base):
    __tablename__ = "cashflow_businesses"
    id       = Column(Integer, primary_key=True, autoincrement=True)
    code     = Column(String(10), unique=True, nullable=False)
    name     = Column(String(100), nullable=False)
    biz_type = Column(String(40), nullable=False)  # 一般资金流 / 保证金 / 借款 ...
    valid    = Column(Boolean, default=True)
    is_deleted = Column(Boolean, default=False)


# ═══════════════════════════════════════════
#  3. 业务 · 资金流信息
# ═══════════════════════════════════════════
class BizFlowInfo(Base):
    __tablename__ = "biz_flow_info"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    biz_id     = Column(Integer, ForeignKey("cashflow_businesses.id"), nullable=False)
    flow_type  = Column(String(40), nullable=False)   # 本金 / 借入本金 / 利息 ...
    direction  = Column(String(20), nullable=False)    # 流入 / 流出 / 根据金额正负决定
    subject_id = Column(Integer, ForeignKey("cashflow_subjects.id"), nullable=True)


# ═══════════════════════════════════════════
#  4. 科目与业务类别映射
# ═══════════════════════════════════════════
class SubjectCategoryMap(Base):
    __tablename__ = "subject_category_map"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    subject_id      = Column(Integer, ForeignKey("cashflow_subjects.id"), nullable=False)
    category_ids    = Column(Text, default="[]")  # JSON array（业务编码列表）
    valid           = Column(Boolean, default=True)
    is_deleted      = Column(Boolean, default=False)


# ═══════════════════════════════════════════
#  5. 科目与资金计划科目映射
# ═══════════════════════════════════════════
class SubjectPlanMap(Base):
    __tablename__ = "subject_plan_map"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    subject_ids     = Column(Text, default="[]")  # JSON array
    direction       = Column(String(10), nullable=False)
    plan_subject_id = Column(Integer, default=0)
    plan_subject_name = Column(String(100), default="")
    valid           = Column(Boolean, default=True)
    is_deleted      = Column(Boolean, default=False)


# ═══════════════════════════════════════════
#  6. 时间段配置
# ═══════════════════════════════════════════
class TimePeriodConfig(Base):
    __tablename__ = "time_period_configs"
    id           = Column(Integer, primary_key=True, autoincrement=True)
    code         = Column(String(20), unique=True, nullable=False)
    name         = Column(String(100), nullable=False)
    periods_json = Column(Text, default="[]")  # [{"freq":"天","length":7}, ...]
    valid        = Column(Boolean, default=True)
    is_deleted   = Column(Boolean, default=False)


# ═══════════════════════════════════════════
#  7. 资金流集合
# ═══════════════════════════════════════════
class CashflowCollection(Base):
    __tablename__ = "cashflow_collections"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    code          = Column(String(30), unique=True, nullable=False)
    created_at    = Column(DateTime, default=datetime.now)
    source_system = Column(String(40), default="手工新增")


# ═══════════════════════════════════════════
#  8. 资金流单据
# ═══════════════════════════════════════════
class CashflowRecord(Base):
    __tablename__ = "cashflow_records"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    code          = Column(String(30), unique=True, nullable=False)
    collection_id = Column(Integer, ForeignKey("cashflow_collections.id"), nullable=True)
    unit          = Column(String(60), nullable=False)
    biz_id        = Column(Integer, ForeignKey("cashflow_businesses.id"), nullable=True)
    currency      = Column(String(10), default="CNY")
    amount        = Column(Float, default=0)
    trade_date    = Column(Date, nullable=True)
    settle_date   = Column(Date, nullable=True)
    source_system = Column(String(40), default="手工新增")
    source_ref    = Column(String(60), nullable=True)
    # PRD：跨源去重键、权威性、锁汇折算（REQ-016 口径）
    source_doc_id = Column(String(80), nullable=True)
    authority_rank = Column(Integer, default=4)  # 1 银企 2 TMS 3 ERP 4 手工
    lock_no_auto_overwrite = Column(Boolean, default=False)
    amount_cny    = Column(Float, nullable=True)
    fx_lock_rate  = Column(Float, nullable=True)
    fx_lock_expiry = Column(Date, nullable=True)
    status        = Column(String(20), default="预测")  # 流水/待确认/已确认/预测/待审核 等
    flows_json    = Column(Text, default="[]")  # [{flow_date, flow_type, currency, amount, subject_id, status}]
    self_account_no   = Column(String(120), nullable=True)  # 本方账号
    self_account_name = Column(String(200), nullable=True)  # 本方账户名
    counterparty_account = Column(String(100), nullable=True)  # 对方账号
    counterparty_name = Column(String(200), nullable=True)  # 对方账户名
    bank_name     = Column(String(200), nullable=True)  # 交易行名
    summary       = Column(String(500), nullable=True)  # 摘要
    is_deleted    = Column(Boolean, default=False)


# ═══════════════════════════════════════════
#  9. 分析与预测报告
# ═══════════════════════════════════════════
class AnalysisReport(Base):
    __tablename__ = "analysis_reports"
    id          = Column(Integer, primary_key=True, autoincrement=True)
    code        = Column(String(30), unique=True, nullable=False)
    name        = Column(String(100), nullable=False)
    params_json = Column(Text, default="{}")
    result_json = Column(Text, default="{}")
    created_at  = Column(DateTime, default=datetime.now)


# ═══════════════════════════════════════════
#  10. 资金计划
# ═══════════════════════════════════════════
class CapitalPlan(Base):
    __tablename__ = "capital_plans"
    id           = Column(Integer, primary_key=True, autoincrement=True)
    unit         = Column(String(60), nullable=False)
    period_type  = Column(String(10), nullable=False)  # 年/季/月/周/天
    period_label = Column(String(40), nullable=False)
    data_json    = Column(Text, default="{}")
    status       = Column(String(10), default="草稿")  # 草稿/已提交/已审批
    data_source  = Column(String(40), default="资金流数据")  # 资金流数据 / 资金分析与预测数据
    is_deleted   = Column(Boolean, default=False)


# ═══════════════════════════════════════════
#  11. 外汇敞口
# ═══════════════════════════════════════════
class FxExposure(Base):
    __tablename__ = "fx_exposures"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    currency_pair = Column(String(10), nullable=False)
    notional      = Column(Float, default=0)
    direction     = Column(String(10), default="买入")
    maturity      = Column(Date, nullable=True)
    hedge_ratio   = Column(Float, default=0)
    instrument    = Column(String(40), default="远期")
    pnl           = Column(Float, default=0)
    status        = Column(String(10), default="持有")


# ═══════════════════════════════════════════
#  12. 取数映射规则
# ═══════════════════════════════════════════
class MappingRule(Base):
    __tablename__ = "mapping_rules"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    code            = Column(String(20), unique=True, nullable=False)
    name            = Column(String(100), nullable=True)
    biz_id          = Column(Integer, ForeignKey("cashflow_businesses.id"), nullable=True)
    source_system   = Column(String(40), default="资金管理系统")
    source_doc_type = Column(String(60), nullable=True)
    filters_json    = Column(Text, default="[]")
    field_map_json  = Column(Text, default="{}")
    valid           = Column(Boolean, default=True)
    is_deleted      = Column(Boolean, default=False)


# ═══════════════════════════════════════════
#  13. 数据获取任务配置
# ═══════════════════════════════════════════
# ═══════════════════════════════════════════
#  同步日志（权威性 / 冲突 / 审计快照 · PRD 数据集成）
# ═══════════════════════════════════════════
class SyncLog(Base):
    __tablename__ = "sync_logs"
    id             = Column(Integer, primary_key=True, autoincrement=True)
    run_id         = Column(String(40), nullable=False)
    action_type    = Column(String(20), nullable=False)  # insert / skip / override / forced_override
    source_system  = Column(String(40), default="")
    message        = Column(String(500), default="")
    snapshot_json  = Column(Text, default="{}")  # 覆盖前全字段快照
    target_record_id = Column(Integer, nullable=True)
    source_doc_id  = Column(String(80), nullable=True)
    created_at     = Column(DateTime, default=datetime.now)


class FetchTask(Base):
    __tablename__ = "fetch_tasks"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    name          = Column(String(120), nullable=False)
    task_type     = Column(String(50), nullable=False)  # 资金流自动获取 / 资金计划自动获取资金预测
    enabled       = Column(Boolean, default=True)
    cron_expr     = Column(String(80), default="0 0 12 * * ?")
    filters_json  = Column(Text, default="[]")
    extra_json    = Column(Text, default="{}")  # post_action, period_types, last_run_times
    created_at    = Column(DateTime, default=datetime.now)
    is_deleted    = Column(Boolean, default=False)


# ═══════════════════════════════════════════
#  14–18. 司库流动性预测 MVP（对齐文章：数据层 + 预测方案 + 结果 + 模型目录）
# ═══════════════════════════════════════════
class BankAccount(Base):
    __tablename__ = "bank_accounts"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    account_no    = Column(String(40), unique=True, nullable=False)
    account_name  = Column(String(120), nullable=False)
    bank_name     = Column(String(120), default="")
    currency      = Column(String(10), default="CNY")
    unit          = Column(String(60), default="总部")
    status        = Column(String(20), default="启用")  # 启用 / 冻结
    created_at    = Column(DateTime, default=datetime.now)
    is_deleted    = Column(Boolean, default=False)


class AccountBalanceFlow(Base):
    __tablename__ = "account_balance_flows"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    account_id      = Column(Integer, ForeignKey("bank_accounts.id"), nullable=False)
    flow_date       = Column(Date, nullable=False)
    net_amount      = Column(Float, default=0)
    closing_balance = Column(Float, nullable=True)
    source          = Column(String(40), default="import")
    created_at      = Column(DateTime, default=datetime.now)


class LiquidityModelCatalog(Base):
    __tablename__ = "liquidity_model_catalog"
    id                   = Column(Integer, primary_key=True, autoincrement=True)
    code                 = Column(String(40), unique=True, nullable=False)
    name                 = Column(String(120), nullable=False)
    description          = Column(Text, default="")
    model_type           = Column(String(20), default="manual")  # manual / stat / smart
    params_schema_json   = Column(Text, default="{}")
    valid                = Column(Boolean, default=True)


class LiquidityForecastScheme(Base):
    __tablename__ = "liquidity_forecast_schemes"
    id               = Column(Integer, primary_key=True, autoincrement=True)
    name             = Column(String(200), nullable=False)
    unit             = Column(String(60), nullable=True)
    horizon_months   = Column(Integer, default=12)
    model_code       = Column(String(40), nullable=False)
    run_mode         = Column(String(20), default="manual")  # manual / smart
    target_mape      = Column(Float, nullable=True)
    params_json      = Column(Text, default="{}")
    status           = Column(String(20), default="draft")
    method_note      = Column(String(500), default="")
    created_at       = Column(DateTime, default=datetime.now)
    is_deleted       = Column(Boolean, default=False)


class LiquidityForecastMonthly(Base):
    __tablename__ = "liquidity_forecast_monthly"
    id                   = Column(Integer, primary_key=True, autoincrement=True)
    scheme_id            = Column(Integer, ForeignKey("liquidity_forecast_schemes.id"), nullable=False)
    year_month           = Column(String(10), nullable=False)
    pred_inflow          = Column(Float, default=0)
    pred_outflow         = Column(Float, default=0)
    pred_net             = Column(Float, default=0)
    pred_balance_end     = Column(Float, default=0)
    actual_balance_end   = Column(Float, nullable=True)
    actual_inflow        = Column(Float, nullable=True)
    actual_outflow       = Column(Float, nullable=True)
    actual_net           = Column(Float, nullable=True)
    created_at           = Column(DateTime, default=datetime.now)


# ═══════════════════════════════════════════
#  司库指标映射（对齐《数据映射与计算逻辑表》附图 · 可版本化维护）
# ═══════════════════════════════════════════
class TreasuryMappingRow(Base):
    __tablename__ = "treasury_mapping_rows"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    section       = Column(String(120), nullable=False)   # 黄色分组标题
    indicator     = Column(String(200), nullable=False)    # 指标
    source_ref    = Column(String(300), default="")        # 来源表/模块
    logic_text    = Column(Text, default="")               # 说明/过滤与公式
    sort_order    = Column(Integer, default=0)


# ═══════════════════════════════════════════
#  智能财务中台 · 付款池 / 策略 / 往来 / 预警 / 银企指令
# ═══════════════════════════════════════════
class PaymentPoolItem(Base):
    __tablename__ = "payment_pool_items"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    unit          = Column(String(80), nullable=False)
    biz_type      = Column(String(80), nullable=False)
    counterparty  = Column(String(160), default="")
    amount        = Column(Float, default=0)
    expect_date   = Column(Date, nullable=True)
    priority      = Column(String(10), default="P1")  # P0 / P1
    status        = Column(String(40), default="待排程")
    run_at        = Column(String(24), default="")    # 如 09:00 或 —
    source_doc    = Column(String(80), default="")
    extra_json    = Column(Text, default="{}")
    is_deleted    = Column(Boolean, default=False)
    created_at    = Column(DateTime, default=datetime.now)


class PaymentStrategy(Base):
    __tablename__ = "payment_strategies"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    unit       = Column(String(80), default="*")  # * 表示默认
    biz_type   = Column(String(80), nullable=False)
    run_at     = Column(String(24), default="09:00")
    holiday    = Column(String(20), default="顺延")  # 顺延 / 不调整 / 提前
    enabled    = Column(Boolean, default=True)
    is_deleted = Column(Boolean, default=False)


class ArapDocument(Base):
    """往来款：应收 AR / 应付 AP / 预付 PRE"""
    __tablename__ = "arap_documents"
    id           = Column(Integer, primary_key=True, autoincrement=True)
    ar_type      = Column(String(10), nullable=False)  # AR / AP / PRE
    unit         = Column(String(80), nullable=False)
    name         = Column(String(160), nullable=False)  # 客户/供应商/项目
    amount       = Column(Float, default=0)  # 应收应付余额；预付为预付余额
    age_bucket   = Column(String(40), default="")
    due_date     = Column(Date, nullable=True)
    risk_score   = Column(Float, nullable=True)   # 应收
    credit       = Column(String(20), nullable=True)  # 应付
    owner        = Column(String(40), nullable=True)  # 预付责任人
    clear_deadline = Column(Date, nullable=True)
    extra_json   = Column(Text, default="{}")
    is_deleted   = Column(Boolean, default=False)


class FundAlert(Base):
    __tablename__ = "fund_alerts"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    level      = Column(String(10), nullable=False)  # 高/中/低
    rule       = Column(String(120), default="")
    message    = Column(String(500), nullable=False)
    alert_time = Column(String(40), default="")  # 展示用时间文案
    link_page  = Column(String(40), default="payment")  # payment/arap/fx
    is_cleared = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)


class BankPaymentOrder(Base):
    """银企直联模拟：支付指令与回执"""
    __tablename__ = "bank_payment_orders"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    batch_id        = Column(String(40), nullable=False, index=True)
    pool_item_id    = Column(Integer, ForeignKey("payment_pool_items.id"), nullable=True)
    bank_code       = Column(String(20), default="MOCK")  # 工行/建行模拟
    payer_account   = Column(String(40), default="")
    payee_name      = Column(String(120), default="")
    payee_account   = Column(String(40), default="")
    amount          = Column(Float, default=0)
    currency        = Column(String(10), default="CNY")
    status          = Column(String(20), default="accepted")  # accepted/sent/success/failed
    bank_ref        = Column(String(80), nullable=True)  # 银行流水号
    error_message   = Column(String(300), nullable=True)
    raw_request_json  = Column(Text, default="{}")
    raw_response_json = Column(Text, default="{}")
    created_at      = Column(DateTime, default=datetime.now)
    updated_at      = Column(DateTime, default=datetime.now, onupdate=datetime.now)


# ═══════════════════════════════════════════
#  预测快照（可追溯 / 与实际日净额对比偏差）
# ═══════════════════════════════════════════
class ForecastSnapshot(Base):
    __tablename__ = "forecast_snapshots"
    id                  = Column(Integer, primary_key=True, autoincrement=True)
    created_at          = Column(DateTime, default=datetime.now)
    unit                = Column(String(80), nullable=True)  # 空=全部主体
    horizon             = Column(Integer, default=14)
    opening_balance     = Column(Float, default=0)
    last_hist_date      = Column(String(12), default="")
    history_length      = Column(Integer, default=0)
    methods_json        = Column(Text, default="[]")
    forecast_json       = Column(Text, default="{}")
    blended_yhat_json   = Column(Text, default="[]")
    future_dates_json   = Column(Text, default="[]")
    scenario_params_json = Column(Text, default="{}")


# ═══════════════════════════════════════════
#  SQLite 增量列（兼容已有 cashflow_agent.db）
# ═══════════════════════════════════════════
def _migrate_schema(engine):
    insp = inspect(engine)
    tables = insp.get_table_names()
    adds = [
        ("cashflow_subjects", "is_deleted", "INTEGER NOT NULL DEFAULT 0"),
        ("cashflow_businesses", "is_deleted", "INTEGER NOT NULL DEFAULT 0"),
        ("subject_category_map", "is_deleted", "INTEGER NOT NULL DEFAULT 0"),
        ("subject_plan_map", "is_deleted", "INTEGER NOT NULL DEFAULT 0"),
        ("subject_plan_map", "plan_subject_name", "VARCHAR(100) DEFAULT ''"),
        ("time_period_configs", "is_deleted", "INTEGER NOT NULL DEFAULT 0"),
        ("cashflow_records", "is_deleted", "INTEGER NOT NULL DEFAULT 0"),
        ("capital_plans", "data_source", "VARCHAR(40) DEFAULT '资金流数据'"),
        ("capital_plans", "is_deleted", "INTEGER NOT NULL DEFAULT 0"),
        ("mapping_rules", "is_deleted", "INTEGER NOT NULL DEFAULT 0"),
        ("liquidity_forecast_monthly", "actual_inflow", "REAL"),
        ("liquidity_forecast_monthly", "actual_outflow", "REAL"),
        ("liquidity_forecast_monthly", "actual_net", "REAL"),
        ("cashflow_records", "source_doc_id", "VARCHAR(80)"),
        ("cashflow_records", "authority_rank", "INTEGER NOT NULL DEFAULT 4"),
        ("cashflow_records", "lock_no_auto_overwrite", "INTEGER NOT NULL DEFAULT 0"),
        ("cashflow_records", "amount_cny", "REAL"),
        ("cashflow_records", "fx_lock_rate", "REAL"),
        ("cashflow_records", "fx_lock_expiry", "DATE"),
        ("cashflow_records", "self_account_no", "VARCHAR(120)"),
        ("cashflow_records", "self_account_name", "VARCHAR(200)"),
        ("cashflow_records", "counterparty_account", "VARCHAR(100)"),
        ("cashflow_records", "counterparty_name", "VARCHAR(200)"),
        ("cashflow_records", "bank_name", "VARCHAR(200)"),
        ("cashflow_records", "summary", "VARCHAR(500)"),
        ("cashflow_subjects", "unit_name", "VARCHAR(120) DEFAULT ''"),
    ]
    with engine.begin() as conn:
        for table, col, ddl in adds:
            insp = inspect(engine)
            if table not in insp.get_table_names():
                continue
            cols = {c["name"] for c in insp.get_columns(table)}
            if col in cols:
                continue
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {ddl}"))


# ═══════════════════════════════════════════
#  init_db — 创建表 + 种子数据
# ═══════════════════════════════════════════

def _seed_maps_tasks_if_empty(session):
    """已有科目库时补种映射与任务（升级旧库）"""
    subs = session.query(CashflowSubject).filter(CashflowSubject.is_deleted == False).all()
    code_to_id = {s.code: s.id for s in subs}
    if session.query(SubjectCategoryMap).count() == 0 and code_to_id:
        scm_rows = [
            ("200001", ["002", "006", "009"]), ("200002", ["006"]), ("300001", ["018"]),
            ("400001", ["010"]), ("500001", ["001", "003"]),
            ("500002", ["004", "031", "032"]),  # 工资薪酬 1:N：代发工资、社保缴纳、公积金缴纳
            ("500003", ["003"]), ("600001", ["019"]), ("700001", ["010"]),
        ]
        for sc, codes in scm_rows:
            sid = code_to_id.get(sc)
            if sid:
                session.add(SubjectCategoryMap(
                    subject_id=sid, category_ids=json.dumps(codes, ensure_ascii=False), valid=True,
                ))
    if session.query(FetchTask).count() == 0:
        session.add(FetchTask(
            name="资金流自动获取", task_type="资金流自动获取", enabled=True,
            cron_expr="0 0 12 * * ?",
            filters_json=json.dumps([
                {"field": "有效标志", "op": "等于", "value": "有效"},
                {"field": "来源系统", "op": "等于", "value": "资金管理系统"},
            ], ensure_ascii=False),
            extra_json=json.dumps({"last_runs": []}, ensure_ascii=False),
        ))
        session.add(FetchTask(
            name="资金计划自动获取资金预测", task_type="资金计划自动获取资金预测", enabled=True,
            cron_expr="0 0 12 * * ?",
            filters_json=json.dumps([{"field": "单位", "op": "等于", "value": "总部"}], ensure_ascii=False),
            extra_json=json.dumps({"post_action": "暂存", "period_types": ["月计划"]}, ensure_ascii=False),
        ))
    session.commit()


def _ensure_payroll_biz_and_mapping(session):
    """已有非空库升级：补全 031/032 业务及工资薪酬(500002)科目↔业务映射。"""
    for code, name in [("031", "社保缴纳"), ("032", "公积金缴纳")]:
        ex = (
            session.query(CashflowBusiness)
            .filter(CashflowBusiness.code == code, CashflowBusiness.is_deleted == False)
            .first()
        )
        if not ex:
            session.add(CashflowBusiness(code=code, name=name, biz_type="一般资金流", valid=True))
    session.flush()
    sub = (
        session.query(CashflowSubject)
        .filter(CashflowSubject.code == "500002", CashflowSubject.is_deleted == False)
        .first()
    )
    if sub:
        scm = (
            session.query(SubjectCategoryMap)
            .filter(SubjectCategoryMap.subject_id == sub.id, SubjectCategoryMap.is_deleted == False)
            .first()
        )
        if scm:
            try:
                cur = json.loads(scm.category_ids or "[]")
            except Exception:
                cur = []
            target = ["004", "031", "032"]
            changed = False
            for t in target:
                if t not in cur:
                    cur.append(t)
                    changed = True
            if changed:
                scm.category_ids = json.dumps(cur, ensure_ascii=False)
    session.commit()


def _seed(session):
    """仅在空库时执行全量种子；否则补种映射/任务"""
    if session.query(CashflowSubject).count() > 0:
        _seed_maps_tasks_if_empty(session)
        return

    # --- 资金流科目 (树形) ---
    subjects = [
        # 期初/期末
        {"code": "100", "name": "期初余额",       "direction": "流入", "is_period": "期初"},
        {"code": "900", "name": "期末余额",       "direction": "流入", "is_period": "期末"},
        # 流入一级
        {"code": "200", "name": "经营性流入",     "direction": "流入"},
        {"code": "200001", "name": "销售回款",    "direction": "流入", "parent_code": "200"},
        {"code": "200002", "name": "其他经营收入", "direction": "流入", "parent_code": "200"},
        {"code": "300", "name": "投资性流入",     "direction": "流入"},
        {"code": "300001", "name": "利息收入",    "direction": "流入", "parent_code": "300"},
        {"code": "300002", "name": "理财赎回",    "direction": "流入", "parent_code": "300"},
        {"code": "400", "name": "融资性流入",     "direction": "流入"},
        {"code": "400001", "name": "借款流入",    "direction": "流入", "parent_code": "400"},
        # 流出一级
        {"code": "500", "name": "经营性流出",     "direction": "流出"},
        {"code": "500001", "name": "采购付款",    "direction": "流出", "parent_code": "500"},
        {"code": "500002", "name": "工资薪酬",    "direction": "流出", "parent_code": "500"},
        {"code": "500003", "name": "费用报销",    "direction": "流出", "parent_code": "500"},
        {"code": "500004", "name": "税费支出",    "direction": "流出", "parent_code": "500"},
        {"code": "600", "name": "投资性流出",     "direction": "流出"},
        {"code": "600001", "name": "理财购入",    "direction": "流出", "parent_code": "600"},
        {"code": "600002", "name": "定期存款",    "direction": "流出", "parent_code": "600"},
        {"code": "700", "name": "融资性流出",     "direction": "流出"},
        {"code": "700001", "name": "还款本金",    "direction": "流出", "parent_code": "700"},
        {"code": "700002", "name": "利息支出",    "direction": "流出", "parent_code": "700"},
    ]
    code_to_id = {}
    for s in subjects:
        parent_code = s.pop("parent_code", None)
        obj = CashflowSubject(**s)
        if parent_code and parent_code in code_to_id:
            obj.parent_id = code_to_id[parent_code]
        session.add(obj)
        session.flush()
        code_to_id[s["code"]] = obj.id

    # --- 资金业务 ---
    biz_list = [
        ("001", "采购付款",   "一般资金流"), ("002", "销售收款",   "一般资金流"),
        ("003", "费用报销",   "一般资金流"), ("004", "代发工资",   "一般资金流"),
        ("005", "资金调拨付", "一般资金流"), ("006", "资金调拨收", "一般资金流"),
        ("007", "保证金",     "保证金"),     ("008", "应付票据",   "一般资金流"),
        ("009", "应收票据",   "一般资金流"), ("010", "银行借款",   "借款"),
        ("011", "内部借款",   "借款"),       ("012", "委托借款",   "借款"),
        ("013", "资金拆借借", "借款"),       ("014", "内部对外借", "对外借款"),
        ("015", "拆借对外借", "对外借款"),   ("016", "定期存款",   "定期存款"),
        ("017", "通知存款",   "定期存款"),   ("018", "协定存款",   "协定存款"),
        ("019", "金额理财",   "金额理财"),   ("020", "份额理财",   "份额理财"),
        ("021", "开出信用证", "一般资金流"), ("022", "收到信用证", "一般资金流"),
        ("023", "外汇付款",   "一般资金流"), ("024", "外汇收款",   "一般资金流"),
        ("025", "外汇调拨付", "一般资金流"), ("026", "外汇调拨收", "一般资金流"),
        ("027", "外汇即期",   "外汇即远期"), ("028", "外汇远期",   "外汇即远期"),
        ("029", "外汇掉期",   "外汇掉期"),  ("030", "外汇期权",   "外汇期权"),
        ("031", "社保缴纳",   "一般资金流"), ("032", "公积金缴纳", "一般资金流"),
    ]
    biz_map = {}
    for code, name, bt in biz_list:
        b = CashflowBusiness(code=code, name=name, biz_type=bt)
        session.add(b)
        session.flush()
        biz_map[code] = b.id

    # --- 业务·资金流信息 (部分代表性) ---
    flow_infos = [
        (biz_map["001"], "本金", "流出"),
        (biz_map["002"], "本金", "流入"),
        (biz_map["003"], "本金", "流出"),
        (biz_map["004"], "本金", "流出"),
        (biz_map["010"], "借入本金", "流入"), (biz_map["010"], "利息", "流出"), (biz_map["010"], "还款本金", "流出"),
        (biz_map["016"], "存入本金", "流出"), (biz_map["016"], "利息", "流入"), (biz_map["016"], "取出本金", "流入"),
        (biz_map["027"], "买入本金", "流入"), (biz_map["027"], "卖出本金", "流出"), (biz_map["027"], "差额", "根据金额正负决定"),
    ]
    for bid, ft, d in flow_infos:
        session.add(BizFlowInfo(biz_id=bid, flow_type=ft, direction=d))

    # --- 时间段配置 ---
    session.add(TimePeriodConfig(
        code="TP0001", name="标准预测周期（天7+周4+月3+季2+年1）",
        periods_json=json.dumps([
            {"freq": "天", "length": 7}, {"freq": "周", "length": 4},
            {"freq": "月", "length": 3}, {"freq": "季", "length": 2}, {"freq": "年", "length": 1},
        ], ensure_ascii=False),
    ))
    session.add(TimePeriodConfig(
        code="TP0002", name="短期滚动（天14+月2）",
        periods_json=json.dumps([{"freq": "天", "length": 14}, {"freq": "月", "length": 2}], ensure_ascii=False),
    ))

    # --- 资金流集合 + 演示资金流单据 ---
    col = CashflowCollection(code="BATCH1740000000000", source_system="资金管理系统")
    session.add(col)
    session.flush()
    col2 = CashflowCollection(code="BATCH1741000000000", source_system="手工新增")
    session.add(col2)
    session.flush()

    today = date.today()
    units = ["总部", "华东子公司", "华南子公司"]
    demo_flows = [
        # (unit, biz_code, currency, amount, days_offset, status, subject_code)
        ("总部",       "002", "CNY",  5800000,  -25, "已确认", "200001"),
        ("总部",       "001", "CNY", -2300000,  -22, "已确认", "500001"),
        ("总部",       "003", "CNY",  -450000,  -18, "已确认", "500003"),
        ("总部",       "004", "CNY", -1200000,  -15, "已确认", "500002"),
        ("总部",       "002", "CNY",  3200000,   -8, "已确认", "200001"),
        ("华东子公司", "002", "CNY",  4100000,  -20, "已确认", "200001"),
        ("华东子公司", "001", "CNY", -1800000,  -12, "已确认", "500001"),
        ("华东子公司", "003", "CNY",  -280000,   -6, "未确认", "500003"),
        ("华南子公司", "002", "CNY",  2600000,  -18, "已确认", "200001"),
        ("华南子公司", "001", "CNY", -1500000,  -10, "未确认", "500001"),
        # 预测数据
        ("总部",       "002", "CNY",  6200000,   5, "预测", "200001"),
        ("总部",       "001", "CNY", -2800000,   8, "预测", "500001"),
        ("总部",       "004", "CNY", -1200000,  12, "预测", "500002"),
        ("华东子公司", "002", "CNY",  3800000,  10, "预测", "200001"),
        ("华东子公司", "001", "CNY", -2100000,  15, "预测", "500001"),
        ("华南子公司", "002", "CNY",  2900000,   7, "预测", "200001"),
        ("华南子公司", "001", "CNY", -1200000,  18, "预测", "500001"),
        # 外币
        ("总部",       "024", "USD",   850000, -14, "已确认", "200002"),
        ("总部",       "023", "USD",  -620000,   3, "预测",   "500001"),
    ]
    for i, (unit, bc, cur, amt, off, st, sc) in enumerate(demo_flows, 1):
        d = today + timedelta(days=off)
        cid = col.id if st == "已确认" else col2.id
        sid = code_to_id.get(sc)
        flow_row = [{
            "flow_date": d.isoformat(), "flow_type": "本金",
            "currency": cur, "amount": amt,
            "subject_id": sid, "status": st,
        }]
        session.add(CashflowRecord(
            code=f"CF{today.strftime('%Y%m%d')}{i:08d}",
            collection_id=cid, unit=unit,
            biz_id=biz_map.get(bc), currency=cur, amount=amt,
            trade_date=d, settle_date=d,
            source_system="资金管理系统" if st == "已确认" else "手工新增",
            status=st, flows_json=json.dumps(flow_row, ensure_ascii=False),
        ))

    # --- 资金计划 ---
    for unit in units:
        session.add(CapitalPlan(
            unit=unit, period_type="月", period_label="2026年4月",
            data_json=json.dumps({
                "经营性流入": 5200000 if unit == "总部" else 3000000,
                "经营性流出": -3800000 if unit == "总部" else -2200000,
                "投资性流入": 200000, "投资性流出": -500000,
                "融资性流入": 1000000, "融资性流出": -800000,
            }, ensure_ascii=False),
            status="草稿", data_source="资金流数据",
        ))

    # --- 科目↔业务 / 科目↔计划 映射 ---
    def _sid(c):
        return code_to_id.get(c)

    scm_rows = [
        ("200001", ["002", "006", "009"]), ("200002", ["006"]), ("300001", ["018"]),
        ("400001", ["010"]), ("500001", ["001", "003"]),
        ("500002", ["004", "031", "032"]),  # 工资薪酬：代发工资、社保、公积金（1:N）
        ("500003", ["003"]), ("600001", ["019"]), ("700001", ["010"]),
    ]
    for sc, codes in scm_rows:
        sid = _sid(sc)
        if sid:
            session.add(SubjectCategoryMap(
                subject_id=sid, category_ids=json.dumps(codes, ensure_ascii=False), valid=True,
            ))

    # --- 定时获取任务 ---
    session.add(FetchTask(
        name="资金流自动获取", task_type="资金流自动获取", enabled=True,
        cron_expr="0 0 12 * * ?",
        filters_json=json.dumps([
            {"field": "有效标志", "op": "等于", "value": "有效"},
            {"field": "来源系统", "op": "等于", "value": "资金管理系统"},
        ], ensure_ascii=False),
        extra_json=json.dumps({"last_runs": []}, ensure_ascii=False),
    ))
    session.add(FetchTask(
        name="资金计划自动获取资金预测", task_type="资金计划自动获取资金预测", enabled=True,
        cron_expr="0 0 12 * * ?",
        filters_json=json.dumps([{"field": "单位", "op": "等于", "value": "总部"}], ensure_ascii=False),
        extra_json=json.dumps({"post_action": "暂存", "period_types": ["月计划"]}, ensure_ascii=False),
    ))

    # --- 外汇敞口 ---
    fx_data = [
        ("USD/CNY", 12500000, "买入", 30, 0.65, "远期",  185000, "持有"),
        ("USD/CNY",  8000000, "卖出", 60, 0.40, "期权", -92000,  "持有"),
        ("EUR/CNY",  5600000, "买入", 45, 0.50, "远期",  68000,  "持有"),
        ("SAR/CNY",  3200000, "买入", 90, 0.00, "无对冲", 0,     "未对冲"),
    ]
    for pair, notional, d, mat_off, hr, inst, pnl, st in fx_data:
        session.add(FxExposure(
            currency_pair=pair, notional=notional, direction=d,
            maturity=today + timedelta(days=mat_off),
            hedge_ratio=hr, instrument=inst, pnl=pnl, status=st,
        ))

    # --- 取数映射规则 ---
    for i, (doc_type, bc) in enumerate([
        ("应付票据", "008"), ("应收票据", "009"), ("银行借款", "010"),
        ("保证金", "007"), ("协定存款", "018"), ("开出信用证", "021"),
    ], 1):
        session.add(MappingRule(
            code=f"MR{i:06d}", name=f"{doc_type}取数规则",
            biz_id=biz_map.get(bc), source_doc_type=doc_type,
            filters_json="[]", field_map_json="{}",
        ))

    session.commit()


def _seed_liquidity_catalog(session):
    if session.query(LiquidityModelCatalog).count() > 0:
        return
    seeds = [
        (
            "ROLLING_AVG",
            "滚动均值外推",
            "按近 N 个月流入/流出均值外推未来周期；可配置 growth 模拟业务增长。对应文章「手动预测 / 统计基线」。",
            "manual",
            '{"rolling_months":{"type":"int","default":3,"label":"滚动月数"},"growth":{"type":"float","default":1.0,"label":"增长系数"}}',
        ),
        (
            "SMART_GRID",
            "智能系数搜索",
            "在历史月度序列上做一步前瞻误差网格搜索，并可朝「目标准确度」微调系数。对应文章「智能预测」MVP。",
            "smart",
            '{"rolling_months":{"type":"int","default":3,"label":"滚动月数"}}',
        ),
    ]
    for code, name, desc, mt, ps in seeds:
        session.add(
            LiquidityModelCatalog(
                code=code, name=name, description=desc, model_type=mt, params_schema_json=ps, valid=True,
            )
        )
    session.commit()


def _seed_agent_platform(session):
    """智能财务中台：付款池、策略、往来、预警（空表时播种）"""
    if session.query(PaymentPoolItem).filter(PaymentPoolItem.is_deleted == False).count() > 0:
        return
    today = date.today()

    strategies = [
        ("上海哈啰普惠", "每刻报销", "09:00", "顺延"),
        ("*", "每刻报销", "10:00", "顺延"),
        ("*", "骑手薪酬", "08:00", "不调整"),
    ]
    for unit, bt, ra, hol in strategies:
        session.add(PaymentStrategy(unit=unit, biz_type=bt, run_at=ra, holiday=hol, enabled=True))

    pool_rows = [
        ("上海哈啰普惠", "每刻报销", "员工报销池", 1280000, 0, "P0", "待排程", "09:00", "FK-202604-001"),
        ("华东子公司", "供应商货款", "核心供应商A", 5600000, 1, "P1", "已排程", "10:30", "AP-88421"),
        ("总部", "税费", "主管税务机关", 2100000, 0, "P0", "待排程", "15:00", "TAX-Q2"),
        ("华南子公司", "骑手薪酬", "劳务结算", 920000, 0, "P0", "队列中", "08:00", "HR-PAY-03"),
        ("总部", "票据兑付", "承兑行", 15000000, 3, "P1", "待排程", "—", "BILL-778"),
    ]
    for unit, bt, cp, amt, off, pr, st, runa, doc in pool_rows:
        session.add(PaymentPoolItem(
            unit=unit, biz_type=bt, counterparty=cp, amount=amt,
            expect_date=today + timedelta(days=off), priority=pr, status=st,
            run_at=runa, source_doc=doc,
        ))

    arap = [
        ("AR", "总部", "合作方X", 4200000, "0-30天", 12, 72.0, None, None, None),
        ("AR", "华东子公司", "渠道商Y", 1850000, "31-90天", -5, 58.0, None, None, None),
        ("AR", "华南子公司", "平台结算", 960000, "90天以上", -40, 41.0, None, None, None),
        ("AP", "总部", "核心供应商A", 5600000, "0-30天", 1, None, "AAA", None, None),
        ("AP", "华东子公司", "物流服务商", 320000, "0-30天", 2, None, "AA", None, None),
        ("PRE", "总部", "设备采购预付款", 2400000, "", None, None, None, "张某", 90),
        ("PRE", "华南子公司", "城市拓展合作", 800000, "", None, None, None, "李某", -10),
    ]
    for kind, unit, name, amt, age, due_off, rs, cr, ow, clr_off in arap:
        dd = today + timedelta(days=due_off) if due_off is not None else None
        cd = today + timedelta(days=clr_off) if clr_off is not None else None
        session.add(ArapDocument(
            ar_type=kind, unit=unit, name=name, amount=amt, age_bucket=age or "",
            due_date=dd, risk_score=rs, credit=cr, owner=ow, clear_deadline=cd,
        ))

    alerts = [
        ("高", "流动性备付金", "总部基本户可用余额低于安全线 5,000 万", "今日 08:12", "payment"),
        ("中", "重复支付嫌疑", "供应商A 同日两笔等额付款待复核", "今日 09:40", "payment"),
        ("中", "应收逾期", "渠道商Y 应收已逾期 5 天", "昨日 17:05", "arap"),
        ("低", "外汇敞口", "USD/CNY 未对冲名义超阈值", "今日 07:00", "fx"),
    ]
    for lv, ru, msg, tm, pg in alerts:
        session.add(FundAlert(level=lv, rule=ru, message=msg, alert_time=tm, link_page=pg))

    session.commit()


def init_db():
    Base.metadata.create_all(engine)
    _migrate_schema(engine)
    db = SessionLocal()
    try:
        _seed(db)
        _ensure_payroll_biz_and_mapping(db)
        _seed_liquidity_catalog(db)
        _seed_agent_platform(db)
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
    print("Database initialized with seed data.")
