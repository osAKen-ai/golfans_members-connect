'use strict';
// Only rebalance built-in fictional past records. User bookings and custom names are retained.
const sampleTogetherTargets={'山田 太郎':0,'佐藤 花子':3,'鈴木 健一':8,'田中 美咲':2,'井上 一郎':12,'小林 さくら':1,'高橋 次郎':6,'青木 美穂':4,'中村 健':0,'松本 真理':9,'渡辺 修':2,'Alex Smith':1};
function rebalanceSampleCompanions(data){const seen={};for(const r of [...(data.reservationHistory||[])].sort((a,b)=>b.date.localeCompare(a.date))){if(r.status!=='visited'||!String(r.id||'').startsWith('past')||!Array.isArray(r.guests))continue;r.guests=r.guests.map(name=>{if(!(name in sampleTogetherTargets))return name;seen[name]=(seen[name]||0)+1;return seen[name]<=sampleTogetherTargets[name]?name:'';});}return data;}

const sampleVisitCounts={2026:26,2025:45,2024:38,2023:41,2022:36};
function sampleVisitDates(y){const n=sampleVisitCounts[y];let a=Array.from({length:n},(_,i)=>new Date(Date.UTC(y,0,1+Math.floor(i*358/n))));return a;}
function sampleVisitRecords(y){return sampleVisitDates(y).map((d,i)=>({date:d.toISOString().slice(0,10),no:i+1,course:(sampleVisitCounts[y]-i)%2===1?'新コース':'旧コース',competition:i%4===1?'月例杯':'—',guests:['山田 太郎','佐藤 一郎','鈴木 健二']})).reverse();}
const guestSeeds=[
 ['山田 太郎','ヤマダ タロウ','member'],['佐藤 花子','サトウ ハナコ','member'],['鈴木 健一','スズキ ケンイチ','member'],['田中 美咲','タナカ ミサキ','guest'],['井上 一郎','イノウエ イチロウ','member'],['小林 さくら','コバヤシ サクラ','guest'],['高橋 次郎','タカハシ ジロウ','member'],['青木 美穂','アオキ ミホ','guest'],['中村 健','ナカムラ ケン','member'],['松本 真理','マツモト マリ','guest'],['渡辺 修','ワタナベ オサム','guest'],['Alex Smith','ALEX SMITH','guest']
];
function sampleHistory(){let records=[];for(const y of [2022,2023,2024,2025,2026])for(const [i,r] of sampleVisitRecords(y).entries()){if(r.date<'2022-04-10')continue;records.push({id:'past'+r.date,date:r.date,course:r.course,time:i%2?'9:04':'8:12',side:i%3?'OUT':'IN',people:4,guests:[0,1,2].map(n=>guestSeeds[(i+n*3)%guestSeeds.length][0]),status:'visited',createdAt:bookingShift(r.date,-28),source:i%3?'WEB予約':'電話予約',proxy:i%7===0});}
 ['2027-01-10','2027-01-24','2027-02-07','2027-02-21','2027-03-07','2027-03-14','2027-03-28','2027-04-04','2027-04-08'].forEach((date,i)=>records.push({id:'past'+date,date,course:i%2?'新コース':'旧コース',side:i%2?'IN':'OUT',time:i%2?'9:04':'8:12',people:4,guests:i%2?guestSeeds.slice(4,7).map(c=>c[0]):guestSeeds.slice(1,4).map(c=>c[0]),status:'visited',createdAt:bookingShift(date,-30),source:i%2?'電話予約':'WEB予約',proxy:i===7}));
 ['2027-02-14','2027-03-21','2027-04-11','2027-04-24'].forEach((date,i)=>records.push({id:'cancelSample'+i,date,course:i%2?'新コース':'旧コース',side:'OUT',time:'8:40',people:4,guests:guestSeeds.slice(1,4).map(c=>c[0]),status:'cancelled',createdAt:bookingShift(date,-35),cancelledAt:bookingShift(date,i===2?-2:-16),source:i%2?'電話予約':'WEB予約',proxy:false}));return records;
}

