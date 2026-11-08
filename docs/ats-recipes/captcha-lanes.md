# Captcha lanes

Hard rule: **never solve a captcha or puzzle, and never use a solving service.** When one appears, fill the rest of the form if you can, log `captcha_blocked` (or `manual_required`), and list the row for the user to finish by hand.

Knowing which hosts are gated up front saves you from tailoring a resume for a form that cannot be submitted. Pre-screen by ATS host.

## Two browsers, different results

- **Automation Chrome:** the Chrome launched by Playwright MCP (or a Chrome for Testing on `CDP_PORT`, default 9333) with its own persistent profile (`CHROME_PROFILE_DIR`).
- **The user's real Chrome:** driven through the Claude in Chrome extension, with the user's normal cookies and history.

Switching a role from the automation browser to the user's Chrome just to get past a challenge is the user's decision. Do it only on their explicit instruction.

## By platform

| Platform | Automation Chrome | User's real Chrome |
|---|---|---|
| Greenhouse | Clean (watch for invisible reCAPTCHA rejections) | Clean |
| Ashby | Clean with a persistent profile; a bare remote-debugging Chrome can score as spam. Spam flag after about 10 submits in a row, clears in about 40 minutes | Clean |
| Lever (`jobs.lever.co`) | hCaptcha drag puzzle on Submit | Usually clean |
| Gem (`jobs.gem.com`) | hCaptcha drag puzzle on Apply | Usually clean |
| JazzHR (`*.applytojob.com`) | reCAPTCHA v2 checkbox, then image challenge | reCAPTCHA checkbox still shows: fill, leave tick and Apply to the user |
| BambooHR (`*.bamboohr.com/careers`) | reCAPTCHA v2 checkbox, then image challenge | Same as JazzHR |
| Jobvite (new UI) | reCAPTCHA v2 on "Send Application" | reCAPTCHA v2 too: fill, park for the user |
| Recruitee | hCaptcha drag puzzle on Send | Untested |
| iCIMS | Login page with invisible hCaptcha | Account-walled |
| Dover | Cloudflare Turnstile loops forever | Untested |
| TikTok | n/a (sign-in) | Picture CAPTCHA on final submit: hand to the user |
| Workable, Breezy, Rippling, Gusto, Pinpoint, SmartRecruiters | Clean | Clean |

## Pacing

Reputation-scored captchas (Ashby, Greenhouse invisible reCAPTCHA) react to bursts. Interleave platforms instead of running 10 forms on one ATS back to back.

## Field notes

Append dated bullets here when this platform surprises you: what happened, what fixed it.
Technique only. Never a name, email, phone, school, address, or answer.
