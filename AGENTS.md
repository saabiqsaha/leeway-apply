# AGENTS.md: how to run leeway-apply

Read this fully before acting. Codex reads it automatically; Claude Code reads it via CLAUDE.md.
**New session? Start at `START.md`**: it boots you, picks the mode (onboarding, run, refill),
and sets the rules for reading and writing the brain. This file is the rulebook it points to.

## What this is

An autonomous internship application engine. Pollers fill a queue from live company job
boards. You (the agent) work the queue one posting at a time: claim it, open it in the
browser, fill the form truthfully from the owner's profile, submit, log, repeat.

The person who owns this checkout is "the applicant". Their facts live in `profile/`.
You never see them anywhere else, and you never invent them.

## The autonomy line

- **Job applications are reversible and cheap.** A wrong one costs nothing; one hit pays for
  hundreds of misses. Run them autonomously. Do not ask permission to apply. Do not pause
  for confirmation between postings.
- **Everything else is NOT yours to send.** Emails to recruiters, messages, referral asks,
  account creation, anything that speaks for the applicant outside an application form:
  draft it to `data/drafts/` and stop. A human sends it.
- When unsure which side something is on, it is not yours to send.

## Source of truth

- `profile/profile.json`: structured facts (identity, school, work authorization, EEO, links, search filters).
- `profile/answers.md`: the applicant's own words for free-text fields, cover letters, extra facts.
- `profile/do_not_apply.txt`: companies to never auto-apply to (warm intros, manual applies). `bin/next` enforces it.
- `profile/resume.pdf` (or `resume.pdf` path in profile.json): the resume for every application.
- `data/leeway.db`: queue, postings, applications. `data/event_log.jsonl`: append-only history.

**Never type a fact into a form that is not in `profile/`.** If a required field needs a fact
that is missing, do not guess: log `skipped:missing_fact` with the question text in the note,
so the applicant can add it. Optional fields with no known answer stay blank.

## The loop

Run until you hit your batch size or `bin/next` says the queue is empty.

1. **Claim.** `bin/next <your_agent_name>` prints the next posting as JSON (`aq_id`, `url`,
   `title`, `company`, `platform`, `resume`). It has already enforced dedup (URL, req id, ATS
   UUID, company+title), the do-not-apply list, and the per-company cap. Exit code 3 means empty.
2. **Pre-screen** before opening a tab when the platform has a public API (see
   `docs/ats-recipes/sourcing-and-dedup.md`). Read the job description for disqualifiers.
3. **Open and read the form.** Read `docs/ats-recipes/<platform>.md` before your first form on
   each platform this session. Check for hard disqualifiers (below). If one hits, log and move on.
4. **Fill.** Values from `profile/`. Resume upload first on most platforms (the upload re-render
   can wipe fields). Free-text fields come from `profile/answers.md`, adapted only where the
   template says (company name, one line about what the company does).
5. **Verify, then submit.** Every required field has a committed value (read it back, do not
   trust what you typed). Submit with a real click.
6. **Confirm.** Applied means a confirmation page, a "thank you for applying" message, or a
   confirmation email. Anything less is not `applied`.
7. **Log immediately.** `bin/log <aq_id> <outcome> "<short note>"`. Then go to step 1.

Outcomes (`bin/log --help` for the full list): `applied`, `assessment_pending`, `closed`,
`ineligible:<reason>`, `skipped:<reason>`, `account_required`, `captcha_blocked`, `failed:<reason>`.

**One shot per role.** A posting that failed is logged and never retried. Do not circle back.
Use `release` only if a tool crashed before the form was ever opened.

## Hard disqualifiers (log `ineligible:<reason>`, do not submit)

Read these against `profile/profile.json` `work_auth` and `search`:

- Not an internship or co-op when `search.level_keywords` only lists internship terms (new grad, full-time, "Associate Engineer").
- The posting requires something the applicant does not have: US citizenship or security
  clearance (`work_auth.us_citizen`, `work_auth.security_clearance`), no sponsorship ever when
  `work_auth.requires_sponsorship` is true, "no CPT/OPT" when the applicant needs CPT/OPT.
- Outside the US when `search.us_only` is true.
- PhD or master's only, or 3+ years of professional experience required.
- Closed, "no longer accepting applications", or the apply button is disabled.
- A transcript upload is required and the applicant has not provided one in `profile/`.
- The form asks the applicant to attest that no AI was used to complete the application.
  Log `skipped:no_ai_attestation`. (Policies that only cover interviews are fine.)

NOT disqualifiers: "Will you require sponsorship in the future?" questions (answer truthfully
from profile and keep going), class-year words in the title, "must be enrolled in a degree program".

## Hard limits

- Never apply to the same posting twice. `bin/next` checks; if you add URLs by hand use `bin/add`.
- Never complete an online assessment, coding challenge, or video interview. Log `assessment_pending`.
- Never solve or bypass a CAPTCHA. If one blocks submit twice, log `captcha_blocked`.
- Never create an account. No guest apply means `account_required`.
- Never use LinkedIn Easy Apply.
- Salary: only if required, then `profile.preferences.salary`.
- One posting at a time, one foreground tab.

## The browser

- `bin/chrome` starts the ONE Chrome you drive: a dedicated persistent profile in
  `.chrome-profile/` with remote debugging on `CDP_PORT` (default 9333). Never use the
  applicant's personal Chrome profile, never launch a bare throwaway browser (captchas).
- The Playwright MCP server attaches to that Chrome over CDP (`--cdp-endpoint`), so MCP tools and
  the `bin/*.cjs` helpers see the same tabs.
- Drive each form yourself with the MCP tools (`browser_navigate`, `browser_snapshot`,
  `browser_click`, `browser_type`, `browser_select_option`, `browser_file_upload`,
  `browser_run_code` / `browser_evaluate`). If tooling fights you twice on one form, drive it raw
  or log `failed:<reason>` and move on. Do not write new automation mid-session.
- Platform helpers (attach over CDP, all verify what they set):
  - `bin/gh-boot`: builds `.cache/gh_boot.js`, the Greenhouse universal filler. See `docs/ats-recipes/greenhouse.md`.
  - `bin/drv.cjs scan|apply <url>`: list a form's real questions, then fill an explicit answer map and verify.
  - `bin/fill.cjs`: question-keyed filler for React forms whose element refs rotate (Ashby).
  - `bin/resume.cjs <url>`: upload the resume to every file input and report what stuck.
  - `bin/required.cjs`, `bin/qprobe.cjs`: find unfilled required fields / probe questions.
  - `bin/datefield.cjs`, `bin/autocomplete.cjs`, `bin/aclocation.cjs`, `bin/ghlocation.cjs`,
    `bin/comboopts.cjs`, `bin/groups.cjs`, `bin/radiogroup.cjs`, `bin/orderedradios.cjs`,
    `bin/checkboxes.cjs`, `bin/cbgroups.cjs`, `bin/locsubmit.cjs`, `bin/hardsubmit.cjs`:
    single-purpose fixes for the control types named. Read the header comment before using one.

## Writing in forms

- Copy the applicant's lines from `profile/answers.md`. Do not paraphrase them into your own words.
- No em dashes in anything you type into a form. They read as machine-written. Use periods, commas, colons.
- If a field allows 500 characters, use roughly 350 to 480. Lead with the most impressive true thing.
- Never claim a skill, employer, number, or project that is not in `profile/`.

## Coordination

Several agents can run at once (`bin/run-loop` in two terminals, or Codex plus Claude). They
coordinate only through `data/leeway.db`: `bin/next` claims atomically, so two agents never
get the same row. Claims older than 3 hours with no outcome are released automatically.
