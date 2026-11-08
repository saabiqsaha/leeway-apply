/* Real mouse click on the Submit button at its coordinates. Some Ashby forms
   ignore locator.click() when the button is overlaid or virtualised. */
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
  const url=process.argv[2];
  const br = await chromium.connectOverCDP(pw.CDP);
  const key=url.replace(/^https?:\/\//,'').split('?')[0].slice(0,55);
  const page = br.contexts()[0].pages().find(p=>tabMatches(p.url(), url));
  if(!page){console.log(JSON.stringify({err:'no tab'}));await br.close();return;}
  const pos = await page.evaluate(()=>{
    const b=[...document.querySelectorAll('button,input[type=submit]')]
      .find(e=>/submit application|^submit$/i.test((e.innerText||e.value||'').trim()));
    if(!b) return null;
    b.scrollIntoView({block:'center'});
    const r=b.getBoundingClientRect();
    return {t:(b.innerText||b.value||'').trim(), dis:b.disabled, x:r.x+r.width/2, y:r.y+r.height/2};
  });
  if(!pos){console.log(JSON.stringify({err:'no submit button'}));await br.close();return;}
  await page.waitForTimeout(400);
  await page.mouse.click(pos.x,pos.y);
  await page.waitForTimeout(8000);
  const st = await page.evaluate(()=>{
    const t=document.body.innerText.toLowerCase();
    const files=document.querySelectorAll('input[type="file"]').length;
    const subs=[...document.querySelectorAll('button')].filter(e=>/submit|apply/i.test(e.innerText||'')).length;
    return {gone:files===0&&subs===0, thanks:/(thank|receiv|submitted|appreciate)/.test(t), url:location.href,
      errors:[...new Set([...document.querySelectorAll('[role="alert"],[class*="error" i]')]
        .map(e=>(e.innerText||'').replace(/\s+/g,' ').trim()).filter(x=>x&&x.length<120))].slice(0,5)};
  });
  st.button=pos.t; st.disabled=pos.dis; st.applied=st.gone&&st.thanks;
  console.log(JSON.stringify(st));
  await br.close();
})().catch(e=>console.log(JSON.stringify({fatal:e.message.slice(0,130)})));
