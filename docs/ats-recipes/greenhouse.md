# Greenhouse

Hosts: `job-boards.greenhouse.io`, `boards.greenhouse.io`, `/embed/job_app`, and company career sites carrying `?gh_jid=<id>`.

Greenhouse is the friendliest major ATS: plain text inputs accept JavaScript value setters, and a whole form can be filled in about 5 tool calls. The traps are the react-select comboboxes and the email security code.

## Before you open a tab

- The questions API returns the exact question set and option labels: `https://boards-api.greenhouse.io/v1/boards/<board>/jobs/<id>?questions=true`. Use it to pre-screen (transcript, clearance, export control) and to plan answers.
- The API misses things: education dates, work-authorization question pairs, custom demographic blocks, and required cover letters (use the "Enter manually" textarea). Still guard on the page: every label ending in `*` must have a value before you click submit.
- Throttle API calls. An unthrottled sweep gets your IP blocked (403 on the API, 406 on job pages). See `sourcing-and-dedup.md`.

## Which URL to open

- Company career sites that embed Greenhouse (databricks.com, careers.datadoghq.com, stripe.com, akunacapital.com, and boards that redirect to the company site) either redirect away from the form or block injected JavaScript. Go straight to the embed:
  `https://job-boards.greenhouse.io/embed/job_app?for=<board>&token=<job_id>`
  or `https://boards.greenhouse.io/embed/job_app?token=<job_id>`.
- Field ids are per req, not per company. Re-read the field list on every posting.

## Order of operations

1. Upload the resume FIRST. The upload re-render can wipe text fields you already set.
2. Plain text inputs (name, email, phone, LinkedIn, website, end year): native value setter plus `input` and `change` events. Reliable here, unlike Ashby.
3. Comboboxes: see below.
4. Checkboxes: a real click on the box itself.
5. Verify every required field, submit with a real click, then handle the security code.

## The JS boot plus queue pattern (universal filler)

Build the helper with `bin/gh-boot`. It writes `.cache/gh_boot.js`: your profile values (`window.__P`), the answer rules (`window.RULES`, generated from `profile/profile.json`, with `profile/form_rules.json` overrides checked first), and the engine from `bin/gh_boot.engine.js`. Rebuild it whenever the profile changes. Call order after injecting: `__fill()`, `__mkq()`, then `__no()` / wait / `__nc()` pairs until `__no()` returns `DONE`, then `__sweep()` (and re-run pairs if anything re-queued), `__missing()`, and `__sub()` only when it says ALL REQUIRED FILLED. The pattern:

- Store the helper source in `localStorage.__boot` on `job-boards.greenhouse.io` and `eval(localStorage.__boot)` after every navigation. `localStorage` survives across tabs on the same origin; `sessionStorage` is per tab, so a new tab would need a fresh paste.
- Build the plan from `label[for]` elements in the DOM. `window.__remixContext` also holds the field schema with option labels, but it goes empty after a client-side router navigation, so the DOM is the reliable source.
- Answers come from label regexes ordered most specific first, with values from `profile/profile.json` (built into the bundle by `bin/gh-boot`). Never hardcode question ids. See `form-answer-traps.md` for why the order is load-bearing.
- React-select via synthetic events: dispatch `pointerdown`, `mousedown`, `pointerup`, `mouseup`, `click` on the control, set the inner input value with the native setter, then read the options from the listbox named by the input's `aria-controls`. Click the chosen option with the same synthetic sequence.
- One tool call opens the control, a 2 to 3 second wait follows, the next call clicks the option. Opening and clicking in the same call fails because the menu has not rendered yet.
- The Claude in Chrome `javascript_tool` refuses output containing `=`, `&` or `?`. Strip those characters from anything your helper returns.

## Combobox failures and their fixes

Each of these presents as "the field is empty" with no error, so the instinct is to rerun the same failing call. Know the causes instead.

1. **Clear the filter before opening.** A failed open leaves your text in the react-select search input, which filters the list to nothing, so every retry reads back zero options. Set the input to `''` with the native setter and fire `input` BEFORE dispatching the open sequence.
2. **`blur()` and the next open go in SEPARATE tool calls with a wait.** In one call, the previous menu is still closing when the new `mousedown` lands and it toggles the fresh menu shut. Pattern: `[blur] wait 3-4s [open] wait 5s [choose] wait 2s`. About 3 fields per browser batch before the batch times out.
3. **Scroll the control into view first.** Off-screen controls never open their menu.
4. **If a filter string matches nothing**, open with `''` and match on the full option text.
5. **Employment-history dates are comboboxes.** `start-date-month-0` looks like a text input but carries `select__input` and needs the month NAME ("June"), not "06". A number leaves React state empty and submit dies on "Start date month is required" or the generic "There was an error processing your application".
6. **Verify with a strict reader** that looks only inside the control's own `select__control` (for example its `[class*=single-value]`). A loose parent walk reports a neighbour's value and hides empty required fields.
7. Do not batch a whole queue with in-page `await new Promise(r => setTimeout(r, ms))` sleeps. One short sleep works; many throttle under load and blow the 45 second CDP eval timeout. Use the host's `wait` action between calls.

