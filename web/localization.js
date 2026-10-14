/* Explicit local dictionaries. No network translation or mutation of user content. */
window.LOCALE=(()=>{
 const {copy,readings,questions}=window.LOCALE_DATA;
 const supported=['zh-CN','zh-TW','en','ja','th','ar'];
 const missing=new Set();
 function text(source,locale,params={}){
  const entry=copy[source];
  let out=entry?.[locale];
  if(out===undefined){out=source;if(locale!=='zh-CN'&&/[\u3400-\u9fff]{2}/.test(source))missing.add(locale+':'+source);}
  return Object.entries(params).reduce((s,[k,v])=>s.replaceAll('{'+k+'}',v),out);
 }
 // Only authored course markup passes through this adapter. Form values and
 // marked user text are excluded; textContent keeps translations as plain text.
 const combined=Object.keys(copy).filter(k=>k.length>1&&!k.includes('{')&&!k.includes('<')&&!k.includes('\n')).sort((a,b)=>b.length-a.length);
 const pattern=new RegExp(combined.map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g');
 function fragment(value,locale){
  const trimmed=value.trim();
  if(copy[trimmed])return value.replace(trimmed,text(trimmed,locale));
  return value.replace(pattern,key=>copy[key][locale]);
 }
 function html(source,locale){
  if(locale==='zh-CN')return source;
  const tpl=document.createElement('template');tpl.innerHTML=source;
  // Keep option values stable when the visible option label changes language.
  tpl.content.querySelectorAll('option:not([value])').forEach(n=>n.value=n.textContent);
  const walker=document.createTreeWalker(tpl.content,NodeFilter.SHOW_TEXT);
  let node;while(node=walker.nextNode()){
   if(node.parentElement?.closest('textarea,script,style,[data-user-content],.course-mark,.lesson-glyph,.glyph,.account-seal'))continue;
   node.textContent=fragment(node.textContent,locale);
  }
  tpl.content.querySelectorAll('[placeholder],[aria-label],[alt]').forEach(n=>{
   for(const a of ['placeholder','aria-label','alt'])if(n.hasAttribute(a))n.setAttribute(a,fragment(n.getAttribute(a),locale));
  });
  return tpl.innerHTML;
 }
 for(const [index,translations]of Object.entries(questions)){
  const question=window.CONTENT.questions[index];
  for(const [locale,data]of Object.entries(translations)){question.q[locale]=data.q;question.a.forEach((a,i)=>a[locale]=data.a[i]);}
 }
 for(const entry of Object.values(window.CONTENT.ui)){
  const translated=copy[entry['zh-CN']];if(translated)Object.assign(entry,translated);
 }
 function reading(id,locale){const result=readings[id]?.[locale];if(typeof result!=='string')throw Error('Missing reading '+id+'/'+locale);return result;}
 return{text,html,reading,supported,missing};
})();
