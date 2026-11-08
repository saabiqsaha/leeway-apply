# Driving the browser

How to drive application forms reliably, whichever browser tool you have. Platform specifics live in the per-ATS files.

## Ground rules

- **You drive each form yourself, one at a time.** Open the form, read the actual questions, answer them from `profile/`, verify, submit. The helpers in `bin/` are hands for a form you are personally driving, not a pipeline to hand the queue to. Building new batch automation instead of applying is the classic failure mode: it feels like progress and produces zero verified applications.
- **One attempt per posting.** If a form will not go through, log the outcome with a short reason and open the next posting. Fix a blocker only when it is a class of blocker that will unlock many future forms, and even then timebox it to one pass.
- **Verify every submit.** "Applied" means a confirmation page, a success URL, or a confirmation email. Anything else is not applied.

## Pick a driver

| Driver | Use it for | Notes |
|---|---|---|
| Playwright MCP `browser_run_code` | Default for Greenhouse, Ashby, Rippling, Jobvite, SmartRecruiters, Workable | Trusted events, one call can navigate, fill, read back and submit |
| Claude in Chrome extension | The user's real Chrome: captcha-sensitive boards (Lever, Gem), sign-in portals | Coordinate clicks, one foreground tab |
| CDP snippet runner | Fallback when the Playwright MCP dies mid-session | Same semantics as `browser_run_code` |
| opencli (optional) | Driving the real Chrome from bash with zero model tokens | Needs its Browser Bridge extension |

## Playwright MCP

- Configure the MCP with a persistent profile: `--user-data-dir $CHROME_PROFILE_DIR`. The persistent profile carries cookies and clearances so boards see a returning browser, not a fresh bot. Never run without one.
- **Do not launch a Chrome on `CDP_PORT` (default 9333) with that same profile first**, or the MCP dies with "Opening in existing browser session". One process owns a profile at a time.
- Avoid `browser_navigate` and `browser_snapshot` on job forms: their accessibility trees run about 10k tokens. Use `page.goto(...)` inside `browser_run_code` and return a compact object.
- Hang helpers on the `page` object (`page.__gh = ...`). They survive between calls; `globalThis` does not.
- Each `browser_run_code` call is its own JS realm, so a RegExp passed into a stored helper fails `instanceof RegExp`. Pass exact strings or regex source strings and build the RegExp inside.
- Type into strict React forms with `pressSequentially`; `fill()` can leave a field uncommitted (Ashby).

## CDP snippet runner (when the MCP dies)

If the MCP server drops ("Opening in existing browser session", usually a stale Chrome holding the profile), all its tools vanish for the session. Recover:

1. Kill the stale "Google Chrome for Testing" process whose command line has `--user-data-dir=<CHROME_PROFILE_DIR>`.
2. Delete `SingletonLock`, `SingletonSocket` and `SingletonCookie` in the profile directory.
3. Launch Chrome for Testing with `--remote-debugging-port=$CDP_PORT --user-data-dir=$CHROME_PROFILE_DIR`.
4. Drive each form with a one-off snippet file through a tiny runner: `chromium.connectOverCDP('http://127.0.0.1:' + CDP_PORT)`, reuse the first non-blank page, install your platform helpers, then `require(snippet)(page, helpers)`.
5. Never call `browser.close()` on a CDP connection: it closes the browser you attached to.

The `bin/*.cjs` helpers use the same CDP connection and need playwright-core installed by `bin/setup`. If a helper cannot load it, rerun setup rather than pointing at a temp directory that gets cleaned.

## Claude in Chrome (the user's real Chrome)

- **Keep exactly one tab open and drive it in the foreground.** A background tab is throttled hard and every in-page `setTimeout` chain hangs for minutes. Close each tab after submitting; past about 15 open tabs the browser slows and helper calls time out.
- Keep only one Chrome profile with the extension connected. Two connected profiles steal the connection from each other and in-flight forms are lost.
- If a batch reports "Browser extension is not connected", call `tabs_context_mcp` to reconnect. Assume the last action in the failed batch did NOT run and verify before repeating it.
- **Never build async in-page helpers with internal sleeps.** Split each multi-step widget into synchronous calls (`__open(id)`, then `__choose(id, want)`) with a host-side `wait` between them.
- Searchable comboboxes (school, city, phone country) need a real coordinate click plus real typed keystrokes. A JS-set value does not fire the async search.
- The `javascript_tool` refuses to return output containing `=`, `&` or `?`. Strip those from return strings.
- `get_page_text` can be denied on some domains; `read_page` and screenshots usually still work. For long pages, read text in slices.

