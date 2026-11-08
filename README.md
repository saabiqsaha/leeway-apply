# leeway-apply

An autonomous internship application engine. It finds live postings straight from company
job boards, then a coding agent (Codex, or Claude Code) drives a real Chrome and submits the
applications for you, one form at a time, from facts you wrote down once.

```
feeds/poll  ──►  data/leeway.db (queue)  ──►  bin/run-loop (Codex + Playwright)  ──►  submitted
 Greenhouse, Ashby, Lever        dedup, do-not-apply,          fills forms from profile/,
 board APIs + GitHub lists       per-company cap               verifies, logs every outcome
```

Everything personal lives in `profile/`, which is gitignored. Nothing about you is ever committed.

## What you need

- macOS or Linux, Python 3.9+, Node 18+, Google Chrome
- [Codex CLI](https://github.com/openai/codex) (`npm i -g @openai/codex`), logged in. Claude Code works too.

## Setup (about 10 minutes)

```bash
git clone <this repo> leeway-apply && cd leeway-apply
bin/setup
```

`bin/setup` installs playwright-core into `.tools/`, creates `profile/` from `profile.example/`,
creates the database, and registers the Playwright MCP server with Codex.

Then fill in your profile. **Every value is typed into real applications, so it must be true.**

| File | What goes in it |
|---|---|
| `profile/profile.json` | Name, contact, school, GPA, grad date, work authorization, EEO answers, links, what roles to search for |
| `profile/answers.md` | Your own words: pitch, "why this company" template, cover letter, projects, odd facts forms ask for |
| `profile/do_not_apply.txt` | Companies to never auto-apply to (referrals, warm intros, ones you applied to by hand) |
| `profile/resume.pdf` | Your resume |

## Run it

```bash
bin/chrome          # start the dedicated browser (its own profile in .chrome-profile/)
feeds/poll          # fill the queue. First run sweeps ~1,700 boards, ~15 min
bin/status          # what's queued, what's applied
bin/run-loop 10     # Codex applies, 10 per session, relaunching until the queue is empty
```

Watch the Chrome window. The first few runs, read what it typed. If an answer is wrong, the
fix is almost always a missing or vague fact in `profile/`.

Keep the queue fresh with a cron entry (hourly is plenty):

```
0 * * * * cd /path/to/leeway-apply && feeds/poll >> data/poll.log 2>&1
```

### With Claude Code instead

`.mcp.json` already points Playwright MCP at the same Chrome. Open the repo in Claude Code and run
`/apply 10`.

### Add a posting you found yourself

```bash
bin/add "https://job-boards.greenhouse.io/acme/jobs/1234567" "Acme" "Software Engineer Intern"
```

It goes to the front of the queue.

## How it decides

- **Sourcing.** `feeds/ats_poller.py` reads public Greenhouse, Ashby, and Lever board APIs for the
  companies in `feeds/company_slugs.json` (add your own). Board APIs only list live postings,
  which is why they beat aggregator links. `feeds/github_lists.py` imports the community
  internship lists (SimplifyJobs and friends); edit `SOURCES` each cycle as the repos rename.
- **Filtering.** `profile.json` → `search`: a title must contain a level keyword (intern, co-op)
  and a role keyword, and no exclude keyword. `us_only` drops non-US locations.
- **Dedup.** One req shows up under many URLs. `bin/next` checks URL, numeric req id, ATS UUID,
  and normalized company+title against everything you have applied to.
- **Guardrails.** `AGENTS.md` is the agent's rulebook: never invent a fact, never take an
  assessment, never solve a captcha, never create an account, one shot per role, log everything.
- **Platform know-how.** `docs/ats-recipes/` holds tested techniques for each ATS
  (Greenhouse comboboxes, Ashby toggles, Workday dropdowns, Lever consent boxes, and more).
  The agent reads the matching recipe before its first form on a platform.

## Where things live

```
AGENTS.md            the agent's rulebook (Codex reads it automatically)
profile.example/     templates; bin/setup copies them to profile/ (gitignored)
bin/                 setup, chrome, next, log, status, add, run-loop, form helpers (*.cjs)
feeds/               pollers, filters, company slug list
lib/                 shared Python and Node helpers
docs/ats-recipes/    per-platform form techniques
data/                database, event log, poller state (gitignored)
```

Query anything directly: `sqlite3 data/leeway.db "SELECT company, role, applied_at FROM applications ORDER BY applied_at DESC LIMIT 20"`.

## Ground rules

- It applies under your name. Read what it submits for the first day, and keep `profile/` honest.
- Some companies forbid AI-assisted applications. The agent skips any form that makes you attest
  otherwise, but it is on you to respect each company's terms.
- Use your own accounts and machine. Do not share your `profile/`, `.env`, `data/`, or `.chrome-profile/`.
