# Oracle Recruiting Cloud (Oracle HCM)

Hosts end in `.fa.us2.oraclecloud.com`, `.fa.us6.oraclecloud.com` or `.fa.ocs.oraclecloud.com` (Uber, Navy Federal, Texas Instruments, Berkshire Hathaway Energy and many others). The careers site's "Apply now" opens the Oracle tenant.

Oracle HCM requires the candidate to sign in (email plus a one-time code) and creates a candidate profile. Whether to open this lane is the user's call; the sign-in is theirs to do.

## Form shape

One long page: Contact, Address, Preferred Locations, Application Questions, Experience, Education, Diversity, Supporting Documents, E-Signature. Submit lands on the candidate's "my profile" page with the application "Under Consideration".

## Driving it (Claude in Chrome)

- `get_page_text` may be denied on the domain. `read_page` (interactive or all, with `ref_id`) and screenshots work.
- `form_input` works on textboxes.
- Comboboxes take click, type, Return (month and year names, "United States", gender values as listed).
- Address Line 1 offers suggestions that auto-fill ZIP, City, State and County.

## The profile carries stale data

Because the profile persists across every application to that employer, it reuses whatever was entered last time: an old phone number, an old resume under Supporting Documents, outdated Experience entries. Every time:

- Replace the phone with `profile.phone`.
- Click "Remove Resume" (needs a real click after scrolling to it), then upload the current resume to the "Upload Resume" dropzone input.
- Bring Experience up to date with what is in `profile/`.
- Fix any Education "Fields to fix" (for example a missing start date).

## Dialogs

- "Work Summary" (an AI Assist dialog marked Required): Discard.
- "Are You Still With Us?" (a 30 minute idle timer): Continue Working.

## Quirks

- The Preferred Locations lookup can return "No results" for every city. It is optional; leave it blank.
- The public job page can say "Job removed" in its text while the req is still open. Trust the Oracle apply page, not that label.