function ensureMemberSampleData(data){
 // Both member and delegate views use the same built-in booking origins.
 // Fill missing sample metadata only; never relabel saved or user-created bookings.
 const origins={sample1:{source:'WEB予約',proxy:false},sample2:{source:'WEB予約',proxy:true},sample3:{source:'WEB予約',proxy:false}};
 for(const r of data.reservations||[]){
  const origin=origins[r.id];
  if(!origin)continue;
  if(!r.source)r.source=origin.source;
  if(r.proxy===undefined)r.proxy=origin.proxy;
  if(!r.createdAt)r.createdAt=bookingShift(r.date,-30);
 }
 // Add one visible phone-booking example to existing demo sessions as well.
 // Its stable ID prevents duplicates and respects cancellation/removal to history.
 if(!Array.isArray(data.reservations))data.reservations=[];
 const phoneDemoId='phone-reservation-demo-20261031';
 if(![...data.reservations,...(data.reservationHistory||[]),...(data.demoReservationCleanupBackup||[])].some(r=>r.id===phoneDemoId)){
  data.reservations.push({id:phoneDemoId,date:'2027-04-11',course:'旧コース',side:'OUT',time:'9:15',people:4,guests:['佐藤 花子','鈴木 健一','田中 美咲'],status:'reserved',source:'電話予約',proxy:false,createdAt:'2027-04-10'});
 }
 // A visible introduction example, without overwriting existing reservations.
 const introDemoId='intro-reservation-demo-20261031';
 if(![...data.reservations,...(data.reservationHistory||[]),...(data.demoReservationCleanupBackup||[])].some(r=>r.id===introDemoId)){
  data.reservations.push({id:introDemoId,date:'2027-04-13',course:'旧コース',side:'OUT',time:'8:40',people:4,kind:'intro',memberPlaying:false,guests:['井上 一郎','小林 さくら','未定','未定'],status:'reserved',source:'WEB予約',proxy:false,createdAt:'2027-04-10'});
 }
 if(!Array.isArray(data.companions))data.companions=guestSeeds.map(([name,kana,type],i)=>({id:'person'+i,name,kana,type,phone:'090-****-'+String(1800+i*173).padStart(4,'0'),extraVisits:[]}));
 if(!Array.isArray(data.reservationHistory))data.reservationHistory=[];
 if(!data.reservationHistory.some(r=>r.status==='visited')&&!data.sampleHistoryReady){
 const ids=new Set(data.reservationHistory.map(r=>r.id));
 data.reservationHistory.push(...sampleHistory().filter(r=>!ids.has(r.id)));
 }
 data.sampleHistoryReady=true;
 return organizeDemoReservations(rebalanceSampleCompanions(data));
}

// One-time cleanup of accumulated demo submissions; a multi-group submission stays intact.
function organizeDemoReservations(data){
 if(data.demoReservationCleanupVersion===1)return data;
 const records=data.reservations||[],chosen=new Map();
 const active=r=>!r.status||r.status==='reserved';
 const key=r=>r.batchId?'batch:'+r.batchId:'single:'+r.id;
 for(const [i,r] of records.entries()){
  if(!active(r))continue;
  const score=String(r.updatedAt||r.createdAt||'');
  const prior=chosen.get(r.date);
  if(!prior||score>prior.score||score===prior.score&&i>prior.index)chosen.set(r.date,{key:key(r),score,index:i});
 }
 const removed=records.filter(r=>active(r)&&chosen.get(r.date)?.key!==key(r));
 data.demoReservationCleanupBackup=[...(data.demoReservationCleanupBackup||[]),...removed];
 const removedIds=new Set(removed.map(r=>r.id));
 data.reservations=records.filter(r=>!removedIds.has(r.id));
 data.demoReservationCleanupVersion=1;
 return data;
}
