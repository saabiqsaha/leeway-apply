# Lever (and Gem)

Hosts: `jobs.lever.co/<company>/<uuid>` (application at `/apply`), `jobs.eu.lever.co`, and Gem boards at `jobs.gem.com`.

## Which browser

- In a Playwright-launched automation Chrome, the form fills fine but Submit raises a visible hCaptcha drag puzzle. Never solve it. Log `captcha_blocked`.
- In the user's own, logged-in Chrome (Claude in Chrome extension), the invisible check usually passes and Lever submits cleanly to a `/thanks` URL with "Application submitted!".
- Moving a role from the automation browser to the user's Chrome specifically to get past a challenge is the user's decision, not yours. Ask or follow an explicit standing instruction.
- If a visible captcha appears in any browser, stop and skip the role.

## Liveness and JD

`https://api.lever.co/v0/postings/<company>/<uuid>?mode=json` returns the posting (`descriptionPlain` plus `lists`). An HTML fetch is useless: Lever renders "not found" client side with a 200 status. A 404 from the API means dead.

## Order of operations

**Attach the resume FIRST, fill everything else, pick Current location LAST, then submit.**

Uploading the resume runs Lever's parser, which overwrites name, email, phone, LinkedIn and current company, and silently clears the hidden `selectedLocation` field. A location picked earlier is wiped, and submit fails with "Please select a location from the dropdown menu and try again" while the visible text still looks right.

## Resume upload

- The resume input (`#resume-upload-input`, or `input[name=resume]`) is present but visually hidden.
- Claude in Chrome: set its `style.cssText` to make it visible, `find` or `read_page` it to get a ref, then `file_upload`.
- Playwright: `setInputFiles` on the hidden input works directly.

## After the parser runs

- The parser rewrites LinkedIn to a guessed URL. Retype `profile.linkedin`.
- It fills "Current company" from the resume. Correct it to the truth. If the field is required and you are between roles, use your answer from `profile/answers.md` (for example "<Your University> (student)").

## Fields

- Text inputs and native selects accept JS native value setters plus `input` and `change` events.
- Custom questions are `cards[<uuid>][fieldN]` inputs inside `.application-question`.
- **Current location** needs real typing: click the input by coordinate (a ref click does not focus it), type `profile.city`, wait about 3 seconds, then click the matching suggestion by coordinate. That fills `selectedLocation`. A JS-set value never does.
- `consent[store]` has a hidden twin input. Tick it with a real (ref or coordinate) click and verify the `type=checkbox` one is checked.
- Never set `eeo[disability]`: answering it makes the self-ID signature required. Leave the optional disability block and signature blank.

## Submit

Check `form.checkValidity()` is true, then `document.querySelector('#btn-submit').focus()` and press Enter with a real key event. Success is the `/thanks` URL.

Some company-specific Lever forms refuse submission even with a valid `selectedLocation` (Palantir did). One attempt, log it, move on.

## Gem boards

Gem (`jobs.gem.com/<board>`) takes native value setters and JS radio clicks. Submit with "Apply without saving" (no account). Success reads "Congratulations! Your application ... has been received". In the automation Chrome, Gem raises an hCaptcha drag puzzle on Apply; see `captcha-lanes.md`.

## Field notes

Append dated bullets here when this platform surprises you: what happened, what fixed it.
Technique only. Never a name, email, phone, school, address, or answer.
