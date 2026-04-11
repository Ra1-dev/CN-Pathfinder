# University Data

Place `universities_complete.json` from the UniJourney-SE scraper in this folder.

The file is served by the `/universities` API endpoint.

To upload to Render after deploying:
1. Run the UniJourney-SE pipeline locally: `py pipeline.py`
2. Copy `output/universities_complete.json` to this folder
3. Commit and push — Render will redeploy automatically

Expected format: array of university objects with fields:
- name, scorecard_id, city, state, acceptance_rate
- sat_reading_25/75, sat_math_25/75, act_25/75
- gpa_avg, ielts_min
- deadlines: { ed, ea, rd, ed2 }
- requirements: { essay, supplement, recs, interview, fee }
