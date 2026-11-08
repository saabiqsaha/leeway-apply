# Ashby

Host: `jobs.ashbyhq.com/<org>/<uuid>` (application at `/application`).

Ashby is the strictest common ATS. Almost every failure presents the same way: a form that looks completely filled, where submit replies "Missing entry for required field: X".

## The core fact: Ashby trusts only real events

Ashby validates against its own React state, and it only updates that state from trusted (`isTrusted`) events. Setting a value with the native setter plus an `input` event puts text in the DOM, but the state never sees it. Calling the React `onChange` from `__reactProps$...` works for some text inputs and never for radios. Claude in Chrome's `form_input` is unreliable here too: in one batch it worked for some fields and silently failed for others. CDP-dispatched synthetic events are not trusted.

What works:

- **Playwright MCP `browser_run_code`.** Locators fire trusted events. Type with `pressSequentially` (plain `fill()` has left fields uncommitted), click the opposite Yes/No option first, type plus Enter for comboboxes.
- **Claude in Chrome `computer` tool.** Real `left_click` at coordinates, `wait 1s`, then `type`. The wait is required, otherwise the keystrokes go to whatever was focused before. Coordinates from a fresh screenshot are reliable; `ref` clicks go stale after any re-render (re-run `find` if the page changed), and on some setups refs do not register at all. `file_upload` by ref does work.

## Which browser

Ashby runs reCAPTCHA scoring. A bare `--remote-debugging-port` Chrome for Testing can score as spam, so every submit is rejected however human the typing. The user's own Chrome via Claude in Chrome passes, and so has the Chrome that Playwright MCP launches with its own persistent profile.

The spam flag (`RECAPTCHA_SCORE_BELOW_THRESHOLD` in the `ApiSubmitMultipleFormsAction` response, or a "flagged as possible spam" message) appears after roughly 10 to 12 Ashby submits in a row. A retry about 40 minutes later succeeded. Interleave other ATSs between Ashby forms instead of running them back to back.

## Order of operations

1. Upload the resume and wait 6 to 10 seconds. The async parser clears Name and Email 3 to 6 seconds later, and the resume block grows (a "Replace" row appears) a few seconds after upload, shifting everything below it by about 145px. Never upload in the middle of filling: a mid-form upload can re-render and blank fields.
2. Fill the rest screen by screen (recipe below).
3. Fill Name and Email LAST, immediately before submitting: triple-click the field and retype it.
4. Right before submit, re-commit every Yes/No toggle (off then on, below).
5. Submit with a real click. `ref` clicks and JS `.click()` on the submit button silently no-op.
6. Success is a green "Thank you for submitting your application" panel. The URL does not change.

## Text fields

- **The recipe that holds:** scroll a block of fields into view, screenshot, then in ONE batch click each visible field at its screenshot coordinates and `type` (no select-all needed on empty fields). Scroll to the next block and repeat. This beats scripted coordinate helpers, which race the scroll so the click lands on nothing, `document.activeElement` stays BODY, and the form silently stays empty.
- If you locate fields with JS, run `scrollTo` and `getBoundingClientRect` in the same call immediately before the click. Never use a map taken earlier (for example right after the resume upload). Near the page bottom `scrollIntoView` cannot center a field, so never click an assumed y.
- **"Value visible but validation says missing"** is a timing miss. Click the field, select-all, Backspace, wait 1s, retype, wait 1s, submit. Do this before parking anything.
- **A long `type` can leave state empty.** After typing, press End, type a space, then Backspace.
- Only send select-all (cmd+a) after confirming focus is inside the input. With focus on BODY it selects the page and the next keystroke wipes the form.
- **Phone needs the country code.** Type `profile.phone` in E.164 form (`+1` then the digits for a US number). A bare 10-digit number submits as "Missing entry for required field: Phone".
- The first interaction right after a navigate is often swallowed. Click once, verify with a DOM read, then proceed.

## Yes/No toggles (the most common Ashby failure)

- Required Yes/No questions render as a pair of `<button>`s, not radios. Clicking one highlights it, the hidden checkbox may read `checked = true`, `aria-pressed` may read true, and submit still says "Missing entry for required field" for that question.
- **Fix:** click the OPPOSITE option, wait 2s, click the one you want, wait 2s, then submit with no scrolling in between. Clicking the already-selected button either clears it (it is a toggle) or does nothing. A real state change is what commits.
- Never batch a toggle click with the next action, and never batch two clicks on the same pair. The page shifts between them and the second click lands elsewhere. One click, one screenshot, verify.
- Verify with `aria-pressed` on the buttons, not `input:checked`, and with a zoomed screenshot of the row.
- **After every failed submit, re-read every Yes/No answer.** The re-render can silently flip a toggle to the wrong value. On one form a retry left "Have you previously worked at <Company>?" set to Yes, which would have been a false statement.
- Dependent questions appear after toggles. Re-enumerate field positions after any toggle.

## Radios and checkboxes

- EEO radios are real `<input>`s; a plain JS `.click()` works on them.
- Radio and checkbox groups can show a tick while React state is empty, usually because the label text was clicked. Click the input's own rect, or pick a different option and then the right one, and read `input.checked` back.
- Same commit lag as toggles: click OFF, wait 1s, click ON, wait 2s.
- "Select all that apply" lists that render as radios accept multiple clicks.

## Searchable dropdowns ("Start typing...")

University, graduation month or year, location: click the field, wait 1s, type, wait 2s, press Return. Clicking the highlighted option often leaves the field blank again. The substring trap applies ("Male" matches "Female"), so check the options when your text is ambiguous.

## Date fields

- Many date fields are react-datepicker inputs, including text-looking "earliest start date" and "expected graduation" fields.
- Click the "Pick date..." field and type digits `MM/DD/YYYY`. Never click the month arrows: it is slow and the calendar shifts mid-batch so clicks miss. The calendar jumps to the typed month; click the day or press Escape to commit.
- Typing opens a popup that swallows the next click, so later keystrokes keep landing in the date field (an essay once ended up appended to a graduation date). A month and year typed as words ("May" plus a year) was parsed as the 5th of May, not the date you meant. After any date: Escape, click a blank area or neutral label, re-read coordinates, and confirm `document.activeElement` sits inside the intended `[class*=fieldEntry]` before any long `type`.
- A dependent question such as "When will you first require visa sponsorship?" can be a date field. Prose typed into it becomes 01/01/2001. Answer with a real date from `profile/answers.md`.

## A label-walk map

Build a map from label text to `closest('[class*=fieldEntry]')` to its input (or its Yes/No buttons with `aria-pressed`). Refresh it after every scroll and every toggle, because conditional fields shift positions.

## Messages and limits

- "We're updating your application (e.g. uploading files), please try again": the resume is still in flight. Wait 10 seconds and submit again.
- Some boards enforce limits such as "5 roles per 90 days" and reject at submit time.
- Screening gates (export control or US Person, graduation window) often live only in the application questions, not in the JD body, so a text screen of the posting misses them. Check the rendered form before investing in a long application.
- Required video uploads, "best work" uploads and personal-story essays go to the user.
- A job-tracker browser extension may pop an "Application Submitted!" modal over the success page. It is harmless.

## Field notes

Append dated bullets here when this platform surprises you: what happened, what fixed it.
Technique only. Never a name, email, phone, school, address, or answer.
