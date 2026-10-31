'use strict';
// Keep the saved booking identifiable while its replacement is only a draft.
function currentEditingReservation(){
 return draft?.edit&&draft.id?state.reservations.find(r=>r.id===draft.id&&(!r.status||r.status==='reserved')):null;
}
function currentReservationRowMarkup(slot,side){
 const r=slot.currentReservation,delegate=typeof proxyMemberInfo==='function';
 const participates=r.kind!=='intro'&&r.memberPlaying!==false;
 const name=delegate?proxyMemberInfo().name:'伊藤 剛';
 const portrait=!delegate&&typeof ownPhotoMarkup==='function'?ownPhotoMarkup():`<svg viewBox="0 0 26 26" aria-hidden="true"><circle cx="12" cy="7" r="4"/><path d="M3 22v-3a9 9 0 0 1 18 0v3Z"/></svg>`;
 const chosen=delegate?draft.time===r.time&&draft.side===side:bookingUI.selected&&draft.time===r.time;
 const select=delegate?'proxySelectTime':'selectBookingSlot';
 const buttons=slot.choices.map(n=>`<button type="button" class="bk-current-people ${chosen&&draft.people===n?'selected':''}" aria-pressed="${chosen&&draft.people===n}" aria-label="現在のご予約 ${esc(side)} ${esc(r.time)} ${n}名を選択" onclick="${select}('${esc(r.time)}',${n},'${delegate?esc(side):esc(slot.kind)}',${Number(r.seat)||0})">${n}名</button>`).join('');
 return `<div class="bk-slot bk-current-reservation" data-hour="${slot.hour}" aria-label="現在のご予約 ${esc(side)} ${esc(r.time)}"><time>${esc(r.time)}</time><div class="bk-current-main"><span class="bk-current-badge">現在のご予約</span><div class="bk-current-identity">${participates||!delegate?`<span class="bk-current-photo">${portrait}</span>`:''}<span class="bk-current-name">${participates?esc(name)+' 様':r.kind==='intro'?'紹介枠':'同伴者のご予約'}<small>${participates?'ご本人を含む ':''}${Number(r.people)}名</small></span></div><div class="bk-current-party"><span>人数変更</span>${buttons}</div></div></div>`;
}
// The ordinary calendar uses the same public profile settings as the profile preview.
function ownReservedOccupantsMarkup(r){
 const participates=r.kind!=='intro'&&r.memberPlaying!==false;
 const visibility=state.profileVisibility||{};
 const portrait=visibility.portrait==='photo'?ownPhotoMarkup():bookingIcon('person');
 const name=visibility.name==='full'?'伊藤 剛':'T.I';
 const owner=participates?`<button class="bk-avatar bk-own-public-avatar" aria-label="${name}様の公開プロフィール" onclick="openPanel('profilePreview')">${portrait}</button>`:'';
 return `<div class="bk-occupants">${owner}${Array.from({length:Math.max(0,Math.min(4,Number(r.people))-(participates?1:0))},()=>'<span class="bk-guest">G</span>').join('')}</div>`;
}
const currentBookingInventory=bookingSlots;
bookingSlots=function(date,side=draft.side||'OUT'){
 let rows=currentBookingInventory(date,side);
 const r=currentEditingReservation();
 if(typeof proxyMemberInfo!=='function'){
  const own=state.reservations.filter(item=>item.id!==r?.id&&(!item.status||item.status==='reserved')&&item.date===date&&item.course===draft.course&&(item.side||'OUT')===side);
  for(const record of own){
   const same=s=>s.time.padStart(5,'0')===record.time.padStart(5,'0');
   const slot={time:record.time,hour:Number(record.time.split(':')[0]),kind:record.kind||(Number(record.people)===1?'member':'normal'),occupied:Number(record.people),capacity:0,choices:[],available:false,ownReservation:record};
   rows=rows.some(same)?rows.map(s=>same(s)?{...s,...slot}:s):[...rows,slot];
  }
  rows.sort((a,b)=>a.time.padStart(5,'0').localeCompare(b.time.padStart(5,'0')));
 }
 if(!r||r.date!==date||r.course!==draft.course||(r.side||'OUT')!==side)return rows;
 const kind=r.kind||(Number(r.people)===1?'member':'normal');
 const current={time:r.time,hour:Number(r.time.split(':')[0]),kind,occupied:Number(r.people),capacity:4,choices:kind==='member'?[1]:[2,3,4],available:date>now,currentReservation:r};
 const sameTime=t=>t.padStart(5,'0')===r.time.padStart(5,'0');
 const found=rows.some(s=>sameTime(s.time));
 return (found?rows.map(s=>sameTime(s.time)?{...s,...current}:s):[...rows,current]).sort((a,b)=>a.time.padStart(5,'0').localeCompare(b.time.padStart(5,'0')));
};
function focusCurrentReservation(){
 if(!bookingUI.focusCurrent&&!bookingUI.focusReservationId)return;
 const targetId=bookingUI.focusReservationId;
 bookingUI.focusCurrent=false;bookingUI.focusReservationId=null;
 const list=document.querySelector('.bk-slot-list');
 const row=targetId?[...(list?.querySelectorAll('[data-reservation-id]')||[])].find(el=>el.dataset.reservationId===String(targetId)):list?.querySelector('.bk-current-reservation');
 if(!row)return;
 list.scrollTop+=row.getBoundingClientRect().top-list.getBoundingClientRect().top-8;
 if(typeof setBookingHour==='function')setBookingHour(Number(row.dataset.hour));
}
if(typeof mountBookingTimes==='function'){
 const mount=mountBookingTimes;
 mountBookingTimes=function(){mount();focusCurrentReservation();};
}
if(typeof proxyMountTimes==='function'){
 const mount=proxyMountTimes;
 proxyMountTimes=function(){mount();focusCurrentReservation();};
}

