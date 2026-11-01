'use strict';
/* One-off Google Calendar links: no API, OAuth or calendar write access.
 * https://developers.google.com/workspace/calendar/api/concepts/inviting-attendees-to-events
 * Reuse the same fee schedule and demo clock as the reservation screens. */
const ReservationCalendar = (() => {
 const fee=typeof ReservationFees!=='undefined'?ReservationFees:require('./reservation-fees.js');
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=n=>n.toLocaleString('ja-JP')+'円';
 const stamp=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
 const short=d=>fee.display(d).replace(/^\d+年/,'');
 const icon='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 11h18"/></svg>';
 function link(title,dates,details){
  return 'https://calendar.google.com/calendar/r/eventedit?'+new URLSearchParams({action:'TEMPLATE',text:title,dates,stz:'Asia/Tokyo',etz:'Asia/Tokyo',ctz:'Asia/Tokyo',location:'宝塚ゴルフ倶楽部',details});
 }
 function build(input,today){
  fee.date(today);
  const rows=input.filter(r=>r&&(!r.status||r.status==='reserved')&&r.date>=today&&/^([01]?\d|2[0-3]):[0-5]\d$/.test(r.time||'')).sort((a,b)=>a.date.localeCompare(b.date)||a.time.padStart(5,'0').localeCompare(b.time.padStart(5,'0')));
  if(!rows.length)return null;
  const first=rows[0],last=rows[rows.length-1];
  const start=new Date(first.date+'T'+first.time.padStart(5,'0')+':00+09:00');
  const end=new Date(new Date(last.date+'T'+last.time.padStart(5,'0')+':00+09:00').getTime()+6*3600000);
  const summary=rows.map((r,i)=>`${rows.length>1?(i+1)+'組目：':''}${fee.display(r.date)} ${r.course} ${r.side||'OUT'} ${r.time}・${r.people}名`).join('\n');
  const note='予約変更・取消時は、Googleカレンダーの予定もご自身で変更・削除してください。';
  const round={date:first.date,time:first.time,summary,href:link(`宝塚GC ラウンド（${first.side||'OUT'} ${first.time}〜${rows.length>1?'・'+rows.length+'組':''}）`,stamp(start)+'/'+stamp(end),summary+'\n\n終了時刻は最終スタートの6時間後を目安に設定しています。保存前に調整できます。\n'+note+'\n※操作体験版のサンプル予約です。実際の予約ではありません。')};
  let candidates=[];
  rows.filter(r=>r.date>='2027-01-01').forEach(r=>{
   const s=fee.schedule(r.date,r.createdAt||today);
   const solo=Number(r.people)===1&&r.memberPlaying!==false&&r.kind!=='intro';
   if(!solo)s.guest.forEach((t,i)=>{if(t.date&&!t.label.includes('予約時点'))candidates.push({...t,unit:'組',type:'ゲスト',increase:i>0,playDate:r.date});});
   if(r.memberPlaying!==false&&r.kind!=='intro')candidates.push({...s.member,unit:'人',type:'メンバー',increase:false,playDate:r.date});
  });
  candidates=candidates.filter(t=>fee.shift(t.date,-2)>=today).sort((a,b)=>a.date.localeCompare(b.date)||a.type.localeCompare(b.type));
  const next=candidates[0];let reminder=null;
  if(next){
   const matching=[...new Map(candidates.filter(t=>t.date===next.date).map(t=>[`${t.type}|${t.amount}|${t.playDate}`,t])).values()];
   const day=fee.shift(next.date,-2),increase=matching.some(t=>t.increase);
   const label='キャンセル料'+(increase?'増額':'発生')+'の2日前';
   const description=matching.map(t=>`${short(t.date)}から${t.type}${money(t.amount)}／${t.unit}${t.increase?'に増額':'が発生'}します。`).join('\n');
   reminder={date:day,label,description,href:link(`【最終確認】宝塚GC キャンセル料${increase?'増額':'発生'}2日前`,day.replace(/-/g,'')+'/'+fee.shift(day,1).replace(/-/g,''),`明後日${description}\n同伴者の出欠確定・組数調整を行ってください。\nゲストのキャンセル料は組数が減らない場合には発生しません。\n\n対象の予約：\n${summary}\n\n${note}\n※操作体験版のサンプル予約です。実際の予約ではありません。`)};
  }
  return {round,reminder,rows};
 }
 const button=(href,label)=>`<a class="rc-add" href="${escape(href)}" target="_blank" rel="noopener noreferrer">${icon}<span>${label}</span><span class="rc-external" aria-hidden="true">↗</span></a>`;
 function markup(model,expanded){
  if(!model)return '';
  const {round,reminder,rows}=model;
  const cards=`<p class="rc-help">追加する予定を選び、Googleカレンダーで「保存」してください。</p><div class="rc-grid"><article class="rc-card"><h4><span class="rc-number">1</span>ラウンド予定</h4><strong class="rc-date">${short(round.date)} <span>${escape(round.time)}〜</span></strong><p class="rc-description">${escape(rows[0].course)}・${escape(rows[0].side||'OUT')}・${rows.length>1?rows.length+'組／計':''}${rows.reduce((n,r)=>n+Number(r.people),0)}名</p>${rows.length>1?'<p class="rc-small">全組のスタート時間を予定の説明欄に記載します。</p>':''}${button(round.href,'ラウンド予定を追加')}<p class="rc-small">終了時刻は約6時間後の目安です。</p></article><article class="rc-card"><h4><span class="rc-number">2</span>キャンセル料の確認</h4>${reminder?`<strong class="rc-date">${short(reminder.date)} <span class="rc-all-day">終日</span></strong><p class="rc-emphasis">${reminder.label}</p><p class="rc-description">${escape(reminder.description).replace(/\n/g,'<br>')}</p>${button(reminder.href,'確認日を追加')}`:'<p class="rc-description rc-unavailable">これから登録できる「2日前の確認日」はありません。下のキャンセル規定をご確認ください。</p>'}</article></div><p class="rc-note">予約変更・取消は自動反映されません。追加済みの予定もご自身で変更・削除してください。</p><p class="rc-small rc-demo">※体験版の予定がGoogleカレンダーに追加されます。</p>`;
  return expanded?`<section class="rc-calendar" aria-label="Googleカレンダーに追加"><h3 class="rc-heading">${icon}Googleカレンダーに追加</h3>${cards}</section>`:`<details class="rc-calendar rc-fold"><summary>${icon}<span>Googleカレンダーに追加</span><span class="rc-chevron" aria-hidden="true">⌄</span></summary>${cards}</details>`;
 }
 return {build,markup,link};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ReservationCalendar;
if(typeof document!=='undefined')(() => {
 function mount(){
  if(typeof current==='undefined'||!['complete','registered','detail','groupDetail','reservationGroup'].includes(current?.k))return;
  const host=document.querySelector('#panelBody')||document.querySelector('.proxy-flow-content')||document.querySelector('#proxyMain');
  if(!host||host.querySelector('.rc-calendar'))return;
  const arg=current.arg,ids=typeof arg==='string'?[arg]:arg?.ids||[arg?.id];
  let rows=state.reservations.filter(r=>ids.includes(r.id));
  const group=['reservationGroup','registered'].includes(current.k)||typeof proxyMemberInfo==='function'&&['complete','detail'].includes(current.k);
  if(group&&rows[0]?.batchId)rows=state.reservations.filter(r=>r.batchId===rows[0].batchId);
  const today=typeof now==='string'?now:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date());
  const html=ReservationCalendar.markup(ReservationCalendar.build(rows,today),current.k==='complete');
  if(!html)return;
  const template=document.createElement('template');template.innerHTML=html;const el=template.content.firstElementChild;
  const fees=host.querySelector('.rf-details');
  const summary=host.querySelector('.bk-completion-reservation,.rs-detail-line,.rs-batch-slots,.bk-confirm-facts,.proxy-facts');
  if(fees)fees.before(el);else if(summary)summary.after(el);else host.append(el);
 }
 new MutationObserver(mount).observe(document.body,{childList:true,subtree:true});mount();
})();
