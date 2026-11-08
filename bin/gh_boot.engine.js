// Universal Greenhouse form filler engine. Build the injectable bundle with bin/gh-boot,
// which prepends your profile-derived window.__P and window.RULES.
//
// Two hard-won constraints shape every function here:
//   1. Never sleep in-page. document.hidden throttles setTimeout and the CDP eval times out at 45s.
//      Callers put `computer` wait actions BETWEEN js calls instead, which is why every combobox
//      helper is split into an open half (__open2) and a click half (__click2).
//   2. Never reuse a control immediately. document.activeElement.blur() first, or the second
//      mousedown toggles the still-open menu shut and the option list reads back empty.
window.__set = (id, v) => {
  const e = document.getElementById(id);
  if (!e) return 'NF';
  const p = e.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement;
  const d = Object.getOwnPropertyDescriptor(p.prototype, 'value');
  d.set.call(e, v);
  e.dispatchEvent(new Event('input', { bubbles: true }));
  e.dispatchEvent(new Event('change', { bubbles: true }));
  return 'ok';
};

window.__ev = (el, t, x = {}) => {
  const r = el.getBoundingClientRect();
  const o = { bubbles: true, cancelable: true, view: window, button: 0,
    buttons: t.endsWith('up') || t === 'click' ? 0 : 1,
    clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, ...x };
  el.dispatchEvent(t.startsWith('pointer')
    ? new PointerEvent(t, { ...o, pointerId: 1, isPrimary: true })
    : new MouseEvent(t, o));
};

// Walk up to the react-select control that owns this input. Scoped deliberately:
// a loose parent walk finds a neighbour's single-value and __val reports false positives.
window.__ctl = (id) => {
  const e = document.getElementById(id);
  if (!e) return null;
  let n = e.parentElement;
  for (let k = 0; k < 6 && n; k++) {
    if (/select__control/.test(n.className || '')) return n;
    n = n.parentElement;
  }
  return e.parentElement;
};

window.__open2 = (id, t) => {
  const e = document.getElementById(id);
  if (!e) return id + ':NF';
  const c = __ctl(id);
  c.scrollIntoView({ block: 'center', behavior: 'instant' });  // off-screen controls render 0 options
  ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(x => __ev(c, x));
  e.focus();
  const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  d.set.call(e, t);
  e.dispatchEvent(new Event('input', { bubbles: true }));
  return id + ' open';
};

window.__click2 = (id, t, loose) => {
  const e = document.getElementById(id);
  if (!e) return id + ':NF';
  const lb = document.getElementById(e.getAttribute('aria-controls'));
  const o = lb ? [...lb.querySelectorAll('[id*="-option-"]')] : [];
  const N = s => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const n = N(t);
  let x = o.find(a => N(a.innerText) === n)
    || o.find(a => N(a.innerText).startsWith(n))
    || (loose ? o.find(a => N(a.innerText).includes(n)) : null);
  if (!x) {
    e.blur();
    return id + ':NOMATCH "' + t + '" /' + o.length + '/ ' + o.slice(0, 8).map(a => a.innerText.trim()).join(' ~ ');
  }
  const g = x.innerText.trim();
  ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(y => __ev(x, y));
  return id + ' -> ' + g;
};

window.__val = (id) => {
  const e = document.getElementById(id);
  if (!e) return id + '=NF';
  const c = __ctl(id);
  if (!c) return id + '=noctl';
  const s = c.querySelector('[class*=single-value]');
  return id + '=' + (s ? s.innerText.trim() : '(EMPTY)');
};

// Label regexes, most specific first. Order is load-bearing: /gender/ would swallow
// "Transgender Status" and /university/ would swallow "Are you a current university student?".
// window.RULES and window.__P are NOT defined here: bin/gh-boot generates them from
// profile/profile.json (+ profile/form_rules.json) and prepends them to this engine.
window.RULES = window.RULES || [];
window.__P = window.__P || {};

window.__ans = (label) => {
  for (const [re, a] of RULES) if (re.test(label)) return a;
  return null;
};

