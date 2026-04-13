"""
agent.py — 兼容入口（业务代码 `from agent import run_agent`）
实现见 agent_langchain.py（LangChain Harness + OpenAI SDK 回退），工具与提示词见 agent_core.py。

run_agent 返回 dict：{"reply": str, "trace": list}，trace 供前端「执行结果」展示推理与工具调用步骤。
"""

from agent_langchain import run_agent
from agent_core import TOOL_DISPATCH, TOOLS, SYSTEM_PROMPT, _fallback, _fmt_wan

__all__ = ["run_agent", "TOOL_DISPATCH", "TOOLS", "SYSTEM_PROMPT", "_fallback", "_fmt_wan"]
