/* Lists required fields and whether each currently holds a value. */
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
  const out = await page.evaluate(()=>{
    const clean=t=>String(t||'').replace(/\s+/g,' ').trim();
    const res=[];
    document.querySelectorAll('[data-field-path]').forEach(f=>{
      const lab=f.querySelector('label,legend');
      const txt=clean(lab?lab.innerText:'');
      const req=/\*/.test(txt)||/_required_/.test(String(lab&&lab.className));
      if(!req) return;
      let filled=false, kind='';
      const inp=f.querySelector('input:not([type=hidden]),textarea,select');
      if(inp){
        kind=inp.tagName+':'+(inp.type||'');
        if(inp.type==='checkbox'||inp.type==='radio')
          filled=[...f.querySelectorAll('input')].some(x=>x.checked);
        else filled=!!clean(inp.value);
      }
      if(f.querySelector('button[class*="_option_"]')){
        kind='buttongroup';
        filled=[...f.querySelectorAll('button[class*="_option_"]')]
          .some(b=>/_active_/.test(b.className)||b.getAttribute('aria-pressed')==='true');
      }
      if(f.querySelector('input[type=file]')){
        kind='file'; filled=[...f.querySelectorAll('input[type=file]')].some(x=>x.files&&x.files.length);
        if(!filled) filled=/\.pdf/i.test(clean(f.innerText));
      }
      res.push({q:txt.slice(0,58), kind, filled});
    });
    return res;
  });
  const missing=out.filter(x=>!x.filled);
  console.log('REQUIRED:', out.length, '| MISSING:', missing.length);
  missing.forEach(m=>console.log('   MISSING ['+m.kind+']', m.q));
  await br.close();
})().catch(e=>console.log('ERR',e.message.slice(0,130)));
