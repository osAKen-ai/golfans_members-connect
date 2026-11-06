'use strict';
// Read the same saved records as the reservation list, without changing the calendar draft.
let calendarReservationDate='',calendarReservationPeopleId=null;
function calendarReservationCard(r,index,total){
 const id=esc(JSON.stringify(r.id)),expanded=calendarReservationPeopleId===r.id;
 const solo=isSoloMemberTime(r);
 return `<article class="rs-card bk-calendar-reservation-card" data-reservation-id="${esc(r.id)}" aria-label="${esc(r.course)} ${esc(r.side||'OUT')} ${esc(r.time)} ${Number(r.people)}名">
  <div class="rs-card-top">${reservationStatusMarkup(r,'予約中','reserved')}<span class="rs-source">${esc(r.source||'WEB予約')}${r.proxy&&r.source!=='電話予約'?'・代理予約':''}</span></div>
  ${total>1?`<p class="bk-calendar-group">${index+1}組目</p>`:''}
  ${reservationStartFactsMarkup(r)}
  <div class="bk-calendar-owner"><span class="bk-calendar-owner-photo">${ownPhotoMarkup()}</span><div><small>${r.kind==='intro'?'紹介者':'予約者'}</small><strong>伊藤 剛 様</strong></div></div>
  <p class="rs-guest-names">${memberGuestCount(r)>0?`<small class="bk-calendar-guests-label">${reservationPlayerTerm(r)}</small>`:''}${reservationPlayersMarkup(r,true)}</p>
  <p class="rs-created">予約日 ${esc(r.createdAt||'—')}</p>
  <div class="bk-calendar-change-actions">${solo?'<span class="bk-calendar-solo">メンバータイム・1名</span>':`<button type="button" aria-expanded="${expanded}" onclick="toggleCalendarReservationPeople(${id})">人数変更</button>`}<button type="button" onclick="calendarReservationAction('time',${id})">時間変更</button></div>
  ${expanded&&!solo?`<section class="bk-calendar-people" aria-label="変更後の人数"><div><strong>変更後の人数</strong><button type="button" onclick="toggleCalendarReservationPeople(${id})">変更解除</button></div><div class="bk-calendar-people-options">${(r.kind==='member'?[1,2]:[2,3,4]).map(n=>`<button type="button" ${n===Number(r.people)?'disabled':''} onclick="calendarReservationAction('people',${id},${n})">${n}名${n===Number(r.people)?'<small>現在</small>':''}</button>`).join('')}</div><p>人数を選ぶと、変更内容の確認へ進みます。</p></section>`:''}
 </article>`;
}
function calendarReservationMarkup(date){
 const records=calendarOwnReservations(date).slice().sort((a,b)=>a.time.padStart(5,'0').localeCompare(b.time.padStart(5,'0'))||a.course.localeCompare(b.course));
 return `<header class="bk-calendar-modal-head"><h2 id="calendarReservationTitle">${dateMarkup(date,true)}</h2><button type="button" aria-label="予約情報を閉じる" onclick="closeCalendarReservation()">✖︎</button></header><div class="bk-calendar-modal-body">${records.map((r,i)=>calendarReservationCard(r,i,records.length)).join('')}</div><footer class="bk-calendar-modal-foot"><button type="button" class="bk-secondary" onclick="calendarReservationAction('slots')">この日のスタート枠を見る <span aria-hidden="true">›</span></button><button type="button" class="bk-primary" onclick="calendarReservationAction('list')">予約一覧を見る <span aria-hidden="true">›</span></button><button type="button" class="bk-calendar-return" onclick="closeCalendarReservation()">カレンダーに戻る</button></footer>`;
}
function openCalendarReservation(date){
 if(!calendarOwnReservations(date).length)return;
 calendarReservationDate=date;calendarReservationPeopleId=null;
 let modal=document.getElementById('calendarReservationModal');
 if(!modal){
  modal=document.createElement('dialog');modal.id='calendarReservationModal';
  modal.className='bk-calendar-reservation-modal';modal.setAttribute('aria-labelledby','calendarReservationTitle');modal.setAttribute('aria-modal','true');
  modal.addEventListener('keydown',e=>e.stopPropagation());
  modal.addEventListener('click',e=>{if(e.target===modal){const box=modal.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)closeCalendarReservation();}});
  modal.addEventListener('close',()=>{calendarReservationPeopleId=null;});
  document.body.append(modal);
 }
 modal.innerHTML=calendarReservationMarkup(date);
 modal.showModal();
}
function closeCalendarReservation(){document.getElementById('calendarReservationModal')?.close();}
function toggleCalendarReservationPeople(id){
 const modal=document.getElementById('calendarReservationModal');
 if(!modal?.open)return;
 const body=modal.querySelector('.bk-calendar-modal-body');
 const card=[...body.querySelectorAll('[data-reservation-id]')].find(item=>item.dataset.reservationId===String(id));
 const record=calendarOwnReservations(calendarReservationDate).find(item=>item.id===id);
 const control=card?.querySelector('[aria-expanded]');
 if(!control||!record||isSoloMemberTime(record))return;
 const opening=calendarReservationPeopleId!==id;
 // Keep the scrolling container and the tapped button alive. Replacing the dialog
 // resets scrolling/focus on mobile browsers, especially beyond the first group.
 body.scrollTo({top:body.scrollTop,behavior:'instant'});
 const anchorTop=control.getBoundingClientRect().top;
 if(body.querySelector('.bk-calendar-people')?.contains(document.activeElement))control.focus({preventScroll:true});
 body.querySelectorAll('.bk-calendar-people').forEach(section=>section.remove());
 body.querySelectorAll('[aria-expanded]').forEach(button=>button.setAttribute('aria-expanded','false'));
 calendarReservationPeopleId=opening?id:null;
 let section=null;
 if(opening){
  const template=document.createElement('template');
  template.innerHTML=calendarReservationCard(record,0,1);
  section=template.content.querySelector('.bk-calendar-people');
  card.append(section);
  control.setAttribute('aria-expanded','true');
 }
 // If another group's open editor was above this one, preserve the tapped
 // button's visual position while removing that editor.
 body.scrollBy({top:control.getBoundingClientRect().top-anchorTop,behavior:'instant'});
 if(section)requestAnimationFrame(()=>{
  if(!modal.open||!section.isConnected||calendarReservationPeopleId!==id)return;
  const bounds=body.getBoundingClientRect(),target=section.getBoundingClientRect();
  const available=body.clientHeight-16;
  const distance=target.height>available
   ?Math.max(0,target.top-bounds.top-8)
   :Math.max(0,target.bottom-bounds.top-body.clientHeight+8);
  // Reveal only what is below the viewport; never jump upward to another group.
  if(distance>1)body.scrollBy({top:distance,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 });
}
// For multiple groups, anchor to the card currently being viewed in the modal.
function visibleCalendarReservationId(){
 const body=document.querySelector('#calendarReservationModal .bk-calendar-modal-body');
 if(!body)return null;
 const bounds=body.getBoundingClientRect();
 const cards=[...body.querySelectorAll('[data-reservation-id]')];
 const visibleHeight=card=>{const rect=card.getBoundingClientRect();return Math.max(0,Math.min(bounds.bottom,rect.bottom)-Math.max(bounds.top,rect.top));};
 return cards.sort((a,b)=>visibleHeight(b)-visibleHeight(a))[0]?.dataset.reservationId||null;
}
function calendarReservationAction(action,id,people){
 const r=calendarOwnReservations(calendarReservationDate).find(item=>item.id===id);
 if(!['list','slots'].includes(action)&&!r)return;
 const anchorId=['slots','list'].includes(action)?visibleCalendarReservationId():null;
 closeCalendarReservation();
 if(action==='people')changeOwnReservationPeople(id,people);
 else if(action==='time')openPanel('booking',id);
 else if(action==='slots'){
  const records=calendarOwnReservations(calendarReservationDate);
  const target=records.find(item=>String(item.id)===anchorId)||records.find(item=>item.course===draft.course)||records[0];
  if(target){draft.course=target.course;draft.side=target.side||'OUT';bookingUI.focusReservationId=target.id;prepareBookingDateAvailability(calendarReservationDate,true,target.id);}
  calendarPickDateBeforePreview(calendarReservationDate);
 }
 else if(action==='list'){
  showReservationListAtDate(calendarReservationDate,'reserved',anchorId);
 }
}
const calendarPickDateBeforePreview=pickBookingDate;
pickBookingDate=function(date){
 if(!draft.edit&&calendarOwnReservations(date).length){openCalendarReservation(date);return;}
 calendarPickDateBeforePreview(date);
};
window.addEventListener('popstate',closeCalendarReservation);
