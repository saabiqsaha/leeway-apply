/* Clicks Ashby _option_ button groups by matching their question text.
   Real mouse clicks at coordinates: dispatchEvent only paints the active class. */
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
  const url = process.argv[2];
  const picks = JSON.parse(process.argv[3]); // [{q, opt}]
  const br = await chromium.connectOverCDP(pw.CDP);
  const key = url.replace(/^https?:\/\//,'').split('?')[0].slice(0,55);
  const page = br.contexts()[0].pages().find(p=>tabMatches(p.url(), url));
  if(!page){console.log(JSON.stringify({err:'no tab'}));await br.close();return;}
  const out=[];
  for (const {q, opt} of picks) {
    const pos = await page.evaluate(({q,opt})=>{
      const clean=t=>String(t||'').replace(/\s+/g,' ').trim();
      const qUp=(el)=>{ let n=el,h=0;
        while(n&&h<6){ const w=n.closest('div[class*="_field"],fieldset,div');
          if(w){const l=w.querySelector('label,legend'); if(l&&clean(l.innerText)) return clean(l.innerText);}
          let p=(w||n).previousElementSibling,k=0;
          while(p&&k<3){const t=clean(p.innerText); if(t&&t.length>8) return t; p=p.previousElementSibling;k++;}
          n=(w||n).parentElement;h++; }
        return ''; };
      const gs=new Set();
      for (const b of document.querySelectorAll('button[class*="_option_"]')) {
        const sc=b.closest('div[class*="_field"],fieldset,div'); if(!sc||gs.has(sc))continue; gs.add(sc);
        if(!qUp(b).toLowerCase().includes(q.toLowerCase())) continue;
        const t=[...sc.querySelectorAll('button[class*="_option_"]')]
          .find(x=>clean(x.innerText).toLowerCase()===opt.toLowerCase());
        if(!t) return {miss:'no option'};
        if(/_active_/.test(t.className)||t.getAttribute('aria-pressed')==='true') return {already:true};
        t.scrollIntoView({block:'center'});
        const r=t.getBoundingClientRect();
        t.dataset.owPick='1';
        return {x:r.x+r.width/2, y:r.y+r.height/2};
      }
      return {miss:'no group'};
    },{q,opt});
    if (pos && pos.x) {
      await page.mouse.click(pos.x,pos.y); await page.waitForTimeout(400);
      const on = await page.evaluate(()=>{const e=document.querySelector('[data-ow-pick="1"]');
        if(!e) return null; const v=/_active_/.test(e.className)||e.getAttribute('aria-pressed')==='true';
        e.removeAttribute('data-ow-pick'); return v;});
      out.push([q.slice(0,40), on?'set':'FAILED']);
    } else out.push([q.slice(0,40), pos.already?'already':(pos.miss||'?')]);
  }
  console.log(JSON.stringify(out));
  await br.close();
})().catch(e=>console.log(JSON.stringify({fatal:e.message.slice(0,120)})));
