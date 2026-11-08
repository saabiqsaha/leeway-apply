# ATS recipes

Field notes for an agent (Codex or Claude) driving job application forms in a browser. Each file is what actually worked on a platform, plus the traps that silently cost a submit. Read `browser-driving.md` and `form-answer-traps.md` first, then the file for the platform you are on.

Personal values never appear here. Anything you type into a form comes from `profile/profile.json` and `profile/answers.md`.

| File | What it covers |
|---|---|
| [browser-driving.md](browser-driving.md) | Ground rules, choosing a driver (Playwright MCP, Claude in Chrome, CDP runner, opencli), geometry and viewport scaling, event types per platform, resume uploads |
| [form-answer-traps.md](form-answer-traps.md) | Label-regex traps, committed versus displayed values, parsers and stale profiles, AI attestations |
| [sourcing-and-dedup.md](sourcing-and-dedup.md) | Board APIs, throttling, liveness checks, pre-screening, dedup keys, one shot per role |
| [captcha-lanes.md](captcha-lanes.md) | Which hosts raise captchas in the automation Chrome versus the user's Chrome; never solve one |
| [greenhouse.md](greenhouse.md) | Embed URLs, JS boot and queue filler, react-select fixes, Return-submits trap, security code flow and rate limit |
| [ashby.md](ashby.md) | Trusted events only, Yes/No toggle commit, date pickers, field order, spam flag pacing |
| [lever.md](lever.md) | Lever and Gem: upload order, hidden `selectedLocation`, consent twin, submit via focus plus Enter |
| [workday.md](workday.md) | Free-text prompts commit with Enter, fixed dropdown offsets, id selectors |
| [smartrecruiters.md](smartrecruiters.md) | Shadow DOM `spl-*` components in Playwright and in real Chrome, resume to the last file input, screening page |
| [workable.md](workable.md) | Native setters, second file input, `data-ui=apply-button`, Workable job board |
| [rippling.md](rippling.md) | `field-N` ids, role=radio clicks, combobox chain, Places location, footer Apply |
| [gusto.md](gusto.md) | `job_applicant_*` ids, two round trips, read the JD in-tab |
| [pinpoint.md](pinpoint.md) | Guest apply, react-select real clicks, consent cleared on validation errors |
| [clearcompany.md](clearcompany.md) | New-tab guest flow, tenant-specific pages, MM/DD/YYYY dates, ask for missing facts |
| [oracle-hcm.md](oracle-hcm.md) | Sign-in portal with stale saved profile, dialogs, comboboxes |
| [ibm-tiktok.md](ibm-tiktok.md) | IBM Avature hidden dependent questions and stale profile; TikTok limits and final CAPTCHA |
| [other-platforms.md](other-platforms.md) | Jobvite, Eightfold, Phenom, Meta, Breezy, Recruitee, iCIMS, Dover, API-screen postings, account walls |
