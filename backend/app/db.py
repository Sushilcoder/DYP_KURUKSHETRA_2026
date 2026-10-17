from __future__ import annotations
import os
from datetime import datetime, timezone
from sqlalchemy import create_engine, String, Text, DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./storage/studio.db")
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

class Base(DeclarativeBase):
    pass

class MaterialRecord(Base):
    __tablename__ = "materials"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    status: Mapped[str] = mapped_column(String(40), index=True)
    payload: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

def init_db() -> None:
    Base.metadata.create_all(bind=engine)

def save_record(material_id: str, status: str, payload: dict) -> None:
    import json
    with SessionLocal() as db:
        rec = db.get(MaterialRecord, material_id)
        encoded = json.dumps(payload, ensure_ascii=False)
        if rec:
            rec.status = status
            rec.payload = encoded
        else:
            db.add(MaterialRecord(id=material_id, status=status, payload=encoded))
        db.commit()

def get_record(material_id: str) -> dict | None:
    import json
    with SessionLocal() as db:
        rec = db.get(MaterialRecord, material_id)
        if not rec:
            return None
        data = json.loads(rec.payload)
        data.setdefault("id", rec.id)
        data.setdefault("status", rec.status)
        return data

def list_records(limit: int = 50) -> list[dict]:
    import json
    with SessionLocal() as db:
        rows = db.query(MaterialRecord).order_by(MaterialRecord.created_at.desc()).limit(limit).all()
        out = []
        for r in rows:
            payload = json.loads(r.payload)
            payload.setdefault("id", r.id)
            payload.setdefault("status", r.status)
            out.append(payload)
        return out