### Geometry: check it before filling anything

If `ref` clicks land in the wrong place, typed text goes nowhere and `document.activeElement` stays BODY, the viewport and the screenshot disagree.

- Compare `window.innerWidth` with the width of the latest screenshot frame. If `innerWidth` is larger than `outerWidth`, the page zoom is below 100%. Ask the user to press Cmd+0 (or Ctrl+0) on the tab. That is the real fix.
- `resize_window` to about 1600x1000 and re-navigating can also bring them back in line.
- The screenshot frame is NOT constant across tabs or across a session. Read "coordinate frame: WxH" from the latest screenshot and compute the scale inside the same JS call that returns coordinates. Never carry a scale factor over from another tab.

```js
// scale = screenshot frame width / CSS viewport width
window.__S = FRAME_WIDTH / window.innerWidth;
window.__xy = (el) => { const r = el.getBoundingClientRect();
  return [Math.round((r.x + r.width / 2) * __S), Math.round((r.y + r.height / 2) * __S)]; };
window.__optxy = () => [...document.querySelectorAll('[id*="-option-"]')]
  .map(o => o.innerText.trim() + '@' + __xy(o).join(','));
```

- Re-screenshot immediately before every click. Greenhouse and Ashby reflow as content lazy-loads, so a coordinate from 10 seconds ago can hit nothing.
- `scrollIntoView({block: 'center', behavior: 'instant'})` (instant, not smooth) and read the rect in the same call. Near the top or bottom of a page a field cannot be centered, so never click an assumed y.
- Never send select-all (cmd+a) unless focus is confirmed inside the input. With focus on BODY it selects the page and the next keystroke can wipe the form.

## Which events each platform accepts

| Platform | Text inputs | Comboboxes, radios, checkboxes |
|---|---|---|
| Greenhouse | JS native setter plus `input`/`change` | Real clicks and keystrokes, or the synthetic pointer sequence (see `greenhouse.md`) |
| Ashby | Real typing only | Real clicks only |
| Lever, Workable, Rippling, Gusto, Pinpoint, Gem, ClearCompany | JS native setter | JS clicks mostly work; location autocompletes need real typing |
| SmartRecruiters | Real typing via a shadow-root walker, or Playwright | `spl-select-option.click()` after a real open |

The native setter pattern:

```js
const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
set.call(el, value);
el.dispatchEvent(new Event('input', { bubbles: true }));
el.dispatchEvent(new Event('change', { bubbles: true }));
el.dispatchEvent(new Event('blur', { bubbles: true }));
```

Use `HTMLTextAreaElement.prototype` for textareas.

## Resume uploads

- Most ATSs parse the resume and overwrite fields a few seconds after upload. Upload first, wait, then fill, and verify right before submit. Per-platform order is in each recipe.
- Hidden file inputs: make the input visible (`style.cssText`), `find` it, then `file_upload`; or `setInputFiles` in Playwright.
- **The file name is recruiter-visible.** Upload a PDF named like `First_Last_Resume.pdf`, never an internal working name such as `tailored.pdf`. Check the attachment name on screen before submitting.

## opencli (optional bash lane)

`@jackwener/opencli` drives the user's real Chrome from bash through its Browser Bridge extension, with clicks sent through CDP (so Ashby toggles commit).

- Syntax: `opencli browser <session> <cmd>`, with `open <url> --window foreground|background`, `state` (numbered refs), `fill '#id' text` (verifies the value), `type`, `click <ref|css> [--nth n]`, `check`, `upload '#id' /abs/path`, `eval "<js>"`, `wait time N`, `screenshot path.png`, `close`.
- `select` handles native `<select>` only. For react-select: `type '#degree--0' "Bachelor"` then `click '#react-select-degree--0-listbox [role=option]'`.
- Stock `upload` fails on hidden inputs (the extension clicks without a user gesture, and the CDP allowlist blocks `DOM.setFileInputFiles`). A local patch that replaces `setFileInput` with a base64 `DataTransfer` upload fixes it; re-apply after any upgrade.

## Shell gotchas

- zsh does not word-split `$var`, so `set -- $pair` loops silently pass one argument. Call scripts with explicit arguments.
- In zsh, a bare `echo =====` fails (`=` expansion). Quote it: `echo "-----"`.
