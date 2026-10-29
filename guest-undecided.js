'use strict';
// Shared by members and delegates: 未定 is a reserved seat, not a directory person.
const isDelegateBooking=typeof proxyGuestCount==='function';
function guestSeatCount(r=draft){return isDelegateBooking?proxyGuestCount(r):memberGuestCount(r);}
function guestSeatsComplete(r=draft){const seats=Array.from({length:guestSeatCount(r)},(_,i)=>r.guests[i]||'');const names=seats.filter(n=>n!=='未定').map(normalizePersonQuery);return seats.every(Boolean)&&new Set(names).size===names.length;}
memberGuestsComplete=function(){return guestSeatsComplete();};
if(isDelegateBooking){proxyGuestsComplete=function(){return guestSeatsComplete();};proxyRegistrationComplete=guestSeatsComplete;}else bookingGroupComplete=guestSeatsComplete;
// Count actual player seats, including groups where the booking member is not playing.
function undecidedSeatSummary(r=draft){
 const seats=Array.from({length:guestSeatCount(r)},(_,i)=>r.guests[i]||'');
 return {missing:seats.filter(n=>!n).length,pending:seats.filter(n=>n==='未定').length,selected:seats.filter(Boolean).length+Number(r.people)-seats.length};
}
function undecidedControlsMarkup(){
 const {missing}=undecidedSeatSummary();
 return `<div id="undecidedControls" class="cp-undecided-controls"${missing?'':' hidden'}>${missing?`<div class="cp-person cp-undecided-person"><div class="cp-undecided-label"><strong>残り${missing}名を未定にする</strong><small id="undecidedHint">お名前は後から登録できます</small></div><button type="button" class="cp-select" aria-label="残り${missing}名を未定として選択" aria-describedby="undecidedHint" onclick="markRemainingUndecided()">選択</button></div>`:''}</div>`;
}
function undecidedGuestCountMarkup(){
 const {selected,pending}=undecidedSeatSummary();
 return `${selected}／${draft.people}名${pending?`<span class="cp-undecided-count">（うち未定${pending}名）</span>`:''}`;
}
function markRemainingUndecided(){
 if(isDelegateBooking&&!proxyCanAct())return;
 const {missing}=undecidedSeatSummary();
 if(!missing)return;
 draft.guests=Array.from({length:guestSeatCount()},(_,i)=>draft.guests[i]||'未定');
 refreshCompanionChoices();
 $('#memberGuestNext')?.focus({preventScroll:true});
 toast(`${missing}名を未定として選択しました。登録ボタンで保存してください`);
}
const undecidedPicker=companionPickerMarkup;
companionPickerMarkup=function(){
 return undecidedPicker()
  .replace('<div id="bookingGuestChoices">',undecidedControlsMarkup()+'<div id="bookingGuestChoices">')
  .replace(/(<small id="bookingGuestCount">)[\s\S]*?(<\/small>)/,`$1${undecidedGuestCountMarkup()}$2`);
};
const undecidedRefresh=refreshCompanionChoices;
refreshCompanionChoices=function(){
 undecidedRefresh();
 const box=$('#undecidedControls');if(box)box.outerHTML=undecidedControlsMarkup();
 const count=$('#bookingGuestCount');if(count)count.innerHTML=undecidedGuestCountMarkup();
};
// Selecting a real name fills an empty seat, then replaces the first undecided seat.
const undecidedToggle=toggleBookingGuest;
toggleBookingGuest=function(name,checked){if(checked&&isDelegateBooking&&proxyOtherGroupsForName(name).length){undecidedToggle(name,checked);return;}if(checked&&!draft.guests.includes(name)&&!draft.guests.some(n=>!n)&&draft.guests.length>=guestSeatCount()){const index=draft.guests.indexOf('未定');if(index>=0)draft.guests[index]='';}undecidedToggle(name,checked);};
if(isDelegateBooking){const choose=proxySelectGuestName;proxySelectGuestName=function(name){if(proxyOtherGroupsForName(name).length){choose(name);return;}if(!draft.guests.some(n=>!n)&&draft.guests.length>=guestSeatCount()&&!draft.guests.includes(name)){const index=draft.guests.indexOf('未定');if(index>=0)draft.guests[index]='';}choose(name);};}
// After saving, distinguish leaving registration from editing existing players.
function companionRegistrationExitMarkup(){
 const action=isDelegateBooking?"proxyGo('list')":"openPanel('reservations')";
 return `<button type="button" class="bk-primary cp-registration-exit" onclick="${action}"><span>同伴者登録を終了して、</span><strong>予約一覧へ進む <span aria-hidden="true">›</span></strong></button>`;
}
function companionRegistrationActionsMarkup(r){
 const action=isDelegateBooking?`proxyEdit('${r.id}',true)`:`startGuestEditor('${r.id}')`;
 if(!guestSeatsComplete(r))return `<button class="bk-primary" onclick="${action}">同伴者を登録する</button>`;
 return `<div class="cp-registration-actions">${current?.k==='registered'?companionRegistrationExitMarkup():''}<button type="button" class="bk-secondary" onclick="${action}">同伴者を変更する</button></div>`;
}
function completedRegistrationReturnMarkup(rows,original){
 const active=rows.filter(r=>(!r.status||r.status==='reserved')&&guestSeatCount(r)>0);
 if(current?.k!=='registered')return original;
 return undecidedFollowup(rows)+(active.length&&active.every(guestSeatsComplete)?companionRegistrationExitMarkup():original);
}
function undecidedFollowup(rows){const pending=rows.filter(r=>r.guests.includes('未定'));if(!pending.length)return '';const count=pending.reduce((n,r)=>n+r.guests.filter(x=>x==='未定').length,0);return `<div class="cp-undecided-followup"><p>未定 ${count}名 · 決まりましたらお名前をご登録ください。</p><button class="bk-secondary" onclick="${isDelegateBooking?`proxyEdit('${pending[0].id}',true)`:`startGuestEditor('${pending[0].id}')`}">未定の方のお名前を登録する</button></div>`;}
if(isDelegateBooking){const overview=proxyOverviewMarkup;proxyOverviewMarkup=function(rows){return overview(rows).replace('<button class="bk-secondary" onclick="proxyGo(\'list\')">予約一覧に戻る</button>',completedRegistrationReturnMarkup(rows,'<button class="bk-secondary" onclick="proxyGo(\'list\')">予約一覧に戻る</button>'));};}else{const overview=reservationGroupDetailMarkup;reservationGroupDetailMarkup=function(id){const record=state.reservations.find(r=>r.id===id);const rows=record?(record.batchId?state.reservations.filter(r=>r.batchId===record.batchId):[record]):[];return overview(id).replace('<button class="bk-secondary" onclick="openPanel(\'reservations\')">予約一覧に戻る</button>',completedRegistrationReturnMarkup(rows,'<button class="bk-secondary" onclick="openPanel(\'reservations\')">予約一覧に戻る</button>'));};}
