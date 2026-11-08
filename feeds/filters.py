"""Title/location filters driven by profile.json "search". Shared by every feed."""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "lib"))
import leeway  # noqa: E402

NON_US = [
    "canada", "toronto", "vancouver", "montreal", "ontario", "london", "united kingdom",
    " uk", "uk ", "ireland", "dublin", "germany", "berlin", "munich", "france", "paris",
    "netherlands", "amsterdam", "poland", "warsaw", "serbia", "romania", "switzerland",
    "zurich", "israel", "tel aviv", "india", "bangalore", "bengaluru", "hyderabad",
    "singapore", "japan", "tokyo", "korea", "seoul", "china", "beijing", "shanghai",
    "shenzhen", "australia", "sydney", "brazil", "sao paulo", "mexico", "emea", "apac",
]

DEFAULT_SEARCH = {
    "level_keywords": ["intern", "internship", "co-op", "coop"],
    "role_keywords": ["software", "engineer", "developer", "data", "machine learning", "ml", "ai"],
    "exclude_keywords": ["senior", "staff", "principal", "director", "manager", "phd"],
    "boost_keywords": {},
    "us_only": True,
}


class Filter:
    def __init__(self, profile=None):
        profile = profile if profile is not None else leeway.load_profile(required=False)
        s = {**DEFAULT_SEARCH, **profile.get("search", {})}
        self.levels = [k.lower() for k in s["level_keywords"]]
        self.roles = [k.lower() for k in s["role_keywords"]]
        self.excludes = [k.lower() for k in s["exclude_keywords"]]
        self.boost = {k.lower(): int(v) for k, v in (s.get("boost_keywords") or {}).items()}
        self.us_only = bool(s.get("us_only", True))

    @staticmethod
    def _has(text, words):
        # Keyword must start at a word boundary and may only end in a common suffix,
        # so "intern" matches "Interns"/"Internship" but not "Internal", "ai" never
        # matches "maintenance", and "engineer" still matches "Engineering".
        for w in words:
            if re.search(r"(?<![a-z0-9])" + re.escape(w) + r"(s|es|ship|ships|ing|er|ers)?(?![a-z0-9])", text):
                return True
        return False

    def relevant(self, title, location=""):
        t = (title or "").lower()
        if not (self._has(t, self.levels) and self._has(t, self.roles)):
            return False
        if self._has(t, self.excludes):
            return False
        if self.us_only and location:
            loc = f" {location.lower()} "
            if any(k in loc for k in NON_US) and not any(
                k in loc for k in ("united states", " usa", " us,", ", us ", "remote - us", "us remote")
            ):
                return False
        return True

    def priority(self, title):
        t = (title or "").lower()
        return sum(v for k, v in self.boost.items() if self._has(t, [k]))
