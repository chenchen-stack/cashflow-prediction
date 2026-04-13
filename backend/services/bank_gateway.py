"""
银企直联模拟网关：批量受理、签名摘要、异步状态查询。
生产环境可替换为真实 SDK（工行/建行/招行等）实现同一接口。
"""
from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

MOCK_BANK_VERSION = "MOCK-BANK-GW/1.0"


def _sign(payload: dict) -> str:
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


def submit_payments(
    items: List[Dict[str, Any]],
    payer_account: str = "6222000000000001",
    bank_code: str = "MOCK-ICBC",
) -> Dict[str, Any]:
    """
    items: [{ pool_item_id, payee_name, payee_account, amount, currency }]
    """
    batch_id = datetime.now().strftime("%Y%m%d%H%M%S") + "-" + uuid.uuid4().hex[:6]
    orders = []
    for it in items:
        oid = uuid.uuid4().hex[:12].upper()
        order = {
            "order_id": oid,
            "batch_id": batch_id,
            "pool_item_id": it.get("pool_item_id"),
            "bank_code": bank_code,
            "payer_account": payer_account,
            "payee_name": it.get("payee_name", ""),
            "payee_account": it.get("payee_account", ""),
            "amount": float(it.get("amount", 0)),
            "currency": it.get("currency", "CNY"),
            "status": "success",
            "bank_ref": f"BK{uuid.uuid4().hex[:16].upper()}",
            "signed_at": datetime.now().isoformat(),
        }
        order["signature"] = _sign({k: order[k] for k in order if k != "signature"})
        orders.append(order)
    return {
        "gateway": MOCK_BANK_VERSION,
        "batch_id": batch_id,
        "accepted": len(orders),
        "failed": 0,
        "orders": orders,
        "note": "模拟网关：无真实扣款；bank_ref 可用于对账追溯",
    }


def query_status(order_id: str, bank_ref: Optional[str] = None) -> Dict[str, Any]:
    return {
        "order_id": order_id,
        "bank_ref": bank_ref or "",
        "status": "success",
        "message": "模拟：交易成功",
        "queried_at": datetime.now().isoformat(),
    }
