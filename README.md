# UniJourney

US college admissions counselor web app. Multi-page, FastAPI backend, PostgreSQL database.

## Stack
- **Frontend**: Plain HTML/CSS/JS — deployed on Vercel (free)
- **Backend**: FastAPI (Python) — deployed on Render (free tier)
- **Database**: PostgreSQL — Render managed database (free tier, 1GB)
- **Auth**: Session-based (UUID in localStorage, no login required)

## Project structure

```
UniJourney/
├── backend/
│   ├── main.py          # FastAPI routes
│   ├── models.py        # SQLAlchemy DB models
│   ├── database.py      # DB connection
│   ├── schemas.py       # Pydantic schemas
│   ├── requirements.txt
│   ├── render.yaml      # Render deploy config
│   └── .env.example
└── frontend/
    ├── index.html       # Landing page
    ├── profile.html     # 5-step onboarding form
    ├── results.html     # Personalized school list
    ├── university.html  # University detail + radar chart
    ├── style.css        # Shared design system
    └── api.js           # API client + chance calculator
```

---

## Local development

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create a .env file
cp .env.example .env
# Edit .env and set DATABASE_URL to your local postgres or Supabase URL

uvicorn main:app --reload --port 8000
```

API will be live at http://localhost:8000
Swagger docs at http://localhost:8000/docs

### Frontend

```bash
cd frontend
npx serve .
# or just open index.html directly in browser
```

No build step needed.

---

## Deploy (free, ~15 minutes)

### Step 1 — Database on Render

1. Go to render.com → New → PostgreSQL
2. Name it `unijourney-db`, select Free plan
3. Copy the **Internal Database URL** — you'll need it in Step 2

### Step 2 — Backend on Render

1. Push your code to GitHub
2. Go to render.com → New → Web Service
3. Connect your repo, set root directory to `backend/`
4. Build command: `pip install -r requirements.txt`
5. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Add environment variable:
   - `DATABASE_URL` = the Internal URL from Step 1
7. Deploy — takes ~3 minutes
8. Copy your Render service URL (e.g. `https://unijourney-api.onrender.com`)

### Step 3 — Frontend on Vercel

1. Go to vercel.com → New Project → import your GitHub repo
2. Set root directory to `frontend/`
3. No build command needed
4. Deploy

### Step 4 — Wire them together

1. In `frontend/api.js`, update line 4:
   ```js
   : 'https://unijourney-api.onrender.com'  // your Render URL
   ```
2. In Render backend settings → Environment → add:
   - `FRONTEND_URL` = your Vercel URL (e.g. `https://unijourney.vercel.app`)
3. Redeploy both

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/profile` | Create or update user profile |
| GET | `/profile/{session_id}` | Get profile by session |
| DELETE | `/profile/{session_id}` | Delete profile |
| GET | `/saved/{session_id}` | Get saved schools |
| POST | `/saved` | Save a school |
| DELETE | `/saved/{session_id}/{school_id}` | Remove saved school |

---

## Connecting real university data

The frontend ships with 12 hardcoded universities in `api.js`.
To use real data from the UniJourney-SE scraper:

1. Copy `output/universities_complete.json` from the SE repo to `frontend/data/`
2. The `getUniversities()` function in `api.js` will automatically load it:
   ```js
   async function getUniversities() {
     const res = await fetch('data/universities_complete.json');
     if (res.ok) return res.json();
     return UNIVERSITIES; // fallback to hardcoded
   }
   ```

---

## Notes

- Sessions are UUID-based, stored in `localStorage`. No login required.
- If the backend is unreachable, profile data falls back to `localStorage` automatically.
- Render free tier spins down after 15 min of inactivity — first request after sleep takes ~30s.
  Consider upgrading to Render Starter ($7/mo) for always-on.
