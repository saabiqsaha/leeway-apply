"""Shared helpers for leeway-apply: paths, profile, database, dedup, event log.

Everything personal lives in profile/ (gitignored). Everything stateful lives in
data/ (gitignored). This module is the only place that knows where they are.
"""
import json
import os
import re
import sqlite3
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

REPO = Path(__file__).resolve().parent.parent
PROFILE_DIR = Path(os.environ.get("LEEWAY_PROFILE_DIR", REPO / "profile"))
DATA_DIR = Path(os.environ.get("LEEWAY_DATA_DIR", REPO / "data"))
DB_PATH = DATA_DIR / "leeway.db"
EVENT_LOG = DATA_DIR / "event_log.jsonl"

SCHEMA = """
CREATE TABLE IF NOT EXISTS postings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    url         TEXT UNIQUE NOT NULL,
    title       TEXT,
    company     TEXT,
    location    TEXT,
    platform    TEXT,
    source      TEXT,
    category    TEXT DEFAULT 'internship',
    priority    INTEGER DEFAULT 0,
    status      TEXT DEFAULT 'new',
    first_seen  TEXT,
    last_seen   TEXT
);
CREATE TABLE IF NOT EXISTS apply_queue (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    posting_id   INTEGER UNIQUE REFERENCES postings(id),
    added_at     TEXT,
    claimed_by   TEXT,
    claimed_at   TEXT,
    completed_at TEXT,
    outcome      TEXT,
    notes        TEXT
);
CREATE TABLE IF NOT EXISTS applications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    company     TEXT,
    role        TEXT,
    url         TEXT UNIQUE,
    platform    TEXT,
    resume_used TEXT,
    cycle       TEXT,
    status      TEXT DEFAULT 'applied',
    applied_at  TEXT,
    notes       TEXT
);
CREATE TABLE IF NOT EXISTS feed_state (
    feed_name TEXT PRIMARY KEY,
    last_run  TEXT,
    status    TEXT DEFAULT 'ok'
);
CREATE INDEX IF NOT EXISTS idx_postings_status ON postings(status);
CREATE INDEX IF NOT EXISTS idx_queue_claim ON apply_queue(claimed_by, completed_at);
"""

# Terminal posting statuses. Anything not 'new' is never claimed again
# (one shot per role: a failed attempt is logged, not retried).
OUTCOME_TO_STATUS = {
    "applied": "applied",
    "assessment_pending": "applied",
}


def env(key, default=None):
    """Environment first, then .env in the repo root, then default."""
    if os.environ.get(key):
        return os.environ[key]
    f = REPO / ".env"
    if f.exists():
        for line in f.read_text().splitlines():
            k, _, v = line.partition("=")
            if k.strip() == key and not k.strip().startswith("#"):
                return v.strip()
    return default


def add_missing_fact(company, question):
    """Queue a question only the applicant can answer (profile/missing_facts.md)."""
    f = PROFILE_DIR / "missing_facts.md"
    if not f.exists():
        f.write_text("# missing_facts.md: questions only you can answer\n\n## Open\n")
    line = f'- [ ] ({now_iso()[:10]}) {company}: "{question.strip()}"'
    existing = f.read_text()
    if f'{company}: "{question.strip()}"' not in existing:
        with open(f, "a") as fh:
            fh.write(("" if existing.endswith("\n") else "\n") + line + "\n")


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------
def load_profile(required=True):
    path = PROFILE_DIR / "profile.json"
    if not path.exists():
        if required:
            raise SystemExit(
                f"No profile at {path}. Run bin/setup, then fill in profile/profile.json."
            )
        return {}
    data = json.loads(path.read_text())
    return _strip_help(data)


def _strip_help(obj):
    if isinstance(obj, dict):
        return {k: _strip_help(v) for k, v in obj.items() if not k.startswith("_")}
    if isinstance(obj, list):
        return [_strip_help(v) for v in obj]
    return obj


def resume_path(profile=None):
    profile = profile or load_profile()
    rel = profile.get("resume", {}).get("pdf", "profile/resume.pdf")
    p = Path(rel)
    return p if p.is_absolute() else REPO / p


def do_not_apply(profile=None):
    """Company names (lowercase substrings) the agent must never auto-apply to."""
    names = set()
    f = PROFILE_DIR / "do_not_apply.txt"
    if f.exists():
        for line in f.read_text().splitlines():
            line = line.split("#", 1)[0].strip().lower()
            if line:
                names.add(line)
    return names


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
def db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH, timeout=30)
    con.row_factory = sqlite3.Row
    con.executescript(SCHEMA)
    return con


