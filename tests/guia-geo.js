// Comprovació geomètrica de la guia de benvinguda (20/11/2026). S'injecta a la pàgina des de
// smoke.spec.js i torna la llista de problemes del pas actual (buida = tot bé): el globus o la tira
// dins la pantalla i sense tapar l'element ni els resultats de la cerca; l'halo envoltant l'element;
// i la punta del globus caient a sobre de l'element. Si la guia queda desfasada, això peta.
function guiaGeo(){
  const v=[], W=innerWidth, H=innerHeight;
  if(guiaPas==null) return ['la guia no és oberta'];
  const R=e=>e.getBoundingClientRect();
  const solapa=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
  const g=R(guiaEl), amag=guiaEl.classList.contains('amagada');
  if(!amag&&(g.left<-1||g.top<-1||g.right>W+1||g.bottom>H+1)) v.push(`pas ${guiaPas}: el globus surt de la pantalla`);
  const res=document.getElementById('results');
  if(!amag&&res&&res.classList.contains('open')&&R(res).height&&solapa(g,R(res))>0) v.push(`pas ${guiaPas}: el globus tapa els resultats de la cerca`);
  const cantonada=(guiaPas===2&&guiaCtxFet)||(guiaPas===3&&guiaColNova()&&document.getElementById('cfgwrap').hidden);
  const el=guiaObjectiu(), halo=guiaHaloEl.classList.contains('on');
  if(guiaPas===0||cantonada){ if(halo) v.push(`pas ${guiaPas}: hi ha halo i no hi hauria de ser`); return v; }
  if(!el) return v.concat(`pas ${guiaPas}: no troba l'element que ha d'assenyalar`);
  const t=R(el), visible=t.width>0&&t.bottom>0&&t.top<H;
  if(!visible) return v.concat(`pas ${guiaPas}: l'element assenyalat no es veu`);
  if(!halo) return v.concat(`pas ${guiaPas}: falta l'halo`);
  const h=R(guiaHaloEl);
  if(Math.abs(h.left-(t.left-3))>2||Math.abs(h.top-(t.top-3))>2||Math.abs(h.width-(t.width+6))>2||Math.abs(h.height-(t.height+6))>2)
    v.push(`pas ${guiaPas}: l'halo no envolta l'element`);
  if(amag) return v;
  if(solapa(g,t)>0) v.push(`pas ${guiaPas}: el globus tapa l'element`);
  const cls=guiaEl.className, gx=parseFloat(guiaEl.style.getPropertyValue('--gx')), gy=parseFloat(guiaEl.style.getPropertyValue('--gy'));
  const ax=g.left+gx+6, ay=g.top+gy+6;   // centre de la punta (quadrat de 12px girat)
  if(/\bp-baix\b/.test(cls)){ if(g.top<t.bottom-1) v.push(`pas ${guiaPas}: diu «a sota» i no ho és`); if(ax<t.left-2||ax>t.right+2) v.push(`pas ${guiaPas}: la punta no apunta a l'element`); }
  if(/\bp-dalt\b/.test(cls)){ if(g.bottom>t.top+1) v.push(`pas ${guiaPas}: diu «a sobre» i no ho és`); if(ax<t.left-2||ax>t.right+2) v.push(`pas ${guiaPas}: la punta no apunta a l'element`); }
  if(/\bp-dreta\b/.test(cls)){ if(g.left<t.right-1) v.push(`pas ${guiaPas}: diu «a la dreta» i no ho és`); if(ay<t.top-2||ay>t.bottom+2) v.push(`pas ${guiaPas}: la punta no apunta a l'element`); }
  if(/\bp-esq\b/.test(cls)){ if(g.right>t.left+1) v.push(`pas ${guiaPas}: diu «a l'esquerra» i no ho és`); if(guiaPas!==1&&(ay<t.top-2||ay>t.bottom+2)) v.push(`pas ${guiaPas}: la punta no apunta a l'element`); }
  return v;
}
