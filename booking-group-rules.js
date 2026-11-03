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
