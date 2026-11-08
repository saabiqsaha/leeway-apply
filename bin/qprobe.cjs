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
  if(!page){console.log('no tab');await br.close();return;}
  const out = await page.evaluate(()=>{
    const clean=t=>String(t||'').replace(/\s+/g,' ').trim();
    const qUp=(el)=>{ // question is often a preceding sibling, not an ancestor
      let n=el, hops=0;
      while(n && hops<6){
        const w=n.closest('div[class*="_field"],fieldset,div');
        if(w){ const l=w.querySelector('label,legend'); if(l&&clean(l.innerText)) return clean(l.innerText); }
        let p=(w||n).previousElementSibling, k=0;
        while(p&&k<3){ const t=clean(p.innerText); if(t&&t.length>8) return t; p=p.previousElementSibling; k++; }
        n=(w||n).parentElement; hops++;
      }
      return '';
    };
    const res={radios:[],groups:[],unlabeled:[]};
    const seen=new Set();
    document.querySelectorAll('input[type="radio"],input[type="checkbox"]').forEach(r=>{
      if(!r.name||seen.has(r.name))return; seen.add(r.name);
      res.radios.push({name:r.name.slice(0,20), q:qUp(r).slice(0,130),
        opts:[...document.querySelectorAll(`input[name="${CSS.escape(r.name)}"]`)]
          .map(x=>clean(x.labels&&x.labels[0]?x.labels[0].innerText:x.value)).slice(0,8)});
    });
    const gs=new Set();
    document.querySelectorAll('button[class*="_option_"]').forEach(b=>{
      const sc=b.closest('div[class*="_field"],fieldset,div'); if(!sc||gs.has(sc))return; gs.add(sc);
      res.groups.push({q:qUp(b).slice(0,130), opts:[...sc.querySelectorAll('button[class*="_option_"]')].map(x=>clean(x.innerText))});
    });
    document.querySelectorAll('input[type="text"]').forEach(el=>{
      const l=el.labels&&el.labels[0]?clean(el.labels[0].innerText):'';
      if(l)return;
      res.unlabeled.push({ph:el.placeholder||'', q:qUp(el).slice(0,120)});
    });
    return res;
  });
  console.log(JSON.stringify(out,null,1));
  await br.close();
})().catch(e=>console.log('ERR',e.message.slice(0,130)));
