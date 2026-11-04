"use strict";
// A normal/introduction party uses the minimum number of four-player groups.
// Member-time entries reserve individual seats, not whole groups.
function bookingGroupIssue(rows){
 const parties=new Map();
 for(const row of rows){
  if(row.kind==='member'||row.status==='cancelled')continue;
  const key=[row.date,row.course].join('|');
  const party=parties.get(key)||{groups:0,people:0};
  party.groups++;party.people+=Number(row.people);parties.set(key,party);
 }
 for(const party of parties.values()){
  const needed=Math.ceil(party.people/4);
  if(party.groups>needed)return `計${party.people}名は${needed}組でご予約ください。各枠の人数または組数を調整してください。`;
 }
 return '';
}
function bookingGroupCandidate(rows,candidate,keyOf){
 const key=keyOf(candidate),others=rows.filter(row=>keyOf(row)!==key);
 return [...others,candidate];
}
function bookingGroupEditRows(candidate,records){
 const prior=records.find(row=>row.id===candidate.id);
 const siblings=prior?.batchId?records.filter(row=>row.batchId===prior.batchId&&row.id!==candidate.id):[];
 return [...siblings,candidate];
}
function bookingGroupNoticeMarkup(rows){
 const issue=bookingGroupIssue(rows);
 if(issue)return `<p class="bk-group-rule bk-group-rule-error" role="alert">${issue}</p>`;
 return rows.some(row=>row.kind!=='member')?'<p class="bk-group-rule">4名までは1組、5〜8名は2組、9〜12名は3組でお選びください。</p>':'';
}

// Demonstration timetable per course/tee: four member-time starts per day.
// Weekdays: one in each hour; weekends/holidays: two each in the 8 and 9 o'clock hours.
function demoBookingSlotKind(date,time,pattern){
 const [hour,minute]=time.split(':').map(Number);
 const day=new Date(date+'T12:00:00Z').getUTCDay();
 const weekend=day===0||day===6||(typeof isJapaneseHoliday==='function'&&isJapaneseHoliday(date));
 const slotIndex=Math.round((hour*60+minute-(7*60+2))/7);
 const firstInHour=Math.max(0,Math.ceil((hour*60-(7*60+2))/7));
 const position=slotIndex-firstInHour;
 const member=weekend?(hour===8||hour===9)&&[1,5].includes(position):position===2;
 return member?'member':pattern===3||pattern===4?'intro':'normal';
}
