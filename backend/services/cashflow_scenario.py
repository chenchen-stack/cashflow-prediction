"""
现金流情景压力测试：在 ML/统计基线日净额预测上叠加业务假设，输出基准 vs 情景的累计头寸与可解释说明。
对齐 PRD 3.2.3：充值下滑、集中付款、新业务投入、骑手批量结算、回款延迟、汇率压力（简化口径）。
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from services.ml_timeseries import combined_forecast


def _parse_date(s: str) -> date:
    return datetime.strptime(s[:10], "%Y-%m-%d").date()


def _future_dates(last_hist: str, horizon: int) -> List[str]:
    d0 = _parse_date(last_hist)
    return [(d0 + timedelta(days=i + 1)).isoformat() for i in range(horizon)]


def _avg_positive(values: List[float], tail: int = 30) -> float:
    sl = values[-tail:] if len(values) > tail else values
    pos = [float(x) for x in sl if float(x) > 0]
    if not pos:
        return max(abs(float(values[-1])) if values else 0.0, 1.0)
    return float(sum(pos) / len(pos))


def _avg_negative_magnitude(values: List[float], tail: int = 30) -> float:
    sl = values[-tail:] if len(values) > tail else values
    neg = [abs(float(x)) for x in sl if float(x) < 0]
    if not neg:
        return max(abs(float(values[-1])) if values else 0.0, 1.0)
    return float(sum(neg) / len(neg))


def _blend_forecast(forecast_bundle: Dict[str, Any]) -> Tuple[List[float], Dict[str, Any]]:
    """合并 Prophet / LSTM 点预测为单一基线序列（长度取 horizon）"""
    meta: Dict[str, Any] = {"sources": []}
    ys: List[List[float]] = []
    if forecast_bundle.get("prophet") and forecast_bundle["prophet"].get("yhat"):
        ys.append(forecast_bundle["prophet"]["yhat"])
        meta["sources"].append("prophet")
    if forecast_bundle.get("lstm") and forecast_bundle["lstm"].get("yhat"):
        ys.append(forecast_bundle["lstm"]["yhat"])
        meta["sources"].append("lstm")
    if not ys:
        return [], meta
    h = min(len(y) for y in ys)
    blended = []
    for i in range(h):
        blended.append(float(sum(y[i] for y in ys) / len(ys)))
    meta["horizon_used"] = h
    return blended, meta


def apply_scenario_to_future_net(
    base_future: List[float],
    hist_values: List[float],
    params: Dict[str, Any],
) -> Tuple[List[float], List[str]]:
    """
    仅对未来 horizon 段的日净额做调整；返回 (调整后序列, 人类可读假设列表)。
    params 键均为可选：
      recharge_decline_pct — 正向日净额乘 (1-p/100)
      supplier_surge_pct — 在未来前 supplier_surge_spread_days 天内每日增加流出 = 日均流出规模 * p/100
      supplier_lump_outflow — 单笔额外流出，在 lump_outflow_offset 天（0-based）执行
      new_business_capex — 新业务一次性流出，在 capex_offset 天
      rider_payroll_daily_extra — 连续 rider_payroll_days 天每日额外流出
      collection_delay_days — 回款延迟：前 N 天减少净流入 proxy，后在窗口末回补
      fx_stress_pct — 对 |日净额| 施加额外波动压力（简化跨境口径）
    """
    v = [float(x) for x in base_future]
    notes: List[str] = []

    rd = float(params.get("recharge_decline_pct") or 0)
    if rd > 0:
        for i in range(len(v)):
            if v[i] > 0:
                v[i] *= 1.0 - rd / 100.0
        notes.append(f"用户充值/经营现金流入承压：正向日净额下调 {rd:.1f}%")

    surge = float(params.get("supplier_surge_pct") or 0)
    spread = int(params.get("supplier_surge_spread_days") or 5)
    if surge > 0 and spread > 0:
        mag = _avg_negative_magnitude(hist_values)
        daily = mag * surge / 100.0
        for i in range(min(spread, len(v))):
            v[i] -= daily
        notes.append(f"供应商集中付款：前 {spread} 天每日额外流出约 {daily:,.0f}（按近端日均流出×{surge:.0f}%）")

    lump = float(params.get("supplier_lump_outflow") or 0)
    loff = int(params.get("lump_outflow_offset") or 0)
    if lump > 0:
        if 0 <= loff < len(v):
            v[loff] -= lump
        notes.append(f"指定日集中付款：第 {loff + 1} 天额外流出 {lump:,.0f}")

    capex = float(params.get("new_business_capex") or 0)
    c_off = int(params.get("capex_offset") or 0)
    if capex > 0:
        if 0 <= c_off < len(v):
            v[c_off] -= capex
        notes.append(f"新业务/扩张资本性支出：第 {c_off + 1} 天流出 {capex:,.0f}")

    rider = float(params.get("rider_payroll_daily_extra") or 0)
    rdays = int(params.get("rider_payroll_days") or 0)
    if rider > 0 and rdays > 0:
        for i in range(min(rdays, len(v))):
            v[i] -= rider
        notes.append(f"骑手薪酬批量结算：连续 {rdays} 天每日额外流出 {rider:,.0f}")

    delay = int(params.get("collection_delay_days") or 0)
    if delay > 0:
        proxy = _avg_positive(hist_values) * 0.25
        span = min(delay, len(v))
        for i in range(span):
            v[i] -= proxy
        back_start = min(delay * 2, len(v))
        back_span = min(delay, len(v) - back_start) if back_start < len(v) else 0
        for j in range(back_span):
            v[back_start + j] += proxy
        notes.append(
            f"回款延迟 {delay} 天：近端净流入减少约 {proxy:,.0f}/天，后续窗口部分回补（简化代理模型）"
        )

    fx = float(params.get("fx_stress_pct") or 0)
    if fx > 0:
        for i in range(len(v)):
            adj = abs(v[i]) * (fx / 100.0)
            v[i] -= adj if v[i] >= 0 else -adj
        notes.append(f"汇率不利情景（简化）：按日净额绝对值的 {fx:.1f}% 施加额外流出压力")

    return v, notes


def _cumulative(opening: float, hist: List[float], fut: List[float]) -> List[float]:
    out: List[float] = []
    x = float(opening)
    for val in hist + fut:
        x += float(val)
        out.append(x)
    return out


def build_snapshot_parts(
    dates: List[str],
    hist_values: List[float],
    horizon: int,
    methods: List[str],
) -> Tuple[Dict[str, Any], List[float], List[str], str]:
    """返回 (combined_forecast, blended_yhat, future_dates, last_hist_date)"""
    if not dates:
        raise ValueError("empty dates")
    fc = combined_forecast(dates, hist_values, horizon, methods)
    blended, _ = _blend_forecast(fc)
    last = dates[-1]
    fds = _future_dates(last, len(blended))
    return fc, blended, fds, last


def run_scenario(
    dates: List[str],
    hist_values: List[float],
    horizon: int = 30,
    opening_balance: float = 0.0,
    params: Optional[Dict[str, Any]] = None,
    methods: Optional[List[str]] = None,
) -> Dict[str, Any]:
    params = params or {}
    methods = methods or ["prophet", "lstm"]
    if not dates or not hist_values:
        return {"error": "empty_series", "message": "历史日净额为空，无法情景测算"}

    last_date = dates[-1]
    fc = combined_forecast(dates, hist_values, horizon, methods)
    base_future, blend_meta = _blend_forecast(fc)
    if not base_future:
        return {"error": "no_forecast", "forecast": fc, "message": "无法生成基线预测"}

    fut_dates = _future_dates(last_date, len(base_future))
    scen_future, notes = apply_scenario_to_future_net(base_future, hist_values, params)

    hist_cum = _cumulative(opening_balance, hist_values, [])
    base_cum_full = _cumulative(opening_balance, hist_values, base_future)
    scen_cum_full = _cumulative(opening_balance, hist_values, scen_future)

    def _min_val(arr: List[float]) -> float:
        return float(min(arr)) if arr else float(opening_balance)

    def _first_neg_idx(cum_hist_fut: List[float], hist_len: int) -> Optional[int]:
        """返回相对未来段第一天起算的索引（0=预测第1天末余额），若未出现负值则 None"""
        for i in range(hist_len, len(cum_hist_fut)):
            if cum_hist_fut[i] < 0:
                return i - hist_len
        return None

    hl = len(hist_values)
    metrics = {
        "baseline_min_balance": _min_val(base_cum_full),
        "scenario_min_balance": _min_val(scen_cum_full),
        "delta_min": _min_val(scen_cum_full) - _min_val(base_cum_full),
        "first_negative_future_day_baseline": _first_neg_idx(base_cum_full, hl),
        "first_negative_future_day_scenario": _first_neg_idx(scen_cum_full, hl),
    }

    timeline_dates = dates + fut_dates
    return {
        "opening_balance": opening_balance,
        "horizon": len(base_future),
        "historical": {
            "dates": dates,
            "net_daily": hist_values,
            "cumulative_end": hist_cum[-1] if hist_cum else opening_balance,
        },
        "baseline": {
            "dates": fut_dates,
            "net_daily": base_future,
            "cumulative_path": base_cum_full,
            "forecast_blend": blend_meta,
            "raw_forecast": fc,
        },
        "scenario": {
            "dates": fut_dates,
            "net_daily": scen_future,
            "cumulative_path": scen_cum_full,
        },
        "timeline": {
            "dates": timeline_dates,
            "baseline_cumulative_tail": base_cum_full[-len(fut_dates) :] if fut_dates else [],
            "scenario_cumulative_tail": scen_cum_full[-len(fut_dates) :] if fut_dates else [],
        },
        "metrics": metrics,
        "assumptions": notes,
        "params_echo": params,
    }
