/* Bone fragments, dust and a warm perspective passage. Duration remains 6.5s. */
window.PORTAL=(()=>{
 let cleanup=()=>{};
 const texture=typeof Image==='undefined'?null:new Image();if(texture)texture.src='assets/ritual-stone-transparent.png';
 const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x);},mix=(a,b,t)=>a+(b-a)*t;
 function start({duration=6500,title='',hint='',skip=''}){
  cleanup();const root=document.createElement('section');root.id='ritual-portal';root.className='ritual-portal';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label',hint);
  const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');root.append(canvas);
  const caption=document.createElement('div');caption.className='portal-caption';const eyebrow=document.createElement('span');eyebrow.textContent='DAILY SYMBOL';const heading=document.createElement('h2');heading.textContent=title;const status=document.createElement('p');status.textContent=hint;status.setAttribute('role','status');caption.append(eyebrow,heading,status);root.append(caption);
  const footer=document.createElement('div');footer.className='portal-footer';const line=document.createElement('div');line.className='portal-progress';const progress=document.createElement('i');line.append(progress);const button=document.createElement('button');button.id='portal-skip';button.textContent=skip;footer.append(line,button);root.append(footer);document.body.append(root);
  const shell=document.querySelector('.app-shell'),oldInert=shell?.inert,oldOverflow=document.body.style.overflow,priorFocus=document.activeElement;if(shell)shell.inert=true;document.body.style.overflow='hidden';button.focus({preventScroll:true});
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,ctx=canvas.getContext('2d',{alpha:false});let w=innerWidth,h=innerHeight,frame=0;
  function resize(){w=innerWidth;h=innerHeight;const dpr=Math.min(devicePixelRatio||1,1.75);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx?.setTransform(dpr,0,0,dpr,0,0);}resize();addEventListener('resize',resize);
  let seed=84726;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  const chips=Array.from({length:14},(_,i)=>{
   const tile=document.createElement('canvas');tile.width=96;tile.height=96;const c=tile.getContext('2d');if(!c)return tile;
   const vertices=Array.from({length:5+i%3},(_,j)=>{const a=j/(5+i%3)*Math.PI*2,r=25+random()*15;return [48+Math.cos(a)*r,47+Math.sin(a)*r];});
   const path=(dx=0,dy=0)=>{c.beginPath();vertices.forEach(([x,y],j)=>j?c.lineTo(x+dx,y+dy):c.moveTo(x+dx,y+dy));c.closePath();};
   path(1,4);c.fillStyle='#77654d';c.fill();path();const face=c.createLinearGradient(15,5,78,88);face.addColorStop(0,'#f0e4ca');face.addColorStop(.5,'#cbb99a');face.addColorStop(1,'#a89575');c.fillStyle=face;c.fill();c.save();path();c.clip();
   if(texture?.complete&&texture.naturalWidth){c.globalAlpha=.5;c.drawImage(texture,texture.naturalWidth*.15,texture.naturalHeight*.15,texture.naturalWidth*.22,texture.naturalHeight*.18,4,4,88,88);c.globalAlpha=1;}
   for(let j=0;j<100;j++){c.fillStyle=j%3?'rgba(79,62,40,.11)':'rgba(255,248,224,.4)';c.fillRect(random()*96,random()*96,.5+random()*1.5,.5+random()*1.5);}
   c.strokeStyle='rgba(82,65,44,.26)';c.lineWidth=.7;c.beginPath();c.moveTo(12,30+i);c.lineTo(43,40+i);c.lineTo(53,73);c.moveTo(43,40+i);c.lineTo(81,22);c.stroke();c.restore();path();c.strokeStyle='rgba(255,245,220,.58)';c.lineWidth=.9;c.stroke();return tile;
  });
  const fragments=Array.from({length:380},(_,i)=>({a:(i%4)*Math.PI/2+random()*.55,z:random(),r:.8+random()*.55,size:2.5+Math.pow(random(),2)*9,spin:random()*6.28,tile:i%chips.length,targetA:i*2.399963,targetR:Math.sqrt((i+.5)/380)}));
  const dust=Array.from({length:1100},(_,i)=>({a:(i%4)*Math.PI/2+random()*.65,z:random(),r:.76+random()*.48,size:.2+random()*.8}));const begun=performance.now();
  function paint(now){
   const t=clamp((now-begun)/duration),gather=reduced?1:ease((t-.57)/.28),seal=reduced?1:ease((t-.77)/.12),pinch=reduced?0:ease((t-.87)/.09),exit=ease((t-.955)/.045),travel=reduced?0:t*3.7,appear=ease(t/.12),collapse=reduced?1:1-pinch;
   progress.style.transform=`scaleX(${t})`;caption.style.opacity=String(appear*(1-ease((t-.48)/.18)));footer.style.opacity=String(1-ease((t-.85)/.1));
   if(ctx){const scale=Math.min(w,h),cx=w*.5,cy=h*.53,focal=scale*.23;ctx.fillStyle='#f1ece2';ctx.fillRect(0,0,w,h);ctx.save();ctx.globalAlpha=appear*(1-exit);
    const depth=ctx.createRadialGradient(cx,cy,scale*.025,cx,cy,Math.max(w,h)*.52);depth.addColorStop(0,'#29251f');depth.addColorStop(.10,'#564838');depth.addColorStop(.23,'#9e8766');depth.addColorStop(.42,'#d2bf9d');depth.addColorStop(.65,'#eee4d0');depth.addColorStop(1,'#f5f1e7');ctx.fillStyle=depth;ctx.fillRect(0,0,w,h);
    ctx.save();ctx.globalAlpha=(1-gather)*.15;for(let band=0;band<22;band++){const z=band/22,rad=focal/(z+.22),rotation=travel*.35+z*3.8;ctx.save();ctx.translate(cx+Math.sin(z*4+travel*.2)*scale*.055,cy+Math.cos(z*3)*scale*.02);ctx.rotate(rotation);ctx.scale(1,.71);ctx.strokeStyle=band%3?'rgba(248,237,208,.26)':'rgba(100,78,48,.10)';ctx.lineWidth=.4+z*.5;ctx.beginPath();ctx.arc(0,0,rad,band*.49,band*.49+2.2);ctx.stroke();ctx.restore();}ctx.restore();
    for(const p of dust){const z=(p.z+travel*.18)%1,a=p.a+travel*.95+z*8.5,k=focal/(z+.16),r=k*p.r*(1-gather*.98)*collapse,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r*.75,opacity=Math.sin(z*Math.PI)*.52*(1-seal);ctx.fillStyle=`rgba(246,232,201,${opacity})`;ctx.beginPath();ctx.arc(x,y,Math.max(.15,p.size/(z+.6)*collapse),0,Math.PI*2);ctx.fill();}
    const projected=fragments.map(p=>{const z=(p.z+travel*.18)%1,a=p.a+travel*.95+z*8.5,k=focal/(z+.16),tunnelX=Math.cos(a)*k*p.r+Math.sin(z*4+travel*.2)*scale*.055,tunnelY=Math.sin(a)*k*p.r*.75,targetX=Math.cos(p.targetA)*p.targetR*scale*.19,targetY=Math.sin(p.targetA)*p.targetR*scale*.205;return {p,z,x:cx+mix(tunnelX,targetX,gather)*collapse,y:cy+mix(tunnelY,targetY,gather)*collapse,size:mix(p.size/(z+.18)*scale/390,scale*.045,gather)*collapse};}).sort((a,b)=>b.z-a.z);
    for(const q of projected){if(q.x<-90||q.x>w+90||q.y<-90||q.y>h+90)continue;const {p,z}=q;ctx.save();ctx.globalAlpha=mix(Math.min(1,Math.sin(z*Math.PI)*1.5),1,gather)*(1-seal);ctx.translate(q.x,q.y);ctx.rotate(mix(p.spin+travel*(1+p.tile*.07),p.targetA*.1,gather));ctx.scale(mix(.36+Math.abs(Math.cos(p.spin+travel*.8))*.64,1,gather),1);ctx.drawImage(chips[p.tile],-q.size/2,-q.size/2,q.size,q.size);ctx.restore();}
    if(seal>0){const size=scale*.48*collapse;ctx.save();ctx.globalAlpha=seal;if(texture?.complete&&texture.naturalWidth){ctx.drawImage(texture,cx-size/2,cy-size/2,size,size);}else{const stone=ctx.createRadialGradient(cx-size*.14,cy-size*.14,0,cx,cy,Math.max(size*.6,.01));stone.addColorStop(0,'#eee0c3');stone.addColorStop(1,'#a58f6d');ctx.fillStyle=stone;ctx.beginPath();ctx.ellipse(cx,cy,Math.max(.01,size*.44),Math.max(.01,size*.48),0,0,Math.PI*2);ctx.fill();}ctx.restore();}
    if(pinch>0){const rad=Math.max(2,scale*(.02+exit*1.5)),light=ctx.createRadialGradient(cx,cy,0,cx,cy,rad);light.addColorStop(0,`rgba(255,249,229,${pinch})`);light.addColorStop(.12,`rgba(250,239,211,${pinch*.6})`);light.addColorStop(1,'rgba(250,239,211,0)');ctx.fillStyle=light;ctx.fillRect(0,0,w,h);}ctx.restore();
    if(exit){ctx.fillStyle=`rgba(245,242,235,${exit})`;ctx.fillRect(0,0,w,h);}
   }
   if(t<1)frame=requestAnimationFrame(paint);
  }
  frame=requestAnimationFrame(paint);cleanup=()=>{cancelAnimationFrame(frame);removeEventListener('resize',resize);root.remove();if(shell)shell.inert=oldInert;document.body.style.overflow=oldOverflow;if(priorFocus?.isConnected)priorFocus.focus?.({preventScroll:true});cleanup=()=>{};};
 }
 return {start,stop:()=>cleanup()};
})();
