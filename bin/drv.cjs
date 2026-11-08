#!/usr/bin/env node
/* Agent-driven form driver. Connects to the long-lived Chrome (bin/chrome, CDP_PORT) so page
   state survives between calls. `scan` returns the real questions; `apply` fills
   an explicit answer map and VERIFIES each value before submitting. */
const pw = require('../lib/pw.cjs');
const { chromium } = pw;
function tabKey(u) {
  const noProto = u.replace(/^https?:\/\//, '');
  const m = u.match(/[?&](?:token|gh_jid)=(\d+)/);
  if (m) return noProto.split('?')[0].slice(0, 55) + '|' + m[1];
  return noProto.split('?')[0].slice(0, 55);
}
function tabMatches(pageUrl, target) {
  const k = tabKey(target);
  if (k.indexOf('|') >= 0) {
    const parts = k.split('|');
    return pageUrl.indexOf(parts[0]) >= 0 && pageUrl.indexOf(parts[1]) >= 0;
  }
  return pageUrl.indexOf(k) >= 0;
}
const CDP = pw.CDP;
const RESUME = pw.resumePath();

const SCAN = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const clean = (t) => String(t || '').replace(/\s+/g, ' ').trim();
  const qFor = (el) => {
    if (el.labels && el.labels[0]) return clean(el.labels[0].innerText);
    if (el.getAttribute('aria-label')) return clean(el.getAttribute('aria-label'));
    const w = el.closest('div,fieldset,li'); if (!w) return '';
    const l = w.querySelector('label,legend'); if (l) return clean(l.innerText);
    let p = w.previousElementSibling, q = '';
    while (p && !q) { q = clean(p.innerText); p = p.previousElementSibling; }
    return q;
  };
  const out = { url: location.href, title: document.title, fields: [], groups: [], combos: [] };
  let i = 0;
  document.querySelectorAll('input,textarea,select').forEach((el) => {
    if (el.type === 'hidden') return;
    if (el.type !== 'file' && !vis(el)) return;
    el.dataset.dv = 'f' + i;
    const f = { ref: 'f' + i, tag: el.tagName.toLowerCase(), type: el.type || '', q: qFor(el).slice(0, 120),
                req: !!el.required, val: el.type === 'file' ? (el.files && el.files.length ? 'FILE' : '') : clean(el.value).slice(0, 40) };
    if (el.tagName === 'SELECT') f.options = [...el.options].map((o) => clean(o.text)).slice(0, 25);
    if (el.type === 'radio' || el.type === 'checkbox') { f.checked = el.checked; f.name = el.name; }
    out.fields.push(f); i += 1;
  });
  // react-select style dropdowns still showing a placeholder
  let c = 0;
  document.querySelectorAll('div,span').forEach((el) => {
    if (!/^(select\.\.\.|select|choose\.\.\.)$/i.test(clean(el.innerText))) return;
    const ctrl = el.closest('[class*="control"],[class*="Select"],[role="combobox"]') || el.parentElement;
    if (!ctrl || !vis(ctrl) || ctrl.dataset.dvc) return;
    ctrl.dataset.dvc = 'c' + c;
    out.combos.push({ ref: 'c' + c, q: qFor(ctrl).slice(0, 120) }); c += 1;
  });
  // Ashby button groups
  let g = 0; const seen = new Set();
  document.querySelectorAll('button[class*="_option_"]').forEach((b) => {
    const sc = b.closest('div[class*="_field"],fieldset,div'); if (!sc || seen.has(sc)) return;
    seen.add(sc);
    const list = [...sc.querySelectorAll('button[class*="_option_"]')];
    list.forEach((x, j) => { x.dataset.dvg = 'g' + g + '_' + j; });
    const l = sc.querySelector('label,legend');
    out.groups.push({ ref: 'g' + g, q: clean(l ? l.innerText : sc.innerText).slice(0, 120),
      opts: list.map((x, j) => ({ ref: 'g' + g + '_' + j, label: clean(x.innerText),
        on: /_active_/.test(x.className) || x.getAttribute('aria-pressed') === 'true' })) });
    g += 1;
  });
  out.errors = [...new Set([...document.querySelectorAll('[aria-invalid="true"],[role="alert"],[class*="error" i]')]
    .map((e) => clean(e.innerText)).filter((t) => t && t.length < 140))].slice(0, 10);
  return out;
};

