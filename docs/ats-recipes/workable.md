# Workable

Hosts: `apply.workable.com/<slug>/j/<CODE>/apply/` (company board) and `jobs.workable.com/view/...` (the Workable job board).

Workable drives cleanly in both the automation Chrome and the user's Chrome. No captcha seen. About 3 round trips per form.

## Company board form (`apply.workable.com`)

- Navigate to the `/apply/` URL and wait about 4 seconds.
- Text fields are plain React inputs keyed by `name`: `firstname`, `lastname`, `email`, `headline`, `phone`, `address`, `summary`, `cover_letter`. The native value setter plus `input`, `change` and `blur` events registers everything, including phone.
- Phone reformats itself (for example to `XXX-XXX-XXXX`), so a strict equality check reports a mismatch even though it worked. Do not also type into it, or the digits double.
- Some Workable forms still need the real-keystroke nudge if a setter value fails validation: click the field, End, type a space, Backspace.
- Resume: the FIRST `input[type=file]` is the autofill importer. Attach to the SECOND one (in Claude in Chrome, `find` "the required Resume file upload input" returns it), then `file_upload`. A filename chip appears.
- Cover letter is often required; summary is usually optional.
- Submit is `button[data-ui=apply-button]`. Scroll to the bottom, then a real click.
- Success: the URL gains `?success` and the page says "Your application has been submitted successfully."

## Workable job board (`jobs.workable.com/view/...`)

"Apply now" opens the same form inline. Attach the resume to `input[type=file][accept*=".pdf"]`, not the Photo input. Success shows an "Applied" badge, with no `?success` in the URL.

## Supply

Workable has a public search API, `jobs.workable.com/api/v1/jobs`, paged with `pageToken`. It is a useful source of postings the big feeds miss. See `sourcing-and-dedup.md`.

Closed postings redirect with `?not_found=true`.

## Field notes

Append dated bullets here when this platform surprises you: what happened, what fixed it.
Technique only. Never a name, email, phone, school, address, or answer.
