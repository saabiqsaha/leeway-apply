/* Checkbox labels repeat across question groups (Greenhouse ids look like
   question_<QID>[]_<OPTID>), so target by QID, never by label alone. */
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
  const [url, picksRaw] = process.argv.slice(2);
  const br = await chromium.connectOverCDP(pw.CDP);
  const key=url.replace(/^https?:\/\//,'').split('?')[0].slice(0,55);
  const page = br.contexts()[0].pages().find(p=>tabMatches(p.url(), url));
  const groups = await page.evaluate(()=>{
    const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
    const byQ={};
    document.querySelectorAll('input[type=checkbox]').forEach(cb=>{
      const m=(cb.id||'').match(/^question_(\d+)\[\]/); if(!m) return;
      const qid=m[1];
      if(!byQ[qid]) byQ[qid]={qid, q:'', opts:[]};
      byQ[qid].opts.push({lab:clean(cb.labels&&cb.labels[0]?cb.labels[0].innerText:''), id:cb.id, checked:cb.checked});
    });
    // the group's question is the nearest ancestor label mentioning "settings"/"Select all"
    Object.values(byQ).forEach(g=>{
      const first=document.getElementById(g.opts[0].id);
      let n=first,h=0;
      while(n&&!g.q&&h<8){ const w=n.closest('div,fieldset');
        if(w){ const ls=[...w.querySelectorAll('label,legend')].map(l=>clean(l.innerText))
          .filter(t=>/select all that apply|settings|which/i.test(t)); if(ls.length) g.q=ls[0]; }
        n=(w||n).parentElement; h++; }
    });
    return Object.values(byQ);
  });
  if(!picksRaw || picksRaw==='list'){
    groups.forEach(g=>console.log(`QID ${g.qid} :: ${g.q.slice(0,80)} :: ${g.opts.map(o=>o.lab+(o.checked?'[x]':'')).join(' | ')}`));
    await br.close(); return;
  }
  const picks=JSON.parse(picksRaw); const report=[];
  for (const {q,opts} of picks){
    const g=groups.find(g=>g.q.toLowerCase().includes(q.toLowerCase()));
    if(!g){ report.push([q.slice(0,34),'NO_GROUP']); continue; }
    for (const want of opts){
      const o=g.opts.find(o=>o.lab.toLowerCase()===want.toLowerCase());
      if(!o){ report.push([q.slice(0,26)+'/'+want,'NO_OPT']); continue; }
      if(o.checked){ report.push([q.slice(0,26)+'/'+want,'already']); continue; }
      try{
        const lab=page.locator(`label[for="${o.id.replace(/([\[\]])/g,'\\$1')}"]`).first();
        if(await lab.count()){ await lab.scrollIntoViewIfNeeded(); await lab.click({timeout:4000}); }
        else await page.locator(`[id="${o.id}"]`).first().check({force:true});
        await page.waitForTimeout(300);
        const ok=await page.evaluate(i=>{const e=document.getElementById(i);return e?e.checked:false;}, o.id);
        report.push([q.slice(0,26)+'/'+want, ok?'set':'FAILED']);
      }catch(e){ report.push([q.slice(0,26)+'/'+want,'ERR']); }
    }
  }
  console.log(JSON.stringify(report));
  await br.close();
})().catch(e=>console.log(JSON.stringify({fatal:e.message.slice(0,130)})));
