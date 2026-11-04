"use strict";
// A normal/introduction party uses the minimum number of four-player groups.
// Member-time entries reserve individual seats, not whole groups.
function bookingGroupIssue(rows){
 if(rows.some(r=>r.status!=='cancelled'&&r.kind==='intro'&&bookingRequiresAccompaniment(r.date)))return '土日祝はメンバー同伴が必要です。紹介枠はご予約いただけません。';
 const introIssue=bookingIntroLimitIssue(rows);if(introIssue)return introIssue;
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
 return member?'member':!weekend&&(pattern===3||pattern===4)?'intro':'normal';
}

// Shared member/delegate restriction, using the existing holiday calendar.
function bookingRequiresAccompaniment(date){
 const day=new Date(date+'T12:00:00Z').getUTCDay();
 return day===0||day===6||(typeof isJapaneseHoliday==='function'&&isJapaneseHoliday(date));
}
function bookingTypeOptions(){
 const restricted=typeof current!=='undefined'&&current?.k==='times'&&bookingRequiresAccompaniment(draft.date);
 if(restricted&&bookingUI.type==='intro')bookingUI.type='all';
 return [['all','全てを見る'],['member','メンバータイム'],['normal','通常枠'],...(!restricted?[['intro','紹介枠']]:[])];
}
function removeWeekendIntroDemo(data){
 const invalid=r=>r.kind==='intro'&&bookingRequiresAccompaniment(r.date);
 // Keep a recovery copy rather than silently reclassifying players or losing demo input.
 for(const key of ['reservations','reservationHistory']){
  if(!Array.isArray(data[key]))continue;
  const removed=data[key].filter(invalid);
  if(removed.length){data.weekendIntroBackup=data.weekendIntroBackup||[];for(const r of removed)if(!data.weekendIntroBackup.some(x=>x.id===r.id))data.weekendIntroBackup.push({...r});data[key]=data[key].filter(r=>!invalid(r));}
 }
 if(data.waitlistDemo){
  for(const key of ['requests','slots'])if(Array.isArray(data.waitlistDemo[key]))data.waitlistDemo[key]=data.waitlistDemo[key].filter(r=>!invalid(r));
 }
 return data;
}

function bookingExistingReservations(){
 let records=typeof state!=='undefined'?state.reservations||[]:[];
 try{
  const key=typeof proxyMember!=='undefined'&&typeof proxyStorageKey==='function'?proxyStorageKey(proxyMember):'takarazuka-portal-v1';
  const saved=JSON.parse(localStorage.getItem(key));
  if(Array.isArray(saved?.reservations))records=saved.reservations;
 }catch{}
 return records;
}
function bookingIntroLimitIssue(rows,existing=bookingExistingReservations()){
 const changedIds=new Set(rows.map(r=>r.id).filter(Boolean));
 const dates=new Set(rows.filter(r=>r.kind==='intro').map(r=>r.date));
 const combined=[...existing.filter(r=>!changedIds.has(r.id)),...rows];
 for(const date of dates){
  const count=combined.filter(r=>r.date===date&&r.kind==='intro'&&(!r.status||r.status==='reserved')).length;
  if(count>2)return '平日の紹介予約は、会員1名につき同じプレー日で合計2組までです。旧・新コース、本人・代理人の予約を合算します。';
 }
 return '';
}
