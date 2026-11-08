# ClearCompany

Host: `apply.clearcompany.com/<tenant>?jobId=...`. The form opens in a NEW tab at `<tenant>.clearcompany.com/careers/jobs/<id>/apply`. Guest flow; no password is asked ("I Already Have An Account" is optional).

## Flow

- **Step 0, contact:** name, email (entered twice), mobile, an SMS consent radio, an "interested in other positions" radio, then Continue.
- **Page 1, resume:** `find` the first `type=file` under Resume, then `file_upload`.
- **Page 2, tenant-specific.** This varies a lot between employers. One tenant used a full "application for employment" with several "Initial" boxes (type your initials from `profile/`), name plus today's date, an "I Agree", race and gender radios, a desired pay rate, and a start date. Native value setters plus `input`, `change`, `blur` and `.click()` on radios worked.
- "When are you available to start" must be a real date in `MM/DD/YYYY`, or submit fails with "Please enter a valid date."

## Success

A "Thank you for applying." page, and the header flips from logout to login.

## Rules

- Read any acknowledgment text before initialing. Look for arbitration clauses and other commitments; surface anything unusual to the user.
- Some tenants ask facts you do not have (one asked T-shirt size and food allergies). If an answer is not in `profile/answers.md`, park the application and ask the user. Never invent a personal fact.

## Field notes

Append dated bullets here when this platform surprises you: what happened, what fixed it.
Technique only. Never a name, email, phone, school, address, or answer.
