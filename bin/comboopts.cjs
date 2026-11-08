/* Lists each react-select control's label plus its options, so answers are chosen
   from what the form actually offers instead of guessed. */
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
(async () => {
  const [url, filter] = process.argv.slice(2);
  const br = await chromium.connectOverCDP(pw.CDP);
  const key=url.replace(/^https?:\/\//,'').split('?')[0].slice(0,55);
  const page = br.contexts()[0].pages().find(p=>tabMatches(p.url(), url));
  const labels = await page.evaluate(()=>{
    const clean=t=>String(t||'').replace(/\s+/g,' ').trim();
    const out=[];
    document.querySelectorAll('[class*="select__container"]').forEach((c,i)=>{
      const l=c.querySelector('label');
      c.dataset.dvIdx=String(i);
      out.push({i, label:clean(l?l.innerText:'').slice(0,70)});
    });
    return out;
  });
  for (const {i,label} of labels) {
    if (filter && !label.toLowerCase().includes(filter.toLowerCase())) continue;
    const ctl = page.locator(`[data-dv-idx="${i}"] [class*="select__control"]`).first();
    if (!await ctl.count()) { console.log(`${label} -> no control`); continue; }
    await ctl.scrollIntoViewIfNeeded().catch(()=>{});
    await ctl.click({timeout:3500}).catch(()=>{});
    await page.waitForTimeout(650);
    const opts = await page.evaluate((idx)=>{
      const c=document.querySelector(`[data-dv-idx="${idx}"]`);
      if(!c) return [];
      let l=[...c.querySelectorAll('[class*="select__menu"] [class*="option"], [role="option"]')];
      return l.map(o=>(o.innerText||'').replace(/\s+/g,' ').trim()).filter(Boolean).slice(0,14);
    }, i);
    console.log(`${label} -> ${JSON.stringify(opts)}`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  }
  await br.close();
})().catch(e=>console.log('ERR',e.message.slice(0,120)));
