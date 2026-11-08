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
const RESUME = pw.resumePath();
(async () => {
  const url=process.argv[2];
  const br = await chromium.connectOverCDP(pw.CDP);
  const key=url.replace(/^https?:\/\//,'').split('?')[0].slice(0,55);
  const page = br.contexts()[0].pages().find(p=>tabMatches(p.url(), url));
  if(!page){console.log(JSON.stringify({err:'no tab'}));await br.close();return;}
  const out={};
  // some Greenhouse uploaders only wire up after the "Attach" control is clicked
  const inputs = page.locator('input[type="file"]');
  const n = await inputs.count(); out.inputs = n;
  for (let i=0;i<n;i++){
    try{
      await inputs.nth(i).setInputFiles(RESUME);
      await page.waitForTimeout(1800);
    }catch(e){ out['err'+i]=e.message.slice(0,60); }
  }
  const resumeName = require('node:path').basename(RESUME).toLowerCase();
  out.state = await page.evaluate((resumeName)=>{
    const clean=t=>String(t||'').replace(/\s+/g,' ').trim();
    const fi=[...document.querySelectorAll('input[type="file"]')].map(f=>f.files&&f.files.length?f.files[0].name:'');
    const body=clean(document.body.innerText);
    return { files:fi, mentionsPdf:body.toLowerCase().includes(resumeName) };
  }, resumeName);
  console.log(JSON.stringify(out));
  await br.close();
})().catch(e=>console.log(JSON.stringify({fatal:e.message.slice(0,120)})));
