# answers.md: your words, for the fields profile.json can't hold

The agent reads this before every application. It copies these lines, it does not
invent new ones. If a form asks something that is not here or in profile.json,
the agent leaves an optional field blank, or skips the posting and logs
`skipped:missing_fact` so you can add the fact here.

Write in your own voice. Short and specific beats long and polished.

## One-line pitch (used in "tell us about yourself", "anything else")

> I'm a CS student at Example State who builds backend systems. Last summer I
> shipped a caching layer that cut API latency 40% for a 3-person team.

## "Why this company?" template

Swap only the bracketed part. Keep it under ~450 characters.

> I want to work on [one specific thing the company does, from the job post].
> I've been building [your closest real project], and I'd like to learn how
> [company] does it at scale.

## Cover letter (only when a form requires one)

> Paste a short, real cover letter here. 150 to 250 words. The agent swaps the
> company name and the one line about what the company does.

## Projects the agent may mention

- **Project name**: one sentence on what it does, one real number. Link if public.
- **Project name**: ...

## Facts forms sometimes ask for

Add anything that forms keep asking that isn't in profile.json.

- High school: Example High School, graduated 2024
- SAT / ACT: (leave out if you'd rather not share)
- Relatives employed at the company: No
- Previously employed by the company: No
- Non-compete or conflicting agreements: No
- Outside work to disclose (shown when a form asks "describe the nature of any outside business"): leave blank if none

## Rules for the agent

- Never claim a skill, job, or number that isn't written in this folder.
- Never fill salary unless required. Then use profile.preferences.salary.
- Never complete an online assessment, coding challenge, or video interview. Log `assessment_pending`.
- If a form makes you attest that no AI was used to complete the application, stop and log `skipped:no_ai_attestation`. That one is for a human.
