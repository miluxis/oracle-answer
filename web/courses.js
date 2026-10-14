/* Course copy transcribed and condensed from the supplied course brief, September 2026.
   Registration is an explicitly local prototype. No personal data is transmitted. */
window.COURSES=(()=>{
 const groups=[
 {id:'an',name:'安己书',glyph:'安',roman:'I',tag:'向内 · 安住自己',format:'7 课 · 共 14 小时',size:'线上小班 · 每班 20 人',intro:'先不急着处理关系。用七个字，慢慢找回照顾自己的能力。',benefits:['把注意力带回身体，找到可随时回来的安心之处。','练习温柔而坚定的边界，允许自己的感受存在。','带走日常可用的自我关照练习。'],lessons:[
 ['安','心慌的时候，有一个可以回去的地方','自我关怀 · 从摇摆，到落定','身体扫描、呼吸锚点、制作「我的安心按钮」。'],
 ['如','别人的一句话，不再决定你的一整天','安住当下 · 从黏着，到如实','STOP 练习、觉察顺应反射、三分钟呼吸空间。'],
 ['妹','把那个被丢在半路上的小女孩，接回来','找回生命力 · 从懂事，到鲜活','内在小孩对话、正念行走、写下十件只为好玩的事。'],
 ['威','找回你说「我来」时的那股力量','女性的力量 · 从退让，到站定','山式站姿、声音与气场练习、绘制力量图谱。'],
 ['娥','把「不」字，温柔而坚定地说出口','边界与表达 · 从隐忍，到清晰','拒绝脚本演练、愤怒的正念容纳、关系边界地图。'],
 ['婧','让经历，慢慢长成你的骨头','心理韧性 · 从对抗，到承接','RAIN 练习、生命事件盘点、重新书写自己的经历。'],
 ['妍','为自己留一门手艺，把称赞还给自己','自我欣赏 · 从评判，到欣赏','滋养清单、成就存款练习、对自己说一句真心的好话。']]},
 {id:'jian',name:'见人书',glyph:'見',roman:'II',tag:'向外 · 看见关系',format:'7 课 · 共 14 小时',size:'线上小班 · 每班 20 人',intro:'当自己逐渐安定，再看见关系里反复出现的模式。理解他人，也认出自己。',benefits:['观察伴侣、亲子、代际和职场中的互动模式。','从指责与重复，走向更清晰的表达。','为关系找到一个小而可行的改变。'],lessons:[
 ['影','为什么有些人一出现，你就不像自己','自我与阴影 · 从外指，到回看','阴影清单、投射练习、正念自我对话。'],
 ['侣','为什么付出越多，彼此却越远','伴侣关系 · 从追逃，到同频','追逃模式识别、依恋类型观察、正念沟通四步。'],
 ['嗣','说着「我为你好」，孩子却越来越远','亲子关系 · 从投射，到目送','期待归还练习、正念倾听、界限与祝福。'],
 ['承','替上一代扛的那些，什么时候能放下','代际关系 · 从背负，到承接','家谱图初绘、代际信念盘点、正念告别仪式。'],
 ['权','面对领导和规则，为什么会自动变小','权威关系 · 从服从，到对话','权威雕塑练习、内在评判者对话、边界重设。'],
 ['贫','明明不缺，为何仍觉得匮乏与不安','金钱关系 · 从恐惧，到丰盈','金钱叙事访谈、觉察匮乏感在身体的位置、丰盈冥想。'],
 ['转','知道很多道理，关系还是原地打转','整合与行动 · 从重复，到转机','卡点与契机对照、一分钟关系正念、转机行动书。']]},
 {id:'ming',name:'名字书',glyph:'名',roman:'III',tag:'回归 · 认领自己',format:'7 次一对一 · 每次 75 分钟',size:'定制陪伴 · 每期规划 8 席',intro:'以自己的姓名为入口，从古文字意象、家族期待走向自我认领，写下只属于你的名字书。',benefits:['逐字探索姓名的字源与象形意象。','在一对一正念深谈中，觉察名字承载的期待。','在七次会面后，整理自己的《名字疗愈书》。'],lessons:[]}
 ];
 const find=id=>groups.find(g=>g.id===id)||groups[0];
 const email='oracleanswered@gmail.com';
 function mailLink(a){const fields={姓名:'name',国家:'country',地区:'region',性别:'gender',年龄:'age',邮箱:'email',电话:'phone',报名原因:'reason'};const name=tr(find(a.course).name);const body=tr('您好，我想了解「{course}」的班期与费用。',{course:name})+'\n\n'+Object.entries(fields).map(([label,key])=>tr(label)+'：'+(key==='gender'?tr(a[key]||'未填写'):a[key]||tr('未填写'))).join('\n')+'\n\n'+tr('请与我联系，确认课程安排。');return 'mailto:'+email+'?subject='+encodeURIComponent(tr('字有答案线上课报名意向 ·')+' '+name)+'&body='+encodeURIComponent(body);}

 let draft={},current=null;
 const zh=()=>['zh-CN','zh-TW'].includes(lang);
 const bilingual=(c,e)=>zh()?c:e;
 const note=()=>'';
 const tr=(s,p={})=>window.LOCALE.text(s,lang,p);
 const icon=g=>`<span class="course-mark" aria-hidden="true">${g.glyph}</span>`;
 function teaser(){return `<section class="course-teaser"><span class="eyebrow">继续向内 · ONLINE PRACTICE</span><h2>你不是一个人，<br>欢迎你的所有心情。</h2><p>从一个字的片刻，走向有人陪伴的练习。</p><button class="text-link" data-route="courses">认识线上课 <span>↗</span></button></section>`;}
 function catalogue(){return `${note()}<section class="course-hero"><span class="eyebrow">字之三阶 · 线上正念体验</span><h1>向内行走，<br>再走向世界。</h1><p>你不是一个人，欢迎你的所有心情。</p><div class="course-orbit" aria-hidden="true"><span>安</span><i></i></div><div class="course-hero-foot"><span>从照顾自己，到理解他人</span><span>三阶 · 一条向内的路</span></div></section><div class="section-title"><h2>找到适合此刻的起点</h2></div><p class="body-copy">第一期面向中年女性。以字为引，以体验为核心，给自己一段被认真陪伴的时间。</p><div class="course-groups">${groups.map(g=>`<a href="#course/${g.id}" class="course-group">${icon(g)}<div><span class="eyebrow">STAGE ${g.roman} · ${g.tag}</span><h2>${g.name}</h2><p>${g.format}</p></div><span class="course-arrow">↗</span></a>`).join('')}</div><section class="course-method"><span class="eyebrow">HOW WE PRACTICE</span><h2>每一课，都有安定的节奏</h2><ol>${[['抽字 · 观形','从一个字的形，留意自己的感受。'],['解字 · 溯源','借古文字意象，打开理解的入口。'],['照见 · 投射','把字与生活连接，不评判地观察。'],['正念 · 落实','回到呼吸与身体，把体验带进日常。']].map(([a,b],i)=>`<li><span>0${i+1}</span><div><h3>${a}</h3><p>${b}</p></div></li>`).join('')}</ol></section><section class="quiet-panel"><h2>先有片刻，再有同行</h2><p>一个字体验 → 线上体验课 → 旅居静心营</p><small>旅居静心营筹备中，时间与地点另行公布。</small></section><button class="primary course-primary" data-route="course/an">看看第一阶 · 安己书 →</button>`;}
 function detail(id){const g=find(id);return `${back('courses','coursesNav')}${note()}<article><header class="course-detail-head"><span class="eyebrow">STAGE ${g.roman} · ${g.tag}</span><h1>${g.name}</h1><p>${g.intro}</p>${icon(g)}</header><div class="course-facts"><div><small>课程安排</small><strong>${g.format}</strong></div><div><small>共修方式</small><strong>${g.size}</strong></div><div><small>开课日期</small><strong>班期待公布</strong></div><div><small>课程费用</small><strong>待公布</strong></div></div><section class="course-section"><span class="eyebrow">TAKE WITH YOU</span><h2>这一程，带走什么</h2><ul class="benefit-list">${g.benefits.map(x=>`<li>${x}</li>`).join('')}</ul></section>${g.lessons.length?`<section class="course-section"><span class="eyebrow">THE ${g.lessons.length} CHAPTERS</span><h2>七个字，七次练习</h2><div class="lesson-list">${g.lessons.map((a,i)=>`<details class="lesson"><summary><span class="lesson-number">${String(i+1+(g.id==='jian'?7:0)).padStart(2,'0')}</span><span class="lesson-glyph">${a[0]}</span><span>${a[1]}</span><i>＋</i></summary><div><h3>${a[2]}</h3><p>${a[3]}</p></div></details>`).join('')}</div></section>`:`<section class="course-section"><h2>七次会面，一本自己的书</h2><p class="body-copy">从名字到家族期待，从家族期待到自我认领。每一次会面的内容，会在了解你的期待后共同安排。</p></section>`}<details class="course-fit"><summary>这门课适合此刻的我吗？ <span>＋</span></summary><p>如果你长期照顾别人，也想留一点时间照顾自己；愿意在小组中真诚表达、倾听，或希望借古文字探索内在，这里可以是一个起点。</p><p>这是一门正念体验课，不提供速成方法，也不替代专业心理或医疗支持。</p>${g.id==='jian'?'<p>第二阶建议先完成安己书；如希望单独报名，可在报名意向中说明已有练习经历。</p>':''}</details><section class="enrol-strip"><span class="eyebrow">下一步 · 相互认识</span><h2>把一段时间，留给自己。</h2><p>填写意向 → 了解期待 → 确认班期与费用 → 入班</p><button class="primary course-primary" data-route="enrol/${g.id}">${tr('填写{course}报名意向 →',{course:tr(g.name)})}</button><small>填写后可通过邮件联系课程团队，暂不收款或占位。</small></section></article>`;}
 function field(name,label,type='text',required=false,extra=''){return `<label class="form-field"><span>${label}${required?' <em>*</em>':' <small>选填</small>'}</span><input name="${name}" type="${type}" ${required?'required':''} ${extra} value="${esc(draft[name]||'')}"></label>`;}
 function enrol(id){const g=find(id);return `${back('course/'+g.id,'back')}${note()}<header class="page-head"><span class="eyebrow">一起开始 · ${g.name}</span><h1>先认识你。</h1><p>也听听，你希望这一程带来什么。</p></header><form id="course-form" data-course="${g.id}"><div class="form-banner">填写后先保存本机草稿，再由你打开邮件确认发送至 oracleanswered@gmail.com；保存不会自动提交或预订名额。</div><label class="form-field"><span>意向课程</span><select name="course">${groups.map(a=>`<option value="${a.id}" ${a.id===g.id?'selected':''}>${a.name} · ${a.format}</option>`).join('')}</select></label>${field('name','姓名','text',true,'autocomplete="name" maxlength="60"')}<div class="form-pair">${field('country','国家','text',true,'autocomplete="country-name" maxlength="80"')}${field('region','地区 / 城市','text',true,'autocomplete="address-level1" maxlength="100"')}</div><div class="form-pair"><label class="form-field"><span>性别 <small>选填</small></span><select name="gender">${['暂不填写','女','男','自我描述 / 其他','不愿透露'].map(a=>`<option ${draft.gender===a?'selected':''}>${a}</option>`).join('')}</select></label>${field('age','年龄','number',false,'min="18" max="120" inputmode="numeric"')}</div>${field('email','邮箱','email',true,'autocomplete="email" maxlength="160"')}${field('phone','电话（含国家区号）','tel',true,'autocomplete="tel" maxlength="40"')}<label class="form-field"><span>为什么想来？ <small>选填 · 500 字以内</small></span><textarea name="reason" maxlength="500" placeholder="此刻你最想照顾的，是生活的哪一部分？">${esc(draft.reason||'')}</textarea></label><label class="consent"><input type="checkbox" name="consent" required><span>我同意把以上资料保存在此浏览器中，知道保存不等于发送；后续可自行通过邮件联系课程团队，也可随时删除草稿。</span></label><button type="submit" class="primary course-primary">保存报名意向草稿 →</button></form>`;}
 function application(){const a=current||read('oracle-course-application',null);if(!a||!groups.some(g=>g.id===a.course))return enrol('an');const g=find(a.course);return `${back('courses','coursesNav')}<section class="application-success"><div class="account-seal">✓</div><span class="eyebrow">已保存于本机</span><h1>意向已记下。</h1><p><bdi data-user-content>${esc(a.name)}</bdi>，你为自己留出了一小步。</p><div class="quiet-panel"><h2>${g.name}</h2><p>${g.format}</p><p>班期与费用待公布</p></div><p class="body-copy">保存不会自动发送。点击下方按钮，在自己的邮件应用中确认收件人与内容，再发送给课程团队。班期与费用以团队回复为准。</p><a class="primary course-primary" id="email-application" href="${esc(mailLink(a))}">打开邮件发送报名 ↗</a><p class="fine">收件人：${email}<br>若没有邮件应用，可下载资料后手动发到此邮箱。</p><button class="secondary" id="export-application">下载我的意向资料 ↓</button><button class="secondary" id="edit-application">继续编辑</button><button class="text-button" id="delete-application">删除本机意向资料</button></section>`;}
 const routes={courses:catalogue,course:detail,enrol,application};
 document.addEventListener('input',e=>{if(e.target.closest('#course-form')&&e.target.name!=='consent')draft[e.target.name]=e.target.value;});
 document.addEventListener('change',e=>{if(e.target.closest('#course-form')&&e.target.name!=='consent')draft[e.target.name]=e.target.value;});
 document.addEventListener('submit',e=>{if(e.target.id!=='course-form')return;e.preventDefault();const form=e.target; if(!form.reportValidity())return;const a=Object.fromEntries(new FormData(form));for(const k of Object.keys(a))a[k]=String(a[k]).trim();if(!a.name||!a.country||!a.region||!a.phone){toast(tr('请填写姓名、国家、地区和电话。'));return;}if(!groups.some(g=>g.id===a.course))return;delete a.consent;a.savedAt=new Date().toISOString();const done=()=>{current=a;draft={...a};go('application');};
  /* [账号改造] 登录用户存账号（跨设备可见），未登录仍存本地 */
  if(window.API&&window.API.isLoggedIn()&&window.API.putApplication){
    window.API.putApplication({course_id:a.course,name:a.name,country:a.country,region:a.region,email:a.email,phone:a.phone,age:a.age,gender:a.gender,reason:a.reason,saved_at:a.savedAt})
      .then(done).catch(err=>toast(err.message||tr('保存未成功，请稍后重试。')));
  }else{
    if(!store('oracle-course-application',a)){toast(tr('保存未成功，请检查浏览器是否允许本地存储。'));return;}
    done();
  }});
 document.addEventListener('click',e=>{const id=e.target.closest('[id]')?.id,a=current||read('oracle-course-application',null);if(id==='delete-application'){
    /* [账号改造] 同时清除本地与账号上的意向资料 */
    try{localStorage.removeItem('oracle-course-application');}catch{}
    const clear=()=>{current=null;draft={};go('courses');toast(tr('意向资料已删除'));};
    if(window.API&&window.API.isLoggedIn()&&window.API.deleteApplication){window.API.deleteApplication().then(clear).catch(()=>toast(tr('删除未成功，请重试。')));}
    else clear();return;}if(id==='edit-application'&&a){draft={...a};go('enrol/'+a.course);}if(id==='export-application'&&a){const blob=new Blob([JSON.stringify({...a,notice:tr('本机草稿，未提交给课程团队')},null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='字有答案-报名意向草稿.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}});
 return{groups,teaser:()=>window.LOCALE.html(teaser(),lang),has:p=>Object.hasOwn(routes,p),render:(p,id)=>window.LOCALE.html(routes[p](id),lang)};
})();
