# Pinpoint

Host: `<company>.pinpointhq.com/en/postings/<uuid>`. Apply URL is the posting URL plus `/applications/new`. Guest apply, no captcha seen.

## Form

- Text fields have ids `application_form_application_*`. Native setters work. Phone reformats.
- Custom questions use names containing `answers_attributes][N]`: boolean radios (value `true` or `false`, JS `.click()` works), text answers and URL answers.
- Dropdowns are react-select inputs labelled "Select...". Use a real click on the control (read its coordinates at the current frame scale, see `browser-driving.md`), then click the visible option.
- A cookie banner sits at the bottom right. Click "Reject all" so it stops covering fields.
- The "(Required) Allow us to process your personal information" checkbox must be checked.
- Submit is the "Submit Application" button.

## Success

The URL ends in `/applications/thanks`.

## Validation errors

On a validation error the page re-renders at `/applications` with every value kept, INCLUDING the uploaded CV (shown as a cached-file chip with Remove), but the consent checkbox is cleared. Fix only the flagged field, re-check consent, and resubmit.

## Stale forms

Older postings may offer only past terms in a required availability question. Pick the matching season, and state your real availability in a free-text field.
