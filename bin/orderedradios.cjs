/* Pairs each Yes/No radio group with the question that PRECEDES it in document
   order (the GS lesson: question text is a preceding sibling, not an ancestor).
   Walks the document once so groups and questions stay aligned. */
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
  if(!page){console.log(JSON.stringify({err:'no tab'}));await br.close();return;}
  const groups = await page.evaluate(()=>{
    const clean=t=>String(t||'').replace(/\s+/g,' ').trim();
    const w=document.createTreeWalker(document.body, NodeFilter.SHOW_ALL);
    let lastQ=''; const out=[]; const seen=new Set();
    while(w.nextNode()){
      const n=w.currentNode;
      if(n.nodeType===3){ const t=clean(n.nodeValue); if(t.length>12 && /[?:]$/.test(t)||t.length>25) lastQ=t; continue; }
      if(n.nodeType!==1) continue;
      if(n.tagName==='LABEL'||n.tagName==='LEGEND'){ const t=clean(n.innerText); if(t.length>12) lastQ=t; continue; }
      if(n.tagName==='INPUT' && n.type==='radio'){
        if(!n.name||seen.has(n.name)) continue; seen.add(n.name);
        const opts=[...document.querySelectorAll(`input[name="${CSS.escape(n.name)}"]`)]
          .map(x=>({id:x.id, label:clean(x.labels&&x.labels[0]?x.labels[0].innerText:x.value), checked:x.checked}));
        out.push({q:lastQ.slice(0,150), opts});
      }
    }
    return out;
  });
  const picks = JSON.parse(picksRaw);
  const report=[];
  for (const {q,opt} of picks){
    const g = groups.find(g=>g.q.toLowerCase().includes(q.toLowerCase()));
    if(!g){ report.push([q.slice(0,36),'NO_GROUP']); continue; }
    const o = g.opts.find(o=>o.label.toLowerCase()===opt.toLowerCase());
    if(!o||!o.id){ report.push([q.slice(0,36),'NO_OPT', g.opts.map(x=>x.label).join('/')]); continue; }
    if(o.checked){ report.push([q.slice(0,36),'already']); continue; }
    try{
      const lab=page.locator(`label[for="${o.id}"]`).first();
      if(await lab.count()){ await lab.scrollIntoViewIfNeeded(); await lab.click({timeout:4000}); }
      else await page.locator(`[id="${o.id}"]`).first().check({force:true});
      await page.waitForTimeout(350);
      const ok=await page.locator(`[id="${o.id}"]`).first().isChecked().catch(()=>false);
      report.push([q.slice(0,36), ok?'set':'FAILED']);
    }catch(e){ report.push([q.slice(0,36),'ERR '+e.message.slice(0,36)]); }
  }
  console.log(JSON.stringify({found:groups.map(g=>g.q.slice(0,70)), report}, null, 1));
  await br.close();
})().catch(e=>console.log(JSON.stringify({fatal:e.message.slice(0,130)})));
