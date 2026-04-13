"""
PRD 3.1.x 规则校验（科目层级、映射唯一、业务类型枚举、取数任务 extra_json）
"""
from __future__ import annotations

import json
import re
from typing import Any, List, Optional, Set, Tuple

from fastapi import HTTPException

# 说明书 3.1.1 资金业务类型
PRD_BIZ_TYPES = (
    "一般资金流",
    "保证金",
    "借款",
    "对外借款",
    "定期存款",
    "协定存款",
    "金额理财",
    "份额理财",
    "外汇即远期",
    "外汇掉期",
    "外汇期权",
)

PRD_TASK_TYPES = ("资金流自动获取", "资金计划自动获取资金预测")

SUBJECT_CODE_RE = re.compile(r"^\d{3}(\d{3})*$")


def validate_subject_code_format(code: str) -> Tuple[bool, str]:
    if not code or not str(code).strip():
        return False, "资金流科目代码不能为空"
    code = str(code).strip()
    if not SUBJECT_CODE_RE.match(code):
        return False, "科目代码须为层级数字结构（一级3位，每级递增3位）"
    if len(code) > 24:
        return False, "科目代码层级过深"
    return True, ""


def validate_subject_parent_chain(db, parent_id: Optional[int], code: str) -> Tuple[bool, str]:
    """子科目代码 = 父科目代码 + 三位流水（说明书层级规则）"""
    from database import CashflowSubject

    if not parent_id:
        if len(code) != 3:
            return False, "一级科目代码须为3位数字"
        return True, ""
    p = db.query(CashflowSubject).filter(CashflowSubject.id == parent_id, CashflowSubject.is_deleted == False).first()
    if not p:
        return False, "父科目不存在"
    pc = (p.code or "").strip()
    if not code.startswith(pc):
        return False, "子科目代码须以父科目代码为前缀"
    if len(code) != len(pc) + 3:
        return False, "子科目须在父科目下扩展三位数字"
    return True, ""


def validate_biz_type(biz_type: str) -> Tuple[bool, str]:
    if biz_type not in PRD_BIZ_TYPES:
        return False, f"资金业务类型须为：{'、'.join(PRD_BIZ_TYPES)}"
    return True, ""


def assert_category_map_unique_subject(db, subject_id: int, exclude_id: Optional[int] = None) -> None:
    from database import SubjectCategoryMap

    q = db.query(SubjectCategoryMap).filter(
        SubjectCategoryMap.subject_id == subject_id,
        SubjectCategoryMap.is_deleted == False,
        SubjectCategoryMap.valid == True,
    )
    if exclude_id is not None:
        q = q.filter(SubjectCategoryMap.id != exclude_id)
    if q.first():
        raise HTTPException(status_code=400, detail="该资金流科目已配置科目↔业务类别映射，不允许重复配置")


def collect_plan_map_subject_ids(db) -> Tuple[dict, Set[int]]:
    """返回 map_id -> set(subject_ids)"""
    from database import SubjectPlanMap

    out = {}
    all_ids: Set[int] = set()
    for m in db.query(SubjectPlanMap).filter(SubjectPlanMap.is_deleted == False, SubjectPlanMap.valid == True).all():
        try:
            ids = set(json.loads(m.subject_ids or "[]"))
        except Exception:
            ids = set()
        out[m.id] = ids
        all_ids |= ids
    return out, all_ids


def assert_plan_map_no_subject_overlap(db, subject_ids: List[int], exclude_map_id: Optional[int] = None) -> None:
    from database import CashflowSubject

    maps, _ = collect_plan_map_subject_ids(db)
    want = set(subject_ids)
    for mid, sids in maps.items():
        if exclude_map_id is not None and mid == exclude_map_id:
            continue
        overlap = want & sids
        if overlap:
            subs = db.query(CashflowSubject).filter(CashflowSubject.id.in_(overlap)).all()
            names = "、".join(f"{s.code} {s.name}" for s in subs if s)
            raise HTTPException(status_code=400, detail=f"资金流科目 {names} 已配置计划映射，不允许重复配置")


def validate_fetch_task_body(task_type: str, extra_json: str) -> Tuple[bool, str]:
    if task_type not in PRD_TASK_TYPES:
        return False, f"任务类型须为：{'、'.join(PRD_TASK_TYPES)}"
    try:
        ex: Any = json.loads(extra_json or "{}")
    except Exception:
        return False, "extra_json 须为合法 JSON"
    if not isinstance(ex, dict):
        return False, "extra_json 须为对象"
    if task_type == "资金计划自动获取资金预测":
        # 可选：post_action / period_types / alert_user_ids
        pa = ex.get("post_action")
        if pa is not None and pa not in ("暂存", "提交"):
            return False, "获取后操作 post_action 须为 暂存 或 提交"
        pt = ex.get("period_types")
        if pt is not None:
            if not isinstance(pt, list):
                return False, "period_types 须为数组"
            allowed = {"年计划", "季计划", "月计划", "周计划", "天计划"}
            for x in pt:
                if x not in allowed:
                    return False, "period_types 项须为年/季/月/周/天计划之一"
    return True, ""


def validate_category_biz_codes_unique(db, subject_id: int, biz_codes: List[str], exclude_id: Optional[int] = None) -> None:
    """同一业务类别不能映射到多科目（说明书：业务类别重复校验）"""
    from database import SubjectCategoryMap

    want = set(biz_codes)
    for m in db.query(SubjectCategoryMap).filter(SubjectCategoryMap.is_deleted == False, SubjectCategoryMap.valid == True).all():
        if exclude_id is not None and m.id == exclude_id:
            continue
        if m.subject_id == subject_id:
            continue
        try:
            old = set(json.loads(m.category_ids or "[]"))
        except Exception:
            old = set()
        dup = want & old
        if dup:
            raise HTTPException(status_code=400, detail=f"业务类别编码 {','.join(dup)} 已配置，不允许重复配置")


def validate_plan_subject_name_unique(db, direction: str, plan_subject_name: str, exclude_id: Optional[int] = None) -> None:
    from database import SubjectPlanMap

    q = db.query(SubjectPlanMap).filter(
        SubjectPlanMap.direction == direction,
        SubjectPlanMap.plan_subject_name == plan_subject_name.strip(),
        SubjectPlanMap.is_deleted == False,
        SubjectPlanMap.valid == True,
    )
    if exclude_id is not None:
        q = q.filter(SubjectPlanMap.id != exclude_id)
    if q.first():
        raise HTTPException(status_code=400, detail=f"资金计划科目 {plan_subject_name} 在该流向下已配置，不允许重复配置")
