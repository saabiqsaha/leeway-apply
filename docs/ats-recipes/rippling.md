# Rippling ATS

Host: `ats.rippling.com/<company>/jobs/<uuid>`. Every board on this host uses the same form engine.

About 5 round trips per form. No captcha seen.

## Recipe

1. The job page has a `button` "Apply now". A JS `.click()` works and lands on `.../apply?...&step=application`.
2. **Upload the resume FIRST and wait 3 to 8 seconds.** The parse OVERWRITES text fields a few seconds later (for example it resets "Current company" to whatever the resume says). Set text fields only after it settles, and verify again right before Apply.
3. Resume input: the hidden `input[type=file]`. In Claude in Chrome, `find` "resume file upload input" returns a `textbox (File)` ref; `file_upload` works.
4. Text inputs have ids `field-<n>`; dates split into `field-<n>-month`, `field-<n>-day`, `field-<n>-year`. Native value setter plus `input`, `change`, `blur` registers text, textareas and dates.
5. Phone is masked and reformats, so equality checks report a mismatch even when it is fine. In Playwright, clear it with select-all plus Delete before typing.
6. Custom radios and checkboxes are `div[role=radio]` and `div[role=checkbox]`. JS `.click()` works; verify `aria-checked`. In Playwright, pick radios by exact accessible name. Verify Yes/No order on SMS consent radios after clicking.
7. EEO selects are `div[role=combobox]`. Index them carefully: Pronouns and the phone-country search are also comboboxes. Open with a JS click, click the `[role=option]` about 500ms later via a `setTimeout` chain, then press Escape, or an open list swallows the next real click.
8. Location is a Google Places autocomplete: real click, type `profile.city`, wait 2 seconds, click the matching option (it renders roughly 50px below the field).
9. The sticky footer covers fields near the bottom of the page. Scroll fields to center before clicking, or use JS clicks for them.
10. Submit is the footer `button` "Apply", fixed at the bottom right. It enables only when everything required is set.

## Success

The URL reaches `step=confirmation` and the page says "You have successfully applied".
