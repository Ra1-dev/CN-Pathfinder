from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import os, json, pathlib

from database import engine, Base, get_db
import models, schemas

load_dotenv()
Base.metadata.create_all(bind=engine)

# Auto-migrate: add columns added after initial deploy
from sqlalchemy import text, inspect
def run_migrations():
    with engine.connect() as conn:
        inspector = inspect(engine)
        cols = [c["name"] for c in inspector.get_columns("saved_schools")]
        if "slot" not in cols:
            conn.execute(text("ALTER TABLE saved_schools ADD COLUMN slot VARCHAR"))
            conn.commit()
        if "scores" not in cols:
            conn.execute(text("ALTER TABLE saved_schools ADD COLUMN scores JSON"))
            conn.commit()

try:
    run_migrations()
except Exception as e:
    print(f"Migration note: {e}")

app = FastAPI(title="UniJourney API", version="1.0.0")

FRONTEND_URL = os.getenv("FRONTEND_URL", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_URL,
        "http://localhost:3000",
        "http://127.0.0.1:5500",
        "https://uni-journey-app.vercel.app",
        "https://uni-journey-app.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Universities JSON ─────────────────────────────────────
DATA_FILE = pathlib.Path(__file__).parent / "data" / "universities_complete.json"

@app.get("/universities")
def get_universities():
    if DATA_FILE.exists():
        with open(DATA_FILE) as f:
            return json.load(f)
    raise HTTPException(status_code=404, detail="universities_complete.json not found in backend/data/")

# ── Health ────────────────────────────────────────────────
@app.get("/")
def health():
    return {"status": "ok", "service": "UniJourney API"}

# ── Profile ───────────────────────────────────────────────
@app.post("/profile", response_model=schemas.ProfileResponse)
def upsert_profile(data: schemas.ProfileCreate, db: Session = Depends(get_db)):
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
    profile = models.UserProfile(**data.model_dump())
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile

@app.get("/profile/{session_id}", response_model=schemas.ProfileResponse)
def get_profile(session_id: str, db: Session = Depends(get_db)):
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

# ── Saved Schools ─────────────────────────────────────────
@app.get("/saved/{session_id}", response_model=list[schemas.SavedSchoolResponse])
def get_saved(session_id: str, db: Session = Depends(get_db)):
    return db.query(models.SavedSchool).filter(
        models.SavedSchool.session_id == session_id
    ).all()

@app.post("/saved", response_model=schemas.SavedSchoolResponse)
def save_school(data: schemas.SavedSchoolCreate, db: Session = Depends(get_db)):
    # Remove existing entry for same slot if exists
    if data.slot:
        db.query(models.SavedSchool).filter(
            models.SavedSchool.session_id == data.session_id,
            models.SavedSchool.slot == data.slot,
        ).delete()
        db.commit()

    # Remove duplicate school entry if exists
    db.query(models.SavedSchool).filter(
        models.SavedSchool.session_id == data.session_id,
        models.SavedSchool.school_id  == data.school_id,
    ).delete()
    db.commit()

    school = models.SavedSchool(**data.model_dump())
    db.add(school)
    db.commit()
    db.refresh(school)
    return school

# NOTE: more specific route must come BEFORE the generic one
@app.delete("/saved/{session_id}/{school_id}")
def remove_saved_school(session_id: str, school_id: str, db: Session = Depends(get_db)):
    db.query(models.SavedSchool).filter(
        models.SavedSchool.session_id == session_id,
        models.SavedSchool.school_id  == school_id,
    ).delete()
    db.commit()
    return {"deleted": True}

@app.delete("/saved/{session_id}")
def clear_saved(session_id: str, db: Session = Depends(get_db)):
    db.query(models.SavedSchool).filter(
        models.SavedSchool.session_id == session_id
    ).delete()
    db.commit()
    return {"deleted": True}
