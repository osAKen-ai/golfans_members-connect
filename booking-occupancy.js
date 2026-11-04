'use strict';
// The limit is per four-seat tee time, including people already booked there.
function memberTimeBackground(r){
 const previous=draft;
 try{draft={...r};return (typeof wlOriginalSlots==='function'?wlOriginalSlots:currentBookingInventory)(r.date,r.side||'OUT',true).find(s=>s.time===r.time);}
 finally{draft=previous;}
}
function memberTimeIssue(r){
 if(r.kind!=='member')return '';
 const slot=memberTimeBackground(r);
 const occupied=slot?.kind==='member'?sampleBookingParticipants(slot):[];
 const players=bookingRecordParticipants(r);
 const others=state.reservations.filter(x=>x.id!==r.id&&x.status!=='cancelled'&&x.date===r.date&&x.course===r.course&&(x.side||'OUT')===(r.side||'OUT')&&x.time===r.time);
 const reserved=others.flatMap(bookingRecordParticipants);
 if(occupied.length+reserved.length+Number(r.people)>4)return 'メンバータイムは1組4枠までです。空き枠を選び直してください。';
 if([...occupied,...reserved,...players].filter(p=>p.type==='guest').length>1)return 'メンバータイムのゲスト同伴は、1組4枠のうち最大1名です。';
 return '';
}
function memberTimeCanAddGuest(r){
 const previous=draft;let available;try{draft={...r};available=bookingSlots(r.date,r.side||'OUT').find(s=>s.time===r.time)?.available;}finally{draft=previous;}
 return available&&r.kind==='member'&&r.memberPlaying!==false&&!memberTimeIssue({...r,people:2,memberGuestReserved:true,guests:['']});
}
const occupancyValid=bookingSelectionValid;
bookingSelectionValid=function(){
 if(memberTimeIssue(draft))return false;
 if(draft.kind==='member'&&Number(draft.people)===2&&draft.memberGuestReserved){
  const s=memberTimeBackground(draft);
  return draft.date>now&&!!s&&(s.kind==='member'||!!currentEditingReservation())&&memberTimeCanAddGuest(draft);
 }
 return occupancyValid();
};
const occupancySelection=bookingSelectionMarkup;
bookingSelectionMarkup=function(){
 let html=occupancySelection();
 const rows=selectionTrayRows();
 const options=rows.map((r,i)=>r.kind==='member'&&r.memberPlaying!==false?`<label class="bk-member-guest-option"><input type="checkbox" ${r.memberGuestReserved?'checked':''} ${!r.memberGuestReserved&&!memberTimeCanAddGuest(r)?'disabled':''} onchange="setMemberTimeGuest(${i},this.checked)"><span>${r.time} ゲスト1名を同伴<small>${memberTimeCanAddGuest(r)?'ご本人と合わせて2枠を予約します':'空き枠不足、またはこの組のゲスト枠は予約済みです'}</small></span></label>`:'').join('');
 return options?html.replace('<div class="bk-selection-actions">',options+'<div class="bk-selection-actions">'):html;
};
function setMemberTimeGuest(index,checked){
 const r=selectionTrayRows()[index];if(!r||r.kind!=='member')return;
 if(checked&&!memberTimeCanAddGuest(r)){toast('この組ではゲスト同伴を追加できません');refreshBookingSelection();return;}
 r.people=checked?2:1;r.memberGuestReserved=checked;if(checked)r.seat=Math.min(Number(r.seat)||0,Math.max(0,(memberTimeBackground(r)?.capacity||4)-2));r.guests=checked?r.guests.slice(0,1):[];
 if(draft.edit){draft.people=r.people;draft.memberGuestReserved=checked;}
 refreshBookingSelection();
}
const occupancyToggleGuest=toggleBookingGuest;
toggleBookingGuest=function(name,checked){
 if(checked&&draft.kind==='member'){
  const guests=draft.guests.filter(n=>n&&n!=='未定'&&n!==name);guests.push(name);
  const issue=memberTimeIssue({...draft,guests});if(issue){toast(issue);return;}
 }
 return occupancyToggleGuest(name,checked);
};
const occupancyFinish=finishCompanionPicker;
finishCompanionPicker=function(){const issue=memberTimeIssue(draft);if(issue){toast(issue);return;}return occupancyFinish();};
const occupancySaveCompanions=finishSavedCompanionRegistration;
finishSavedCompanionRegistration=function(){const issue=memberTimeIssue(draft);if(issue){toast(issue);return;}return occupancySaveCompanions();};
const occupancyCommit=commitBooking;
commitBooking=function(){
 const rows=bookingBatch.flow&&!draft.edit?bookingBatch.slots.map((r,i)=>i===bookingBatch.active?draft:r):[draft];
 const issue=rows.map(memberTimeIssue).find(Boolean);if(issue){toast(issue);return;}
 return occupancyCommit();
};

const occupancySelect=selectBookingSlot;
selectBookingSlot=function(time,people,kind,seat=0){
 if(draft.edit&&Number(people)===1)draft.memberGuestReserved=false;
 return occupancySelect(time,people,kind,seat);
};
