"""
亿流 Work · 工作台 API（位于 backend/workbench/，与主服务共用 agent 与业务库）
启动：在 backend 目录下执行  python -m workbench  或  uvicorn workbench.app:app --port 8010
"""
from __future__ import annotations

import os
import time
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.middleware.base import BaseHTTPMiddleware

from workbench.database_wb import init_wb_db, new_session, get_session_by_public_id, append_message, list_messages

_BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

app = FastAPI(
    title="亿流 Work · 工作台 API",
    version="1.0.0",
    description="Accio 风格协作层：智能体对话、会话审计、能力发现（代码统一在 backend/workbench/）",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ProcessTimeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        t0 = time.perf_counter()
        response = await call_next(request)
        response.headers["X-Process-Time-Ms"] = str(int((time.perf_counter() - t0) * 1000))
        return response


app.add_middleware(ProcessTimeMiddleware)


class ChatIn(BaseModel):
    message: str
    role: str = "treasurer"
    history: List[dict] = Field(default_factory=list)
    session_id: Optional[str] = None
    agent_mode: Optional[str] = None


@app.on_event("startup")
def _startup():
    init_wb_db()


@app.get("/api/workbench/health")
def health():
    return {
        "service": "workbench",
        "ok": True,
        "backend_root": _BACKEND_ROOT,
        "note": "对话引擎：backend/agent_langchain.py（LangChain Harness）+ agent_core.py 工具；业务库：backend/cashflow_agent.db；会话库：backend/workbench/workbench.db",
    }


@app.get("/api/workbench/capabilities")
def capabilities():
    return {
        "product": "亿流 Work",
        "workbench": "资金预测 · Accio 工作台",
        "dataagent_capabilities": [
            {"id": 1, "name": "资金头寸", "tools": ["query_position", "dashboard_summary"]},
            {"id": 2, "name": "资金预测", "tools": ["run_forecast"]},
            {"id": 3, "name": "外汇敞口", "tools": ["query_fx_exposure"]},
            {"id": 4, "name": "异常资金流", "tools": ["detect_anomalies"]},
            {"id": 5, "name": "资金计划", "tools": ["query_plans"]},
            {"id": 6, "name": "决策建议", "tools": ["suggest_liquidity_decision"]},
            {"id": 7, "name": "预警汇总", "tools": ["collect_exception_alerts"]},
        ],
        "tabs": [
            {"id": "chat", "name": "对话", "primary": True},
            {"id": "agents", "name": "智能体"},
            {"id": "tasks", "name": "定时任务"},
            {"id": "apps", "name": "应用"},
            {"id": "skills", "name": "技能"},
            {"id": "channels", "name": "渠道"},
            {"id": "pairing", "name": "配对"},
        ],
        "agents": [
            {"id": "data", "name": "DataAgent · 数据智能体", "default": True},
            {"id": "prd", "name": "资金预测 · 口径助手"},
            {"id": "plan", "name": "计划与偏差复盘"},
        ],
        "chat_path": "/api/workbench/chat",
        "engine": "DeepSeek + function tools（与主服务 agent 一致）",
    }


@app.get("/api/workbench/sessions/{session_id}/messages")
def session_messages(session_id: str, limit: int = 100):
    rows = list_messages(session_id, limit=limit)
    if not rows and not get_session_by_public_id(session_id):
        raise HTTPException(404, "会话不存在")
    return {"session_id": session_id, "messages": rows}


@app.post("/api/workbench/chat")
async def workbench_chat(body: ChatIn):
    from agent import run_agent

    msg = (body.message or "").strip()
    if not msg:
        raise HTTPException(400, "message 不能为空")

    sess = None
    sid = (body.session_id or "").strip()
    if sid:
        sess = get_session_by_public_id(sid)
        if not sess:
            raise HTTPException(404, "session_id 无效")
    else:
        sess = new_session(body.role, body.agent_mode or "data")

    append_message(sess.id, "user", msg)

    mode_note = ""
    if body.agent_mode == "prd":
        mode_note = "\n【当前模式】口径/PRD 问答优先，少改数。\n"
    elif body.agent_mode == "plan":
        mode_note = "\n【当前模式】资金计划与偏差复盘优先。\n"

    augmented = mode_note + msg
    out = await run_agent(augmented, body.role, body.history or [])
    if isinstance(out, dict):
        reply_text = out.get("reply") or ""
        trace = out.get("trace") or []
    else:
        reply_text = str(out)
        trace = []

    append_message(sess.id, "assistant", reply_text)

    return {
        "reply": reply_text,
        "trace": trace,
        "session_id": sess.public_id,
        "agent_mode": body.agent_mode or sess.agent_mode,
    }