// Owner controls exist only on records belonging to the signed-in demo member.
let ownReservationPeopleId=null;
function ownReservationRowMarkup(slot){
 const r=slot.ownReservation,solo=isSoloMemberTime(r),expanded=ownReservationPeopleId===r.id;
 const id=esc(JSON.stringify(r.id));
 return `<section class="bk-slot bk-current-reservation bk-owned-reservation" data-reservation-id="${esc(r.id)}" data-hour="${slot.hour}" aria-label="ご自身の予約 ${esc(r.time)} ${r.people}名"><time>${esc(r.time)}</time><div class="bk-owned-main"><header>${r.kind==='intro'||r.memberPlaying===false?`<span class="bk-owned-booker"><span class="bk-owned-booker-photo">${ownPhotoMarkup()}</span><span><span class="bk-current-badge">ご自身の予約</span><small>${r.kind==='intro'?'紹介者':'予約者'}：伊藤 剛</small></span></span>`:'<span class="bk-current-badge">ご自身の予約</span>'}<strong>${r.people}名</strong></header>${ownReservedOccupantsMarkup(r)}<div class="bk-owned-actions">${solo?'<span class="bk-owned-solo">メンバータイム・1名</span>':`<button type="button" aria-expanded="${expanded}" onclick="toggleOwnReservationPeople(${id})">人数変更</button>`}<button type="button" onclick="openPanel('booking',${id})">時間変更</button></div>${expanded&&!solo?`<div class="bk-owned-people" role="group" aria-label="変更後の人数"><div class="bk-owned-edit-heading"><strong>変更後の人数</strong><button type="button" class="bk-change-reset" onclick="toggleOwnReservationPeople(${id})">変更解除</button></div>${[2,3,4].map(n=>`<button type="button" ${n===Number(r.people)?'disabled':''} onclick="changeOwnReservationPeople(${id},${n})">${n}名${n===Number(r.people)?'<small>現在</small>':''}</button>`).join('')}</div>`:''}</div></section>`;
}
function toggleOwnReservationPeople(id){
 if(!state.reservations.some(r=>r.id===id&&(!r.status||r.status==='reserved')))return;
 ownReservationPeopleId=ownReservationPeopleId===id?null:id;
 const list=document.querySelector('.bk-slot-list'),top=list?.scrollTop||0;
 if(list){list.innerHTML=bookingRows();list.scrollTop=top;}
}
function changeOwnReservationPeople(id,people){
 const r=state.reservations.find(r=>r.id===id&&(!r.status||r.status==='reserved'));
 if(!r||isSoloMemberTime(r)||![2,3,4].includes(people)||people===Number(r.people))return;
 ownReservationPeopleId=null;
 openPanel('booking',id);
 selectBookingSlot(r.time,people,r.kind||'normal',Number(r.seat)||0);
 proceedBookingGuests();
}

