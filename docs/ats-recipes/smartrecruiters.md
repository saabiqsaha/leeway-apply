# SmartRecruiters

Hosts: `jobs.smartrecruiters.com`, apply flow at `jobs.smartrecruiters.com/oneclick-ui/company/<Company>/publication/<uuid>?dcr_ci=<Company>`.

The form is built from `spl-*` web components inside (sometimes nested) shadow roots. Claude in Chrome's `find` and `read_page` cannot see inside them, and plain injected JS struggles. Two lanes work.

## Liveness, JD and the apply id

`https://api.smartrecruiters.com/v1/companies/<Company>/postings/<postingId>` returns `active`, `uuid` and `jobAd.sections`. Build the apply URL from the `uuid`.

SmartRecruiters' cross-company search (`jobs.smartrecruiters.com/sr-jobs/search?keyword=...&limit=100`) does not page and its tech-internship pool is small. Do not expect volume there.

## Lane 1: Playwright MCP `browser_run_code`

Playwright CSS locators pierce open shadow roots and send trusted events, which is all the `spl-*` components need.

- Target the inner control, not the host: `#first-name-input input`, `spl-phone-field input[type=tel]`, `#hiring-manager-message-input textarea`.
- **Never use the top "Easy Apply" dropzone.** It runs the resume parser, which wipes fields and creates half-empty Experience cards (for example from a Projects section). Attach the resume to the **LAST** `input[type=file]`, the one in the Resume section. Some forms have an avatar file input first, so "the second input" is wrong.
- Recovery after an accidental parse: delete the junk cards with `button[aria-label^="Delete experience"]` and refill the wiped fields.
- City: type `profile.city`, then click the `spl-typography-body` option that matches (for example "<City>, <ST>, US"). Some forms use Country/Region plus Postal code instead.
- Required Experience or Education ("Please provide at least one ... entry"): click "Add experience entry" or "Add education entry", type into `spl-autocomplete[label="Title"|"Company"|"Institution"] input` and click the matching `spl-select-option`, set dates by typing `MM/YYYY` plus Enter into `spl-date-field[label="From"|"To"] input[type=text]`, then Save.

## Lane 2: the user's Chrome via Claude in Chrome

- Install a JS shadow-root walker (for example `__q(sel)`) that recursively descends every `shadowRoot` and returns elements with their coordinates. Collect inner inputs with the recursive walker over each host, not host-descendant CSS.
- Drive with real `computer` clicks and typing at those coordinates.
- **Resume bridge:** create a visible light-DOM `<input type=file>`, `find` it, `file_upload` to it, then copy its `FileList` with `DataTransfer` into the LAST `spl-dropzone` file input (the top one is the parser) and dispatch `input` and `change` with `composed: true`. The dropzone then shows the file name.
- Autocompletes (City, Title, Company, Institution, School location): real click on the inner input, select-all, type, wait about 2s, then a JS `spl-select-option.click()` on the visible matching option commits (synthetic is fine for this step). Read the option labels first; they vary ("NO" versus "No, I have not been employed by <Company>").
- Phone: type into the visible `input[type=tel]` for real. The native setter hits a hidden text twin.
- `spl-number-field` (salary and similar) rejects synthetic setters and the host `.value`. A real click on the inner input then typed digits works.
- Radios: click at about `host.rect.x + 10`, or a JS `.click()` on the `spl-radio` host; verify through the inner `aria-checked`, and take a screenshot when that stays blank. Rows can be very wide (about 1138px); click near the left edge after `scrollTo(0, pageY - 300)`.
- Scrolling: use `scrollIntoView({block: 'center', behavior: 'instant'})`. The default smooth scroll made the next real click land on the wrong field. Fields near the top or bottom of a page cannot be centered, so read the returned coordinates instead of assuming a fixed y.
- Buttons: "Next" and "Submit" are SPANs inside `spl-button` hosts. Find the element whose trimmed text is exactly "Next" or "Submit", scroll it into view, and click its rect.

## Screening page (`/screening`)

Knockout questions only appear here, after page 1 is filled (no visa sponsorship ever, transcript on request, a required hourly-pay dropdown with no number on file). Read the full screening scan before answering anything.

- Question text lives in the host's light-DOM `[slot="label-content"]`.
- Radio labels are the `label` attribute on `spl-radio`.
- Selects are `input#question_<uuid>`. Open with a JS `mousedown` plus `click` on the inner input, then `spl-select-option.click()` (match on `textContent`) about 800ms later. An async chain can fill several selects in one call.
- Checkboxes are `input#spl-form-element_N`. Click the inner `input[type=checkbox]` rect. Tick only the required privacy box, not SMS or community opt-ins.
- Unlabeled `spl-input` hosts on this page can be EEO pickers (race, ethnicity, legal sex, veteran) whose labels only show in a screenshot. Look before you skip them.
- Conditional follow-ups ("How did you hear" = Other, school = Other) insert a new required input and shift every later question index. Re-list labels after any pick.
- Multi-select "None of these apply" shows no chip text. Trust the pick result.

## Details that bite

- The "Message to the Hiring Team" field REJECTS semicolons ("This field cannot contain following characters: ;").
- Experience and Education card Save buttons sit at fixed offsets once the first field is scrolled to the top; read them from a screenshot.
- Optional transcript uploads can be left empty.
- **Session timeout:** a filled form left idle for about 2 hours is replaced by "Due to inactivity, the form has been closed to protect your data", and every answer is lost. Finish a SmartRecruiters form in one sitting. Never park one half-filled for the user.

## Success

The URL ends in `/success` and the page says "Application submitted!".

## Field notes

Append dated bullets here when this platform surprises you: what happened, what fixed it.
Technique only. Never a name, email, phone, school, address, or answer.
