'use strict';
// The limit is per four-seat tee time, including people already booked there.
function memberTimeBackground(r){
 const previous=draft;
 try{draft={...r};return (typeof wlOriginalSlots==='function'?wlOriginalSlots:currentBookingInventory)(r.date,r.side||'OUT',true).find(s=>s.time===r.time);}
 finally{draft=previous;}
}
function memberTimeIssue(r){
 if(r.kind!=='member')return '';
 if(r.memberMode==='group'&&Number(r.people)!==4)return 'メンバー枠は1組4名で予約してください。';
 const slot=memberTimeBackground(r);
 if((r.memberMode||slot?.memberMode)==='individual'&&(Number(r.people)!==(r.memberGuestReserved?2:1)))return '1人予約はご本人1名、ゲスト同伴時は2名で予約してください。';
 const occupied=slot?.kind==='member'?sampleBookingParticipants(slot):[];
 const players=bookingRecordParticipants(r);
 const others=state.reservations.filter(x=>x.id!==r.id&&x.status!=='cancelled'&&x.date===r.date&&x.course===r.course&&(x.side||'OUT')===(r.side||'OUT')&&x.time===r.time);
 const reserved=others.flatMap(bookingRecordParticipants);
 if(occupied.length+reserved.length+Number(r.people)>4)return 'メンバータイムは1組4枠までです。空き枠を選び直してください。';
 if([...occupied,...reserved,...players].filter(p=>p.type==='guest').length>1)return 'メンバータイムのゲスト同伴は、1組4枠のうち最大1名です。';
 return '';
}
const occupancyValid=bookingSelectionValid;
bookingSelectionValid=function(){
 if(memberTimeIssue(draft))return false;
 if(draft.kind==='member'){const slot=memberTimeBackground(draft);return draft.date>now&&!!slot&&Number(draft.people)>=1&&Number(draft.people)<=4&&!memberTimeIssue(draft);}
 return occupancyValid();
};
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

function memberSelectedSeats(r){return Array.isArray(r?.selectedSeats)?r.selectedSeats:Array.from({length:Number(r?.people)||0},(_,i)=>(Number(r?.seat)||0)+i);}
const occupancySelect=selectBookingSlot;
function setMemberSeats(time,seats,{memberGuestReserved=false}={}){
 const slot=bookingSlots(draft.date).find(s=>s.time===time);
 if(!slot?.available||slot.kind!=='member')return;
 seats=[...new Set(seats)].filter(i=>Number.isInteger(i)&&i>=0&&i<slot.capacity).sort((a,b)=>a-b);
 const old=selectedBookingForSlot(slot);
 if(!seats.length){if(old)removeBookingSelection(draft.edit?0:bookingBatch.slots.indexOf(old));return;}
 const candidate={...(old||{}),date:draft.date,course:draft.course,side:draft.side||'OUT',time,kind:'member',memberMode:slot.memberMode||'individual',people:seats.length,seat:seats[0],selectedSeats:seats,availableCapacity:slot.capacity,guests:(old?.guests||[]).slice(0,seats.length-1),memberGuestReserved:slot.memberMode!=='group'&&memberGuestReserved};
 const issue=bookingGroupIssue(memberGroupRows(candidate))||memberTimeIssue(candidate);if(issue){toast(issue);return;}
 if(draft.edit){Object.assign(draft,candidate);bookingUI.selected=true;}
 else {const i=bookingBatch.slots.findIndex(r=>bookingSlotKey(r)===bookingSlotKey(candidate));if(i<0)bookingBatch.slots.push(candidate);else bookingBatch.slots[i]=candidate;normalizeBookingBatch();Object.assign(draft,{time,people:seats.length,kind:'member'});}
 bookingUI.seat=seats[0];refreshBookingSelection();
}
selectBookingSlot=function(time,people,kind,seat=0){
 if(kind!=='member')return occupancySelect(time,people,kind,seat);
 const slot=bookingSlots(draft.date).find(s=>s.time===time);if(!slot)return;
 if(slot.memberMode==='group'){toggleMemberTimeAll(time);return;}
 const selected=selectedBookingForSlot(slot);
 setMemberSeats(time,selected&&memberSelectedSeats(selected).includes(seat)?[]:[seat]);
};
function toggleMemberTimeAll(time){
 const slot=bookingSlots(draft.date).find(s=>s.time===time);if(!slot?.available||slot.kind!=='member')return;
 if(slot.memberMode!=='group')return;
 const seats=memberSelectedSeats(selectedBookingForSlot(slot));
 setMemberSeats(time,seats.length===slot.capacity?[]:Array.from({length:slot.capacity},(_,i)=>i));
}

// Individual seats retain the original optional guest checkbox; group bookings do not.
function memberTimeCanAddGuest(r){
 if(r.kind!=='member'||r.memberMode==='group'||r.memberPlaying===false)return false;
 const previous=draft;
 try{
  draft={...r};
  const slot=bookingSlots(r.date,r.side||'OUT').find(s=>s.time===r.time);
  return !!slot?.available&&slot.capacity>=2&&!memberTimeIssue({...r,people:2,memberGuestReserved:true,guests:['']});
 }finally{draft=previous;}
}
const occupancySelection=bookingSelectionMarkup;
bookingSelectionMarkup=function(){
 const html=occupancySelection();
 const options=selectionTrayRows().map((r,i)=>r.kind==='member'&&r.memberMode!=='group'&&r.memberPlaying!==false?`<label class="bk-member-guest-option"><input type="checkbox" ${r.memberGuestReserved?'checked':''} ${!r.memberGuestReserved&&!memberTimeCanAddGuest(r)?'disabled':''} onchange="setMemberTimeGuest(${i},this.checked)"><span>${r.time} ゲスト1名を同伴<small>${r.memberGuestReserved||memberTimeCanAddGuest(r)?'ご本人と合わせて2枠を予約します':'空き枠不足、またはこの組のゲスト枠は予約済みです'}</small></span></label>`:'').join('');
 return options?html.replace('<div class="bk-selection-actions">',options+'<div class="bk-selection-actions">'):html;
};
function setMemberTimeGuest(index,checked){
 const r=selectionTrayRows()[index];
 if(!r||r.kind!=='member'||r.memberMode==='group')return;
 if(checked&&!memberTimeCanAddGuest(r)){toast('この組ではゲスト同伴を追加できません');refreshBookingSelection();return;}
 const previous=draft;
 try{
  draft={...r};
  const slot=bookingSlots(r.date,r.side||'OUT').find(s=>s.time===r.time);
  const first=memberSelectedSeats(r)[0]||0;
  const second=Array.from({length:slot?.capacity||0},(_,i)=>i).find(i=>i!==first);
  setMemberSeats(r.time,checked?[first,second]:[first],{memberGuestReserved:checked});
  if(r.edit)Object.assign(previous,draft);
 }finally{draft=previous;}
}
