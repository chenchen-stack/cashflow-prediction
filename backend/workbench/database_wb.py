"""工作台专用 SQLite（与 cashflow_agent.db 分离，仅存协作会话与消息）"""
import os
import uuid
from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

DB_PATH = os.path.join(os.path.dirname(__file__), "workbench.db")
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionWB = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


class WbSession(Base):
    __tablename__ = "wb_sessions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    public_id = Column(String(36), unique=True, nullable=False)
    role = Column(String(40), default="treasurer")
    agent_mode = Column(String(40), default="data")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    messages = relationship("WbMessage", back_populates="session", cascade="all, delete-orphan")


class WbMessage(Base):
    __tablename__ = "wb_messages"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("wb_sessions.id"), nullable=False)
    role = Column(String(20), nullable=False)
    content = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.now)
    session = relationship("WbSession", back_populates="messages")


def init_wb_db():
    Base.metadata.create_all(engine)


def new_session(role: str, agent_mode: str) -> WbSession:
    sid = str(uuid.uuid4())
    db = SessionWB()
    try:
        s = WbSession(public_id=sid, role=role or "treasurer", agent_mode=agent_mode or "data")
        db.add(s)
        db.commit()
        db.refresh(s)
        return s
    finally:
        db.close()


def get_session_by_public_id(public_id: str):
    db = SessionWB()
    try:
        return db.query(WbSession).filter(WbSession.public_id == public_id).first()
    finally:
        db.close()


def append_message(session_pk: int, role: str, content: str):
    db = SessionWB()
    try:
        m = WbMessage(session_id=session_pk, role=role, content=content or "")
        db.add(m)
        db.commit()
    finally:
        db.close()


def list_messages(public_id: str, limit: int = 80):
    db = SessionWB()
    try:
        s = db.query(WbSession).filter(WbSession.public_id == public_id).first()
        if not s:
            return []
        rows = (
            db.query(WbMessage)
            .filter(WbMessage.session_id == s.id)
            .order_by(WbMessage.id.asc())
            .limit(limit)
            .all()
        )
        return [{"role": r.role, "content": r.content, "created_at": r.created_at.isoformat() if r.created_at else None} for r in rows]
    finally:
        db.close()
