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
 document.querySelector('#bookingQuickDialog')?.remove();
 entryOriginal.render(k,arg);
 const entry=k==='booking'&&bookingEntryMode==='choose';
 document.querySelector('.sheet')?.classList.toggle('booking-entry-view',entry);
 if(k==='booking'){
  document.querySelector('#panelTitle').textContent=entry?'メンバー予約':'予約カレンダー';
  if(!entry)document.querySelector('.sheet .back').hidden=false;
 }
};
function bookingQuickRowsMarkup(){
 return ['member','individual','normal','intro'].map(type=>{
  const restricted=type==='intro'&&bookingRequiresAccompaniment(draft.date);
  const count=restricted?0:bookingTypeRemaining(type);
  const remaining=restricted?'土日祝は対象外':count?'残り'+count+(type==='individual'?'名':'組'):'空きなし';
  return `<button type="button" class="bk-quick-row ${type==='individual'?'is-individual':''}" data-quick-type="${type}" ${restricted?'disabled':''}>${bookingTypeIcon(type)}<span class="bk-quick-label">${bookingTypeCopy(type)}</span><strong class="bk-quick-count ${!count?'is-empty':''}">${remaining}</strong><b aria-hidden="true">${restricted?'':'›'}</b></button>`;
 }).join('');
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
 // Do not use pickBookingDate: its full-day fallback deliberately clears filters.
 bookingUI.type=type;bookingUI.only=true;bookingUI.anchor=draft.date;bookingUI.hour=8;
 clearBookingSelection(false);selectAvailableBookingSide();openPanel('times');
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
function showBookingQuickSummary(dialog){
 delete dialog.dataset.calendarMonth;dialog.innerHTML=bookingQuickMarkup();dialog.scrollTop=0;
 dialog.querySelector('[data-quick-calendar]').focus({preventScroll:true});
 startBookingQuickLoading(dialog);
}
function openBookingQuick(trigger){
 document.querySelector('#bookingQuickDialog')?.remove();
 if(!draft.date||draft.date<=now)setBookingQuickDate(bookingShift(now,1));
 if(draft.date>bookingQuickLastDate)setBookingQuickDate(bookingQuickLastDate);
 const dialog=document.createElement('dialog');dialog.id='bookingQuickDialog';dialog.setAttribute('aria-labelledby','bookingQuickTitle');
 dialog.innerHTML=bookingQuickMarkup();
 dialog.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'&&dialog.dataset.calendarMonth){e.preventDefault();showBookingQuickSummary(dialog);}});
 dialog.addEventListener('close',()=>{stopBookingQuickLoading(dialog);dialog.remove();if(trigger?.isConnected)trigger.focus({preventScroll:true});});
 dialog.addEventListener('click',e=>{
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
 document.body.append(dialog);dialog.showModal();startBookingQuickLoading(dialog);dialog.querySelector('.bk-quick-close').focus({preventScroll:true});
}
