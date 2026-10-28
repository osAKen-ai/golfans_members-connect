'use strict';
// Shared by members and delegates: 未定 is a reserved seat, not a directory person.
const isDelegateBooking=typeof proxyGuestCount==='function';
function guestSeatCount(r=draft){return isDelegateBooking?proxyGuestCount(r):memberGuestCount(r);}
function guestSeatsComplete(r=draft){const seats=Array.from({length:guestSeatCount(r)},(_,i)=>r.guests[i]||'');const names=seats.filter(n=>n!=='未定').map(normalizePersonQuery);return seats.every(Boolean)&&new Set(names).size===names.length;}
memberGuestsComplete=function(){return guestSeatsComplete();};
if(isDelegateBooking){proxyGuestsComplete=function(){return guestSeatsComplete();};proxyRegistrationComplete=guestSeatsComplete;}else bookingGroupComplete=guestSeatsComplete;
function undecidedControlsMarkup(){const missing=Math.max(0,guestSeatCount()-draft.guests.filter(Boolean).length),pending=draft.guests.filter(n=>n==='未定').length;return `<div id="undecidedControls" class="cp-undecided-controls">${missing?`<button type="button" onclick="markRemainingUndecided()">残り${missing}名を「未定」にする</button>`:pending?`<p>未定 ${pending}名 · お名前は後から変更できます</p>`:''}</div>`;}
function markRemainingUndecided(){if(isDelegateBooking&&!proxyCanAct())return;draft.guests=Array.from({length:guestSeatCount()},(_,i)=>draft.guests[i]||'未定');refreshCompanionChoices();toast('未定として選択しました。登録ボタンで保存してください');}
const undecidedPicker=companionPickerMarkup;
companionPickerMarkup=function(){return undecidedPicker().replace('<button id="memberGuestNext"',undecidedControlsMarkup()+'<button id="memberGuestNext"');};
const undecidedRefresh=refreshCompanionChoices;
refreshCompanionChoices=function(){undecidedRefresh();const box=$('#undecidedControls');if(box)box.outerHTML=undecidedControlsMarkup();};
// Selecting a real name fills an empty seat, then replaces the first undecided seat.
const undecidedToggle=toggleBookingGuest;
toggleBookingGuest=function(name,checked){if(checked&&isDelegateBooking&&proxyOtherGroupsForName(name).length){undecidedToggle(name,checked);return;}if(checked&&!draft.guests.includes(name)&&!draft.guests.some(n=>!n)&&draft.guests.length>=guestSeatCount()){const index=draft.guests.indexOf('未定');if(index>=0)draft.guests[index]='';}undecidedToggle(name,checked);};
if(isDelegateBooking){const choose=proxySelectGuestName;proxySelectGuestName=function(name){if(proxyOtherGroupsForName(name).length){choose(name);return;}if(!draft.guests.some(n=>!n)&&draft.guests.length>=guestSeatCount()&&!draft.guests.includes(name)){const index=draft.guests.indexOf('未定');if(index>=0)draft.guests[index]='';}choose(name);};}
function undecidedFollowup(rows){const pending=rows.filter(r=>r.guests.includes('未定'));if(!pending.length)return '';const count=pending.reduce((n,r)=>n+r.guests.filter(x=>x==='未定').length,0);return `<div class="cp-undecided-followup"><p>未定 ${count}名 · 決まりましたらお名前をご登録ください。</p><button class="bk-secondary" onclick="${isDelegateBooking?`proxyEdit('${pending[0].id}',true)`:`startGuestEditor('${pending[0].id}')`}">未定の方のお名前を登録する</button></div>`;}
if(isDelegateBooking){const overview=proxyOverviewMarkup;proxyOverviewMarkup=function(rows){return overview(rows).replace('<button class="bk-secondary" onclick="proxyGo(\'list\')">',undecidedFollowup(rows)+'<button class="bk-secondary" onclick="proxyGo(\'list\')">');};}else{const overview=reservationGroupDetailMarkup;reservationGroupDetailMarkup=function(id){const record=state.reservations.find(r=>r.id===id);const rows=record?(record.batchId?state.reservations.filter(r=>r.batchId===record.batchId):[record]):[];return overview(id).replace('<button class="bk-secondary" onclick="openPanel(\'reservations\')">',undecidedFollowup(rows)+'<button class="bk-secondary" onclick="openPanel(\'reservations\')">');};}
