#!/usr/bin/env python3
"""feeds/github_lists.py: import postings from community GitHub internship lists.

Handles both README layouts in the wild: HTML <table> rows (SimplifyJobs) and
markdown pipe tables (vanshb03, speedyapply). Closed rows (🔒) are dropped.
Edit SOURCES to point at the lists for your cycle; the repos rename every year.

    python3 feeds/github_lists.py
"""
import re
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "lib"))
import leeway  # noqa: E402
from filters import Filter  # noqa: E402
from url_gate import is_reachable  # noqa: E402

SOURCES = [
    ("simplify_summer2027", "https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/README.md"),
    ("vanshb03_summer2027", "https://raw.githubusercontent.com/vanshb03/Summer2027-Internships/dev/README.md"),
    ("speedyapply_2027_swe", "https://raw.githubusercontent.com/speedyapply/2027-SWE-College-Jobs/main/README.md"),
]
UA = {"User-Agent": "Mozilla/5.0 (leeway-apply list reader)"}


def strip(t):
    t = re.sub(r"<[^>]+>|\*\*", " ", t or "")
    return re.sub(r"\s+", " ", t).replace("&amp;", "&").strip(" 🔥")


def clean_url(u):
    u = re.sub(r"[&?](utm_source|ref)=[^&]*", "", u)
    return u.rstrip(")").rstrip("&?")


def pick_url(cell):
    hrefs = re.findall(r'href="(https?://[^"]+)"', cell) + re.findall(r"\]\((https?://[^)\s]+)\)", cell)
    real = [h for h in hrefs if "simplify.jobs" not in h and "imgur.com" not in h]
    return clean_url(real[0]) if real else None


def html_rows(text):
    last = ""
    for block in re.split(r"<tr[^>]*>", text):
        tds = re.findall(r"<td[^>]*>(.*?)</td>", block, re.S)
        if len(tds) < 4:
            continue
        company = strip(tds[0])
        if company in ("↳", ""):
            company = last  # "same company as the row above"
        last = company
        if "🔒" in block:
            continue
        url = pick_url(" ".join(tds[3:]))
        if url:
            yield company, strip(tds[1]), strip(tds[2]), url


def md_rows(text):
    last = ""
    for line in text.splitlines():
        if not line.startswith("|") or set(line.replace("|", "").strip()) <= set("-: "):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 4 or cells[0].lower() == "company":
            continue
        company = strip(cells[0])
        if company in ("↳", ""):
            company = last
        last = company
        if "🔒" in line:
            continue
        url = pick_url(" ".join(cells[3:]))
        if url:
            yield company, strip(cells[1]), strip(cells[2]), url


def main():
    flt = Filter()
    con = leeway.db()
    index = leeway.DedupIndex(con, include_postings=True)
    total = 0
    for name, src in SOURCES:
        try:
            req = urllib.request.Request(src, headers=UA)
            text = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "ignore")
        except Exception as e:
            print(f"[{name}] fetch failed: {e}")
            continue
        rows = list(html_rows(text)) or list(md_rows(text))
        added = 0
        for company, title, location, url in rows:
            if not title or not flt.relevant(title, location):
                continue
            ok, platform = is_reachable(url)
            if not ok:
                continue
            if leeway.insert_posting(con, url, title, company, platform, name,
                                     flt.priority(title), location, index=index):
                added += 1
        con.commit()
        print(f"[{name}] {len(rows)} open rows, {added} new queued")
        total += added
    con.execute("INSERT OR REPLACE INTO feed_state (feed_name, last_run, status) VALUES ('github_lists', ?, 'ok')",
                (leeway.now_iso(),))
    con.commit()
    print(f"Done. {total} new postings queued.")


if __name__ == "__main__":
    main()
