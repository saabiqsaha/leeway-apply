# Sourcing, screening and dedup

Driving forms is rarely the bottleneck. Supply of live, fitting postings is, followed by not wasting tabs on postings you should never open, followed by never applying twice.

## Board APIs beat scraped feeds

- Aggregator and scraped-feed links are mostly dead or account-walled (in one audit, roughly 70% of aggregator links were dead). Harvest live postings straight from the ATS board APIs:
  - Greenhouse: `https://boards-api.greenhouse.io/v1/boards/<board>/jobs` (add `?content=true` for bodies); one job with questions: `.../jobs/<id>?questions=true`.
  - Ashby: `https://api.ashbyhq.com/posting-api/job-board/<org>?includeCompensation=true`.
  - Lever: `https://api.lever.co/v0/postings/<company>?mode=json`.
  - SmartRecruiters: `https://api.smartrecruiters.com/v1/companies/<Company>/postings`.
  - Workable public search: `jobs.workable.com/api/v1/jobs`, paged with `pageToken`.
- Seed new board tokens from the URLs already in your database: every Greenhouse, Ashby or Lever URL you have ever seen names a board worth sweeping.
- Community GitHub internship lists (SimplifyJobs and similar README tables) are a good second source. Normalize their links and screen them like anything else.
- Late in a cycle, even a sweep of 100k+ board postings can yield only dozens of fresh, fitting roles. Re-sweep every few days rather than burning hours on scraps.

## Throttle, or lose the API

An unthrottled discovery sweep (thousands of guessed Greenhouse slugs) got one machine's IP blocked: `boards-api.greenhouse.io` returned 403 and `job-boards.greenhouse.io` returned 406 to scripts, which killed question pre-screening mid-session.

- Cap Greenhouse at about 2 requests per second, and keep every other board API similarly polite.
- Back off on the first 403, 406 or 429, and stop entirely after a few more.
- Never run bulk slug probing during a live apply session. Run it hours before.
- If the API is blocked, read questions in the browser instead (the Greenhouse helper's plan function, or page text).

## Liveness

Ashby and Lever are SPAs that render "Job not found" client side, so an HTML fetch returns 200 with a full body for dead postings. Verify against the board API and match the posting id. A 404 from the board API means dead, not unknown. Defaulting unknowns to alive wastes attempts.

## Screen before opening a tab

Opening tabs speculatively is the slowest part of the loop. Screen in this order:

1. **Hard-eligibility screen on the JD body**, using the rules in `profile/answers.md` (for example ITAR or export control, US Person or citizenship, clearance, transcript required, explicit no-sponsorship, PhD-only, non-US location, wrong term).
2. **The questions API** (Greenhouse `?questions=true`) to catch transcript or clearance questions for free.
3. **Then open the tab**, and still check the rendered form: Ashby and SmartRecruiters often hide knockouts in the application questions.

Two ways the screen itself goes wrong:

- A grad-only regex like `pursuing[^.]{0,45}(master|phd)` matches "pursuing a **Bachelor's or Master's**" and wrongly rejects good postings. Require that no "bachelor" appears between "pursuing" and "master".
- Feed titles lie. Postings labelled internships in feeds turn out to be full-time senior reqs or past-cycle terms. Confirm on the posting itself.

## Dedup: never apply twice

A duplicate application looks careless to the employer. URL equality is not enough. Check all of these before opening a form:

1. **Normalized URL keys.**
   - Greenhouse: key by the numeric job id alone, `gh:<id>`. One req appears under many shapes: `boards.greenhouse.io/<org>/jobs/<id>`, `job-boards.greenhouse.io/<org>/jobs/<id>`, `/embed/job_app?for=&token=<id>`, `?gh_jid=<id>` on a company site.
   - Ashby and Lever: key by posting UUID.
   - Any URL: extract long numeric req ids (7+ digits) and match on those too, because the same job appears under wrappers that share no other substring.
2. **Fuzzy (company, role) token-set match.** One req can carry several ATS UUIDs (three different Lever UUIDs for one intern req has happened), and feeds disagree on titles. Normalize: lowercase, fold synonyms (engineering, developer, development become engineer), strip stopwords (intern, internship, summer, year, program, the term), then treat one token set being a subset of the other as a match.
3. **Board slug or host path.** Company fields are inconsistent (a role title stored as the company, or a long legal name versus a short board slug). Also match the board path (`jobs.ashbyhq.com/<org>`, `job-boards.greenhouse.io/<board>`, `jobs.lever.co/<company>`) against every URL in the event log.
4. **Frozen resume folders.** If a tailored resume folder for this role already exists, a prior application exists. Never overwrite it.

Some boards also enforce their own limits (an Ashby board rejecting at submit with "5 roles per 90 days"). Log those as `rate_limited_by_employer` and move on.

## One shot per role

Give each posting one attempt. On failure, log the outcome with a short reason and move to the next. Volume is the strategy: sessions that debug one widget for 20 minutes produce fewer applications than sessions that log and keep moving.
