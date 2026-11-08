/* Ashby autocomplete inputs (placeholder "Start typing...") need a real typed
   query and a clicked suggestion; typed text alone never commits. */
const pw = require('../lib/pw.cjs');
const { chromium } = pw;
(async () => {
  const [url, labelText, query] = process.argv.slice(2);
  const br = await chromium.connectOverCDP(pw.CDP);
  const key=url.replace(/^https?:\/\//,'').split('?')[0].slice(0,55);
  const page = br.contexts()[0].pages().find(p=>p.url().includes(key));
  const ok = await page.evaluate((lt)=>{
    const clean=t=>String(t||'').replace(/\s+/g,' ').trim();
    const lab=[...document.querySelectorAll('label')].find(l=>clean(l.innerText).toLowerCase().includes(lt.toLowerCase()));
    if(!lab) return false;
    const w=lab.closest('div'); const inp=w&&w.querySelector('input');
    if(!inp) return false; inp.dataset.owAc='1'; inp.scrollIntoView({block:'center'}); return true;
  }, labelText);
  if(!ok){console.log(JSON.stringify({err:'input not found'}));await br.close();return;}
  const box=page.locator('[data-ow-ac="1"]').first();
  await box.click(); await page.waitForTimeout(300);
  await box.fill(''); await page.waitForTimeout(300);
  await page.keyboard.type(query,{delay:95});
  await page.waitForTimeout(2800);
  const pick = await page.evaluate(()=>{
    const l=[...document.querySelectorAll('[role="option"],[class*="option"],[class*="suggestion"],li')]
      .filter(e=>{const r=e.getBoundingClientRect();return r.width>40&&r.height>8&&r.height<80;})
      .filter(e=>{const t=(e.innerText||'').trim();return t.length>2&&!/no option/i.test(t);});
    if(!l.length) return null;
    const r=l[0].getBoundingClientRect();
    return {t:(l[0].innerText||'').trim().slice(0,60), x:r.x+r.width/2, y:r.y+r.height/2};
  });
  if(pick){ await page.mouse.click(pick.x,pick.y); await page.waitForTimeout(800); }
  console.log(JSON.stringify({picked:pick&&pick.t, value:await box.inputValue().catch(()=>'')}));
  await br.close();
})().catch(e=>console.log(JSON.stringify({fatal:e.message.slice(0,120)})));