## The faster path: commit with Return

For most react-selects: click the control, type the search text, wait about 2 seconds, press Return. The highlighted first option commits, and you never need option coordinates, so page reflow cannot break it. Verify with `[...document.querySelectorAll('[class*=singleValue],[class*=single-value]')].map(e => e.innerText)`.

Two traps:

- **Substring matching.** Typing "Male" highlights "Female" first. Whenever your text could match more than one option, read the option list first and use exact match or arrow keys to reach the right index.
- **Return over an EMPTY option list submits the whole form.** Near the page bottom, `scrollIntoView` cannot center a control, so a click at the assumed y lands on the field above; the typed filter then matches nothing and Return submits the application with whatever is filled (one Point72 form went in with a wrong self-ID value this way). Rules: read the control's rect after every scroll and click those coordinates; guard every Return with a JS check that throws when the visible `[role=option]` list is empty; fill an optional EEO block before the required block, or skip it if it sits at the page bottom.

Keyboard alternative when clicks do nothing on newer forms: focus the underlying `<input>`, press ArrowDown to open the menu, type to filter, read the visible `[id*="-option-"]` elements, then click the chosen option by its bounding box. Mouse-only helpers fail on roughly half of forms; the keyboard path is near universal.

## The hidden phone-country option list

`[role=option]` also matches the hidden intl-tel-input phone-country list (about 245 `<li role=option>` items). Substring matching then hits "Mayotte" for "May", and an Enter fallback silently selects a hidden option (a disability self-ID went in wrong this way). Use `[role=option]:visible`, match exact, then startsWith, then includes, never fall back to Enter, and verify every demographic value before submit. With opencli, `find --role option` sees only that hidden list, so target the listbox by id: `#react-select-<field>-listbox [role=option]`.

## Location (City) autocomplete and other searchable fields

School, Location/City and phone Country need a real coordinate click plus real typed keystrokes. A JS-set value does not fire the async search. For "Location (City)": click the control, type `profile.city`, wait about 2.5 seconds, press Return (with the empty-list guard above). Setting the hidden `#candidate-location` input directly never validates.

## Checkboxes

Click the checkbox itself at real coordinates. A JS `dispatchEvent` sequence sets `.checked = true` but React does not register it, so the form submits unchecked. On some forms the mouse-event sequence dispatched on the `<label>` works instead.

## Other gotchas

- Filling Phone makes Country required even when Country is not marked required.
- When demographic questions are answered, some boards require the `gdpr_demographic_data_consent` checkbox, otherwise submit shows "You answered some demographic questions. Please accept the terms...".
- Submit with a real click on the LAST "Submit application" button. A JS `.click()` on it, or a helper's submit function, can silently do nothing.
- If your rules skip transcript-required roles, test the body text for `/transcript/i` before filling anything.
- "There was an error processing your application" plus a `grecaptcha-error` element, even after a real click (seen on nCino early-talent), is an invisible reCAPTCHA rejection. Park the tab for the user.
- Required "Are you an LLM, AI agent, or other agentic tool?" surveys: do not answer, see `form-answer-traps.md`.

## The security code (email verification)

This is the number one hidden blocker.

- After the first submit, newer forms show "A verification code was sent to <email>... enter the 8-character code". The email comes from `no-reply@us.greenhouse-mail.io` with subject "Security code for your application to <Org>". Until it is entered the form refuses to submit and shows NO validation errors, which looks exactly like an unexplained failure.
- Flow: fill, submit once (this sends the email), read the newest code from the inbox (a mail MCP if you have one, otherwise ask the user), type it into the 8-box field, submit again, verify the `/confirmation` URL.
- Each submit attempt issues a new code and invalidates the previous one. Always use the newest code for that company.
- Rate limit: after roughly 30 code requests to one email in a night, Greenhouse stops issuing codes and every staged application sits at "Invalid security code". Work Greenhouse strictly one posting at a time, never resubmit to "retry" a code, cap it near 20 to 25 per email per night, and interleave other ATSs.
- If a code never arrives after a few minutes, park that application and move on.

## Playwright MCP

Playwright locators fire trusted events, so react-select commits without most of the synthetic-event workarounds above. The questions-API guard and the hidden phone-country trap still apply. See `browser-driving.md`.
