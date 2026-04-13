"""
轻量 NFR 自检：对关键 API 串行请求并打印耗时（需先启动 main.py）。
不替代 k6/Lighthouse，仅作开发机基线采样。
用法: python scripts/nfr_smoke.py
"""
from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8000"
PATHS = [
    "/api/dashboard/stats",
    "/api/records?page_size=50",
    "/api/analysis/reports",
    "/api/metrics/summary",
]


def main() -> int:
    print("NFR smoke @", BASE)
    for p in PATHS:
        url = BASE + p
        t0 = time.perf_counter()
        try:
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = resp.read()
                ms_hdr = resp.headers.get("X-Process-Time-Ms", "-")
            elapsed = (time.perf_counter() - t0) * 1000
            print(f"  OK {p}  client={elapsed:.0f}ms  X-Process-Time-Ms={ms_hdr}  bytes={len(body)}")
        except urllib.error.URLError as e:
            print(f"  FAIL {p}  {e}", file=sys.stderr)
            return 1
    print("提示: 并发/500 用户/P95 需按 PRD 使用 k6 + APM 验收。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
