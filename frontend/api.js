// ─────────────────────────────────────────────────────────────
// CONFIG — change this to your deployed Render backend URL
// ─────────────────────────────────────────────────────────────
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8000'
  : 'https://unijourney-api.onrender.com'

// ─────────────────────────────────────────────────────────────
// SESSION — UUID stored in localStorage
// ─────────────────────────────────────────────────────────────
function getSessionId() {
  let id = localStorage.getItem('uj_session');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('uj_session', id);
  }
  return id;
}

// ─────────────────────────────────────────────────────────────
// API HELPERS
// ─────────────────────────────────────────────────────────────
async function apiPost(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiGet(path) {
  const res = await fetch(API_BASE + path);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiDelete(path) {
  const res = await fetch(API_BASE + path, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─────────────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────────────
async function saveProfile(data) {
  return apiPost('/profile', { session_id: getSessionId(), ...data });
}

async function loadProfile() {
  try {
    return await apiGet('/profile/' + getSessionId());
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `show ${type}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.className = '', 3200);
}

// ─────────────────────────────────────────────────────────────
// CHANCE CALCULATOR — pure client-side, uses data from JSON
// ─────────────────────────────────────────────────────────────
function calcChance(uni, profile) {
  const sat = profile.sat || (profile.act ? profile.act * 44 + 790 : 0);
  const p25 = (uni.sat_reading_25 || 0) + (uni.sat_math_25 || 0);
  const p75 = (uni.sat_reading_75 || 0) + (uni.sat_math_75 || 0);

  let satScore = 50;
  if (sat && p25) {
    const mid = (p25 + p75) / 2;
    if (sat >= p75)       satScore = 92;
    else if (sat >= mid)  satScore = 74;
    else if (sat >= p25)  satScore = 55;
    else satScore = Math.max(15, Math.round((sat / p25) * 65));
  }

  let gpaScore = 50;
  if (profile.gpa && uni.gpa_avg) {
    const diff = profile.gpa - uni.gpa_avg;
    if (diff >= 0.1)       gpaScore = 90;
    else if (diff >= -0.1) gpaScore = 72;
    else if (diff >= -0.3) gpaScore = 55;
    else if (diff >= -0.5) gpaScore = 38;
    else gpaScore = Math.max(12, 38 + diff * 40);
  }

  let ieltsScore = 60;
  if (profile.ielts && uni.ielts_min) {
    const diff = profile.ielts - uni.ielts_min;
    if (diff >= 0.5)      ieltsScore = 92;
    else if (diff >= 0)   ieltsScore = 76;
    else if (diff >= -0.5) ieltsScore = 40;
    else ieltsScore = 18;
  }

  const acts = (profile.activities || []).filter(Boolean).length;
  const ecScore = acts >= 5 ? 82 : acts >= 3 ? 64 : acts >= 1 ? 46 : 28;

  const essayLen = (profile.essay || '').trim().length;
  const essayScore = essayLen > 300 ? 72 : essayLen > 100 ? 56 : essayLen > 0 ? 44 : 40;

  const weights = { sat: 0.30, gpa: 0.25, ielts: 0.10, ec: 0.15, essay: 0.20 };
  const scores  = { sat: satScore, gpa: gpaScore, ielts: ieltsScore, ec: ecScore, essay: essayScore };
  const weighted = Object.keys(weights).reduce((s, k) => s + scores[k] * weights[k], 0);
  const rate = uni.acceptance_rate || 0.5;
  const penalized = weighted * (1 - rate * 0.28);
  const final = Math.min(97, Math.max(2, Math.round(penalized)));

  return { final, scores };
}

function getTier(chance) {
  if (chance >= 60) return 'likely';
  if (chance >= 35) return 'target';
  return 'reach';
}

// ─────────────────────────────────────────────────────────────
// RADAR CHART — pure SVG, no dependencies
// ─────────────────────────────────────────────────────────────
function buildRadar(scores, tier, size = 280) {
  const cx = size / 2, cy = size / 2 - 5, maxR = size * 0.33;
  const axes = [
    { label: 'SAT/ACT', angle: 0,   score: scores.sat   || 0 },
    { label: 'GPA',     angle: 72,  score: scores.gpa   || 0 },
    { label: 'IELTS',   angle: 144, score: scores.ielts || 0 },
    { label: 'Essay',   angle: 216, score: scores.essay || 0 },
    { label: 'ECs',     angle: 288, score: scores.ec    || 0 },
  ];

  const pt = (angle, r) => {
    const rad = (angle - 90) * Math.PI / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };

  const rings = [25, 50, 75, 100].map(pct => {
    const r = (pct / 100) * maxR;
    const pts = axes.map(a => pt(a.angle, r).join(',')).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="rgba(159,172,251,0.07)" stroke-width="1"/>`;
  }).join('');

  const axisLines = axes.map(a => {
    const [x, y] = pt(a.angle, maxR);
    return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(159,172,251,0.1)" stroke-width="1"/>`;
  }).join('');

  const polyPts = axes.map(a => {
    const [x, y] = pt(a.angle, (a.score / 100) * maxR);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const stroke = tier === 'likely' ? '#2DBF7B' : tier === 'target' ? '#E0A020' : '#E0115F';
  const fill   = tier === 'likely' ? 'rgba(45,191,123,0.15)' : tier === 'target' ? 'rgba(224,160,32,0.15)' : 'rgba(224,17,95,0.15)';

  const dots = axes.map(a => {
    const [x, y] = pt(a.angle, (a.score / 100) * maxR);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${stroke}"/>`;
  }).join('');

  const labels = axes.map(a => {
    const [x, y] = pt(a.angle, maxR + 18);
    const anchor = x < cx - 8 ? 'end' : x > cx + 8 ? 'start' : 'middle';
    return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="${anchor}" font-size="11" fill="#8B92A8" font-family="DM Sans,sans-serif">${a.label}</text>`;
  }).join('');

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${rings}${axisLines}
    <polygon points="${polyPts}" fill="${fill}" stroke="${stroke}" stroke-width="1.8"/>
    ${dots}${labels}
  </svg>`;
}

// ─────────────────────────────────────────────────────────────
// UNIVERSITY DATABASE — matches universities_complete.json structure
// In production this can be replaced with fetch('data/universities_complete.json')
// ─────────────────────────────────────────────────────────────
const UNIVERSITIES = [
  { id:'mit', name:'Massachusetts Institute of Technology', emoji:'⚗️', city:'Cambridge', state:'MA', type:'Private', acceptance_rate:0.039, sat_reading_25:730, sat_reading_75:790, sat_math_25:790, sat_math_75:800, act_25:35, act_75:36, gpa_avg:3.97, ielts_min:7.0, deadlines:{ ed:'2024-11-01', rd:'2025-01-01' }, requirements:{ essay:true, supplement:'Short answer', recs:'2 teachers + 1 counselor', interview:'Alumni interview', fee:75 }, whyFit:'The world\'s top science and engineering school. Unmatched research opportunities from day one.', keyAction:'Your research or project work matters most. Highlight a concrete technical achievement.', aidNote:'MIT is need-blind for internationals and meets 100% of demonstrated need.' },
  { id:'harvard', name:'Harvard University', emoji:'🎓', city:'Cambridge', state:'MA', type:'Private', acceptance_rate:0.032, sat_reading_25:730, sat_reading_75:780, sat_math_25:740, sat_math_75:800, act_25:34, act_75:36, gpa_avg:3.96, ielts_min:7.0, deadlines:{ ed:'2024-11-01', rd:'2025-01-01' }, requirements:{ essay:true, supplement:'Short essays', recs:'2 teachers + 1 counselor', interview:'Alumni interview', fee:90 }, whyFit:'Most recognized name in global academia. Extraordinary alumni network across every field.', keyAction:'Essays are everything. Show intellectual curiosity and impact beyond the classroom.', aidNote:'Need-blind for US students, need-aware for internationals. Very generous aid if admitted.' },
  { id:'stanford', name:'Stanford University', emoji:'🌴', city:'Stanford', state:'CA', type:'Private', acceptance_rate:0.036, sat_reading_25:720, sat_reading_75:780, sat_math_25:750, sat_math_75:800, act_25:34, act_75:36, gpa_avg:3.96, ielts_min:7.0, deadlines:{ ed:'2024-11-01', rd:'2025-01-02' }, requirements:{ essay:true, supplement:'3 short essays', recs:'2 teachers + 1 counselor', interview:'Not offered', fee:90 }, whyFit:'The heart of Silicon Valley. Best entrepreneurship and tech ecosystem of any university.', keyAction:'Show genuine intellectual passion. Stanford wants students who think differently.', aidNote:'Meets full need. No loans in aid packages. Very strong support for internationals.' },
  { id:'cmu', name:'Carnegie Mellon University', emoji:'🤖', city:'Pittsburgh', state:'PA', type:'Private', acceptance_rate:0.113, sat_reading_25:710, sat_reading_75:770, sat_math_25:770, sat_math_75:800, act_25:34, act_75:36, gpa_avg:3.84, ielts_min:7.0, deadlines:{ ed:'2024-11-03', rd:'2025-01-05' }, requirements:{ essay:true, supplement:'1 short answer', recs:'1 counselor + 2 teachers', interview:'Not offered', fee:75 }, whyFit:'Top-5 CS and engineering globally. The best pipeline into big tech and AI research.', keyAction:'Highlight specific projects, competitions, or research. Technical depth matters here.', aidNote:'Limited aid for international students. Some merit scholarships available by program.' },
  { id:'columbia', name:'Columbia University', emoji:'🏙️', city:'New York', state:'NY', type:'Private', acceptance_rate:0.040, sat_reading_25:730, sat_reading_75:780, sat_math_25:750, sat_math_75:800, act_25:34, act_75:36, gpa_avg:3.93, ielts_min:7.0, deadlines:{ ed:'2024-11-01', rd:'2025-01-01' }, requirements:{ essay:true, supplement:'List + essays', recs:'2 teachers + 1 counselor', interview:'Not offered', fee:85 }, whyFit:'New York City is your campus. Unmatched access to finance, media, and the arts.', keyAction:'The "Why Columbia" essay is critical. Reference the Core Curriculum specifically.', aidNote:'Need-blind for US students. Limited but available merit aid for internationals.' },
  { id:'upenn', name:'University of Pennsylvania', emoji:'🏛️', city:'Philadelphia', state:'PA', type:'Private', acceptance_rate:0.056, sat_reading_25:720, sat_reading_75:770, sat_math_25:750, sat_math_75:800, act_25:34, act_75:36, gpa_avg:3.90, ielts_min:7.0, deadlines:{ ed:'2024-11-01', rd:'2025-01-05' }, requirements:{ essay:true, supplement:'Multiple essays', recs:'2 teachers + 1 counselor', interview:'Not offered', fee:85 }, whyFit:'Wharton is the top undergrad business school in the world. Penn Engineering is also elite.', keyAction:'Know exactly which Penn school you\'re applying to. Dual-degree programs set applicants apart.', aidNote:'Need-blind for US students. Need-aware for internationals but offers generous packages.' },
  { id:'northeastern', name:'Northeastern University', emoji:'🐾', city:'Boston', state:'MA', type:'Private', acceptance_rate:0.068, sat_reading_25:680, sat_reading_75:750, sat_math_25:700, sat_math_75:790, act_25:33, act_75:35, gpa_avg:3.71, ielts_min:6.5, deadlines:{ ed:'2024-11-01', ea:'2024-11-01', rd:'2025-01-01' }, requirements:{ essay:true, supplement:'1 short answer', recs:'1 counselor + 1 teacher', interview:'Not offered', fee:75 }, whyFit:'World-leading co-op program — 6-month paid work placements built directly into the degree.', keyAction:'Emphasize work experience, internships, or entrepreneurial projects. Co-op fit is key.', aidNote:'Merit aid available for international students with strong profiles. Apply ED for best chance.' },
  { id:'uwashington', name:'University of Washington', emoji:'🌲', city:'Seattle', state:'WA', type:'Public', acceptance_rate:0.482, sat_reading_25:590, sat_reading_75:690, sat_math_25:610, sat_math_75:730, act_25:27, act_75:33, gpa_avg:3.74, ielts_min:6.5, deadlines:{ ea:'2024-11-15', rd:'2024-12-01' }, requirements:{ essay:true, supplement:'Personal statement', recs:'Not required', interview:'Not offered', fee:80 }, whyFit:'Amazon, Microsoft, and Boeing recruit heavily here. Strong tech pipeline in Seattle.', keyAction:'Essays carry heavy weight. Show community impact and intellectual curiosity.', aidNote:'Very limited aid for international students. Competitive tuition for out-of-state applicants.' },
  { id:'purdue', name:'Purdue University', emoji:'🚀', city:'West Lafayette', state:'IN', type:'Public', acceptance_rate:0.531, sat_reading_25:570, sat_reading_75:680, sat_math_25:610, sat_math_75:740, act_25:26, act_75:33, gpa_avg:3.66, ielts_min:6.5, deadlines:{ ea:'2024-11-01', rd:'2025-02-01' }, requirements:{ essay:true, supplement:'None', recs:'Not required', interview:'Not offered', fee:60 }, whyFit:'One of the best value engineering schools in the US. Strong aerospace and CS programs.', keyAction:'SAT math score is heavily weighted. Highlight STEM achievements and competition results.', aidNote:'Some merit scholarships available for international students through specific colleges.' },
  { id:'indiana', name:'Indiana University Bloomington', emoji:'🔴', city:'Bloomington', state:'IN', type:'Public', acceptance_rate:0.782, sat_reading_25:560, sat_reading_75:660, sat_math_25:550, sat_math_75:660, act_25:25, act_75:31, gpa_avg:3.60, ielts_min:6.0, deadlines:{ ea:'2024-11-01', rd:'2025-02-01' }, requirements:{ essay:true, supplement:'None', recs:'Not required', interview:'Not offered', fee:65 }, whyFit:'Kelley School of Business is a top-10 undergraduate business program nationwide.', keyAction:'Apply directly to Kelley. Business applicants benefit from strong analytical background.', aidNote:'Scholarships available for international students with strong academic profiles.' },
  { id:'gatech', name:'Georgia Institute of Technology', emoji:'⚙️', city:'Atlanta', state:'GA', type:'Public', acceptance_rate:0.175, sat_reading_25:670, sat_reading_75:760, sat_math_25:730, sat_math_75:800, act_25:32, act_75:35, gpa_avg:4.07, ielts_min:6.5, deadlines:{ ea:'2024-10-15', rd:'2025-01-05' }, requirements:{ essay:true, supplement:'Short answers', recs:'1 counselor', interview:'Not offered', fee:75 }, whyFit:'Top-5 public engineering university. Strong ties to Delta, Coca-Cola, and Atlanta\'s tech scene.', keyAction:'Apply Early Action — it significantly improves admission odds. Highlight technical projects.', aidNote:'Limited aid for international students. In-state tuition available for select programs.' },
  { id:'umich', name:'University of Michigan', emoji:'💛', city:'Ann Arbor', state:'MI', type:'Public', acceptance_rate:0.178, sat_reading_25:680, sat_reading_75:760, sat_math_25:700, sat_math_75:790, act_25:32, act_75:35, gpa_avg:3.88, ielts_min:6.5, deadlines:{ ea:'2024-11-01', rd:'2025-02-01' }, requirements:{ essay:true, supplement:'Why Michigan essay', recs:'1 counselor', interview:'Not offered', fee:75 }, whyFit:'Top-10 in most majors. Ross Business School and CSE are nationally ranked powerhouses.', keyAction:'Write a specific "Why Michigan" essay referencing programs, professors, or opportunities.', aidNote:'Very limited merit aid for international students. Mostly need-based for domestic.' },
];

// Helper: get universities from JSON file (production) or embedded data (fallback)
async function getUniversities() {
  try {
    const res = await fetch('../data/universities_complete.json');
    if (res.ok) return res.json();
  } catch {}
  return UNIVERSITIES;
}
