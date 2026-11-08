# Other platforms

Shorter notes on platforms seen less often. Captcha behaviour for each is summarized in `captcha-lanes.md`.

## Jobvite

Hosts: `jobs.jobvite.com/<company>/job/<id>/apply` (new UI, ids `jv-field-*`) and older guest flows.

- Consent page first: pick the only "All Locations (English)" option in `#jv-country-select` (native setter plus `change`) and click Submit.
- The resume input (`input[type=file]#file-input-0`) is hidden behind an "Add Resume > Select" menu. Make it visible, `find` it, `file_upload`. In Playwright, upload, wait a few seconds for the parser to finish wiping fields, then fill.
- Text inputs and native selects accept native setters plus `input`/`change` (selects via value plus `change`).
- Custom radios and checkboxes: click the box itself on the option row (read coordinates after scrolling the row into view).
- Multi-page: contact, then an EEO self-ID page with name and date signature blocks, then questions (enrollment, graduation, authorization, sponsorship, sometimes a REQUIRED skills checklist a probe can miss). Ends with "Send Application". Success is `/applyConfirmation` plus "Application Sent!".
- "How did you hear" lists can contain decoy entries (a "Job Board" option that is really a specific organization's board). Pick the truthful generic one, for example "Web Search".
- The new UI's "Send Application" fires a reCAPTCHA v2 challenge even in a real Chrome. Fill everything, park the tab for the user, log `manual_required`.
- Many postings are already closed (`?not_found=true`).

## Eightfold campus portals (for example Millennium's `campusjobs.mlp.com`)

- Sign-in (email code or Google) is the user's.
- After sign-in: resume via `find` plus `file_upload`, a "Build your profile" wizard (Save), then one long form.
- Text inputs take real typing.
- Every select is a combobox `input#input-N` whose typed text APPENDS to the current value (select-all and Backspace first) and filters a list. The list stays OPEN after Escape, so scrolling and clicking the next field lands on an option of the still-open list. This silently set several wrong answers during probing. Close lists with a click on empty page area and assert zero `[class*=select-dropdown-overlay]` before the next field.
- Real clicks on options did NOT commit. Reliable commit: open the list, `focus()` the exact option button by text via JS (`button[id*=option]`, retry a few times because the first focus can bounce), press Return, then assert the input value.
- Field ids shift when conditional fields mount (university = Other adds an "other university" input; authorized = Yes adds a sponsorship combobox). Re-dump ids after those.
- "Expected graduation date" is a calendar picker that discards typed text. Navigate with the year and month header buttons and click the day cell (it carries `title=YYYY-MM-DD`).
- If your school is not listed, pick Other and type the name. GPA may be banded; pick the band containing your GPA from `profile/`.
- Submit is at the bottom right and is briefly disabled during autosave. Success URL ends `/careerhub/explore/jobs/apply/success`.

## Phenom (for example `careers.activision.com/apply?jobSeqNo=...`)

- No account wall. Step 1 text fields and native selects fill fine (real keystrokes; selects need value plus `input` plus `change`). Changing Phone Device Type wipes the phone number, so retype it after.
- The moment a file lands in the resume input, the renderer freezes for 1 to 3 minutes and reloads with the file gone. This reproduced with extension `file_upload`, a JS `DataTransfer`, and Playwright `setInputFiles` over CDP (which froze the whole browser). It is the page, not the file.
- Hand these to the user: give them the resume PDF and the step-1 values and let them do the upload. Do not burn 20 minutes on it.

## Meta (`metacareers.com`)

Guest apply works through Claude in Chrome. The form pre-attaches the last application's resume: remove it with the `Remove <file>` aria-label button, unhide and `find` the `input[type=file]`, then `file_upload` the current one.

## Breezy

`/apply` forms submit to `/apply/submitted`. Watch for anti-AI "I am human" questions; see `form-answer-traps.md`.

## Recruitee

`<company>.recruitee.com/o/<slug>/c/new`, sometimes white-labelled as `jobs.<company>.com`. Fills cleanly (name, email, phone as `+1...`, CV), but Send raises an hCaptcha drag puzzle in the automation Chrome.

## iCIMS

`careers-<company>.icims.com/jobs/<id>/login` is a login or account page with invisible hCaptcha. Account-walled.

## Dover

Cloudflare Turnstile loops forever in the automation browser. Skip, or hand to the user.

## Postings that are really an API screen

Occasionally a posting says the web form is not reviewed and asks candidates to POST a JSON payload to an endpoint instead (Primer's SWE intern posting did this). Rules:

- Surface it to the user and get their go-ahead before sending anything.
- Do NOT probe the endpoint with an empty body first. These rate-limit hard (one returned 429 with `retry-after: 3600` on the first bad request). Send the real payload on the first call.
- A `resume_url` field needs a publicly reachable resume. Ask the user where theirs is hosted; never publish one yourself.

## Account-walled portals

Workday, iCIMS, UltiPro, Oracle HCM, Avature, Eightfold, Amazon, Microsoft, Apple, TikTok and similar require a candidate account. Log `account_required` unless the user has signed in and asked you to proceed.
