/* Greenhouse "Location (City)" react-select: clear, type slowly, then CLICK the
   matching row in .select__menu. Typed text alone fails validation. */
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
  const [url, city, wantRe] = process.argv.slice(2);
  const br = await chromium.connectOverCDP(pw.CDP);
  const key=url.replace(/^https?:\/\//,'').split('?')[0].slice(0,55);
  const page = br.contexts()[0].pages().find(p=>tabMatches(p.url(), url));
  if(!page){console.log(JSON.stringify({err:'no tab'}));await br.close();return;}
  const box = page.locator('input#candidate-location').first();
  if(!await box.count()){console.log(JSON.stringify({err:'no location input'}));await br.close();return;}
  await box.scrollIntoViewIfNeeded(); await box.click(); await page.waitForTimeout(300);
  await box.fill(''); await page.waitForTimeout(500);
  for (const ch of city){ await page.keyboard.type(ch); await page.waitForTimeout(130); }
  await page.waitForTimeout(3000);
  const pick = await page.evaluate((re)=>{
    const rx=new RegExp(re,'i');
    const m=document.querySelector('.select__menu'); if(!m) return {saw:'NO MENU'};
    const o=[...m.querySelectorAll('[class*="option"]')].filter(e=>!/no option/i.test(e.innerText||''));
    const want=o.find(e=>rx.test((e.innerText||'').trim())) || o[0];
    if(!want) return {saw:o.map(e=>e.innerText.trim()).slice(0,5)};
    const r=want.getBoundingClientRect();
    return {t:(want.innerText||'').trim(), x:r.x+r.width/2, y:r.y+r.height/2};
  }, wantRe||city);
  if(pick&&pick.x){ await page.mouse.click(pick.x,pick.y); await page.waitForTimeout(800); }
  const shown = await page.evaluate(()=>{
    const c=document.querySelector('#candidate-location'); const ctl=c&&c.closest('[class*="select__control"]');
    return ctl?(ctl.innerText||'').replace(/\s+/g,' ').trim().slice(0,60):'';
  });
  console.log(JSON.stringify({picked:pick&&pick.t, saw:pick&&pick.saw, control:shown}));
  await br.close();
})().catch(e=>console.log(JSON.stringify({fatal:e.message.slice(0,120)})));