// Compare against the saved record, never the in-progress draft.
function bookingConfirmationFacts(r=draft,savedBefore){
 const before=savedBefore===undefined?(r.edit?state.reservations.find(item=>item.id===r.id):null):savedBefore;
 const row=(label,oldValue,newValue)=>{
  const changed=before&&oldValue!==newValue;
  return `<dt class="${changed?'bk-fact-changed':''}">${label}</dt><dd class="${changed?'bk-fact-changed':''}">${changed?`<span class="bk-change-values" aria-label="${esc(oldValue)}から${esc(newValue)}に変更"><span class="bk-change-before"><small>変更前</small>${esc(oldValue)}</span><span class="bk-change-arrow" aria-hidden="true">→</span><strong class="bk-change-after"><small>変更後</small>${esc(newValue)}</strong></span>`:label==='プレー日'?dateMarkup(r.date,true):esc(newValue)}</dd>`;
 };
 return row('プレー日',before?formatDate(before.date,true):'',formatDate(r.date,true))
  +row('コース',before?.course,r.course)
  +row('スタート',before?`${before.side||'OUT'} ${before.time}`:'',`${r.side||'OUT'} ${r.time}`)
  +row('人数',before?`${before.people}名`:'',`${r.people}名`);
}

// Exiting an edit discards only the draft, never the saved reservation.
function cancelOwnBookingChange(){
 const r=currentEditingReservation();
 if(!r)return;
 draft={date:r.date,course:r.course,side:r.side||'OUT',people:Number(r.people),kind:r.kind||'normal',guests:[],time:''};
 ownReservationPeopleId=null;
 resetBooking();
 bookingUI.hour=Number(r.time.split(':')[0]);
 bookingUI.focusCurrent=true;
 year=Number(r.date.slice(0,4));month=Number(r.date.slice(5,7))-1;
 history.replaceState({...history.state,route:{k:'times',arg:null}},'',location.pathname+location.search+'#times');
 render('times');
 toast('変更を解除しました。元の予約はそのままです');
}
if(typeof bookingTimes==='function'&&typeof proxyMemberInfo!=='function'){
 const timesBeforeReset=bookingTimes;
 bookingTimes=function(){
  const markup=timesBeforeReset(),r=currentEditingReservation();
  if(!r)return markup;
  const reset=`<div class="bk-edit-notice" role="group" aria-label="予約変更中"><span><strong>予約を変更中</strong><small>元の予約：${esc(r.time)}・${Number(r.people)}名</small></span><button type="button" class="bk-change-reset" onclick="cancelOwnBookingChange()">変更解除</button></div>`;
  return markup.replace('<div class="bk-time-main">','<div class="bk-time-main">'+reset);
 };
 const confirmBeforeReset=bookingConfirm;
 bookingConfirm=function(){
  const markup=confirmBeforeReset();
  return currentEditingReservation()?markup.replace('<button class="bk-secondary" onclick="openBookingStep(\'times\')">選択しなおす</button>','<button class="bk-secondary" onclick="openBookingStep(\'times\')">選択しなおす</button><button type="button" class="bk-secondary bk-change-reset" onclick="cancelOwnBookingChange()">変更解除</button>'):markup;
 };
}

// Keep replacement browsing focused on the available times. Details belong to confirmation.
if(typeof bookingSelectionMarkup==='function'&&typeof proxyMemberInfo!=='function'){
 const selectionBeforeEdit=bookingSelectionMarkup;
 bookingSelectionMarkup=function(){
  if(!currentEditingReservation())return selectionBeforeEdit();
  if(!bookingUI.selected)return '';
  return '<button type="button" class="bk-primary reservation-action bk-edit-confirm" onclick="proceedBookingGuests()">変更内容を確認 <span aria-hidden="true">›</span></button>';
 };
}

function bookingChangeComplete(arg){
 const r=state.reservations.find(item=>item.id===arg.id);
 if(!r)return '<p class="bk-empty">予約一覧からご予約をご確認ください。</p>';
 const guests=(r.guests||[]).map(name=>name&&name!=='未定'?esc(name)+' 様':esc(name||'未登録')).join('<br>')||'なし';
 return `<div class="bk-completion bk-change-complete"><header class="bk-completion-hero" role="status"><div class="bk-completion-check" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><path d="m12 24 8 8 16-18" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h3>ご予約の変更が完了しました</h3><p>予約一覧に反映しています。</p></header><section class="bk-change-complete-card" aria-label="変更が完了した予約内容"><dl class="bk-confirm-facts">${bookingConfirmationFacts(r,arg.before||null)}<dt>予約者</dt><dd>伊藤 剛 様</dd><dt>同伴者</dt><dd>${guests}</dd></dl></section><div class="bk-change-complete-actions"><button class="bk-primary" onclick="openPanel('reservations')">予約一覧を見る</button><button class="bk-secondary" onclick="closePanel()">トップへ戻る</button></div><p class="bk-note">操作体験版です。実際の予約は行われません。</p>${saveFailed?'<p class="hint">このブラウザでは保存できないため、画面を閉じるとリセットされます。</p>':''}</div>`;
}
