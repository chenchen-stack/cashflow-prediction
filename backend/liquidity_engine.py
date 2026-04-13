"""
司库流动性预测 MVP 引擎 — 对齐「数据层 + 算法层」最小闭环：
- 历史：从 cashflow_records 按月汇总流入/流出（可扩展为 account_balance_flows）
- 手动预测：滚动均值 × 固定增长系数
- 智能预测：在训练窗内网格搜索增长系数，使一步前瞻 MAPE 最优，并朝 target_mape 方向微调
"""

from __future__ import annotations

import json
from collections import defaultdict
from calendar import monthrange
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session


def _ym(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def monthly_from_records(
    db: Session,
    CashflowRecord,
    unit: Optional[str],
    status_in: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    q = db.query(CashflowRecord).filter(CashflowRecord.is_deleted == False)
    if unit:
        q = q.filter(CashflowRecord.unit == unit)
    if status_in:
        q = q.filter(CashflowRecord.status.in_(status_in))
    rows = q.all()
    agg: Dict[str, Dict[str, float]] = defaultdict(lambda: {"inflow": 0.0, "outflow": 0.0})
    for r in rows:
        if not r.trade_date:
            continue
        ym = _ym(r.trade_date)
        a = float(r.amount or 0)
        if a >= 0:
            agg[ym]["inflow"] += a
        else:
            agg[ym]["outflow"] += abs(a)
    out = []
    for ym in sorted(agg.keys()):
        inf = agg[ym]["inflow"]
        ouf = agg[ym]["outflow"]
        out.append({"year_month": ym, "inflow": inf, "outflow": ouf, "net": inf - ouf})
    return out


def _rolling_avg(series: List[float], window: int) -> float:
    if not series:
        return 0.0
    w = min(window, len(series))
    return sum(series[-w:]) / w


def _mape_one_step_ahead(
    hist_inf: List[float],
    hist_out: List[float],
    growth: float,
    window: int = 3,
) -> float:
    """用前 window 月均值×growth 预测下一月，对历史可测区间算 MAPE（净额）。"""
    if len(hist_inf) < window + 2:
        return 999.0
    errs = []
    for t in range(window, len(hist_inf) - 1):
        pred_inf = _rolling_avg(hist_inf[:t], window) * growth
        pred_out = _rolling_avg(hist_out[:t], window) * growth
        pred_net = pred_inf - pred_out
        act_inf = hist_inf[t]
        act_out = hist_out[t]
        act_net = act_inf - act_out
        denom = max(abs(act_net), 1.0)
        errs.append(abs(pred_net - act_net) / denom)
    if not errs:
        return 999.0
    return sum(errs) / len(errs)


def pick_growth_smart(
    monthly: List[Dict[str, Any]],
    target_mape: Optional[float],
    window: int = 3,
) -> Tuple[float, str]:
    hist_inf = [m["inflow"] for m in monthly]
    hist_out = [m["outflow"] for m in monthly]
    best_g, best_mape = 1.0, 999.0
    for i in range(0, 161):
        g = 0.85 + i * 0.002  # 0.85 ~ 1.17
        m = _mape_one_step_ahead(hist_inf, hist_out, g, window)
        if m < best_mape:
            best_mape, best_g = m, g
    note = f"网格搜索 growth={best_g:.4f}，训练窗一步前瞻 MAPE≈{best_mape*100:.2f}%"
    if target_mape is not None and target_mape > 0:
        tgt = target_mape / 100.0 if target_mape > 1 else target_mape
        adj = best_g
        for _ in range(12):
            cur = _mape_one_step_ahead(hist_inf, hist_out, adj, window)
            if cur <= tgt * 1.05:
                break
            adj *= 0.985
        note += f"；向目标准确度 {tgt*100:.1f}% 微调后 growth={adj:.4f}"
        best_g = adj
    return best_g, note


def _next_month_ym(y: int, m: int) -> Tuple[int, int]:
    if m == 12:
        return y + 1, 1
    return y, m + 1


def run_mvp_daily_forecast(
    db: Session,
    CashflowRecord,
    unit: Optional[str],
    horizon_days: int,
    opening_balance: Optional[float],
    only_confirmed: bool = True,
    smart: bool = True,
) -> Dict[str, Any]:
    """
    资金流预测页主路径：从 cashflow_records 月度汇总 → 与 run_scheme_forecast 同口径的滚动预测，
    再按日历天摊入/流出，得到未来 horizon_days 天的预计余额曲线（与 liquidity_engine 月度方案一致）。
    """
    hd = max(7, min(int(horizon_days or 90), 366))
    monthly = monthly_from_records(db, CashflowRecord, unit, ["已确认"] if only_confirmed else None)
    note_fallback = ""
    if len(monthly) < 2 and only_confirmed:
        monthly = monthly_from_records(db, CashflowRecord, unit, None)
        note_fallback = " 已确认月份不足，已使用全部状态单据参与汇总。"
    if len(monthly) < 2:
        raise ValueError(
            "历史数据不足：至少需要 2 个自然月的资金流记录。请在「资金流管理」录入/同步/导入单据。"
        )

    window = 3
    if smart:
        growth, smart_note = pick_growth_smart(monthly, None, window)
        method_note = smart_note + note_fallback
    else:
        growth = 1.0
        method_note = "手动 growth=1.0" + note_fallback

    hist_by_ym = {m["year_month"]: m for m in monthly}
    last_ym = monthly[-1]["year_month"]
    hist_inf = [m["inflow"] for m in monthly]
    hist_out = [m["outflow"] for m in monthly]

    opening = float(opening_balance) if opening_balance is not None else sum(x["net"] for x in monthly)
    warn_line = max(abs(opening) * 0.15, 1_000_000.0)

    ly, lm = int(last_ym[:4]), int(last_ym[5:7])
    cy, cm = _next_month_ym(ly, lm)
    hist_inf_run = list(hist_inf)
    hist_out_run = list(hist_out)
    num_months = max(hd // 28 + 4, 6)
    month_pred: Dict[str, Dict[str, float]] = {}
    for _ in range(num_months):
        pred_inf = _rolling_avg(hist_inf_run, window) * growth
        pred_out = _rolling_avg(hist_out_run, window) * growth
        pred_net = pred_inf - pred_out
        ym = f"{cy:04d}-{cm:02d}"
        month_pred[ym] = {"pred_inf": pred_inf, "pred_out": pred_out, "pred_net": pred_net}
        hist_inf_run.append(pred_inf)
        hist_out_run.append(pred_out)
        cy, cm = _next_month_ym(cy, cm)

    start = date.today()
    labels: List[str] = []
    balances: List[float] = []
    daily_infs: List[float] = []
    daily_outs: List[float] = []
    alert_indices: List[int] = []
    bal = opening
    for i in range(hd):
        d = start + timedelta(days=i + 1)
        labels.append(d.isoformat())
        ym = f"{d.year:04d}-{d.month:02d}"
        nd = float(monthrange(d.year, d.month)[1])
        if ym <= last_ym:
            mdata = hist_by_ym.get(ym) or {"inflow": 0.0, "outflow": 0.0, "net": 0.0}
            inf_d = float(mdata["inflow"]) / nd
            ouf_d = float(mdata["outflow"]) / nd
        else:
            p = month_pred.get(ym)
            if not p:
                p = {"pred_inf": 0.0, "pred_out": 0.0, "pred_net": 0.0}
            inf_d = float(p["pred_inf"]) / nd
            ouf_d = float(p["pred_out"]) / nd
        bal = bal + inf_d - ouf_d
        balances.append(round(bal, 2))
        daily_infs.append(round(inf_d, 2))
        daily_outs.append(round(ouf_d, 2))
        if bal < warn_line:
            alert_indices.append(i)

    month_buckets: Dict[str, Dict[str, float]] = defaultdict(lambda: {"inflow": 0.0, "outflow": 0.0})
    for i in range(hd):
        d = start + timedelta(days=i + 1)
        ym_b = f"{d.year:04d}-{d.month:02d}"
        month_buckets[ym_b]["inflow"] += float(daily_infs[i])
        month_buckets[ym_b]["outflow"] += float(daily_outs[i])
    monthly_summary: List[Dict[str, Any]] = []
    for ym_b in sorted(month_buckets.keys()):
        inf_m = round(month_buckets[ym_b]["inflow"], 2)
        ouf_m = round(month_buckets[ym_b]["outflow"], 2)
        monthly_summary.append(
            {
                "year_month": ym_b,
                "inflow": inf_m,
                "outflow": ouf_m,
                "net": round(inf_m - ouf_m, 2),
                "is_forecast": ym_b > last_ym,
            }
        )

    key_nodes: List[Dict[str, Any]] = []
    step = max(1, hd // 6)
    for j in range(0, hd, step):
        key_nodes.append(
            {
                "date": labels[j],
                "inflow": daily_infs[j],
                "outflow": daily_outs[j],
                "balance": balances[j],
            }
        )
    if key_nodes and key_nodes[-1]["date"] != labels[-1]:
        key_nodes.append(
            {
                "date": labels[-1],
                "inflow": daily_infs[-1],
                "outflow": daily_outs[-1],
                "balance": balances[-1],
            }
        )

    return {
        "horizon_days": hd,
        "unit": unit,
        "opening_balance": opening,
        "warn_line": round(warn_line, 2),
        "method_note": method_note[:800],
        "growth_used": growth,
        "history_months": len(monthly),
        "last_history_year_month": last_ym,
        "labels": labels,
        "balances": balances,
        "alert_indices": alert_indices[:24],
        "key_nodes": key_nodes,
        "monthly_summary": monthly_summary,
    }


def run_scheme_forecast(
    db: Session,
    scheme,
    CashflowRecord,
    LiquidityForecastMonthly,
) -> Dict[str, Any]:
    monthly = monthly_from_records(db, CashflowRecord, scheme.unit)
    if len(monthly) < 2:
        raise ValueError("历史数据不足：请先在「资金流管理」中录入或同步单据，或导入账户流水。")

    params = {}
    try:
        params = json.loads(scheme.params_json or "{}")
    except Exception:
        pass
    window = int(params.get("rolling_months", 3))
    growth = float(params.get("growth", 1.0))
    method = scheme.model_code or "ROLLING_AVG"

    if scheme.run_mode == "smart" or method == "SMART_GRID":
        growth, smart_note = pick_growth_smart(monthly, scheme.target_mape, window)
        scheme.method_note = smart_note[:500]
    else:
        scheme.method_note = f"手动/统计模型：{method}，rolling={window} 月，growth={growth}"

    hist_inf = [m["inflow"] for m in monthly]
    hist_out = [m["outflow"] for m in monthly]
    last_ym = monthly[-1]["year_month"]
    y, m = int(last_ym[:4]), int(last_ym[5:7])

    def next_month(y0: int, m0: int) -> Tuple[int, int]:
        if m0 == 12:
            return y0 + 1, 1
        return y0, m0 + 1

    # 期初余额近似：历史累计净额（演示用）
    opening = sum(x["net"] for x in monthly)

    # 删除旧结果
    db.query(LiquidityForecastMonthly).filter(
        LiquidityForecastMonthly.scheme_id == scheme.id
    ).delete(synchronize_session=False)

    cy, cm = y, m
    results = []
    hist_inf_run = list(hist_inf)
    hist_out_run = list(hist_out)
    for _ in range(int(scheme.horizon_months or 12)):
        cy, cm = next_month(cy, cm)
        ym = f"{cy:04d}-{cm:02d}"
        pred_inf = _rolling_avg(hist_inf_run, window) * growth
        pred_out = _rolling_avg(hist_out_run, window) * growth
        pred_net = pred_inf - pred_out
        closing = opening + pred_net
        row = LiquidityForecastMonthly(
            scheme_id=scheme.id,
            year_month=ym,
            pred_inflow=pred_inf,
            pred_outflow=pred_out,
            pred_net=pred_net,
            pred_balance_end=closing,
            actual_balance_end=None,
        )
        db.add(row)
        results.append(
            {
                "year_month": ym,
                "pred_inflow": pred_inf,
                "pred_outflow": pred_out,
                "pred_net": pred_net,
                "pred_balance_end": closing,
            }
        )
        opening = closing
        hist_inf_run.append(pred_inf)
        hist_out_run.append(pred_out)

    scheme.status = "completed"
    db.add(scheme)
    db.commit()
    return {
        "scheme_id": scheme.id,
        "method": method,
        "run_mode": scheme.run_mode,
        "growth_used": growth,
        "method_note": scheme.method_note,
        "history_months": len(monthly),
        "rows": results,
    }


def compute_holdout_split(
    monthly: List[Dict[str, Any]],
    params: Dict[str, Any],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, Any]]:
    """
    params.split_mode:
      - index（默认）：按时间序列顺序取前 train_months 为训练、接着 test_months 为检验（36+12）。
      - calendar_years：按日历年排序后，取第 1～3 个日历年内的所有月份为训练、第 4 个日历年的所有月份为检验。
    """
    mode = (params.get("split_mode") or "index").strip().lower()
    if mode not in ("index", "calendar_years"):
        raise ValueError(
            f"不支持的 split_mode「{mode}」，请使用 index（按序截取）或 calendar_years（前 3 日历年 vs 第 4 年）。"
        )

    if mode == "calendar_years":
        if not monthly:
            raise ValueError("无月度历史数据。")
        years = sorted({int(m["year_month"][:4]) for m in monthly})
        if len(years) < 4:
            raise ValueError(
                f"calendar_years 切分需要至少 4 个不同日历年，当前仅有 {len(years)} 个：{years}。"
            )
        y_train_set = set(years[0:3])
        y_test = years[3]
        train = [m for m in monthly if int(m["year_month"][:4]) in y_train_set]
        test_actual = [m for m in monthly if int(m["year_month"][:4]) == y_test]
        if len(train) < 6:
            raise ValueError(
                f"前三个日历年（{years[0]}–{years[2]}）合计仅 {len(train)} 个月，不足以滚动训练（建议 ≥6）。"
            )
        if not test_actual:
            raise ValueError(f"检验年 {y_test} 内无月度汇总数据。")
        extra_years = years[4:]
        meta: Dict[str, Any] = {
            "split_mode": "calendar_years",
            "train_years": [years[0], years[1], years[2]],
            "test_year": y_test,
            "train_month_count": len(train),
            "test_month_count": len(test_actual),
            "extra_years_ignored": extra_years,
        }
        return train, test_actual, meta

    train_n = int(params.get("train_months", 36))
    test_n = int(params.get("test_months", 12))
    need = train_n + test_n
    if len(monthly) < need:
        raise ValueError(
            f"index 切分需要至少 {need} 个月连续汇总数据，当前仅 {len(monthly)} 个月。"
            "可改用 split_mode=calendar_years（需满 4 个日历年），或补足单据日期跨度。"
        )
    train = monthly[:train_n]
    test_actual = monthly[train_n : train_n + test_n]
    meta = {
        "split_mode": "index",
        "train_months": train_n,
        "test_months": test_n,
        "train_month_count": len(train),
        "test_month_count": len(test_actual),
    }
    return train, test_actual, meta


def run_holdout_backtest(
    db: Session,
    scheme,
    CashflowRecord,
    LiquidityForecastMonthly,
) -> Dict[str, Any]:
    """
    样本外预测；切分方式由 params.split_mode 决定（index / calendar_years）。
    每月递归外推时仅将「预测值」接入滚动历史（不偷看检验期真实值）。
    """
    monthly = monthly_from_records(db, CashflowRecord, scheme.unit)
    params: Dict[str, Any] = {}
    try:
        params = json.loads(scheme.params_json or "{}")
    except Exception:
        pass

    train, test_actual, split_meta = compute_holdout_split(monthly, params)

    window = int(params.get("rolling_months", 3))
    growth = float(params.get("growth", 1.0))
    method = scheme.model_code or "ROLLING_AVG"

    if split_meta["split_mode"] == "calendar_years":
        ty0, ty1, ty2 = split_meta["train_years"]
        y_test = split_meta["test_year"]
        ign = split_meta.get("extra_years_ignored") or []
        ign_note = f" 更晚年份已忽略：{ign}。" if ign else ""
        split_desc = (
            f"日历切分：训练 {ty0}–{ty2}（{split_meta['train_month_count']} 月），"
            f"检验 {y_test}（{split_meta['test_month_count']} 月）。{ign_note}"
        )
    else:
        split_desc = (
            f"索引切分：前 {split_meta['train_months']} 月训练、后 {split_meta['test_months']} 月检验。"
        )

    if scheme.run_mode == "smart" or method == "SMART_GRID":
        growth, smart_note = pick_growth_smart(train, scheme.target_mape, window)
        head = f"Hold-out（{split_desc}）{smart_note}"
    else:
        head = (
            f"Hold-out（{split_desc}）模型 {method}，rolling={window}，growth={growth}。"
        )

    hist_inf = [m["inflow"] for m in train]
    hist_out = [m["outflow"] for m in train]
    opening_pred = sum(m["net"] for m in train)
    opening_actual = opening_pred

    db.query(LiquidityForecastMonthly).filter(
        LiquidityForecastMonthly.scheme_id == scheme.id
    ).delete(synchronize_session=False)

    mapes: List[float] = []
    results: List[Dict[str, Any]] = []
    for act in test_actual:
        pred_inf = _rolling_avg(hist_inf, window) * growth
        pred_out = _rolling_avg(hist_out, window) * growth
        pred_net = pred_inf - pred_out
        ainf = float(act["inflow"])
        aout = float(act["outflow"])
        anet = float(act["net"])
        pred_bal = opening_pred + pred_net
        act_bal = opening_actual + anet
        denom = max(abs(anet), 1.0)
        mapes.append(abs(pred_net - anet) / denom)

        row = LiquidityForecastMonthly(
            scheme_id=scheme.id,
            year_month=act["year_month"],
            pred_inflow=pred_inf,
            pred_outflow=pred_out,
            pred_net=pred_net,
            pred_balance_end=pred_bal,
            actual_balance_end=act_bal,
            actual_inflow=ainf,
            actual_outflow=aout,
            actual_net=anet,
        )
        db.add(row)
        results.append(
            {
                "year_month": act["year_month"],
                "pred_inflow": pred_inf,
                "pred_outflow": pred_out,
                "pred_net": pred_net,
                "pred_balance_end": pred_bal,
                "actual_balance_end": act_bal,
                "actual_inflow": ainf,
                "actual_outflow": aout,
                "actual_net": anet,
            }
        )
        opening_pred = pred_bal
        opening_actual = act_bal
        hist_inf.append(pred_inf)
        hist_out.append(pred_out)

    test_mape = sum(mapes) / len(mapes) if mapes else 0.0
    tail = f" 检验期净额 MAPE（逐月）≈{test_mape * 100:.2f}%。"
    scheme.method_note = (head + tail)[:500]
    scheme.status = "completed"
    scheme.horizon_months = len(test_actual)
    db.add(scheme)
    db.commit()
    return {
        "scheme_id": scheme.id,
        "backtest": True,
        "split_mode": split_meta["split_mode"],
        "split_detail": split_meta,
        "method": method,
        "run_mode": scheme.run_mode,
        "growth_used": growth,
        "method_note": scheme.method_note,
        "train_months": len(train),
        "test_months": len(test_actual),
        "history_months": len(monthly),
        "test_mape_net": test_mape,
        "rows": results,
    }


def monthly_subject_flows_from_records(
    db: Session,
    CashflowRecord,
    CashflowSubject,
    year_month: str,
    unit: Optional[str],
    only_confirmed: bool = True,
) -> List[Dict[str, Any]]:
    """
    按自然月 + 单位汇总资金流单据 flows_json 中的 subject_id → 科目名称维度流入/流出。
    unit 为空表示全集团（不按单位过滤）。
    """
    ym = (year_month or "").strip()
    if len(ym) < 7:
        return []
    try:
        y, mo = int(ym[:4]), int(ym[5:7])
    except ValueError:
        return []
    d0 = date(y, mo, 1)
    d1 = date(y, mo, monthrange(y, mo)[1])

    subs = (
        db.query(CashflowSubject)
        .filter(CashflowSubject.is_deleted == False)
        .all()
    )
    id2name = {s.id: (s.name or s.code or str(s.id)) for s in subs}

    q = (
        db.query(CashflowRecord)
        .filter(
            CashflowRecord.is_deleted == False,
            CashflowRecord.trade_date >= d0,
            CashflowRecord.trade_date <= d1,
            CashflowRecord.currency == "CNY",
        )
    )
    if unit:
        q = q.filter(CashflowRecord.unit == unit)
    if only_confirmed:
        q = q.filter(CashflowRecord.status == "已确认")

    agg: Dict[str, Dict[str, float]] = defaultdict(lambda: {"inflow": 0.0, "outflow": 0.0})
    for r in q.all():
        try:
            flows = json.loads(r.flows_json or "[]")
        except Exception:
            flows = []
        if not flows:
            amt = float(r.amount or 0)
            sid = None
            nm = (id2name.get(sid) if sid else None) or "未分类"
            if amt >= 0:
                agg[nm]["inflow"] += amt
            else:
                agg[nm]["outflow"] += abs(amt)
            continue
        for fl in flows:
            try:
                fd = fl.get("flow_date")
                if fd:
                    p = fd.split("-")
                    if len(p) >= 3:
                        fy, fm, fdd = int(p[0]), int(p[1]), int(p[2])
                        fdt = date(fy, fm, fdd)
                        if fdt < d0 or fdt > d1:
                            continue
            except Exception:
                pass
            amt = float(fl.get("amount", 0) or 0)
            sid = fl.get("subject_id")
            try:
                sid_i = int(sid) if sid is not None else None
            except (TypeError, ValueError):
                sid_i = None
            nm = (id2name.get(sid_i) if sid_i is not None else None) or "未分类"
            if amt >= 0:
                agg[nm]["inflow"] += amt
            else:
                agg[nm]["outflow"] += abs(amt)

    rows: List[Dict[str, Any]] = []
    for name, v in agg.items():
        inf = round(v["inflow"], 2)
        ouf = round(v["outflow"], 2)
        rows.append(
            {
                "subject_name": name,
                "inflow": inf,
                "outflow": ouf,
                "net": round(inf - ouf, 2),
            }
        )
    rows.sort(key=lambda r: -abs(r["net"]))
    return rows


def monthly_forecast_subject_split(
    db: Session,
    CashflowRecord,
    CashflowSubject,
    unit: Optional[str],
    pred_inflow: float,
    pred_outflow: float,
    only_confirmed: bool = True,
) -> List[Dict[str, Any]]:
    """
    预测月：无明细时，按最近历史月的科目结构比例分摊到预测流入/流出。
    """
    monthly = monthly_from_records(db, CashflowRecord, unit, ["已确认"] if only_confirmed else None)
    if len(monthly) < 1:
        return []
    last_ym = monthly[-1]["year_month"]
    base = monthly_subject_flows_from_records(
        db, CashflowRecord, CashflowSubject, last_ym, unit, only_confirmed
    )
    if not base:
        return [
            {
                "subject_name": "预计流入（汇总）",
                "inflow": round(float(pred_inflow), 2),
                "outflow": 0.0,
                "net": round(float(pred_inflow), 2),
                "split_note": "无历史科目结构，仅展示汇总",
            },
            {
                "subject_name": "预计流出（汇总）",
                "inflow": 0.0,
                "outflow": round(float(pred_outflow), 2),
                "net": round(-float(pred_outflow), 2),
                "split_note": "无历史科目结构，仅展示汇总",
            },
        ]

    ti = sum(r["inflow"] for r in base)
    to = sum(r["outflow"] for r in base)
    pi = float(pred_inflow or 0)
    po = float(pred_outflow or 0)
    nbase = len(base)
    out: List[Dict[str, Any]] = []
    for r in base:
        si = float(r["inflow"])
        so = float(r["outflow"])
        if ti > 0:
            ni = round(pi * (si / ti), 2)
        elif nbase > 0:
            ni = round(pi / nbase, 2)
        else:
            ni = 0.0
        if to > 0:
            no = round(po * (so / to), 2)
        elif nbase > 0:
            no = round(po / nbase, 2)
        else:
            no = 0.0
        out.append(
            {
                "subject_name": r["subject_name"],
                "inflow": ni,
                "outflow": no,
                "net": round(ni - no, 2),
                "split_note": f"按 {last_ym} 科目结构比例分摊",
            }
        )
    out.sort(key=lambda r: -abs(r["net"]))
    return out


def resolve_month_subject_detail(
    db: Session,
    CashflowRecord,
    CashflowSubject,
    year_month: str,
    unit: Optional[str],
    only_confirmed: bool = True,
    forecast_inflow: Optional[float] = None,
    forecast_outflow: Optional[float] = None,
) -> Dict[str, Any]:
    """真实明细优先；预测月且库无流水时，用比例分摊。"""
    rows = monthly_subject_flows_from_records(
        db, CashflowRecord, CashflowSubject, year_month, unit, only_confirmed
    )
    if rows:
        return {"detail_source": "records", "items": rows}

    if forecast_inflow is not None and forecast_outflow is not None:
        fc = monthly_forecast_subject_split(
            db,
            CashflowRecord,
            CashflowSubject,
            unit,
            forecast_inflow,
            forecast_outflow,
            only_confirmed,
        )
        return {"detail_source": "forecast_proportional", "items": fc}

    return {"detail_source": "empty", "items": []}
