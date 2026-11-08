/* Ashby _systemfield_location autocomplete: type, then CLICK the exact matching
   _result_ row. Arrow-key selection picks the wrong city (it chose
   "Springfield, Missouri" for "Springfield, Illinois"), so match the text explicitly and read it back. */
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
  const [url, query, wantRe] = process.argv.slice(2);
  const br = await chromium.connectOverCDP(pw.CDP);
  const key=url.replace(/^https?:\/\//,'').split('?')[0].slice(0,55);
  const page = br.contexts()[0].pages().find(p=>tabMatches(p.url(), url));
  if(!page){console.log(JSON.stringify({err:'no tab'}));await br.close();return;}
  const box = page.locator('input.ashby-application-form-input-autocomplete, input[placeholder="Start typing..."]').first();
  if(!await box.count()){console.log(JSON.stringify({err:'no autocomplete'}));await br.close();return;}
  await box.scrollIntoViewIfNeeded(); await box.click(); await page.waitForTimeout(300);
  await box.fill(''); await page.waitForTimeout(250);
  await page.keyboard.type(query,{delay:95});
  await page.waitForTimeout(3200);
  const pick = await page.evaluate((re)=>{
    const rx=new RegExp(re,'i');
    const rs=[...document.querySelectorAll('[class*="_result_"]')]
      .filter(e=>{const r=e.getBoundingClientRect();return r.width>60&&r.height>8;});
    const want=rs.find(e=>rx.test((e.innerText||'').trim()));
    if(!want) return {saw:rs.map(e=>(e.innerText||'').trim().slice(0,44)).slice(0,6)};
    const r=want.getBoundingClientRect();
    return {t:(want.innerText||'').trim(), x:r.x+r.width/2, y:r.y+r.height/2};
  }, wantRe);
  if(pick && pick.x){ await page.mouse.click(pick.x,pick.y); await page.waitForTimeout(900); }
  console.log(JSON.stringify({picked:pick&&pick.t, saw:pick&&pick.saw, value:await box.inputValue().catch(()=>'')}));
  await br.close();
})().catch(e=>console.log(JSON.stringify({fatal:e.message.slice(0,120)})));
