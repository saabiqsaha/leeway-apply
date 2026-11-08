// Shared bits for the bin/*.cjs form helpers.
// They all attach to ONE long-lived Chrome (started by bin/chrome) over CDP, so
// page state survives between calls and the agent drives a single foreground tab.
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_CORE_PATH,
    path.join(REPO, '.tools', 'node_modules', 'playwright-core'),
    'playwright-core',
  ].filter(Boolean);
  for (const c of candidates) {
    try { return require(c); } catch (_) { /* try next */ }
  }
  throw new Error('playwright-core not found. Run bin/setup (installs it into .tools/).');
}

function profile() {
  const dir = process.env.LEEWAY_PROFILE_DIR || path.join(REPO, 'profile');
  const f = path.join(dir, 'profile.json');
  if (!fs.existsSync(f)) throw new Error(`No ${f}. Run bin/setup and fill it in.`);
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

function resumePath() {
  if (process.env.RESUME_PATH) return process.env.RESUME_PATH;
  const rel = (profile().resume || {}).pdf || 'profile/resume.pdf';
  return path.isAbsolute(rel) ? rel : path.join(REPO, rel);
}

const CDP = process.env.CDP_URL || `http://127.0.0.1:${process.env.CDP_PORT || 9333}`;

module.exports = {
  REPO,
  CDP,
  profile,
  resumePath,
  get chromium() { return loadPlaywright().chromium; },
};
