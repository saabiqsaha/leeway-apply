#!/usr/bin/env python3
"""feeds/ats_poller.py: sweep public Greenhouse, Ashby, and Lever job-board APIs.

These are the same JSON endpoints the companies' own career pages use. No login.
Board APIs return only live postings, which is why this beats scraped aggregator
links (most of those are dead by the time you open them).

    python3 feeds/ats_poller.py                 # full sweep of feeds/company_slugs.json
    python3 feeds/ats_poller.py --only ashby    # one platform
    python3 feeds/ats_poller.py --limit 50      # first 50 slugs per platform (smoke test)

Politeness: each platform is swept in its own thread at ~2 requests/second, and a
platform stops for this run on its first 403/429. Hammering Greenhouse with
thousands of rapid requests gets your IP blocked for hours.
"""
import argparse
import fcntl
import json
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "lib"))
import leeway  # noqa: E402
from filters import Filter  # noqa: E402

SLUGS_FILE = HERE / "company_slugs.json"
HEALTH_FILE = leeway.DATA_DIR / "slug_health.json"
UA = {"User-Agent": "Mozilla/5.0 (leeway-apply job board reader)"}
TIMEOUT = 15
DELAY = 0.5
MAX_FAILURES = 3
DEAD_RECHECK_HOURS = 168


class Blocked(Exception):
    pass


def get_json(url):
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return json.loads(r.read().decode("utf-8", "ignore"))
    except urllib.error.HTTPError as e:
        if e.code in (403, 406, 429):
            raise Blocked(e.code)
        if e.code == 404:
            return None
        raise


def fetch_greenhouse(slug):
    data = get_json(f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs")
    if data is None:
        return None
    return [(j.get("title", ""), j.get("absolute_url", ""), (j.get("location") or {}).get("name", ""))
            for j in data.get("jobs", [])]


def fetch_ashby(slug):
    data = get_json(f"https://api.ashbyhq.com/posting-api/job-board/{slug}")
    if data is None:
        return None
    return [(j.get("title", ""), j.get("jobUrl", ""), j.get("location", "") or "")
            for j in data.get("jobs", []) if j.get("isListed", True)]


def fetch_lever(slug):
    data = get_json(f"https://api.lever.co/v0/postings/{slug}?mode=json")
    if data is None:
        return None
    return [(j.get("text", ""), j.get("hostedUrl", ""), (j.get("categories") or {}).get("location", ""))
            for j in data]


FETCHERS = {"greenhouse": fetch_greenhouse, "ashby": fetch_ashby, "lever": fetch_lever}


def alive(health, key):
    e = health.get(key)
    if not e or e.get("failures", 0) < MAX_FAILURES:
        return True
    try:
        last = datetime.fromisoformat(e["checked"].replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - last).total_seconds() / 3600 >= DEAD_RECHECK_HOURS
    except Exception:
        return True


def sweep(platform, slugs):
    fn, results = FETCHERS[platform], []
    for slug in slugs:
        try:
            jobs = fn(slug)
            results.append((slug, jobs, jobs is not None))
        except Blocked as b:
            print(f"[{platform}] HTTP {b} on {slug}: backing off for the rest of this run")
            break
        except Exception as e:
            print(f"[{platform}/{slug}] {type(e).__name__}: {e}")
            results.append((slug, [], True))  # transient, not dead
        time.sleep(DELAY)
    return platform, results


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=list(FETCHERS))
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    leeway.DATA_DIR.mkdir(parents=True, exist_ok=True)
    lock = open(leeway.DATA_DIR / "ats_poller.lock", "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        print("previous ats_poller run still active, skipping")
        return

    slugs = json.loads(SLUGS_FILE.read_text())
    health = json.loads(HEALTH_FILE.read_text()) if HEALTH_FILE.exists() else {}
    flt = Filter()
    con = leeway.db()
    index = leeway.DedupIndex(con, include_postings=True)

    plans = []
    for platform in FETCHERS:
        if args.only and platform != args.only:
            continue
        todo = [s for s in slugs.get(platform, []) if alive(health, f"{platform}/{s}")]
        if args.limit:
            todo = todo[: args.limit]
        print(f"[{platform}] {len(todo)} boards")
        plans.append((platform, todo))

    with ThreadPoolExecutor(max_workers=max(1, len(plans))) as pool:
        swept = list(pool.map(lambda p: sweep(*p), plans))

    added = 0
    now = leeway.now_iso()
    for platform, results in swept:
        for slug, jobs, ok in results:
            key = f"{platform}/{slug}"
            e = health.get(key, {"failures": 0})
            e["checked"] = now
            e["failures"] = 0 if ok else e.get("failures", 0) + 1
            health[key] = e
            for title, url, location in jobs or []:
                if not url or not flt.relevant(title, location):
                    continue
                if leeway.insert_posting(con, url, title, slug, platform, f"ats_{platform}",
                                         flt.priority(title), location, index=index):
                    added += 1
                    print(f"  + {slug}: {title} ({location})")
    con.execute("INSERT OR REPLACE INTO feed_state (feed_name, last_run, status) VALUES ('ats_poller', ?, 'ok')", (now,))
    con.commit()
    HEALTH_FILE.write_text(json.dumps(health, indent=1))
    dead = sum(1 for v in health.values() if v.get("failures", 0) >= MAX_FAILURES)
    print(f"Done. {added} new postings queued. {dead} boards marked dead (rechecked weekly).")


if __name__ == "__main__":
    main()
