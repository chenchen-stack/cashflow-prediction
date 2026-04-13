"""
时序预测：优先 Prophet / LSTM(Keras)；不可用时回退到统计基线 + sklearn MLP（滞后特征）。
所有返回含 meta.backend 便于前端展示「可解释、可追溯」。
"""
from __future__ import annotations

import math
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import numpy as np


def _safe_series(dates: List[str], values: List[float]) -> Tuple[np.ndarray, List[str]]:
    if not dates or not values:
        return np.array([]), []
    n = min(len(dates), len(values))
    y = np.array(values[:n], dtype=float)
    ds = dates[:n]
    return y, ds


def _linear_extrapolate(y: np.ndarray, horizon: int) -> List[float]:
    if len(y) < 2:
        return [float(y[-1]) if len(y) else 0.0] * horizon
    x = np.arange(len(y))
    coef = np.polyfit(x, y, 1)
    poly = np.poly1d(coef)
    out = []
    for h in range(1, horizon + 1):
        out.append(float(poly(len(y) - 1 + h)))
    return out


def forecast_prophet(dates: List[str], values: List[float], horizon: int = 14) -> Dict[str, Any]:
    y, ds = _safe_series(dates, values)
    if len(y) < 3:
        pred = _linear_extrapolate(y if len(y) else np.array([0.0]), horizon)
        return {
            "method": "prophet",
            "yhat": pred,
            "yhat_lower": pred,
            "yhat_upper": pred,
            "meta": {"backend": "linear_fallback", "reason": "insufficient_points"},
        }
    try:
        import pandas as pd
        from prophet import Prophet  # type: ignore

        df = pd.DataFrame({"ds": pd.to_datetime(ds), "y": y})
        m = Prophet(daily_seasonality=False, weekly_seasonality=True, yearly_seasonality=False)
        m.fit(df)
        future = m.make_future_dataframe(periods=horizon)
        fcst = m.predict(future).tail(horizon)
        return {
            "method": "prophet",
            "yhat": [float(v) for v in fcst["yhat"].values],
            "yhat_lower": [float(v) for v in fcst["yhat_lower"].values],
            "yhat_upper": [float(v) for v in fcst["yhat_upper"].values],
            "meta": {"backend": "prophet", "library": "prophet"},
        }
    except Exception as e:
        pred = _stat_fallback(y, horizon)
        return {
            "method": "prophet",
            "yhat": pred["yhat"],
            "yhat_lower": pred["yhat_lower"],
            "yhat_upper": pred["yhat_upper"],
            "meta": {"backend": "stats_fallback", "reason": str(e)[:200]},
        }


def _stat_fallback(y: np.ndarray, horizon: int) -> Dict[str, List[float]]:
    """滚动均值 + 残差标准差作为置信带"""
    win = min(7, len(y))
    base = float(np.mean(y[-win:]))
    vol = float(np.std(y[-win:])) if len(y) > 1 else abs(base) * 0.05 or 1.0
    out = []
    for h in range(1, horizon + 1):
        decay = 0.98 ** h
        out.append(base * decay)
    band = max(vol * 1.96, abs(base) * 0.02)
    return {
        "yhat": out,
        "yhat_lower": [v - band for v in out],
        "yhat_upper": [v + band for v in out],
    }


