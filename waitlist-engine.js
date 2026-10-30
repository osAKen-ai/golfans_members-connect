/* Browser-local demonstration only. Production needs a shared transactional queue and notification delivery. */
(function(root){
'use strict';
const hour=3600000;
const day=t=>new Date(t+9*hour).toISOString().slice(0,10);
const minute=t=>{const d=new Date(t+9*hour);return d.getUTCHours()*60+d.getUTCMinutes();};
const deadline=date=>Date.parse(date+'T00:00:00+09:00')-6*hour; // previous day 18:00, provisional
const key=s=>[s.date,s.course,s.side||'OUT',s.time,s.kind].join('|');
const fingerprint=r=>JSON.stringify([r.id,r.date,r.course,r.side||'OUT',r.time,r.people,r.kind||'normal']);
const order=(a,b)=>(a.mode==='change'?0:1)-(b.mode==='change'?0:1)||a.created-b.created||a.id.localeCompare(b.id);
function matches(r,s){return r.date===s.date&&r.kind===s.kind&&(r.course==='any'||r.course===s.course)&&r.hours.includes(Number(s.time.split(':')[0]))&&r.people<=s.capacity&&(!r.original||r.original.course!==s.course||r.original.time!==s.time||(r.original.side||'OUT')!==(s.side||'OUT'));}
function init(data,base){if(!data.waitlistDemo)data.waitlistDemo={requests:[],slots:[],log:[],seeded:[],clock:base,wall:Date.now(),serial:0};return data.waitlistDemo;}
function clock(w){return w.clock+Math.max(0,Date.now()-w.wall);}
function log(w,r,text,t){w.log.unshift({id:r.id,text,at:t,owner:r.owner});w.log=w.log.slice(0,60);}
function add(w,r,t){
 if(t>=deadline(r.date))throw Error('この日のキャンセル待ち受付は終了しました。');
 if(!r.hours.length||r.hours.some(h=>![7,8,9,10].includes(h)))throw Error('希望時間帯を選択してください。');
 if(r.kind==='member'&&r.people!==1)throw Error('メンバータイムはご本人1名です。');
 if(w.requests.some(x=>x.owner===r.owner&&x.date===r.date&&['waiting','queued','offered'].includes(x.status)))throw Error('同じ日の待ち登録があります。「待ち状況」からご確認ください。');
 const row={...r,id:'wait-'+(++w.serial),created:t,status:'waiting'};w.requests.push(row);return row;
}
function release(w,slots){for(const s of slots){const k=key(s);const old=w.slots.find(x=>key(x)===k);if(!old)w.slots.push({...s,status:'open'});else if(old.status==='booked'){Object.assign(old,s,{status:'open'});delete old.request;}}}
function availableToSend(t,date){return day(t)<date&&minute(t)>=600&&minute(t)<=1020&&t+hour<=deadline(date);}
function tick(w,t,reservations,owner){
 for(const r of w.requests){
  if(!['waiting','queued','offered'].includes(r.status))continue;
  const original=r.original&&r.owner===owner?reservations.find(x=>x.id===r.original.id):null;
  const invalid=r.owner===owner&&(r.mode==='change'?(!original||fingerprint(original)!==r.fingerprint):reservations.some(x=>x.date===r.date));
  if(invalid||t>=deadline(r.date)||(r.status==='offered'&&t>=r.expires)){
   r.status=invalid?'invalid':'expired';const s=w.slots.find(s=>s.request===r.id&&s.status==='held');if(s){s.status='open';delete s.request;}
   log(w,r,invalid?'元の予約状況が変わったため受付終了':'回答期限が過ぎたため仮確保を解除',t);
  }
 }
 for(const s of w.slots){
  if(t>=deadline(s.date)){if(s.status!=='booked')s.status='closed';continue;}
  if(s.status==='open'){
   const r=w.requests.filter(r=>r.status==='waiting'&&matches(r,s)).sort(order)[0];
   if(r){s.status='held';s.request=r.id;r.slot={...s};r.status='queued';log(w,r,'希望枠を確保・配信時刻待ち',t);}
  }
  if(s.status==='held'){
   const r=w.requests.find(r=>r.id===s.request);
   if(r?.status==='queued'&&availableToSend(t,r.date)){r.status='offered';r.sent=t;r.expires=t+hour;log(w,r,'空き枠のご案内（通知デモ）・1時間確保',t);}
  }
 }
}
function decline(w,id,t,owner){const r=w.requests.find(x=>x.id===id&&x.owner===owner);if(!r||!['waiting','queued','offered'].includes(r.status))throw Error('この受付は終了しています。');r.status='declined';const s=w.slots.find(s=>s.request===id&&s.status==='held');if(s){s.status='open';delete s.request;}log(w,r,'辞退しました。元の予約は維持されます',t);}
function accept(data,id,t,owner,operator){
 const w=data.waitlistDemo;tick(w,t,data.reservations,owner);
 const r=w.requests.find(x=>x.id===id&&x.owner===owner),s=w.slots.find(x=>x.request===id&&x.status==='held');
 if(!r||r.status!=='offered'||!s||t>=r.expires)throw Error('回答期限が過ぎているか、この枠は確保されていません。');
 let record;
 if(r.mode==='change'){
  record=data.reservations.find(x=>x.id===r.original.id);
  if(!record||fingerprint(record)!==r.fingerprint)throw Error('元の予約が変更されています。');
  const old={date:record.date,course:record.course,side:record.side||'OUT',time:record.time,kind:record.kind==='member'?'member':'normal',capacity:record.kind==='member'?1:4};
  Object.assign(record,{course:s.course,side:s.side,time:s.time});
  release(w,[old]);
 }else{
  if(data.reservations.some(x=>x.date===r.date))throw Error('同日に予約があります。変更待ちをご利用ください。');
  record={id:'wait-booking-'+r.id,date:r.date,course:s.course,side:s.side,time:s.time,kind:r.kind,people:r.people,memberPlaying:true,guests:Array(Math.max(0,r.people-1)).fill('未定'),createdAt:day(t),source:'キャンセル待ち',proxy:operator.id!=='ito'};
  data.reservations.push(record);
 }
 record.audit=[...(record.audit||[]),{action:r.mode==='change'?'waitlist-change':'waitlist-book',operatorId:operator.id,operatorName:operator.name,at:new Date(t).toISOString()}];
 record.updatedAt=day(t);s.status='booked';r.status='accepted';log(w,r,'予約を確定しました',t);tick(w,t,data.reservations,owner);return record;
}
function rank(w,r,h){return 1+w.requests.filter(x=>x.id!==r.id&&['waiting','queued','offered'].includes(x.status)&&x.mode===r.mode&&x.date===r.date&&x.kind===r.kind&&x.hours.includes(h)&&(r.course==='any'||x.course==='any'||x.course===r.course)&&(x.created<r.created||x.created===r.created&&x.id<r.id)).length;}
root.WaitlistEngine={hour,day,minute,deadline,key,fingerprint,order,matches,init,clock,add,release,tick,decline,accept,rank};
if(typeof module!=='undefined')module.exports=root.WaitlistEngine;
})(typeof globalThis!=='undefined'?globalThis:this);
