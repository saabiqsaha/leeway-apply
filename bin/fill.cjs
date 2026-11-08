#!/usr/bin/env node
/* Question-keyed form filler. Refs do not survive React re-renders (Ashby rotates
   them on every DOM update), so answers are keyed by QUESTION TEXT and elements are
   resolved fresh at fill time. Every value is read back and verified. */
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
const fs = require('fs');
const RESUME = pw.resumePath();

(async () => {
  const [url, file, mode] = process.argv.slice(2);
  const answers = JSON.parse(fs.readFileSync(file, 'utf8')); // [{match, value, kind}]
  const br = await chromium.connectOverCDP(pw.CDP);
  const ctx = br.contexts()[0];
  const key = url.replace(/^https?:\/\//, '').split('?')[0].slice(0, 55);
  let page = ctx.pages().find((p) => { try { return tabMatches(p.url(), url); } catch { return false; } });
  if (!page) { page = await ctx.newPage(); await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }); await page.waitForTimeout(2500); }

  // resume first; it often triggers a re-render
  const files = page.locator('input[type="file"]');
  const fc = await files.count();
  for (let i = 0; i < fc; i += 1) {
    try { const has = await files.nth(i).evaluate((e) => e.files && e.files.length > 0); if (!has) { await files.nth(i).setInputFiles(RESUME); await page.waitForTimeout(900); } } catch {}
  }

  const report = [];
  for (const a of answers) {
    if (a.kind === 'combo') {
      // react-select: locate by question text, click, read options, pick, verify
      try {
        const marked = await page.evaluate((needle) => {
          const clean = (t) => String(t || '').replace(/\s+/g, ' ').trim();
          const norm = (t) => clean(t).toLowerCase().replace(/[‘’]/g, "'");
          const n = norm(needle);
          const ctrls = [...document.querySelectorAll('[class*="select__control"],[class*="-control"],[role="combobox"]')];
          for (const c of ctrls) {
            const r = c.getBoundingClientRect();
            if (r.width < 20 || r.height < 8) continue;
            // The label sits several levels up (select__container > select-shell >
            // div > select__control), so closest('div') never reached it.
            let lab = null; let up = c; let hops = 0;
            while (up && !lab && hops < 6) { lab = up.querySelector && up.querySelector('label'); if (!lab) up = up.parentElement; hops += 1; }
            const q = norm(lab ? lab.innerText : (up ? up.innerText : ''));
            if (!q.includes(n)) continue;
            if (clean(c.innerText) && !/^select\.\.\.$|^select$/i.test(clean(c.innerText))) return 'FILLED';
            c.dataset.dvTarget = '1';
            c.scrollIntoView({ block: 'center' });
            return 'OK';
          }
          return 'NOT_FOUND';
        }, a.match);
        if (marked !== 'OK') { report.push([a.match.slice(0, 42), marked, '']); continue; }
        const box = page.locator('[data-dv-target="1"]').first();
        await box.click({ timeout: 4000 });
        await page.waitForTimeout(500);
        // Long option lists (every university) only render matches once filtered.
        if (a.type) {
          await page.keyboard.type(String(a.type), { delay: 45 });
          await page.waitForTimeout(1100);
        }
        const opts = await page.evaluate(() => {
          // Scope to the control we opened. Reading [role=option] globally picked up
          // the phone widget's country list and returned "Afghanistan+93" for a
          // security-clearance question.
          const c = document.querySelector('[data-dv-target="1"]');
          const scope = (c && c.closest('[class*="select__container"]')) || c || document;
          let l = [...scope.querySelectorAll('[class*="select__menu"] [class*="option"], [role="option"]')];
          if (!l.length) l = [...document.querySelectorAll('[class*="select__menu"] [class*="option"]')];
          l = l.filter((o) => { const r = o.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
          return l.map((o, i) => { o.dataset.dvo = String(i); return { i, t: (o.innerText || '').replace(/\s+/g, ' ').trim() }; });
        });
        const want = String(a.value).toLowerCase();
        const hit = opts.find((o) => o.t.toLowerCase() === want)
                 || opts.find((o) => o.t.toLowerCase().startsWith(want))
                 || opts.find((o) => o.t.toLowerCase().includes(want));
        if (!hit) {
          report.push([a.match.slice(0, 42), 'NO_OPTION', opts.map((o) => o.t).slice(0, 8).join('/')]);
          await page.keyboard.press('Escape');
          await page.evaluate(() => document.querySelectorAll('[data-dv-target]').forEach((e) => e.removeAttribute('data-dv-target')));
          continue;
        }
        await page.locator(`[data-dvo="${hit.i}"]`).first().click({ timeout: 3000 });
        await page.waitForTimeout(400);
        report.push([a.match.slice(0, 42), 'set', hit.t.slice(0, 34)]);
        await page.evaluate(() => document.querySelectorAll('[data-dv-target]').forEach((e) => e.removeAttribute('data-dv-target')));
      } catch (e) {
        report.push([a.match.slice(0, 42), 'ERR', e.message.slice(0, 50)]);
      }
      continue;
    }
    const res = await page.evaluate(({ match, value, kind }) => {
      const clean = (t) => String(t || '').replace(/\s+/g, ' ').trim();
      const norm = (t) => clean(t).toLowerCase().replace(/[‘’]/g, "'");
      const m = norm(match);
      const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const qOf = (el) => {
        if (el.labels && el.labels[0]) return clean(el.labels[0].innerText);
        if (el.getAttribute('aria-label')) return clean(el.getAttribute('aria-label'));
        const w = el.closest('div,fieldset,li'); if (!w) return '';
        const l = w.querySelector('label,legend'); if (l) return clean(l.innerText);
        return clean(w.innerText).slice(0, 120);
      };
      if (kind === 'radio') {
        const rs = [...document.querySelectorAll('input[type="radio"]')];
        // Exact label match ALWAYS wins. A single exact-or-includes pass let the
        // first radio in a group win on substring (e.g. "J1 F1 None Other"
        // contains "f1"), which could silently select the wrong visa status.
        let t = rs.find((r) => norm(qOf(r)) === m);
        if (!t) {
          const partial = rs.filter((r) => norm(qOf(r)).includes(m));
          if (partial.length > 1) return { st: 'AMBIGUOUS', now: partial.map((r) => norm(qOf(r)).slice(0, 24)).join('|') };
          t = partial[0];
        }
        if (!t) return { st: 'NOT_FOUND' };
        if (t.checked) return { st: 'already' };
        if (t.id) { const lab = document.querySelector(`label[for="${CSS.escape(t.id)}"]`); if (lab) { lab.click(); return { st: t.checked ? 'set' : 'clicked_label' }; } }
        t.click(); return { st: t.checked ? 'set' : 'FAILED' };
      }
      const els = [...document.querySelectorAll('input,textarea,select')].filter((e) => e.type !== 'hidden' && e.type !== 'file' && vis(e));
      let t = els.find((e) => norm(qOf(e)) === m);
      if (!t) {
        const partial = els.filter((e) => norm(qOf(e)).includes(m));
        if (partial.length > 1) return { st: 'AMBIGUOUS', now: partial.map((e) => norm(qOf(e)).slice(0, 24)).join('|') };
        t = partial[0];
      }
      if (!t) return { st: 'NOT_FOUND' };
      if (t.tagName === 'SELECT') {
        const o = [...t.options].find((x) => norm(x.text) === norm(value)) || [...t.options].find((x) => norm(x.text).includes(norm(value)));
        if (!o) return { st: 'NO_OPTION', saw: [...t.options].map((x) => clean(x.text)).slice(0, 8) };
        t.value = o.value; t.dispatchEvent(new Event('change', { bubbles: true })); return { st: 'set', now: clean(o.text) };
      }
      const setter = Object.getOwnPropertyDescriptor(
        t.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype, 'value').set;
      setter.call(t, String(value));
      t.dispatchEvent(new Event('input', { bubbles: true }));
      t.dispatchEvent(new Event('change', { bubbles: true }));
      return { st: t.value === String(value) ? 'set' : 'MISMATCH', now: String(t.value).slice(0, 40) };
    }, a);
    report.push([a.match.slice(0, 42), res.st, res.now || (res.saw ? res.saw.join('/') : '')]);
    await page.waitForTimeout(180);
  }

  if (mode === 'submit') {
    for (const t of [/submit application/i, /^submit$/i, /^apply$/i]) {
      const b = page.getByRole('button', { name: t }).first();
      if (await b.count().catch(() => 0)) { try { await b.click({ timeout: 4000 }); break; } catch {} }
    }
    await page.waitForTimeout(5000);
    const st = await page.evaluate(() => {
      const txt = document.body.innerText.toLowerCase();
      const files = document.querySelectorAll('input[type="file"]').length;
      const subs = [...document.querySelectorAll('button,input[type=submit]')].filter((e) => /submit|apply/i.test(e.innerText || e.value || '')).length;
      return { gone: files === 0 && subs === 0, thanks: /(thank|receiv|submitted|appreciate)/.test(txt), url: location.href,
        errors: [...new Set([...document.querySelectorAll('[aria-invalid="true"],[role="alert"],[class*="error" i]')]
          .map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()).filter((t) => t && t.length < 130))].slice(0, 8) };
    });
    st.applied = st.gone && st.thanks;
    console.log(JSON.stringify({ report, submit: st }));
  } else {
    console.log(JSON.stringify({ report }));
  }
  await br.close();
})().catch((e) => { console.log(JSON.stringify({ fatal: e.message.slice(0, 160) })); process.exit(1); });
