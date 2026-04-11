from sqlalchemy import Column, String, Float, Integer, JSON, DateTime, Text
from sqlalchemy.sql import func
from database import Base


class UserProfile(Base):
    __tablename__ = "user_profiles"

    session_id   = Column(String, primary_key=True, index=True)
    first_name   = Column(String, nullable=True)
    country      = Column(String, nullable=True)
    grade        = Column(String, nullable=True)

    # Academics
    sat          = Column(Integer, nullable=True)
    act          = Column(Integer, nullable=True)
    gpa          = Column(Float,   nullable=True)
    ielts        = Column(Float,   nullable=True)

    # Profile
    major        = Column(String,  nullable=True)
    activities   = Column(JSON,    nullable=True)   # list of strings
    essay        = Column(Text,    nullable=True)

    # Metadata
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), onupdate=func.now())


class SavedSchool(Base):
    __tablename__ = "saved_schools"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    session_id   = Column(String, index=True)
    school_id    = Column(String)          # e.g. 'cmu', 'northeastern'
    school_name  = Column(String)
    chance       = Column(Integer)         # 0–100
    tier         = Column(String)          # reach / target / likely
    saved_at     = Column(DateTime(timezone=True), server_default=func.now())