def forecast_lstm(dates: List[str], values: List[float], horizon: int = 14) -> Dict[str, Any]:
    y, _ = _safe_series(dates, values)
    if len(y) < 8:
        pred = _stat_fallback(y if len(y) else np.array([0.0]), horizon)
        return {
            "method": "lstm",
            "yhat": pred["yhat"],
            "yhat_lower": pred["yhat_lower"],
            "yhat_upper": pred["yhat_upper"],
            "meta": {"backend": "stats_fallback", "reason": "insufficient_points_for_nn"},
        }

    # 1) 尝试 Keras LSTM
    try:
        import numpy as np
        import tensorflow as tf  # type: ignore
        from tensorflow import keras  # type: ignore

        tf.random.set_seed(42)
        lookback = min(10, len(y) - 1)
        X, Y = [], []
        for i in range(lookback, len(y)):
            X.append(y[i - lookback : i])
            Y.append(y[i])
        X = np.array(X).reshape(-1, lookback, 1)
        Y = np.array(Y)
        model = keras.Sequential(
            [
                keras.layers.Input(shape=(lookback, 1)),
                keras.layers.LSTM(16, return_sequences=False),
                keras.layers.Dense(1),
            ]
        )
        model.compile(optimizer="adam", loss="mse")
        model.fit(X, Y, epochs=40, verbose=0, batch_size=max(2, len(X) // 2))
        seq = y[-lookback:].copy()
        preds = []
        for _ in range(horizon):
            x = seq[-lookback:].reshape(1, lookback, 1)
            p = float(model.predict(x, verbose=0)[0, 0])
            preds.append(p)
            seq = np.append(seq, p)
        vol = float(np.std(y)) * 0.15
        return {
            "method": "lstm",
            "yhat": preds,
            "yhat_lower": [p - 1.96 * vol for p in preds],
            "yhat_upper": [p + 1.96 * vol for p in preds],
            "meta": {"backend": "keras_lstm", "lookback": lookback},
        }
    except Exception as e_k:
        pass

    # 2) sklearn MLP 滞后特征（文档称 LSTM-lite）
    try:
        from sklearn.neural_network import MLPRegressor

        lookback = min(7, len(y) - 2)
        if lookback < 2:
            raise ValueError("short")
        X, Y = [], []
        for i in range(lookback, len(y)):
            X.append(y[i - lookback : i])
            Y.append(y[i])
        mlp = MLPRegressor(hidden_layer_sizes=(32, 16), max_iter=500, random_state=42)
        mlp.fit(X, Y)
        seq = list(y[-lookback:])
        preds = []
        for _ in range(horizon):
            p = float(mlp.predict(np.array([seq]))[0])
            preds.append(p)
            seq = seq[1:] + [p]
        vol = float(np.std(y)) * 0.12
        return {
            "method": "lstm",
            "yhat": preds,
            "yhat_lower": [p - 1.96 * vol for p in preds],
            "yhat_upper": [p + 1.96 * vol for p in preds],
            "meta": {"backend": "sklearn_mlp_lag", "lookback": lookback, "note": "Keras 不可用时使用 MLP+滞后特征近似序列"},
        }
    except Exception as e_m:
        pred = _stat_fallback(y, horizon)
        return {
            "method": "lstm",
            "yhat": pred["yhat"],
            "yhat_lower": pred["yhat_lower"],
            "yhat_upper": pred["yhat_upper"],
            "meta": {"backend": "stats_fallback", "reason": str(e_m)[:200]},
        }


def build_daily_net_from_records(records: List[Any]) -> Tuple[List[str], List[float]]:
    """从 CashflowRecord ORM 行列表聚合日净额（CNY）"""
    from collections import defaultdict

    daily: Dict[str, float] = defaultdict(float)
    for r in records:
        amt = float(getattr(r, "amount_cny", None) or r.amount or 0)
        d = getattr(r, "trade_date", None) or date.today()
        if hasattr(d, "isoformat"):
            key = d.isoformat()[:10]
        else:
            key = str(d)[:10]
        daily[key] += amt
    keys = sorted(daily.keys())
    vals = [daily[k] for k in keys]
    return keys, vals


def combined_forecast(
    dates: List[str],
    values: List[float],
    horizon: int = 14,
    methods: Optional[List[str]] = None,
) -> Dict[str, Any]:
    methods = methods or ["prophet", "lstm"]
    out: Dict[str, Any] = {"horizon": horizon, "history_points": len(values)}
    if "prophet" in methods:
        out["prophet"] = forecast_prophet(dates, values, horizon)
    if "lstm" in methods:
        out["lstm"] = forecast_lstm(dates, values, horizon)
    return out
