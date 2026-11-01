'use strict';
/* Shared by member and proxy screens. Civil dates are calculated in UTC so
 * browser timezone and daylight saving never change a cancellation deadline.
 * Holiday source: https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html
 * 2026/2027 are published dates; later years follow current law (provisional).
 * Policy: supplied club decision sheet, effective January 2027. */
const ReservationFees = (() => {
 const version='2027-01';
 const date = value => {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))throw new Error('Invalid play date');
  const d=new Date(value+'T00:00:00Z');
  if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)throw new Error('Invalid play date');
  return d;
 };
 const shift=(value,days)=>{const d=date(value);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
 const display=value=>{const d=date(value);return `${d.getUTCFullYear()}年${d.getUTCMonth()+1}月${d.getUTCDate()}日（${'日月火水木金土'[d.getUTCDay()]}）`;};
 const cache=new Map();
 function holidays(year){
  if(cache.has(year))return cache.get(year);
  const list={};const key=(m,d)=>`${year}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const add=(m,d,n)=>list[key(m,d)]=n;
  const monday=(m,n)=>1+(8-date(key(m,1)).getUTCDay())%7+(n-1)*7;
  if(year<2026||year>2099)return list;
  [[1,1,'元日'],[2,11,'建国記念の日'],[2,23,'天皇誕生日'],[4,29,'昭和の日'],[5,3,'憲法記念日'],[5,4,'みどりの日'],[5,5,'こどもの日'],[8,11,'山の日'],[11,3,'文化の日'],[11,23,'勤労感謝の日']].forEach(v=>add(...v));
  [[1,2,'成人の日'],[7,3,'海の日'],[9,3,'敬老の日'],[10,2,'スポーツの日']].forEach(([m,n,name])=>add(m,monday(m,n),name));
  add(3,Math.floor(20.8431+0.242194*(year-1980)-Math.floor((year-1980)/4)),'春分の日');
  add(9,Math.floor(23.2488+0.242194*(year-1980)-Math.floor((year-1980)/4)),'秋分の日');
  const national={...list};
  Object.keys(national).forEach(day=>{const next=shift(day,1);if(!national[next]&&national[shift(day,2)])list[next]='国民の休日';});
  Object.keys(national).forEach(day=>{if(date(day).getUTCDay()===0){let next=shift(day,1);while(list[next])next=shift(next,1);list[next]='振替休日';}});
  cache.set(year,list);return list;
 }
 const holiday=value=>holidays(date(value).getUTCFullYear())[value]||'';
 const weekend=value=>[0,6].includes(date(value).getUTCDay())||!!holiday(value);
 function schedule(playDate,createdAt){
  date(playDate);
  const special=weekend(playDate),booked=/^\d{4}-\d{2}-\d{2}$/.test(createdAt||'')?createdAt:null;
  if(booked)date(booked);
  let guest=special?[{date:booked,label:'予約時点から',amount:5000},...[42,28,7].map((days,i)=>({date:shift(playDate,-days),label:`プレー日の${days/7}週間前から`,amount:[10000,20000,30000][i]}))]:[{date:shift(playDate,-14),label:'プレー日の2週間前から',amount:10000}];
  const member={date:shift(playDate,-7),label:'プレー日の1週間前から',amount:2000};
  // A late booking cannot incur a fee before it exists. Collapse elapsed
  // tiers into the amount applicable on its actual reservation date.
  if(booked){
   const elapsed=guest.filter(t=>t.date&&t.date<=booked);
   if(elapsed.length)guest=[{date:booked,label:'予約時点から',amount:elapsed[elapsed.length-1].amount},...guest.filter(t=>t.date>booked)];
   if(member.date<booked){member.date=booked;member.label='1週間前を過ぎているため予約時点から';}
  }
  return {playDate,special,holiday:holiday(playDate),guest,member,guestPrice:special?32050:29850,provisional:Number(playDate.slice(0,4))>2027};
 }
 function amountAt(playDate,cancelDate,createdAt){
  date(cancelDate);const s=schedule(playDate,createdAt);
  if(createdAt&&cancelDate<createdAt)return {guest:0,member:0};
  return {guest:s.guest.reduce((amount,tier)=>!tier.date||cancelDate>=tier.date?tier.amount:amount,0),member:cancelDate>=s.member.date?2000:0};
 }
 return {version,date,shift,display,holiday,weekend,schedule,amountAt};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ReservationFees;

if(typeof document!=='undefined')(() => {
 const fee=ReservationFees;
 const money=value=>value.toLocaleString('ja-JP')+'円';
 // Use one holiday source for calendar colors, labels and the fee schedule.
 const oldHoliday=typeof japaneseHolidayName==='function'?japaneseHolidayName:()=>'';
 japaneseHolidayName=value=>Number(value.slice(0,4))>=2026?fee.holiday(value):oldHoliday(value);
 if(typeof isJapaneseHoliday==='function')isJapaneseHoliday=value=>!!japaneseHolidayName(value);
 function activeRows(){
  if(draft?.edit)return [draft];
  if(typeof proxyBatch!=='undefined'&&proxyBatch.slots.length)return proxyBatch.slots;
  if(typeof bookingBatch!=='undefined'&&bookingBatch.flow&&bookingBatch.slots.length)return bookingBatch.slots;
  return draft?[draft]:[];
 }
 const fingerprint=rows=>JSON.stringify(rows.map(r=>[r.id,r.date,r.course,r.side,r.time,r.people,r.kind,r.memberPlaying,r.guests]));
 function policy(rows){
  const unique=[...new Map(rows.filter(r=>r?.date).map(r=>[r.date+'|'+(r.createdAt||''),r])).values()];
  return unique.map(r=>{
   if(r.date<'2027-01-01')return '<p class="rf-copy">2027年1月より前のプレー日の料金は、倶楽部へお問い合わせください。</p>';
   const s=fee.schedule(r.date,r.createdAt||(typeof now==='string'?now:undefined));
   const cell=t=>`<tr><td>${t.date?`<strong class="rf-date">${fee.display(t.date)}〜</strong>`:'<strong>予約時点から</strong>'}<small>${t.date?t.label:''}</small></td><td><strong>${money(t.amount)}</strong><small>／${t===s.member?'人':'組'}</small></td></tr>`;
   return `<section class="rf-policy"><p class="rf-day">${fee.display(r.date)} <span>${s.special?'土日祝料金':'平日料金'}${s.holiday?'・'+s.holiday:''}</span></p><h4>キャンセル料金</h4><p class="rf-copy">プレー日から逆算した、料金が発生する日付です。</p><table class="rf-table"><caption>ゲスト${s.special?'（土日祝）':'（平日）'}</caption><thead><tr><th scope="col">発生日</th><th scope="col">キャンセル料</th></tr></thead><tbody>${s.guest.map(cell).join('')}</tbody></table><p class="rf-copy">${s.special?'各期間の料金は加算されません。予約時点ですでに発生日を過ぎている場合は、その期間の料金が適用されます。<br>':''}組数が減らない場合、ゲストのキャンセル料は発生しません。</p><table class="rf-table"><caption>メンバー（全日）</caption><thead><tr><th scope="col">発生日</th><th scope="col">キャンセル料</th></tr></thead><tbody>${cell(s.member)}</tbody></table><p class="rf-copy">倶楽部競技・準倶楽部競技も対象です。</p><h4>ゲスト料金</h4><table class="rf-table"><tbody><tr><th scope="row">${s.special?'土・日・祝':'平日'}</th><td><strong>${money(s.guestPrice)}</strong><small>／人</small></td></tr></tbody></table><p class="rf-copy">消費税10％・ゴルフ場利用税1,200円・ゴルフ振興基金50円を含みます。</p>${s.provisional?'<p class="rf-copy">祝日は現行法に基づく予定です。正式発表により変更される場合があります。</p>':''}</section>`;
  }).join('');
 }
 function confirmation(html){
  const template=document.createElement('template');template.innerHTML=html;
  const root=template.content.querySelector('.bk-confirm');if(!root)return html;
  const primary=root.querySelector(':scope > button.bk-primary');if(!primary)return html;
  const secondary=primary.nextElementSibling;
  const footer=document.createElement('footer');footer.className='rf-footer';
  footer.innerHTML='<label class="rf-consent"><input type="checkbox" class="rf-agree" aria-describedby="rf-read-status" disabled><span>料金・キャンセル規定を確認し、同意します</span></label><p id="rf-read-status" class="rf-read-status" aria-live="polite">注意事項を最後までスクロールしてご確認ください。</p>';
  primary.disabled=true;footer.append(primary);
  if(secondary?.matches('button'))footer.append(secondary);
  const note=root.querySelector(':scope > .bk-note');if(note)footer.append(note);
  const summary=document.createElement('div');summary.className='rf-summary';
  while(root.firstChild)summary.append(root.firstChild);
  summary.querySelectorAll('.bk-confirm-facts dt').forEach(dt=>{if(dt.textContent==='スタート')dt.nextElementSibling?.classList.add('rf-start-value');});
  root.classList.add('rf-confirm');root.dataset.feeFingerprint=fingerprint(activeRows());
  root.append(summary);
  const terms=document.createElement('section');terms.className='rf-terms';
  terms.innerHTML='<h3 class="rf-heading">ご予約時の注意事項</h3><div class="rf-scroll" tabindex="0" role="region" aria-label="料金とキャンセル規定（スクロールして確認）">'+policy(activeRows())+'<p class="rf-end">以上の内容をご確認のうえ、ご予約ください。</p></div>';
  root.append(terms,footer);return template.innerHTML;
 }
 if(typeof bookingConfirm==='function'){const original=bookingConfirm;bookingConfirm=function(...args){return confirmation(original.apply(this,args));};}
 if(typeof proxyMemberConfirm==='function'){const original=proxyMemberConfirm;proxyMemberConfirm=function(...args){return confirmation(original.apply(this,args));};}
 function consent(){
  const root=document.querySelector('.rf-confirm'),box=root?.querySelector('.rf-agree');
  if(!box?.checked||box.disabled||root.dataset.feeFingerprint!==fingerprint(activeRows())){
   if(typeof toast==='function')toast('料金・キャンセル規定をご確認のうえ、同意してください。');return false;
  }
  const accepted={version:fee.version,acceptedAt:new Date().toISOString(),playDates:[...new Set(activeRows().map(r=>r.date))]};
  activeRows().forEach(r=>r.feeConsent={...accepted});if(draft)draft.feeConsent={...accepted};return true;
 }
 if(typeof commitBooking==='function'){const original=commitBooking;commitBooking=function(...args){if(consent())return original.apply(this,args);};}
 if(typeof proxyCommit==='function'){const original=proxyCommit;proxyCommit=function(...args){if(draft?.guestOnly||consent())return original.apply(this,args);};}
 function mount(){
  const root=document.querySelector('.rf-confirm');if(!root||root.dataset.feeMounted)return;
  root.dataset.feeMounted='true';const scroll=root.querySelector('.rf-scroll'),box=root.querySelector('.rf-agree'),button=root.querySelector('.rf-footer .bk-primary'),status=root.querySelector('.rf-read-status');
  const read=()=>{if(scroll.scrollHeight-scroll.clientHeight-scroll.scrollTop<=4){box.disabled=false;status.textContent='チェックを入れると予約を確定できます。';scroll.removeEventListener('scroll',read);}};
  scroll.addEventListener('scroll',read,{passive:true});requestAnimationFrame(read);
  box.addEventListener('change',()=>{button.disabled=!box.checked;status.textContent=box.checked?'ご予約内容をご確認のうえ、確定してください。':'チェックを入れると予約を確定できます。';});
 }
 function savedRows(){
  if(typeof current==='undefined'||!current)return [];
  const arg=current.arg,id=typeof arg==='string'?arg:arg?.id,ids=arg?.ids||[id];
  const all=[...(state?.reservations||[]),...(state?.reservationHistory||[])];
  const selected=all.filter(r=>ids.includes(r.id));
  if(['reservationGroup','registered'].includes(current.k)||typeof proxyMemberInfo==='function'&&current.k==='detail'){
   const batch=selected[0]?.batchId;if(batch)return all.filter(r=>r.batchId===batch);
  }
  return selected;
 }
 function decorateSaved(){
  if(typeof current==='undefined'||!['complete','detail','groupDetail','reservationGroup','registered','archiveDetail'].includes(current?.k))return;
  const host=document.querySelector('#panelBody')||document.querySelector('.proxy-flow-content');
  if(!host||host.querySelector('.rf-details'))return;
  const rows=savedRows();if(!rows.length)return;
  const details=document.createElement('details');details.className='rf-details';
  details.innerHTML='<summary>料金・キャンセル規定を確認する</summary><div class="rf-saved-scroll" tabindex="0" role="region" aria-label="この予約の料金・キャンセル規定">'+policy(rows)+'</div>';
  const anchor=host.querySelector('.bk-completion-reservation,.rs-detail-line,.rs-batch-slots,.bk-confirm-facts');
  if(anchor)anchor.after(details);else host.append(details);
 }
 const observer=new MutationObserver(()=>{mount();decorateSaved();});
 observer.observe(document.body,{subtree:true,childList:true});mount();decorateSaved();
})();
