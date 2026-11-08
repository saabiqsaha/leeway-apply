# IBM (Avature) and TikTok

Both require sign-in and both keep a saved candidate profile, so treat them like Oracle HCM: the user signs in, you check every prefilled value.

## IBM (`careers.ibm.com`, IBMid login, Avature)

- **The saved profile carries stale values** (an old phone number, an old campus address). If the form asks for a permanent home address, use the permanent address from `profile/`, not a school address. Check phone and address every time.
- Clicking Apply now while another req's application is in progress silently redirects you to that other req. Open the target JobDetail page and click Apply now there.
- Answering "authorized to work = Yes" inserts a hidden follow-up (future IBM sponsorship, explicitly including CPT and OPT) that shifts the layout and makes later coordinate clicks miss. Fill that page by element id via JS (radio `.click()`, native value setter plus `input`/`change`, a jQuery `change` trigger for selects), then read every value back.
- "Attended university = Yes" reveals Country, Institution, Degree, then Study/Specialization, each appearing only after the previous is set and Continue is pressed. If your school is not in the Institution list, pick OTHER, then type the name.
- The resume parser adds non-jobs (hackathons, programs) to work history. Remove anything that is not real employment.
- Race and Veteran status are select2 controls with lazy options: click, type, pick.

## TikTok (`lifeattiktok.com`)

- Resume upload auto-parses name, phone, education and internships. Check each one.
- Answer work-authorization and sponsorship questions from `profile/answers.md`. Read the exact wording: "legally authorized to work without restriction" and "now or in the future require sponsorship" are separate questions with possibly different answers.
- TikTok limits how many applications a candidate can have open per cycle (about 2). Choose the reqs deliberately.
- Final submit raises a picture CAPTCHA. Hand that click to the user. Never solve a CAPTCHA.
