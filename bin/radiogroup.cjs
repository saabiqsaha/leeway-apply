/* Selects a radio inside an Ashby fieldset by (group question, option label).
   Clicks label[for=id] because the inputs are opacity:0 overlays, then verifies. */
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
  const url=process.argv[2]; const picks=JSON.parse(process.argv[3]);
  const br = await chromium.connectOverCDP(pw.CDP);
  const key=url.replace(/^https?:\/\//,'').split('?')[0].slice(0,55);
  const page = br.contexts()[0].pages().find(p=>tabMatches(p.url(), url));
  const out=[];
  for (const {q,opt} of picks){
    const id = await page.evaluate(({q,opt})=>{
      const clean=t=>String(t||'').replace(/\s+/g,' ').trim();
      for (const fs of document.querySelectorAll('fieldset')){
        const l=fs.querySelector('label');
        if(!l || !clean(l.innerText).toLowerCase().includes(q.toLowerCase())) continue;
        for (const r of fs.querySelectorAll('input[type="radio"],input[type="checkbox"]')){
          const rl=r.labels&&r.labels[0]?clean(r.labels[0].innerText):'';
          if (rl.toLowerCase()===opt.toLowerCase()) return r.id||null;
        }
      }
      return null;
    },{q,opt});
    if(!id){ out.push([q.slice(0,34),'NOT_FOUND']); continue; }
    try{
      const lab=page.locator(`label[for="${id}"]`).first();
      await lab.scrollIntoViewIfNeeded(); await lab.click({timeout:4000}); await page.waitForTimeout(400);
      const ok=await page.locator(`[id="${id}"]`).first().isChecked().catch(()=>false);
      out.push([q.slice(0,34), ok?'set':'FAILED']);
    }catch(e){ out.push([q.slice(0,34),'ERR '+e.message.slice(0,40)]); }
  }
  console.log(JSON.stringify(out));
  await br.close();
})().catch(e=>console.log(JSON.stringify({fatal:e.message.slice(0,120)})));
