"""
LangChain Harness：DeepSeek ChatOpenAI + 多轮工具调用（与 agent_core.TOOLS / TOOL_DISPATCH 对齐）。
若未安装 langchain-openai，回退到 OpenAI 兼容 SDK 直连（与旧版行为一致）。

环境变量：
- CF_USE_LANGCHAIN=0 — 强制使用 OpenAI SDK 循环（不走 LangChain）
- 未设置或=1 — 且已安装 langchain-openai 时优先 LangChain
- CF_AGENT_MAX_TOOL_ROUNDS — 单次请求内「模型推理 ↔ 工具执行」最大循环次数（默认 5）。
  正整数：上限 1～1_000_000；**0 / -1 / unlimited / inf** 表示**不限制轮次**（内部按 100 万轮封顶，正常会在终答前结束）。
  每轮若模型仍发起 tool_calls 则计为一轮；达上限仍未输出纯文字终答则返回「处理轮次已达上限」。
  无上限会显著增加延迟与 API 费用，仅建议在深度读代码、长链排查时开启。
"""

from __future__ import annotations

import json
import os
import time
from typing import Any, Dict, List, Optional

from agent_core import SYSTEM_PROMPT, TOOL_DISPATCH, TOOLS, _fallback


def _ts() -> str:
    return time.strftime("%H:%M:%S", time.localtime())


def _preview(s: Any, n: int = 480) -> str:
    t = s if isinstance(s, str) else json.dumps(s, ensure_ascii=False)
    t = t.replace("\r\n", "\n")
    return (t[:n] + "…") if len(t) > n else t


# 「无上限」时内部使用的足够大上限（避免真无限循环拖死进程）；一般请求远不会触达。
_EFFECTIVE_UNLIMITED_ROUNDS = 1_000_000


def _max_tool_rounds() -> int:
    """
    CF_AGENT_MAX_TOOL_ROUNDS：
    - 默认 5
    - 正整数：1～1_000_000
    - 0、-1、或 unlimited/inf/infinity（大小写不敏感）：工程意义上的无上限（内部 _EFFECTIVE_UNLIMITED_ROUNDS）
    """
    raw = (os.getenv("CF_AGENT_MAX_TOOL_ROUNDS") or "5").strip()
    low = raw.lower()
    if low in ("0", "-1", "unlimited", "inf", "infinity"):
        return _EFFECTIVE_UNLIMITED_ROUNDS
    try:
        n = int(raw)
    except ValueError:
        return 5
    if n < 0:
        return _EFFECTIVE_UNLIMITED_ROUNDS
    return max(1, min(n, _EFFECTIVE_UNLIMITED_ROUNDS))


def _is_unlimited_round_mode(max_rounds: int) -> bool:
    return max_rounds >= _EFFECTIVE_UNLIMITED_ROUNDS


def _llm_trace_title(round_i: int, max_rounds: int, suffix: str) -> str:
    if _is_unlimited_round_mode(max_rounds):
        return f"第 {round_i + 1} 轮 · {suffix}"
    return f"第 {round_i + 1}/{max_rounds} 轮 · {suffix}"


