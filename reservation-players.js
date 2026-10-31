"use strict";
// A provisional seat is not a registered person. Keep stored reservations unchanged.
function reservationGuestSeats(r){return typeof proxyGuestCount==='function'?proxyGuestCount(r):memberGuestCount(r);}
function registeredGuestCount(r){return (r.guests||[]).slice(0,reservationGuestSeats(r)).filter(n=>typeof n==='string'&&n.trim()&&n.trim()!=='未定').length;}
function reservationGuestNameMarkup(name){return '<span class="rs-guest-name'+(name==='未定'?' rs-pending-name':'')+'">'+(name==='未定'?'未定':esc(name)+'様')+'</span>';}
function reservationSelfMarkup(r,inlineMemberTime=false){
 const name=typeof proxyMemberInfo==='function'?proxyMemberInfo().name:'伊藤 剛';
 if(r.kind==='intro')return '<span class="rs-self-player rs-introducer"><span class="rs-introducer-label">紹介者：</span><span>'+esc(name)+'様（未同伴）</span></span>';
 if(reservationGuestSeats(r)>=Number(r.people))return '';
 return '<span class="rs-self-player"><span class="rs-self-label">ご本人</span><span>'+esc(name)+'様</span>'+(inlineMemberTime?memberTimeBadge(r):'')+'</span>';
}
function reservationPlayersMarkup(r,inlineMemberTime=false){
 const names=(r.guests||[]).filter(Boolean).map(reservationGuestNameMarkup).join('、');
 return reservationSelfMarkup(r,inlineMemberTime)+(names||(reservationGuestSeats(r)>0?'<span class="rs-pending-name">'+reservationPlayerTerm(r)+'未登録</span>':''));
}

// Booking kind is independent of booking channel and delegated entry.
function reservationIntroBadge(r){
 const rows=r.groups||[r],introduced=rows.filter(g=>g.kind==='intro').length;
 return introduced?'<span class="rs-intro-badge">'+(introduced===rows.length?'紹介枠':'紹介枠あり')+'</span>':'';
}
function reservationPlayerTerm(r){return (r.groups||[r]).some(g=>g.kind==='intro')?'ご紹介のお客様':'同伴者';}
function reservationStatusMarkup(r,label,status=r.status){return '<span class="rs-status-group"><span class="rs-status '+esc(status)+'">'+esc(label)+'</span>'+reservationIntroBadge(r)+'</span>';}

// Keep the year once per list section, while preserving the full accessible date.
function reservationCardDateMarkup(date){
 return '<time datetime="'+esc(date)+'" aria-label="'+esc(formatDate(date,true))+'">'+dateMarkup(date,true).replace(/^\d{4}年/,'')+'</time>';
}
function reservationYearCardsMarkup(records,renderCard){
 let previousYear='';
 return records.map(r=>{
  const card=renderCard(r);
  if(!card)return '';
  const year=String(r.date).slice(0,4);
  const heading=year!==previousYear?'<h3 class="rs-year-heading">'+esc(year)+'年</h3>':'';
  previousYear=year;
  return heading+card;
 }).join('');
}

function reservationStartFactsMarkup(r){
 return '<dl class="rs-start-facts"><div><dt>スタート</dt><dd>'+esc(r.side||'OUT')+' '+esc(r.time)+'</dd></div><div><dt>コース</dt><dd>'+esc(r.course)+'</dd></div><div><dt>人数</dt><dd>'+Number(r.people)+'名</dd></div></dl>';
}

// List cards emphasize active slots; cancelled slots remain attached as compact history.
function reservationListSlotsMarkup(r){
 return r.groups.map(g=>`<div class="rs-batch-slot">${r.groups.some(x=>x.kind!=='intro')?reservationIntroBadge(g):''}${g.date!==r.date?`<p class="rs-slot-date">${dateMarkup(g.date,true)}</p>`:''}${reservationStartFactsMarkup(g)}${g.status==='cancelled'?'<p class="rs-batch-cancelled">キャンセル済み</p>':`<p class="rs-guest-names">${reservationPlayersMarkup(g,true)}</p>`}</div>`).join('');
}
function reservationCancelledRows(r){
 const rows=[...(r.groups||[]),...(state.reservationHistory||[])];
 return [...new Map(rows.filter(g=>g.status==='cancelled'&&(r.batchId?g.batchId===r.batchId:g.id===r.id)).map(g=>[g.id,g])).values()].sort((a,b)=>a.date.localeCompare(b.date)||a.time.padStart(5,'0').localeCompare(b.time.padStart(5,'0')));
}
function reservationCancellationAuditTimestamp(r){
 return (r.audit||[]).filter(a=>a.action==='cancel'&&a.at&&!Number.isNaN(Date.parse(a.at))).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0]?.at;
}
function reservationCancellationTimestampParts(value){
 if(!value)return null;
 if(/^\d{4}-\d{2}-\d{2}$/.test(value))return {date:value,time:null};
 const date=new Date(value);
 if(Number.isNaN(date.getTime()))return null;
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const part=type=>parts.find(p=>p.type===type).value;
 return {date:`${part('year')}-${part('month')}-${part('day')}`,time:`${part('hour')}:${part('minute')}`};
}
function reservationCancellationOperationDate(r){
 // The demo's cancellation day is stored in cancelledAt (same calendar as createdAt).
 // Wall-clock audit dates belong to the real calendar; do not replace the demo day.
 return (reservationCancellationTimestampParts(r.cancelledAt)||reservationCancellationTimestampParts(reservationCancellationAuditTimestamp(r)))?.date||null;
}
function reservationCancellationOperationTime(r){
 // Preserve the actual recorded clock time, including for older date-only demo records.
 return reservationCancellationTimestampParts(r.cancelledAt)?.time||reservationCancellationTimestampParts(reservationCancellationAuditTimestamp(r))?.time||null;
}
function reservationCancellationHistoryMarkup(rows,playDate){
 if(!rows.length)return '';
 return `<section class="rs-cancel-history" aria-label="キャンセル履歴"><h4>キャンセル済み${rows.length>1?'（'+rows.length+'組）':''}</h4>${rows.map(g=>{
  const date=reservationCancellationOperationDate(g),clock=reservationCancellationOperationTime(g);
  const label=date?(date.slice(0,4)!==playDate.slice(0,4)?Number(date.slice(0,4))+'年':'')+Number(date.slice(5,7))+'月'+Number(date.slice(8,10))+'日'+(clock?' '+clock:''):'記録なし';
  return `<div class="rs-cancel-history-entry"><p>${g.date!==playDate?esc(formatDate(g.date,true))+'・':''}${esc(g.side||'OUT')} ${esc(g.time)}・${esc(g.course)}・${Number(g.people)}名</p><p class="rs-operation-date">操作日：${date?`<time datetime="${esc(date+(clock?'T'+clock+':00+09:00':''))}">${label}</time>`:label}</p></div>`;
 }).join('')}</section>`;
}
