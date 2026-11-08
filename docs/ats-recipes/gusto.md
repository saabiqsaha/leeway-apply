# Gusto job board

Host: `jobs.gusto.com/postings/<slug>` (application at `.../applicants/new`).

The cheapest lane seen: about 2 round trips, no captcha. Prioritize Gusto postings when you find them.

## Form

- Fields: first, middle, last name, email, phone (optional), an "Additional information" textarea (optional, a good place for a short summary and your demo or portfolio link), and a resume PDF (required).
- Ids: `job_applicant_first_name`, `job_applicant_last_name`, `job_applicant_email`, `job_applicant_phone`, `job_applicant_additional_information`, `job_applicant_resume`.
- Native value setters register.
- Resume: `find` "resume PDF file upload input" then `file_upload`.
- Submit is `input[type=submit][name=commit]` ("Submit your application"). Use a real click.

## Success

The page at `.../applicants` says "SUCCESS! Your application was submitted".

## Reading the JD

`curl` of the posting page hits a Cloudflare "Just a moment" wall. Read the JD from the open tab instead (page text in slices of about 1,400 characters) before tailoring.

## Field notes

Append dated bullets here when this platform surprises you: what happened, what fixed it.
Technique only. Never a name, email, phone, school, address, or answer.