def _result_dict(reply: str, trace: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {"reply": reply, "trace": trace}


def _resolve_system_content(role: str, system_prompt: Optional[str]) -> str:
    """
    必须始终保留 agent_core.SYSTEM_PROMPT（含 Function Calling / LangChain 工具约束）。
    前端传入的 system_prompt 仅作为「浏览器侧实时上下文」附录，不得覆盖基座提示词。
    """
    base = SYSTEM_PROMPT + f"\n\n## 会话角色\n当前用户角色 id: **{role}**\n"
    extra = (system_prompt or "").strip()
    if extra:
        return (
            base
            + "\n\n---\n## 前端注入上下文（浏览器缓存，可能与数据库有秒级延迟；**与工具返回不一致时以工具为准**）\n"
            + extra
        )
    return base


def _lc_available() -> bool:
    try:
        import langchain_openai  # noqa: F401
        import langchain_core.messages  # noqa: F401
        return True
    except ImportError:
        return False


async def _run_agent_openai_sdk(
    user_message: str,
    role: str = "treasurer",
    history: Optional[List[dict]] = None,
    api_key_override: Optional[str] = None,
    system_prompt: Optional[str] = None,
) -> Dict[str, Any]:
    from openai import AsyncOpenAI

    trace: List[Dict[str, Any]] = [
        {
            "phase": "start",
            "title": "任务入队",
            "detail": user_message[:500],
            "ts": _ts(),
        }
    ]
    key = (api_key_override or os.getenv("DEEPSEEK_API_KEY", "") or "").strip()
    base = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
    if not key:
        trace.append(
            {
                "phase": "offline",
                "title": "无 API Key · 本地工具链",
                "detail": "未配置 DEEPSEEK_API_KEY，使用规则匹配 + 数据库只读工具。",
                "ts": _ts(),
            }
        )
        return _result_dict(_fallback(user_message), trace)

    use_lc = os.getenv("CF_USE_LANGCHAIN", "1").strip().lower() in ("1", "true", "yes")
    harness = "OpenAI SDK（Function Calling）"
    if use_lc:
        harness += " · LangChain 未启用或不可用时的回退"
    trace.append(
        {
            "phase": "config",
            "title": "执行引擎",
            "detail": harness,
            "ts": _ts(),
        }
    )

    client = AsyncOpenAI(api_key=key, base_url=base)
    messages: List[Dict[str, Any]] = [
        {"role": "system", "content": _resolve_system_content(role, system_prompt)}
    ]
    for h in (history or [])[-12:]:
        r, c = h.get("role"), h.get("content")
        if r in ("user", "assistant") and c and isinstance(c, str):
            messages.append({"role": r, "content": c})
    messages.append({"role": "user", "content": user_message})

    max_rounds = _max_tool_rounds()
    for round_i in range(max_rounds):
        trace.append(
            {
                "phase": "llm",
                "title": _llm_trace_title(round_i, max_rounds, "模型推理"),
                "detail": "DeepSeek deepseek-chat + tools=auto"
                + (" · 无上限模式" if _is_unlimited_round_mode(max_rounds) else ""),
                "ts": _ts(),
            }
        )
        try:
            resp = await client.chat.completions.create(
                model="deepseek-chat",
                messages=messages,
                tools=TOOLS,
                tool_choice="auto",
                temperature=0.3,
                max_tokens=2048,
            )
        except Exception as e:
            trace.append(
                {
                    "phase": "error",
                    "title": "模型调用失败",
                    "detail": str(e),
                    "ts": _ts(),
                }
            )
            return _result_dict(f"AI 服务暂不可用: {str(e)}", trace)

        choice = resp.choices[0]
        msg = choice.message
        plan = (getattr(msg, "content", None) or "").strip()
        if plan:
            trace.append(
                {
                    "phase": "reasoning",
                    "title": "模型输出（含工具计划前说明）",
                    "detail": plan[:1200],
                    "ts": _ts(),
                }
            )

        if choice.finish_reason == "tool_calls" or (
            msg.tool_calls and len(msg.tool_calls) > 0
        ):
            messages.append(msg)
            for tc in msg.tool_calls:
                fn_name = tc.function.name
                try:
                    fn_args = json.loads(tc.function.arguments or "{}")
                except Exception:
                    fn_args = {}
                handler = TOOL_DISPATCH.get(fn_name)
                result = (
                    handler(fn_args)
                    if handler
                    else json.dumps({"error": f"未知工具: {fn_name}"}, ensure_ascii=False)
                )
                trace.append(
                    {
                        "phase": "tool",
                        "title": f"工具 · {fn_name}",
                        "args": fn_args,
                        "result_preview": _preview(result, 520),
                        "ts": _ts(),
                    }
                )
                messages.append({"role": "tool", "tool_call_id": tc.id, "content": result})
            continue

        trace.append(
            {
                "phase": "done",
                "title": "生成最终回复",
                "detail": "本轮无进一步工具调用",
                "ts": _ts(),
            }
        )
        return _result_dict(msg.content or "（无回复）", trace)

    trace.append(
        {
            "phase": "limit",
            "title": "达到最大工具轮次",
            "detail": (
                "已达到单次请求允许的最大工具轮次（无上限模式下的工程安全顶）。请简化问题、拆步提问，或检查是否陷入重复工具调用。"
                if _is_unlimited_round_mode(max_rounds)
                else f"本轮上限为 {max_rounds} 轮（环境变量 CF_AGENT_MAX_TOOL_ROUNDS）。已停止，请简化问题或拆步提问。"
            ),
            "ts": _ts(),
        }
    )
    if _is_unlimited_round_mode(max_rounds):
        reply = (
            "分析完成，但工具链轮次已达单次请求的工程安全上限（无上限模式仍设有防失控顶）。"
            "若任务合理却反复触顶，请拆成多轮对话或检查模型是否重复调用工具。"
        )
    else:
        reply = (
            f"分析完成，但处理轮次已达上限（当前最多 {max_rounds} 轮）。"
            "可通过环境变量 CF_AGENT_MAX_TOOL_ROUNDS 调大；设为 0 或 unlimited 表示不限制轮次（仍受工程安全顶保护）。"
        )
    return _result_dict(reply, trace)


async def _run_agent_langchain(
    user_message: str,
    role: str = "treasurer",
    history: Optional[List[dict]] = None,
    api_key_override: Optional[str] = None,
    system_prompt: Optional[str] = None,
) -> Dict[str, Any]:
    from langchain_openai import ChatOpenAI
    from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

    trace: List[Dict[str, Any]] = [
        {
            "phase": "start",
            "title": "任务入队",
            "detail": user_message[:500],
            "ts": _ts(),
        },
        {
            "phase": "config",
            "title": "执行引擎",
            "detail": "LangChain ChatOpenAI + bind_tools（与 agent_core.TOOLS 对齐）",
            "ts": _ts(),
        },
    ]

    key = (api_key_override or os.getenv("DEEPSEEK_API_KEY", "") or "").strip()
    if not key:
        trace.append(
            {
                "phase": "offline",
                "title": "无 API Key · 本地工具链",
                "detail": "未配置 DEEPSEEK_API_KEY，使用规则匹配 + 数据库只读工具。",
                "ts": _ts(),
            }
        )
        return _result_dict(_fallback(user_message), trace)

    llm = ChatOpenAI(
        model="deepseek-chat",
        api_key=key,
        base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
        temperature=0.3,
        max_tokens=2048,
    )
    llm_with_tools = llm.bind_tools(TOOLS)

    messages: List[Any] = [SystemMessage(content=_resolve_system_content(role, system_prompt))]
    for h in (history or [])[-12:]:
        r, c = h.get("role"), h.get("content")
        if r in ("user", "assistant") and c and isinstance(c, str):
            if r == "user":
                messages.append(HumanMessage(content=c))
            else:
                messages.append(AIMessage(content=c))
    messages.append(HumanMessage(content=user_message))

    max_rounds = _max_tool_rounds()
    for round_i in range(max_rounds):
        trace.append(
            {
                "phase": "llm",
                "title": _llm_trace_title(round_i, max_rounds, "LangChain 推理"),
                "detail": "ainvoke + 可选工具调用"
                + (" · 无上限模式" if _is_unlimited_round_mode(max_rounds) else ""),
                "ts": _ts(),
            }
        )
        try:
            ai_msg = await llm_with_tools.ainvoke(messages)
        except Exception as e:
            trace.append(
                {
                    "phase": "error",
                    "title": "模型调用失败",
                    "detail": str(e),
                    "ts": _ts(),
                }
            )
            return _result_dict(f"AI 服务暂不可用: {str(e)}", trace)

        messages.append(ai_msg)
        plan = (getattr(ai_msg, "content", None) or "").strip()
        if plan:
            trace.append(
                {
                    "phase": "reasoning",
                    "title": "模型说明",
                    "detail": plan[:1200],
                    "ts": _ts(),
                }
            )

        tool_calls = getattr(ai_msg, "tool_calls", None) or []
        if not tool_calls:
            text = getattr(ai_msg, "content", None) or ""
            trace.append(
                {
                    "phase": "done",
                    "title": "生成最终回复",
                    "detail": "本轮无工具调用",
                    "ts": _ts(),
                }
            )
            return _result_dict(text.strip() or "（无回复）", trace)

        for tc in tool_calls:
            if isinstance(tc, dict):
                tid = tc.get("id") or ""
                name = tc.get("name")
                args = tc.get("args")
                if args is None and tc.get("arguments"):
                    try:
                        args = json.loads(tc["arguments"])
                    except Exception:
                        args = {}
                if isinstance(args, str):
                    try:
                        args = json.loads(args) if args else {}
                    except Exception:
                        args = {}
            else:
                tid = getattr(tc, "id", "") or ""
                name = getattr(tc, "name", None)
                args = getattr(tc, "args", None) or {}
                if isinstance(args, str):
                    try:
                        args = json.loads(args) if args else {}
                    except Exception:
                        args = {}

            if not name:
                continue
            handler = TOOL_DISPATCH.get(str(name))
            result = (
                handler(args if isinstance(args, dict) else {})
                if handler
                else json.dumps({"error": f"未知工具: {name}"}, ensure_ascii=False)
            )
            trace.append(
                {
                    "phase": "tool",
                    "title": f"工具 · {name}",
                    "args": args if isinstance(args, dict) else {},
                    "result_preview": _preview(result, 520),
                    "ts": _ts(),
                }
            )
            messages.append(ToolMessage(content=result, tool_call_id=tid))

    trace.append(
        {
            "phase": "limit",
            "title": "达到最大工具轮次",
            "detail": (
                "已达到单次请求允许的最大工具轮次（无上限模式下的工程安全顶）。请简化问题、拆步提问，或检查是否陷入重复工具调用。"
                if _is_unlimited_round_mode(max_rounds)
                else f"本轮上限为 {max_rounds} 轮（环境变量 CF_AGENT_MAX_TOOL_ROUNDS）。已停止，请简化问题或拆步提问。"
            ),
            "ts": _ts(),
        }
    )
    if _is_unlimited_round_mode(max_rounds):
        reply = (
            "分析完成，但工具链轮次已达单次请求的工程安全上限（无上限模式仍设有防失控顶）。"
            "若任务合理却反复触顶，请拆成多轮对话或检查模型是否重复调用工具。"
        )
    else:
        reply = (
            f"分析完成，但处理轮次已达上限（当前最多 {max_rounds} 轮）。"
            "可通过环境变量 CF_AGENT_MAX_TOOL_ROUNDS 调大；设为 0 或 unlimited 表示不限制轮次（仍受工程安全顶保护）。"
        )
    return _result_dict(reply, trace)


async def run_agent(
    user_message: str,
    role: str = "treasurer",
    history: Optional[List[dict]] = None,
    api_key_override: Optional[str] = None,
    system_prompt: Optional[str] = None,
) -> Dict[str, Any]:
    """对外入口：优先 LangChain Harness；否则 OpenAI SDK。返回 {"reply": str, "trace": [...]}。"""
    use_lc = os.getenv("CF_USE_LANGCHAIN", "1").strip().lower() in ("1", "true", "yes")
    if use_lc and _lc_available():
        return await _run_agent_langchain(
            user_message, role, history, api_key_override, system_prompt
        )
    return await _run_agent_openai_sdk(
        user_message, role, history, api_key_override, system_prompt
    )
