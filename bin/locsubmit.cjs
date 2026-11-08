/* Ashby clears the location combobox after every failed submit, so re-select it
   and click Submit in the SAME pass with nothing in between. */
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
  const box = page.locator('[data-field-path="_systemfield_location"] input, input.ashby-application-form-input-autocomplete').first();
  await box.scrollIntoViewIfNeeded(); await box.click(); await page.waitForTimeout(300);
  await box.fill(''); await page.waitForTimeout(400);
  await page.keyboard.type(query,{delay:100});
  await page.waitForTimeout(3200);
  const pick = await page.evaluate((re)=>{
    const rx=new RegExp(re,'i');
    const rs=[...document.querySelectorAll('[class*="_result_"]')]
      .filter(e=>{const r=e.getBoundingClientRect();return r.width>60&&r.height>8;})
      .filter(e=>!/no result/i.test(e.innerText||''));
    const w=rs.find(e=>rx.test(e.innerText.trim()))||rs[0];
    if(!w) return null;
    const r=w.getBoundingClientRect();
    return {t:w.innerText.trim(), x:r.x+r.width/2, y:r.y+r.height/2};
  }, wantRe||query);
  if(!pick){console.log(JSON.stringify({err:'no location result'}));await br.close();return;}
  await page.mouse.click(pick.x,pick.y); await page.waitForTimeout(900);
  const val = await box.inputValue().catch(()=>'');
  // submit immediately
  for (const t of [/submit application/i,/^submit$/i]) {
    const b=page.getByRole('button',{name:t}).first();
    if(await b.count().catch(()=>0)){ try{ await b.click({timeout:5000}); break; }catch{} }
  }
  await page.waitForTimeout(6000);
  const st = await page.evaluate(()=>{
    const t=document.body.innerText.toLowerCase();
    const files=document.querySelectorAll('input[type="file"]').length;
    const subs=[...document.querySelectorAll('button')].filter(e=>/submit|apply/i.test(e.innerText||'')).length;
    return {gone:files===0&&subs===0, thanks:/(thank|receiv|submitted|appreciate)/.test(t), url:location.href,
      errors:[...new Set([...document.querySelectorAll('[aria-invalid="true"],[role="alert"],[class*="error" i]')]
        .map(e=>(e.innerText||'').replace(/\s+/g,' ').trim()).filter(x=>x&&x.length<120))].slice(0,6)};
  });
  st.locationSet=val; st.picked=pick.t; st.applied=st.gone&&st.thanks;
  console.log(JSON.stringify(st));
  await br.close();
})().catch(e=>console.log(JSON.stringify({fatal:e.message.slice(0,130)})));
