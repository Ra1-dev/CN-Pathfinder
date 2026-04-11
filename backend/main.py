from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import os

from database import engine, Base, get_db
import models, schemas

load_dotenv()

# Create all tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(title="UniJourney API", version="1.0.0")

FRONTEND_URL = os.getenv("FRONTEND_URL", "*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000", "http://127.0.0.1:5500"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ─────────────────────────────────────────────────
@app.get("/")
def health():
    return {"status": "ok", "service": "UniJourney API"}


# ── Profile ────────────────────────────────────────────────

@app.post("/profile", response_model=schemas.ProfileResponse)
def upsert_profile(data: schemas.ProfileCreate, db: Session = Depends(get_db)):
    """Create or update a user profile by session_id."""
    existing = db.query(models.UserProfile).filter(
        models.UserProfile.session_id == data.session_id
    ).first()

    if existing:
        for field, value in data.model_dump(exclude={"session_id"}).items():
            if value is not None:
                setattr(existing, field, value)
        db.commit()
        db.refresh(existing)
        return existing
    else:
        profile = models.UserProfile(**data.model_dump())
        db.add(profile)
        db.commit()
        db.refresh(profile)
        return profile


@app.get("/profile/{session_id}", response_model=schemas.ProfileResponse)
def get_profile(session_id: str, db: Session = Depends(get_db)):
    """Retrieve a profile by session_id."""
    profile = db.query(models.UserProfile).filter(
        models.UserProfile.session_id == session_id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@app.delete("/profile/{session_id}")
def delete_profile(session_id: str, db: Session = Depends(get_db)):
    profile = db.query(models.UserProfile).filter(
        models.UserProfile.session_id == session_id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    db.delete(profile)
    db.commit()
    return {"deleted": True}


# ── Saved Schools ──────────────────────────────────────────

@app.get("/saved/{session_id}", response_model=list[schemas.SavedSchoolResponse])
def get_saved_schools(session_id: str, db: Session = Depends(get_db)):
    return db.query(models.SavedSchool).filter(
        models.SavedSchool.session_id == session_id
    ).all()


@app.post("/saved", response_model=schemas.SavedSchoolResponse)
def save_school(data: schemas.SavedSchoolCreate, db: Session = Depends(get_db)):
    # Prevent duplicates
    existing = db.query(models.SavedSchool).filter(
        models.SavedSchool.session_id == data.session_id,
        models.SavedSchool.school_id  == data.school_id,
    ).first()
    if existing:
        return existing
    school = models.SavedSchool(**data.model_dump())
    db.add(school)
    db.commit()
    db.refresh(school)
    return school


@app.delete("/saved/{session_id}/{school_id}")
def remove_saved_school(session_id: str, school_id: str, db: Session = Depends(get_db)):
    school = db.query(models.SavedSchool).filter(
        models.SavedSchool.session_id == session_id,
        models.SavedSchool.school_id  == school_id,
    ).first()
    if not school:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(school)
    db.commit()
    return {"deleted": True}
