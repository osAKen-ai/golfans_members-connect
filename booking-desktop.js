/* Presentation only: retain original controls/events and restore the mobile DOM on resize. */
(()=>{
 const desktop=matchMedia('(min-width:1000px)');
 const homes=new Map();
 const roots=[document.querySelector('#panelBody'),document.querySelector('#proxyMain')].filter(Boolean);
 const trays=new WeakMap();
 function followSelection(root,selection){
  const list=selection.querySelector('.bk-chosen-list');
  if(!list){trays.delete(root);return;}
  const previous=trays.get(root);
  if(previous?.list===list)return;
  const context=selection.querySelector('.bk-chosen-summary header>strong')?.textContent;
  const rows=[...list.querySelectorAll('.bk-chosen-row')];
  const keys=rows.map(row=>row.querySelector('strong').textContent.trim());
  const sameContext=previous?.context===context;
  const added=sameContext?keys.findIndex(key=>!previous.keys.includes(key)):-1;
  const state={list,context,keys,top:sameContext?previous.top:0};
  trays.set(root,state);
  list.addEventListener('scroll',()=>{state.top=list.scrollTop;},{passive:true});
  // Scroll only the selection list, keeping the time table and page in place.
  requestAnimationFrame(()=>{
   if(!list.isConnected||trays.get(root)!==state)return;
   list.scrollTop=state.top;
   if(rows.length>3&&added>=0){
    const target=rows[added].getBoundingClientRect();
    const bounds=list.getBoundingClientRect();
    if(target.bottom>bounds.bottom)list.scrollTop+=target.bottom-bounds.bottom;
    else if(target.top<bounds.top)list.scrollTop+=target.top-bounds.top;
   }
   state.top=list.scrollTop;
  });
 }
 function move(node,target){
  if(node.parentElement===target)return;
  if(!homes.has(node)){const marker=document.createComment('desktop layout home');node.before(marker);homes.set(node,marker);}
  target.append(node);
 }
 function restore(){
  for(const [node,marker] of homes){if(marker.isConnected&&node.isConnected)marker.replaceWith(node);else marker.remove();}
  homes.clear();
  document.querySelectorAll('.bd-time-sidebar').forEach(side=>{side.querySelector('.bd-selection-heading')?.remove();side.replaceWith(...side.childNodes);});
 }
 function decorate(){
  observer.disconnect();
  document.querySelectorAll('.bd-calendar').forEach(node=>{if(!node.querySelector('.bk-calendar-pair'))node.classList.remove('bd-calendar');});
  for(const [node,marker] of homes)if(!node.isConnected||!marker.isConnected){marker.remove();homes.delete(node);}
  if(!desktop.matches)restore();
  else {
   document.querySelectorAll('.bk-calendar-pair').forEach(pair=>{
    const parent=pair.parentElement;parent.classList.add('bd-calendar');
    const controls=parent.querySelector(':scope > .bk-controls');
    if(controls)parent.querySelectorAll(':scope > .bk-own-calendar-legend, :scope > .wl-legend, :scope > .wl-entry, :scope > .bk-note').forEach(node=>move(node,controls));
    const nav=parent.querySelector(':scope > .bk-month-navigation');
    if(nav&&!nav.querySelector('.bd-month-label')){
     const heading=document.createElement('strong');heading.className='bd-month-label';
     heading.textContent=pair.querySelector('.bk-calendar-title')?.firstChild?.textContent?.trim()||'';
     nav.insertBefore(heading,nav.lastElementChild);
    }
   });
   document.querySelectorAll('.booking-times-view').forEach(view=>{
    const parent=view.querySelector('#panelBody')||view;
    const selection=parent.querySelector('.bk-selection');if(!selection)return;
    let side=parent.querySelector(':scope > .bd-time-sidebar');
    if(!side){side=document.createElement('aside');side.className='bd-time-sidebar';side.setAttribute('aria-label','選択した予約内容とご案内');selection.before(side);side.append(selection);}
    parent.querySelectorAll(':scope > .bk-note, :scope > .wl-time-entry').forEach(node=>move(node,side));
    view.closest('#proxyMain')?.querySelectorAll(':scope > .wl-time-entry').forEach(node=>move(node,side));
    if(!selection.children.length){const empty=document.createElement('div');empty.className='bk-selection-empty';const text=document.createElement('p');text.textContent='時間と人数を選んでください。複数のスタート枠を選べます。';empty.append(text);selection.append(empty);}
    if(!side.querySelector('.bd-selection-heading')){const h=document.createElement('h3');h.className='bd-selection-heading';h.textContent='選択した予約内容';side.prepend(h);}
   });
  }
  // Follow newly added groups on both mobile and desktop, for members and delegates.
  roots.forEach(root=>{
   const selection=root.querySelector('.bk-selection');
   if(selection)followSelection(root,selection);
   else trays.delete(root);
   observer.observe(root,{childList:true,subtree:true});
  });
 }
 const observer=new MutationObserver(decorate);
 desktop.addEventListener('change',decorate);
 decorate();
})();
