# Form answer traps

A wrong answer in a demographic or eligibility field is worse than a blank one, and nobody reviews it before submit. These are the ways answers silently go wrong.

## The first rule

Every answer comes from `profile/answers.md` and `profile/profile.json`. If a form asks for a fact that is not there, stop and ask the user. Never invent a fact, and never pick "the answer that gets past the screen" over the true one.

## Label regexes that match the wrong question

Rule-matching a label to an answer breaks when two questions share a word. Put the specific rule before the general one.

- "Transgender Status" matches a `/gender/` rule and gets your gender value. It is a separate Yes/No question.
- "Gender Identity" often offers Man/Woman, not Male/Female. Feeding it "Male" leaves the field empty with the text sitting in the search box.
- "Are you a current university student?" matches a `/university/` rule and gets your school name instead of Yes. "Are you currently enrolled in a university?" has the same shape.
- Veteran wording varies: some forms offer "I am not a protected veteran", others plain Yes/No.
- "Male" is a substring of "Female", and many filters are substring matches. Always match option text exactly first, then startsWith, then includes.

## Committed versus displayed

- Always read back the committed value from the control itself before submitting, not from a nearby element.
- If a select shows the text you typed but the option list says "No options", nothing committed. Clear the field, reopen, and pick from the unfiltered list.
- Greenhouse: `[role=option]` also matches a hidden phone-country list, so "May" can select "Mayotte". Use `:visible`.
- Greenhouse: pressing Return over an EMPTY option list submits the whole form. Guard every Return.
- Ashby: a failed submit can flip a Yes/No toggle to the wrong value. Re-read every toggle after any failed submit.
- Date fields eat prose: a free-text answer typed into a date picker becomes a nonsense date (01/01/2001). Answer date questions with a real date.

## Parsers and saved profiles put words in your mouth

- Resume parsers (Lever, Rippling, Ashby, Jobvite, SmartRecruiters, IBM) overwrite name, email, LinkedIn and "Current company", rewrite LinkedIn to a guessed URL, and add non-jobs (projects, hackathons) as work history. Correct every one.
- Portals with saved candidate profiles (Oracle HCM, IBM, Workday) reuse old phone numbers, old addresses and old resumes. Replace them every time.

## AI attestations and "are you an AI" questions

The agent filling the form is an AI, so some questions cannot be answered truthfully on the user's behalf.

- If a form asks the applicant to attest that no AI assistant was used **in the application itself or its written answers**, stop. Log the row as needing the user (for example `needs_user: no-AI attestation`) and list the essay prompts so they can do it by hand.
- If the policy covers only interviews or assessments ("during the interview process"), acknowledging it is fine, because the user does those themselves.
- A required survey like "Are you an LLM, AI agent, or other associated agentic tool?" with options such as "I am a human" is the same class. Do not submit. Log it for the user.
- Read the full policy text before ticking any AI-related acknowledgment.

## Other things to read before you tick

- Acknowledgments and initials boxes: look for arbitration clauses and other commitments. Surface anything unusual.
- Some boards need a demographic data consent checkbox once you answer demographic questions.
- Salary expectations: fill only if required, and then use the answer in `profile/answers.md` (for example "Open to discussion").
- Graduation-window, US Person and export-control gates often appear only in the application questions. Answer them truthfully, and if the truthful answer is a knockout, log `ineligible` instead of submitting.
- Required video uploads, "best work" uploads and personal-story essays go to the user.