(async () => {
  const [cmd, arg1, arg2] = process.argv.slice(2);
  const br = await chromium.connectOverCDP(CDP);
  const ctx = br.contexts()[0];
  const pick = async (url) => {
    for (const p of ctx.pages()) { try { if (tabMatches(p.url(), url)) return p; } catch {} }
    return null;
  };

  if (cmd === 'scan') {
    let page = await pick(arg1);
    if (!page) { page = await ctx.newPage(); await page.goto(arg1, { waitUntil: 'domcontentloaded', timeout: 45000 }); }
    await page.waitForTimeout(2500);
    for (const t of [/^apply/i, /apply now/i, /application/i]) {
      const b = page.getByRole('button', { name: t }).first();
      if (await b.count().catch(() => 0)) { try { await b.click({ timeout: 1500 }); await page.waitForTimeout(1500); } catch {} break; }
    }
    const files = page.locator('input[type="file"]');
    if (await files.count()) { try { await files.first().setInputFiles(RESUME); await page.waitForTimeout(1200); } catch {} }
    console.log(JSON.stringify(await page.evaluate(SCAN)));
    await br.close(); return;
  }

  if (cmd === 'apply') {
    const answers = JSON.parse(require('fs').readFileSync(arg2, 'utf8'));
    const page = await pick(arg1);
    if (!page) { console.log(JSON.stringify({ error: 'no open tab for url' })); await br.close(); return; }
    const report = [];
    for (const [ref, value] of Object.entries(answers)) {
      try {
        if (ref.startsWith('c')) {
          const box = page.locator(`[data-dvc="${ref}"]`).first();
          await box.scrollIntoViewIfNeeded(); await box.click({ timeout: 4000 }); await page.waitForTimeout(500);
          const opts = await page.evaluate(() => {
            let l = [...document.querySelectorAll('[role="option"]')];
            if (!l.length) l = [...document.querySelectorAll('[class*="menu"] [class*="option"]')];
            return l.map((o, i) => { o.dataset.dvo = String(i); return { i, t: (o.innerText || '').replace(/\s+/g, ' ').trim() }; });
          });
          const hit = opts.find((o) => o.t.toLowerCase() === String(value).toLowerCase())
                   || opts.find((o) => o.t.toLowerCase().includes(String(value).toLowerCase()));
          if (!hit) { report.push([ref, 'NO_MATCH', opts.map((o) => o.t).slice(0, 8).join('/')]); await page.keyboard.press('Escape'); continue; }
          await page.locator(`[data-dvo="${hit.i}"]`).first().click({ timeout: 3000 });
          await page.waitForTimeout(350); report.push([ref, 'set', hit.t]);
        } else if (ref.startsWith('g')) {
          const el = page.locator(`[data-dvg="${value}"]`).first();
          await el.evaluate((n) => n.scrollIntoView({ block: 'center' })); await page.waitForTimeout(200);
          const b = await el.boundingBox();
          await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(300);
          const on = await el.evaluate((n) => /_active_/.test(n.className) || n.getAttribute('aria-pressed') === 'true');
          report.push([ref, on ? 'set' : 'FAILED', String(value)]);
        } else {
          const el = page.locator(`[data-dv="${ref}"]`).first();
          const info = await el.evaluate((n) => ({ tag: n.tagName, type: n.type }));
          if (info.tag === 'SELECT') { await el.selectOption({ label: String(value) }); }
          else if (info.type === 'checkbox' || info.type === 'radio') {
            const id = await el.evaluate((n) => n.id);
            if (id) { const lab = page.locator(`label[for="${id}"]`).first();
              if (await lab.count()) await lab.click({ timeout: 3000 }); else await el.check({ force: true }); }
            else await el.check({ force: true });
          } else { await el.fill(String(value)); }
          await page.waitForTimeout(200);
          const now = await el.evaluate((n) => (n.type === 'checkbox' || n.type === 'radio') ? String(n.checked) : n.value);
          report.push([ref, String(now).toLowerCase().includes(String(value).toLowerCase()) || now === 'true' ? 'set' : 'MISMATCH', String(now).slice(0, 40)]);
        }
      } catch (e) { report.push([ref, 'ERR', e.message.slice(0, 60)]); }
    }
    console.log(JSON.stringify({ report }));
    await br.close(); return;
  }

  if (cmd === 'submit') {
    const page = await pick(arg1);
    if (!page) { console.log(JSON.stringify({ error: 'no tab' })); await br.close(); return; }
    for (const t of [/submit application/i, /submit/i, /^apply/i]) {
      const b = page.getByRole('button', { name: t }).first();
      if (await b.count().catch(() => 0)) { try { await b.click({ timeout: 4000 }); break; } catch {} }
    }
    await page.waitForTimeout(4000);
    const st = await page.evaluate(() => {
      const txt = document.body.innerText.toLowerCase();
      const files = document.querySelectorAll('input[type="file"]').length;
      const subs = [...document.querySelectorAll('button,input[type=submit]')].filter((e) => /submit|apply/i.test(e.innerText || e.value || '')).length;
      return { gone: files === 0 && subs === 0, thanks: /(thank|receiv|submitted|appreciate)/.test(txt),
        errors: [...new Set([...document.querySelectorAll('[aria-invalid="true"],[role="alert"],[class*="error" i]')]
          .map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()).filter((t) => t && t.length < 140))].slice(0, 8),
        url: location.href };
    });
    st.applied = st.gone && st.thanks;
    console.log(JSON.stringify(st));
    await br.close(); return;
  }

  if (cmd === 'close') { const p = await pick(arg1); if (p) await p.close(); await br.close(); return; }
  console.log('usage: scan <url> | apply <url> <answers.json> | submit <url> | close <url>');
  await br.close();
})().catch((e) => { console.log(JSON.stringify({ fatal: e.message.slice(0, 160) })); process.exit(1); });
