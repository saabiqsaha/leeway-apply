# Workday

Host: `*.myworkdayjobs.com` (also `myworkdaysite.com`).

Workday requires a candidate account per tenant. Creating accounts is the user's call; if your rules say "no account creation", log `account_required` and move on. When the user has signed in, these mechanics apply.

## Searchable prompts take free text

School or University, Field of Study and Location prompts **accept free text: type the value and press Enter, and it commits as a chip.** A browse list showing "No Items." means the tenant's reference list is empty, not that the field is blocked. (Barclays' `GET /wday/<tenant>/cxs/jobapplication/<tenant>/schools` returned a literal `[]`, and typing plus Enter still worked.)

On any Workday prompt that will not populate, press Enter with the typed text before investigating anything else. An empty lookup is a red herring that can eat a whole session.

## "Select One" dropdowns open at fixed offsets

Plain "Select One" dropdowns open as an overlay at fixed offsets from the field's y coordinate: option 1 at about +19px, option 2 at +39px, option 3 at +58px. For Yes/No questions, Yes is +39 and No is +58. The layout does not shift after an answer is set, so several Yes/No questions can be batched from one screenshot. Verify each afterwards anyway.

## Selectors

- Inputs key on `id` (for example `education-4--school`, `name--legalName--firstName`). Do not rely on `data-automation-id`.
- Long option lists are virtualized, so a DOM query for an option's text returns nothing until it is scrolled into view. Type to filter instead.

## Liveness

Workday reqs close fast. Re-check the posting right before you start a long form.
