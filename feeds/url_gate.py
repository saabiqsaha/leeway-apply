"""URL pre-filter. is_reachable(url) decides whether a posting can enter the queue.

Conservative: only rejects URLs the agent certainly cannot submit as a guest.
"""
from urllib.parse import urlparse

PLATFORMS = [
    ("ashbyhq.com", "ashby"),
    ("lever.co", "lever"),
    ("greenhouse.io", "greenhouse"),
    ("myworkdayjobs.com", "workday"),
    ("myworkdaysite.com", "workday"),
    ("smartrecruiters.com", "smartrecruiters"),
    ("workable.com", "workable"),
    ("jobvite.com", "jobvite"),
    ("icims.com", "icims"),
    ("rippling.com", "rippling"),
    ("gusto.com", "gusto"),
    ("pinpointhq.com", "pinpoint"),
    ("breezy.hr", "breezy"),
    ("bamboohr.com", "bamboohr"),
    ("applytojob.com", "jazzhr"),
    ("oraclecloud.com", "oracle_hcm"),
]

# Account-walled portals: no guest apply, so the agent cannot finish them alone.
ACCOUNT_REQUIRED = {
    # Workday and Oracle HCM make you create a per-company account before applying.
    # The agent never creates accounts, so these never enter the queue. Apply by hand
    # (docs/ats-recipes/workday.md, oracle-hcm.md) or delete these lines if you will
    # keep tenant accounts signed in inside .chrome-profile/.
    "myworkdayjobs.com",
    "myworkdaysite.com",
    "oraclecloud.com",
    "amazon.jobs",
    "tal.net",
    "careers.microsoft.com",
    "jobs.apple.com",
    "www.metacareers.com",
}

SKIP_ALWAYS = {
    "linkedin.com",  # Easy Apply: near-zero conversion, and automating it risks the account
}


def _host(url):
    try:
        return (urlparse(url).hostname or "").lower()
    except Exception:
        return ""


def platform_for(url):
    host = _host(url)
    if "gh_jid=" in (url or "").lower():
        return "greenhouse"
    for domain, name in PLATFORMS:
        if host == domain or host.endswith("." + domain):
            return name
    return "company_site"


def is_reachable(url):
    """(True, reason) if the URL should enter the queue, else (False, reason)."""
    host = _host(url)
    if not host:
        return (False, "no_host")
    for domain in SKIP_ALWAYS:
        if host == domain or host.endswith("." + domain):
            return (False, f"skip:{domain}")
    for domain in ACCOUNT_REQUIRED:
        if host == domain or host.endswith("." + domain):
            return (False, f"account_required:{domain}")
    return (True, platform_for(url))
