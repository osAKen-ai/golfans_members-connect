"use strict";
// A provisional seat is not a registered person. Keep stored reservations unchanged.
function reservationGuestSeats(r){return typeof proxyGuestCount==='function'?proxyGuestCount(r):memberGuestCount(r);}
function registeredGuestCount(r){return (r.guests||[]).slice(0,reservationGuestSeats(r)).filter(n=>typeof n==='string'&&n.trim()&&n.trim()!=='未定').length;}
function reservationGuestNameMarkup(name){return '<span class="rs-guest-name'+(name==='未定'?' rs-pending-name':'')+'">'+(name==='未定'?'未定':esc(name)+'様')+'</span>';}
function reservationSelfMarkup(r){
 const name=typeof proxyMemberInfo==='function'?proxyMemberInfo().name:'伊藤 剛';
 if(r.kind==='intro')return '<span class="rs-self-player rs-introducer"><span class="rs-introducer-label">紹介者：</span><span>'+esc(name)+'様（未同伴）</span></span>';
 if(reservationGuestSeats(r)>=Number(r.people))return '';
 return '<span class="rs-self-player"><span class="rs-self-label">ご本人</span><span>'+esc(name)+'様</span></span>';
}
function reservationPlayersMarkup(r){
 const names=(r.guests||[]).filter(Boolean).map(reservationGuestNameMarkup).join('、');
 return reservationSelfMarkup(r)+(names||(reservationGuestSeats(r)>0?'<span class="rs-pending-name">'+reservationPlayerTerm(r)+'未登録</span>':''));
}

// Booking kind is independent of booking channel and delegated entry.
function reservationIntroBadge(r){
 const rows=r.groups||[r],introduced=rows.filter(g=>g.kind==='intro').length;
 return introduced?'<span class="rs-intro-badge">'+(introduced===rows.length?'紹介枠':'紹介枠あり')+'</span>':'';
}
function reservationPlayerTerm(r){return (r.groups||[r]).some(g=>g.kind==='intro')?'ご紹介のお客様':'同伴者';}
function reservationStatusMarkup(r,label,status=r.status){return '<span class="rs-status-group"><span class="rs-status '+esc(status)+'">'+esc(label)+'</span>'+reservationIntroBadge(r)+'</span>';}