// DOM-based planner. __remixContext is the richer source (it carries option labels) but goes
// empty after a client-side router navigation, so the DOM is the one that always works.
window.__plan = () => {
  const out = [];
  document.querySelectorAll('label[for]').forEach(l => {
    const id = l.getAttribute('for');
    const e = document.getElementById(id);
    if (!e || e.type === 'hidden') return;
    const label = (l.innerText || '').replace(/\s+/g, ' ').trim();
    const req = /\*/.test(label) || e.required;
    let type = 'input_text';
    if (e.tagName === 'TEXTAREA') type = 'textarea';
    else if (e.type === 'file') type = 'input_file';
    else if (e.type === 'checkbox') type = 'checkbox';
    else if (/select__input/.test(e.className || '')) type = 'multi_value_single_select';
    out.push({ id, type, req, label: label.replace(/\*$/, '').trim().slice(0, 80), v: __ans(label), opts: [] });
  });
  return out;
};

window.__fill = () => {
  const r = [];
  for (const [id, v] of __P.text_fields || [])
    if (v && document.getElementById(id)) r.push(id + ':' + __set(id, v));
  for (const p of __plan()) {
    if (p.type !== 'input_text' && p.type !== 'textarea') continue;
    const e = document.getElementById(p.id);
    if (!e || e.value) continue;
    if (/describe the nature|if yes, please (describe|explain)/i.test(p.label)) {
      if (__P.outside_work) r.push(p.id + ':' + __set(p.id, __P.outside_work));
    }
    else if (p.v && !/^(Yes|No|I agree)$/.test(p.v)) r.push(p.id + ':' + __set(p.id, p.v));
  }
  return r.join(', ');
};

// Queue runner. __no() opens the next control, __nc() commits it. One pair per
// combobox, with a `computer` wait between the two halves.
window.__q = []; window.__qi = 0; window.__cur = null; window.__qlog = []; window.__qall = [];

window.__mkq = () => {
  const q = [];
  const late = new Set((__P.eeo_selects || []).map(x => x[0]));
  for (const [id, v] of __P.select_fields || [])
    if (v && document.getElementById(id)) q.push([id, v]);
  for (const p of __plan()) if (/select/.test(p.type) && p.v && !late.has(p.id)) q.push([p.id, p.v]);
  for (const [id, v] of __P.eeo_selects || [])
    if (v && document.getElementById(id)) q.push([id, v]);
  window.__qall = q; window.__q = q; window.__qi = 0; window.__cur = null; window.__qlog = [];
  return q.length + ' queued';
};

window.__no = () => {
  while (__qi < __q.length) {
    __cur = __q[__qi++];
    if (document.getElementById(__cur[0])) {
      const r = __open2(__cur[0], __cur[1]);
      return /NF/.test(r) ? r : '';
    }
  }
  __cur = null;
  return 'DONE';
};

window.__nc = () => {
  if (!__cur) return '';
  const r = __click2(__cur[0], __cur[1]);
  __qlog.push(r);
  __cur = null;
  return /NOMATCH|NF/.test(r) ? r : '';
};

// Re-queue anything that silently failed to commit. Run before every submit.
window.__sweep = () => {
  const q = [];
  for (const [id, v] of __qall) if (document.getElementById(id) && /EMPTY/.test(__val(id))) q.push([id, v]);
  __q = q; __qi = 0; __cur = null; __qlog = [];
  return q.length + ' resweep: ' + q.map(x => x[0]).join(',');
};

window.__missing = () => {
  const bad = [];
  document.querySelectorAll('label').forEach(l => {
    if (!/\*/.test(l.innerText)) return;
    const id = l.getAttribute('for');
    if (!id) return;
    const e = document.getElementById(id);
    if (!e || e.type === 'file') return;
    const isSel = /select__input/.test(e.className || '');
    const v = isSel ? __val(id) : (e.value || '').trim();
    if (isSel ? /EMPTY/.test(v) : !v) bad.push(id + '::' + l.innerText.replace(/\s+/g, ' ').slice(0, 50));
  });
  return bad.length ? 'MISSING ' + bad.join(' | ') : 'ALL REQUIRED FILLED';
};

window.__sub = () => {
  const b = [...document.querySelectorAll('button')].find(x => /submit/i.test(x.innerText));
  if (!b) return 'NO BUTTON';
  b.click();
  return 'clicked';
};

'booted';