def insert_posting(con, url, title, company, platform, source, priority=0,
                   location="", category="internship", index=None):
    """Insert a posting and queue it. Returns True if it was new.

    Skips anything whose req id / ATS UUID or company+title already exists, because
    one req is routinely listed under several URLs (company site, ATS embed, aggregator).
    Pass a DedupIndex when inserting in bulk; it is built once and kept current.
    """
    url = (url or "").strip()
    if not url:
        return False
    if con.execute("SELECT 1 FROM postings WHERE url=?", (url,)).fetchone():
        con.execute("UPDATE postings SET last_seen=? WHERE url=?", (now_iso(), url))
        return False
    index = index or DedupIndex(con, include_postings=True)
    if index.reason(url, company, title):
        return False
    ts = now_iso()
    cur = con.execute(
        "INSERT OR IGNORE INTO postings (url,title,company,location,platform,source,category,"
        "priority,status,first_seen,last_seen) VALUES (?,?,?,?,?,?,?,?,'new',?,?)",
        (url, (title or "")[:200], (company or "")[:100], (location or "")[:200],
         platform, source, category, priority, ts, ts),
    )
    if not cur.rowcount:
        return False
    con.execute("INSERT OR IGNORE INTO apply_queue (posting_id, added_at) VALUES (?,?)",
                (cur.lastrowid, ts))
    index.add(url, company, title)
    return True


# ---------------------------------------------------------------------------
# Dedup
# ---------------------------------------------------------------------------
REQ_ID = re.compile(r"(\d{7,})")
UUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.I)


def req_ids(url):
    """Stable ids embedded in a job URL: numeric req ids and ATS UUIDs."""
    url = url or ""
    return set(REQ_ID.findall(url)) | {u.lower() for u in UUID.findall(url)}


def norm_company(name):
    n = (name or "").lower()
    n = re.sub(r"\b(inc|llc|ltd|corp|corporation|co|company|technologies|labs|hq)\b\.?", "", n)
    return re.sub(r"[^a-z0-9]", "", n)


def norm_title(title):
    t = (title or "").lower()
    t = re.sub(r"\b(summer|fall|spring|winter)\b|\b20\d\d\b|[-–()|,/]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


class DedupIndex:
    """In-memory view of everything already applied to (and optionally already queued)."""

    def __init__(self, con, include_postings=False):
        self.urls, self.ids, self.pairs = set(), set(), set()
        rows = list(con.execute("SELECT url, company, role FROM applications"))
        if include_postings:
            rows += list(con.execute("SELECT url, company, title FROM postings"))
        for url, company, title in rows:
            self.add(url, company, title)

    def add(self, url, company, title):
        self.urls.add(url)
        self.ids |= req_ids(url)
        nc, nt = norm_company(company), norm_title(title)
        if nc and nt:
            self.pairs.add((nc, nt))

    def reason(self, url, company, title):
        if url in self.urls:
            return "duplicate:url"
        if req_ids(url) & self.ids:
            return "duplicate:req_id"
        nc, nt = norm_company(company), norm_title(title)
        if nc and nt and (nc, nt) in self.pairs:
            return "duplicate:company_role"
        return None


def duplicate_reason(con, url, company, title):
    """Reason string if this posting duplicates a past application, else None."""
    return DedupIndex(con).reason(url, company, title)


def company_application_count(con, company, cycle=None):
    nc = norm_company(company)
    if not nc:
        return 0
    n = 0
    sql = "SELECT company FROM applications"
    args = ()
    if cycle:
        sql += " WHERE cycle=?"
        args = (cycle,)
    for (c,) in con.execute(sql, args):
        if norm_company(c) == nc:
            n += 1
    return n


# ---------------------------------------------------------------------------
# Event log
# ---------------------------------------------------------------------------
def append_event(event):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    event = {"ts": now_iso(), **event}
    with open(EVENT_LOG, "a") as f:
        f.write(json.dumps(event, separators=(",", ":")) + "\n")
    return event


# ---------------------------------------------------------------------------
# Short links
# ---------------------------------------------------------------------------
# Community lists often wrap apply links in redirectors, which hides the req id
# and the platform. bin/next resolves these at claim time (one request per claim).
SHORTENERS = {"go.vansh.nyc", "bit.ly", "tinyurl.com", "lnkd.in", "t.co", "rebrand.ly",
              "cutt.ly", "shorturl.at", "tiny.cc", "ow.ly", "buff.ly"}


def is_short_link(url):
    host = (urlparse(url or "").hostname or "").lower()
    return host in SHORTENERS


def resolve_url(url, timeout=12):
    """Follow redirects and return the final URL (or the input on failure)."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            final = r.geturl()
    except Exception:
        return url
    return re.sub(r"[&?](utm_[a-z]+|ref|source)=[^&]*", "", final)
