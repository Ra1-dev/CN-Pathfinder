from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class ProfileCreate(BaseModel):
    session_id:  str
    first_name:  Optional[str] = None
    country:     Optional[str] = None
    grade:       Optional[str] = None
    sat:         Optional[int] = None
    act:         Optional[int] = None
    gpa:         Optional[float] = None
    ielts:       Optional[float] = None
    major:       Optional[str] = None
    activities:  Optional[List[str]] = []
    essay:       Optional[str] = None


class ProfileResponse(ProfileCreate):
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SavedSchoolCreate(BaseModel):
    session_id:  str
    school_id:   str
    school_name: str
    chance:      int
    tier:        str
    slot:        Optional[str] = None
    scores:      Optional[Dict[str, Any]] = None


class SavedSchoolResponse(SavedSchoolCreate):
    id:       int
    saved_at: Optional[datetime] = None

    class Config:
        from_attributes = True
