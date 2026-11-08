/* Ashby date inputs display typed text but React only commits a date chosen from
   the calendar, so type first THEN click the day cell, and read the value back. */
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
  const [url, dateStr, day] = process.argv.slice(2);
  const br = await chromium.connectOverCDP(pw.CDP);
  const key = url.replace(/^https?:\/\//,'').split('?')[0].slice(0,55);
  const page = br.contexts()[0].pages().find(p=>tabMatches(p.url(), url));
  const box = page.locator('input[placeholder="Pick date..."]').first();
  if(!await box.count()){console.log(JSON.stringify({err:'no date field'}));await br.close();return;}
  await box.scrollIntoViewIfNeeded(); await box.click(); await page.waitForTimeout(500);
  await box.fill(dateStr); await page.waitForTimeout(1400);
  const pos = await page.evaluate((d)=>{
    const cells=[...document.querySelectorAll('[role="gridcell"],td,button,div')]
      .filter(e=>(e.innerText||'').trim()===String(d))
      .filter(e=>{const r=e.getBoundingClientRect();return r.width>8&&r.width<70&&r.height>8&&r.height<70;});
    if(!cells.length) return null;
    const r=cells[cells.length-1].getBoundingClientRect();
    return {x:r.x+r.width/2,y:r.y+r.height/2};
  }, day);
  if(pos){ await page.mouse.click(pos.x,pos.y); await page.waitForTimeout(700); }
  console.log(JSON.stringify({clicked:!!pos, value: await box.inputValue().catch(()=>'')}));
  await br.close();
})().catch(e=>console.log(JSON.stringify({fatal:e.message.slice(0,120)})));
