/* Ticks checkboxes by label via label[for=id] (inputs are often opacity:0), verifies. */
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
  const [url, wanted] = process.argv.slice(2);
  const labels = JSON.parse(wanted);
  const br = await chromium.connectOverCDP(pw.CDP);
  const key=url.replace(/^https?:\/\//,'').split('?')[0].slice(0,55);
  const page = br.contexts()[0].pages().find(p=>tabMatches(p.url(), url));
  const out=[];
  for (const want of labels) {
    const id = await page.evaluate((w)=>{
      const clean=t=>String(t||'').replace(/\s+/g,' ').trim();
      for (const cb of document.querySelectorAll('input[type="checkbox"]')) {
        const l=cb.labels&&cb.labels[0]?clean(cb.labels[0].innerText):'';
        if (l.toLowerCase()===w.toLowerCase()) { if(cb.checked) return 'ALREADY'; return cb.id||null; }
      }
      return null;
    }, want);
    if (id==='ALREADY'){ out.push([want,'already']); continue; }
    if (!id){ out.push([want,'NOT_FOUND']); continue; }
    try {
      const lab=page.locator(`label[for="${id.replace(/([\[\]])/g,'\\$1')}"]`).first();
      if (await lab.count()) { await lab.scrollIntoViewIfNeeded(); await lab.click({timeout:4000}); }
      else await page.locator(`[id="${id}"]`).first().check({force:true});
      await page.waitForTimeout(350);
      const ok = await page.evaluate((i)=>{const e=document.getElementById(i); return e?e.checked:false;}, id);
      out.push([want, ok?'set':'FAILED']);
    } catch(e){ out.push([want,'ERR '+e.message.slice(0,40)]); }
  }
  console.log(JSON.stringify(out));
  await br.close();
})().catch(e=>console.log(JSON.stringify({fatal:e.message.slice(0,120)})));
