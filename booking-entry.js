'use strict';
// Member booking entry. Both paths share the existing inventory and filters.
let bookingEntryMode='choose';
const bookingQuickLastDate='2028-12-31';
const entryOriginal={calendar:bookingCalendar,reset:resetBooking,render,back:backPanel,returnCalendar:bookingReturnCalendar};
resetBooking=function(){entryOriginal.reset();bookingEntryMode='choose';};
function bookingEntryIcon(name){return `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${name==='search'?'<circle cx="20" cy="20" r="13"/><path d="m30 30 12 12"/>':'<rect x="7" y="10" width="34" height="32" rx="3"/><path d="M16 5v11M32 5v11M7 22h34M16 29h1M24 29h1M32 29h1M16 35h1M24 35h1"/>'}</svg>`;}
function bookingEntryMarkup(){
 return `<section class="bk-entry"><div class="bk-courses" role="group" aria-label="コース選択">${['旧コース','新コース'].map(c=>`<button aria-pressed="${draft.course===c}" class="${draft.course===c?'active':''}" onclick="setBookingFilter('course','${c}')">${c}</button>`).join('')}</div><h3>探し方をお選びください</h3><div class="bk-entry-options"><button class="bk-entry-card is-quick" onclick="openBookingQuick(this)">${bookingEntryIcon('search')}<span><strong>かんたん検索</strong><small>日付を決めて、空き枠をすぐ確認</small></span><b aria-hidden="true">›</b></button><button class="bk-entry-card" onclick="showBookingCalendar()">${bookingEntryIcon('calendar')}<span><strong>カレンダーから探す</strong><small>空いている日を見比べて予約</small></span><b aria-hidden="true">›</b></button></div><p>どちらからでも、同じ空き枠を確認できます。</p></section>`;
}
bookingCalendar=function(){return bookingEntryMode==='calendar'?entryOriginal.calendar():bookingEntryMarkup();};
function showBookingCalendar(){bookingEntryMode='calendar';year=Number(draft.date.slice(0,4));month=Number(draft.date.slice(5,7))-1;render('booking');}
function showBookingEntry(){bookingEntryMode='choose';render('booking');}
bookingReturnCalendar=function(){bookingEntryMode='calendar';entryOriginal.returnCalendar();};
backPanel=function(){if(current?.k==='booking'&&bookingEntryMode==='calendar'){showBookingEntry();return;}entryOriginal.back();};
render=function(k,arg){
 setBookingHelpCloseDisabled(false);
 document.querySelector('#bookingQuickDialog')?.remove();
 if(k==='booking'&&arg?.quickReturn){
  bookingEntryMode='choose';
  Object.assign(draft,{date:arg.quickReturn.date,course:arg.quickReturn.course});
  bookingUI.consecutive=arg.quickReturn.consecutive;
 }
 entryOriginal.render(k,arg);
 const entry=k==='booking'&&bookingEntryMode==='choose';
 document.querySelector('.sheet')?.classList.toggle('booking-entry-view',entry);
 if(k==='booking'){
  document.querySelector('#panelTitle').textContent=entry?'メンバー予約':'予約カレンダー';
  if(!entry)document.querySelector('.sheet .back').hidden=false;
  if(arg?.quickReturn)openBookingQuick(document.querySelector('.bk-entry-card.is-quick'),true);
 }
};
function bookingQuickHelpMarkup(type){
 const copy={
  member:'<p><strong>メンバー同士で楽しむ枠です。</strong><br>ゲストも1名までご一緒いただけます。</p><p>ご予約はお一人2組まで。3組以上をご希望の場合は、倶楽部へお電話ください。</p><p>2名でお申し込みの場合は、ほかの2名の方との組み合わせや、スタート時間の変更をお願いすることがあります。</p>',
  individual:'<p><strong>お一人から、気軽に参加できる枠です。</strong></p><p>えんじ色の□を1つ選ぶと、1名分のご予約になります。「残り○名」は、参加できる人数です。</p><p>ただいま試験導入中です。</p>',
  normal:'<p><strong>メンバーがゲスト2名以上と一緒にプレーする枠です。</strong></p><p>土日祝は、メンバーお一人につき次の組数までご予約いただけます。</p><table><thead><tr><th>プレー月</th><th>土曜</th><th>日曜・祝日</th></tr></thead><tbody><tr><th>4〜5月・10〜11月</th><td>3組</td><td>1組</td></tr><tr><th>6〜9月・12〜3月</th><td>6組</td><td>3組</td></tr></tbody></table><p>2名でお申し込みの場合は、ほかのお客様と組み合わせになることがあります。</p>',
  intro:'<p><strong>メンバーのご紹介で、ゲストだけでプレーする枠です。</strong><br>ご紹介者のメンバーは同伴しません。</p><p>ゲスト紹介の誓約事項をご確認・ご承諾のうえ、お申し込みください。</p><p>平日にご利用いただけます。土日祝は対象外です。</p>'
 };
 const label={member:'メンバー枠',individual:'新・メンバー枠',normal:'同伴枠',intro:'紹介枠'}[type];
 return `<details class="bk-quick-help"><summary data-quick-help="${type}" aria-label="${label}の説明"><span aria-hidden="true">i</span></summary><div>${copy[type]}</div></details>`;
}
function bookingQuickRowsMarkup(){
 let hasEmpty=false;
 const rows=['member','individual','normal','intro'].map(type=>{
  const restricted=type==='intro'&&bookingRequiresAccompaniment(draft.date);
  const count=restricted?0:bookingTypeRemaining(type);
  if(!restricted&&!count)hasEmpty=true;
  const remaining=restricted?'土日祝は対象外':count?'残り'+count+(type==='individual'?'名':'組'):'空きなし';
  return `<div class="bk-quick-item">${bookingQuickHelpMarkup(type)}<button type="button" class="bk-quick-row ${type==='individual'?'is-individual':''}" data-quick-type="${type}" ${restricted?'disabled':''}>${bookingTypeIcon(type)}<span class="bk-quick-label">${bookingTypeCopy(type)}</span><strong class="bk-quick-count ${!count?'is-empty':''}">${remaining}</strong><b aria-hidden="true">${restricted?'':'›'}</b></button></div>`;
 }).join('');
 const waiting=hasEmpty&&typeof wlEligible==='function'&&wlEligible(draft.date);
 return rows+(waiting?`<div class="bk-quick-wait"><button type="button" data-quick-waitlist>キャンセル待ちを申し込む <span aria-hidden="true">›</span></button></div>`:'');
}
function bookingQuickDateMarkup(){const text=esc(formatDate(draft.date,true)),at=text.indexOf('（');return at<0?text:text.slice(0,at)+'<wbr><span class="bk-quick-weekday-label">'+text.slice(at)+'</span>';}
function bookingQuickMarkup(){
 return `<header class="bk-quick-heading"><h2 id="bookingQuickTitle">かんたん検索</h2><button type="button" class="bk-quick-close" aria-label="かんたん検索を閉じる">×</button></header><div class="bk-quick-date"><button type="button" data-quick-shift="-1" aria-label="前の日" ${draft.date<=bookingShift(now,1)?'disabled':''}>‹</button><button type="button" class="bk-quick-date-label" data-quick-calendar aria-label="カレンダーから日付を選ぶ" aria-haspopup="dialog"><span><strong id="bookingQuickDateText" class="${bookingDayClass(draft.date)}">${bookingQuickDateMarkup()}</strong><small>${bookingEntryIcon('calendar')}カレンダーから日付を選ぶ ▾</small></span></button><button type="button" data-quick-shift="1" aria-label="次の日" ${draft.date>=bookingQuickLastDate?'disabled':''}>›</button></div><p class="bk-quick-course">${esc(draft.course)} ／ OUT・IN合計</p><label class="bk-quick-consecutive"><span>連続枠</span><select aria-label="連続枠" data-quick-consecutive>${[[0,'指定なし'],...Array.from({length:9},(_,i)=>[i+2,(i+2)+'組連続'])].map(([n,t])=>`<option value="${n}" ${bookingUI.consecutive===n?'selected':''}>${t}</option>`).join('')}</select></label><p class="bk-quick-filter-note" ${bookingUI.consecutive?'':'hidden'}>連続して予約できる枠の残数です。</p><div class="bk-quick-results"><div class="bk-quick-rows" aria-live="polite" aria-atomic="true">${bookingQuickRowsMarkup()}</div><div class="bk-quick-loading" role="status" hidden><span aria-hidden="true"></span>空き状況を確認中…</div></div><footer class="bk-quick-footer"><p>枠を選ぶと、スタート時間が表示されます。</p><small>空き枠は表示例です。</small></footer>`;
}
function setBookingQuickDate(date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<=now||date>bookingQuickLastDate||!Number.isFinite(Date.parse(date+'T12:00:00Z')))return false;
 draft.date=date;bookingUI.anchor=date;clearBookingSelection(false);return true;
}
// A short visual refresh for demo inventory; only the result area is busy.
function stopBookingQuickLoading(dialog){
 clearTimeout(dialog?._quickLoadingTimer);
}
function startBookingQuickLoading(dialog){
 stopBookingQuickLoading(dialog);
 const rows=dialog.querySelector('.bk-quick-rows'),status=dialog.querySelector('.bk-quick-loading');
 if(!rows||!status)return;
 rows.inert=true;rows.setAttribute('aria-busy','true');rows.classList.add('is-loading');status.hidden=false;
 dialog._quickLoadingTimer=setTimeout(()=>{
  if(!dialog.isConnected||!rows.isConnected)return;
  rows.classList.remove('is-loading');rows.inert=false;rows.setAttribute('aria-busy','false');status.hidden=true;
 },400);
}
function refreshBookingQuick(dialog){
 dialog.querySelector('#bookingQuickDateText').innerHTML=bookingQuickDateMarkup();
 dialog.querySelector('#bookingQuickDateText').className=bookingDayClass(draft.date);
 dialog.querySelector('[data-quick-shift="-1"]').disabled=draft.date<=bookingShift(now,1);
 dialog.querySelector('[data-quick-shift="1"]').disabled=draft.date>=bookingQuickLastDate;
 dialog.querySelector('.bk-quick-filter-note').hidden=!bookingUI.consecutive;
 dialog.querySelector('.bk-quick-rows').innerHTML=bookingQuickRowsMarkup();
 startBookingQuickLoading(dialog);
}
function chooseBookingQuickType(type){
 if(!['member','individual','normal','intro'].includes(type)||type==='intro'&&bookingRequiresAccompaniment(draft.date))return;
 // The previous history entry reopens the search, including browser Back.
 history.replaceState({...history.state,route:{k:'booking',arg:{quickReturn:{date:draft.date,course:draft.course,consecutive:bookingUI.consecutive}}}},'',location.pathname+location.search+'#booking');
 // Do not use pickBookingDate: its full-day fallback deliberately clears filters.
 bookingUI.type=type;bookingUI.only=true;bookingUI.anchor=draft.date;bookingUI.hour=8;
 clearBookingSelection(false);selectAvailableBookingSide();openPanel('times');
}
function bookingQuickWaitlistType(){
 // This button belongs to the displayed empty categories, not a stale start-list filter.
 return ['member','individual','normal','intro'].find(type=>
  !(type==='intro'&&bookingRequiresAccompaniment(draft.date))&&!bookingTypeRemaining(type)
 )||'member';
}
function openBookingQuickWaitlist(dialog){
 const quickReturn={date:draft.date,course:draft.course,consecutive:bookingUI.consecutive};
 const type=bookingQuickWaitlistType();
 stopBookingQuickLoading(dialog);
 // Remove synchronously: a queued close handler must not unlock a newer modal.
 dialog.remove();
 wlOpen(quickReturn.date,undefined,{type,quickReturn});
}
function bookingQuickCalendarMarkup(y,m){
 const minMonth=now.slice(0,7),view=bookingISO(y,m,1).slice(0,7),start=bookingDay(view+'-01'),days=new Date(Date.UTC(y,m+1,0)).getUTCDate();
 const firstYear=Number(now.slice(0,4)),lastYear=2028;
 let cells='<span aria-hidden="true"></span>'.repeat(start);
 for(let day=1;day<=days;day++){
  const date=bookingISO(y,m,day),holiday=japaneseHolidayName(date),selected=date===draft.date;
  cells+=`<button type="button" class="bk-quick-day ${bookingDayClass(date)} ${selected?'is-selected':''}" data-quick-date="${date}" aria-label="${esc(formatDate(date,true)+(holiday?' '+holiday:''))}" aria-pressed="${selected}" ${date<=now?'disabled':''}>${day}${holiday?'<small>祝</small>':''}</button>`;
 }
 cells+='<span aria-hidden="true"></span>'.repeat(42-start-days);
 return `<header class="bk-quick-heading"><h2 id="bookingQuickTitle">日付を選択</h2><button type="button" class="bk-quick-close" data-quick-calendar-back aria-label="残数画面に戻る">×</button></header><p class="bk-quick-calendar-help">ご希望の日付をタップしてください</p><div class="bk-quick-month-nav"><button type="button" data-quick-month-shift="-1" aria-label="前の月" ${view<=minMonth?'disabled':''}>‹</button><div><select data-quick-year aria-label="年">${Array.from({length:lastYear-firstYear+1},(_,i)=>firstYear+i).map(n=>`<option value="${n}" ${n===y?'selected':''}>${n}年</option>`).join('')}</select><select data-quick-month aria-label="月">${Array.from({length:12},(_,i)=>`<option value="${i}" ${i===m?'selected':''} ${y===firstYear&&i<Number(now.slice(5,7))-1?'disabled':''}>${i+1}月</option>`).join('')}</select></div><button type="button" data-quick-month-shift="1" aria-label="次の月" ${view>=bookingQuickLastDate.slice(0,7)?'disabled':''}>›</button></div><div class="bk-quick-calendar-grid" role="group" aria-label="${y}年${m+1}月の日付">${'日月火水木金土'.split('').map((d,i)=>`<span class="bk-quick-weekday ${i===0?'sun':i===6?'sat':''}">${d}</span>`).join('')}${cells}</div><p class="bk-quick-calendar-legend"><span class="sat">土曜</span><span class="sun">日曜・祝日</span></p><button type="button" class="bk-quick-date-cancel" data-quick-calendar-back>日付を変えずに戻る</button>`;
}
function showBookingQuickCalendar(dialog,view,focusSelector){
 stopBookingQuickLoading(dialog);
 view=view<now.slice(0,7)?now.slice(0,7):view>bookingQuickLastDate.slice(0,7)?bookingQuickLastDate.slice(0,7):view;
 const [y,m]=view.split('-').map(Number);
 const existingGrid=dialog.querySelector('.bk-quick-calendar-grid');
 dialog.dataset.calendarMonth=view;
 if(existingGrid){
  // Keep the native selects mounted while their iOS popup commits a selection.
  // Replacing/refocusing them in change can reopen or strand the native popup.
  const content=document.createElement('template');content.innerHTML=bookingQuickCalendarMarkup(y,m-1);
  const nextGrid=content.content.querySelector('.bk-quick-calendar-grid');
  existingGrid.innerHTML=nextGrid.innerHTML;existingGrid.setAttribute('aria-label',nextGrid.getAttribute('aria-label'));
  dialog.querySelector('[data-quick-year]').value=String(y);
  const months=dialog.querySelector('[data-quick-month]');months.value=String(m-1);
  for(const option of months.options)option.disabled=y===Number(now.slice(0,4))&&Number(option.value)<Number(now.slice(5,7))-1;
  dialog.querySelector('[data-quick-month-shift="-1"]').disabled=view<=now.slice(0,7);
  dialog.querySelector('[data-quick-month-shift="1"]').disabled=view>=bookingQuickLastDate.slice(0,7);
 }else{
  dialog.innerHTML=bookingQuickCalendarMarkup(y,m-1);dialog.scrollTop=0;
  (dialog.querySelector('.is-selected:not(:disabled)')||dialog.querySelector('.bk-quick-day:not(:disabled)'))?.focus({preventScroll:true});
 }
}
function setBookingHelpCloseDisabled(disabled){
 const close=document.querySelector('.sheethead .close');
 if(close){close.disabled=disabled;close.classList.toggle('is-help-disabled',disabled);}
}
function showBookingQuickHelp(dialog,summary){
 stopBookingQuickLoading(dialog);
 const type=summary.dataset.quickHelp;
 const label={member:'メンバー枠',individual:'新・メンバー枠',normal:'同伴枠',intro:'紹介枠'}[type];
 if(!label)return;
 const marker=['member','individual'].includes(type)?`<div class="bk-quick-marker-note">${bookingTypeIcon(type)}<span><strong>${label}の目印です</strong><small>予約画面では、この□で表示します。</small></span></div>`:'';
 const content=marker+summary.parentElement.querySelector('div').innerHTML;
 dialog._quickReturnScroll=dialog.scrollTop;dialog.dataset.helpType=type;
 setBookingHelpCloseDisabled(true);
 dialog.innerHTML=`<button type="button" class="bk-quick-help-back" data-quick-help-back>‹ かんたん検索に戻る</button><header class="bk-quick-heading"><h2 id="bookingQuickTitle">${label}の説明</h2></header><div class="bk-quick-help-content">${content}</div><div class="bk-quick-help-footer"><button type="button" class="bk-quick-date-cancel" data-quick-help-back>説明を閉じる</button></div>`;
 dialog.scrollTop=0;dialog.querySelector('[data-quick-help-back]').focus({preventScroll:true});
}
function showBookingQuickSummary(dialog){
 setBookingHelpCloseDisabled(true);
 const helpType=dialog.dataset.helpType,scroll=dialog._quickReturnScroll||0;
 delete dialog.dataset.calendarMonth;delete dialog.dataset.helpType;
 dialog.innerHTML=bookingQuickMarkup();
 const target=helpType?dialog.querySelector('[data-quick-help="'+helpType+'"]'):dialog.querySelector('[data-quick-calendar]');
 target?.focus({preventScroll:true});dialog.scrollTop=helpType?scroll:0;
 if(!helpType)startBookingQuickLoading(dialog);
}
function bookingQuickInitialDate(base=now){
 const [y,m,d]=base.split('-').map(Number);
 const last=new Date(Date.UTC(y,m+2,0)).getUTCDate();
 return [bookingISO(y,m+1,Math.min(d,last)),bookingQuickLastDate].sort()[0];
}
function openBookingQuick(trigger,preserveDate=false){
 setBookingHelpCloseDisabled(false);
 document.querySelector('#bookingQuickDialog')?.remove();
 if(!preserveDate)setBookingQuickDate(bookingQuickInitialDate());
 if(draft.date>bookingQuickLastDate)setBookingQuickDate(bookingQuickLastDate);
 const dialog=document.createElement('dialog');dialog.id='bookingQuickDialog';dialog.setAttribute('aria-labelledby','bookingQuickTitle');
 dialog.innerHTML=bookingQuickMarkup();
 dialog.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'&&(dialog.dataset.calendarMonth||dialog.dataset.helpType)){e.preventDefault();showBookingQuickSummary(dialog);}});
 dialog.addEventListener('close',()=>{setBookingHelpCloseDisabled(false);stopBookingQuickLoading(dialog);dialog.remove();if(current?.k==='booking'&&history.state?.route?.arg?.quickReturn)history.replaceState({...history.state,route:{k:'booking',arg:null}},'');if(trigger?.isConnected)trigger.focus({preventScroll:true});});
 dialog.addEventListener('click',e=>{
  const help=e.target.closest('[data-quick-help]');
  if(help){e.preventDefault();showBookingQuickHelp(dialog,help);return;}
  if(e.target.closest('[data-quick-help-back]')){showBookingQuickSummary(dialog);return;}
  if(e.target.closest('[data-quick-waitlist]')){openBookingQuickWaitlist(dialog);return;}
  if(e.target.closest('[data-quick-calendar-back]')){showBookingQuickSummary(dialog);return;}
  if(e.target.closest('.bk-quick-close')){dialog.close();return;}
  if(e.target.closest('[data-quick-calendar]')){showBookingQuickCalendar(dialog,draft.date.slice(0,7));return;}
  const monthShift=e.target.closest('[data-quick-month-shift]');
  if(monthShift&&!monthShift.disabled){const [y,m]=dialog.dataset.calendarMonth.split('-').map(Number);showBookingQuickCalendar(dialog,bookingISO(y,m-1+Number(monthShift.dataset.quickMonthShift),1).slice(0,7),'[data-quick-month-shift=\"'+monthShift.dataset.quickMonthShift+'\"]');return;}
  const day=e.target.closest('[data-quick-date]');
  if(day&&!day.disabled&&setBookingQuickDate(day.dataset.quickDate)){showBookingQuickSummary(dialog);return;}
  const shift=e.target.closest('[data-quick-shift]');
  if(shift&&!shift.disabled){setBookingQuickDate(bookingShift(draft.date,Number(shift.dataset.quickShift)));refreshBookingQuick(dialog);return;}
  const row=e.target.closest('[data-quick-type]');
  if(row&&!row.disabled){chooseBookingQuickType(row.dataset.quickType);return;}
  if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}
 });
 dialog.addEventListener('change',e=>{
  if(e.target.matches('[data-quick-year],[data-quick-month]')){
   const y=Number(dialog.querySelector('[data-quick-year]').value),m=Number(dialog.querySelector('[data-quick-month]').value);
   showBookingQuickCalendar(dialog,bookingISO(y,m,1).slice(0,7),e.target.matches('[data-quick-year]')?'[data-quick-year]':'[data-quick-month]');return;
  }
  if(e.target.matches('[data-quick-consecutive]')){bookingUI.consecutive=Number(e.target.value);clearBookingSelection(false);}
  refreshBookingQuick(dialog);
 });
 document.body.append(dialog);dialog.showModal();setBookingHelpCloseDisabled(true);startBookingQuickLoading(dialog);dialog.querySelector('.bk-quick-close').focus({preventScroll:true});
}
