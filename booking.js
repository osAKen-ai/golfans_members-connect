function isSoloMemberTime(r){return r?.kind==='member'&&Number(r.people)===1&&r.memberPlaying!==false;}
function memberTimeBadge(r){return r?.kind==='member'?'<span class="member-time-status"><span aria-hidden="true">□</span> '+(r.memberMode==='group'?'メンバー枠（1組）':'1人予約')+'</span>':'';}
function bookingMemberTypeOptions(){const options=bookingTypeOptions();options.splice(2,0,['individual','□ メンバー枠（お一人専用　試験導入）']);return options;}
function bookingTypeIcon(type){return type==='all'?'':`<i class="bk-type-icon ${type==='individual'?'is-individual':type==='member'?'is-member':'is-circle'}" aria-hidden="true"></i>`;}
function bookingTypeCopy(type){return type==='individual'?'<span class="bk-type-copy">メンバー枠<small>（お一人専用　試験導入）</small></span>':`<span class="bk-type-copy">${{all:'全てを見る',member:'メンバー枠',normal:'同伴枠',intro:'紹介枠'}[type]||'全てを見る'}</span>`;}
function bookingTypeSummaryMarkup(){return `<span class="bk-type-summary">${bookingTypeIcon(bookingUI.type)}<span>${{all:'全ての枠',member:'メンバー枠',individual:'メンバー枠（お一人専用　試験導入）',normal:'同伴枠',intro:'紹介枠'}[bookingUI.type]||'全ての枠'}</span></span>`;}
function bookingTypePickerMarkup(){bookingMemberTypeOptions();return `<section class="bk-type-field"><span class="bk-type-field-label">予約枠の種類</span><button type="button" class="bk-type-trigger" aria-label="予約枠の種類" aria-haspopup="dialog" aria-expanded="false" onclick="openBookingTypeMenu(this)">${bookingTypeIcon(bookingUI.type)}${bookingTypeCopy(bookingUI.type)}<span class="bk-type-chevron" aria-hidden="true">⌄</span></button></section>`;}
function openBookingTypeMenu(trigger){
 document.querySelector('#bookingTypeMenu')?.remove();
 const menu=document.createElement('dialog');menu.id='bookingTypeMenu';menu.setAttribute('aria-label','予約枠の種類');
 menu.innerHTML='<section role="listbox" aria-label="予約枠の種類">'+bookingMemberTypeOptions().map(([type])=>`<button type="button" role="option" aria-selected="${bookingUI.type===type}" data-type="${type}"><span class="bk-type-check" aria-hidden="true">${bookingUI.type===type?'✓':''}</span>${bookingTypeIcon(type)}${bookingTypeCopy(type)}</button>`).join('')+'</section>';
 menu.addEventListener('click',event=>{const option=event.target.closest('[data-type]');if(option){const type=option.dataset.type;menu.close();setBookingFilter('type',type);document.querySelector('.bk-type-trigger')?.focus();return;}const r=menu.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)menu.close();});
 menu.addEventListener('keydown',event=>{const options=[...menu.querySelectorAll('[role="option"]')];let i=options.indexOf(document.activeElement);if(event.key==='ArrowDown')i=(i+1)%options.length;else if(event.key==='ArrowUp')i=(i-1+options.length)%options.length;else if(event.key==='Home')i=0;else if(event.key==='End')i=options.length-1;else return;event.preventDefault();options[i].focus();});
 menu.addEventListener('close',()=>{trigger.setAttribute('aria-expanded','false');menu.remove();});
 document.body.append(menu);trigger.setAttribute('aria-expanded','true');
 const rect=trigger.getBoundingClientRect(),width=Math.min(Math.max(rect.width,310),innerWidth-24);
 menu.style.setProperty('width',width+'px','important');menu.showModal();
 const height=menu.getBoundingClientRect().height;
 menu.style.left=Math.max(12,Math.min(rect.left,innerWidth-width-12))+'px';
 menu.style.top=Math.max(12,Math.min(rect.bottom+6,innerHeight-height-12))+'px';
 menu.querySelector('[aria-selected="true"]')?.focus({preventScroll:true});
}
function memberGuestCount(r=draft){return r.kind==='intro'||r.memberPlaying===false?Number(r.people):Math.max(0,Number(r.people)-1);}
function memberGuestsComplete(){const names=Array.from({length:memberGuestCount()},(_,i)=>normalizePersonQuery(draft.guests[i]||''));return names.every(Boolean)&&new Set(names).size===names.length;}
'use strict';
// Demonstration inventory. No requests are made to the club's reservation system.
const bookingUI={type:'all',party:0,consecutive:0,only:false,hour:8,tab:'history',query:'',anchor:'',selected:false,seat:0};
const bookingMembers=[{name:'山田 太郎',hdcp:'12.8',course:'旧コース'},{name:'佐藤 花子',hdcp:'18.2',course:'新コース'},{name:'鈴木 健一',hdcp:'15.0',course:'旧コース'},{name:'田中 美咲',hdcp:'20.4',course:'新コース'},{name:'井上 一郎',hdcp:'10.6',course:'旧コース'},{name:'小林 さくら',hdcp:'22.1',course:'新コース'},{name:'高橋 次郎',hdcp:'16.3',course:'旧コース'}];
const bookingIcons={person:'<circle cx="12" cy="7" r="4"/><path d="M3 22v-3a9 9 0 0 1 18 0v3Z"/>',clipboard:'<rect x="5" y="4" width="15" height="19" rx="2"/><rect x="9" y="1" width="7" height="5" rx="1"/><path d="M9 11h7M9 15h7M9 19h4"/>'};
function bookingIcon(name){return `<svg viewBox="0 0 26 26" aria-hidden="true">${bookingIcons[name]}</svg>`;}
function bookingISO(y,m,d){return new Date(Date.UTC(y,m,d)).toISOString().slice(0,10);}
function bookingShift(date,n){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function bookingDay(date){return new Date(date+'T12:00:00Z').getUTCDay();}
function bookingShort(date){const parts=date.split('-').map(Number);return `${parts[1]}/${parts[2]}（${'日月火水木金土'[bookingDay(date)]}${isJapaneseHoliday(date)?'・祝':''}）`;}
function bookingDayClass(date){return bookingDay(date)===0||isJapaneseHoliday(date)?'sun':bookingDay(date)===6?'sat':'';}
function resetBooking(){Object.assign(bookingUI,{type:'all',party:0,consecutive:0,only:false,hour:8,tab:'history',query:'',anchor:draft.date,selected:false});draft.side=draft.side||'OUT';draft.kind=draft.kind||'normal';if(!draft.edit)draft.guests=[];draft.time='';}
function bookingSlots(date,side=draft.side||'OUT',ignoreSaved=false){
 const seed=Number(date.replaceAll('-',''))+(draft.course==='新コース'?5:0)+(side==='IN'?3:0);
 return bookingTeeMinutes(date,side).map((minutes,i)=>{const time=Math.floor(minutes/60)+':'+String(minutes%60).padStart(2,'0'),pattern=(seed+i)%10;
  const kind=demoBookingSlotKind(date,time,pattern);
  const memberMode=kind==='member'?(Math.floor(minutes/60)%2===0?'group':'individual'):undefined;
  let occupied=pattern===0?4:pattern===1?3:pattern===2?1:pattern===5?2:pattern===6?3:pattern===7?4:pattern===3&&i%2===0?4:0;
  if(memberMode==='group')occupied=occupied===4?4:0;
  // Group reservations start at two players; only member-time samples may have one.
  if(kind!=='member'&&occupied===1)occupied=2;
  const existing=state.reservations.find(r=>r.id!==draft.id&&r.date===date&&r.course===draft.course&&(r.side||'OUT')===side&&r.time===time);
  if(existing&&!ignoreSaved)occupied=4;
  const capacity=4-occupied,choices=(kind==='member'?(memberMode==='group'?[4]:[1,2,3,4]):[3,4]).filter(n=>n<=capacity);
  return {time,hour:Math.floor(minutes/60),kind,memberMode,occupied,capacity,choices,member:(seed+i)%bookingMembers.length,variant:i,available:date>now&&choices.length>0};
 });
}
function bookingMatch(slot){const type=bookingUI.type;const matches=type==='all'||type==='individual'&&slot.kind==='member'&&slot.memberMode!=='group'||type==='member'&&slot.kind==='member'&&slot.memberMode==='group'||!['member','individual'].includes(type)&&slot.kind===type;return matches&&(!bookingUI.party||slot.choices.includes(bookingUI.party));}
// Match windows against the full timetable; filtering never closes occupied gaps.
function bookingConsecutiveTimes(date,side,slots=bookingSlots(date,side)){
 const n=Number(bookingUI.consecutive)||0;
 if(n<2)return null;
 const matched=new Set(),timetable=bookingTeeMinutes(date,side);
 for(let i=0;i<=slots.length-n;i++){
  const window=slots.slice(i,i+n);
  if(window.some(s=>!s.available||s.currentReservation||s.ownReservation||!bookingMatch(s)))continue;
  const rows=window.map(s=>({date,course:draft.course,side,time:s.time,kind:s.kind,people:Math.max(...s.choices),availableCapacity:s.capacity}));
  if(bookingGroupIssue(rows))continue;
  const indexes=window.map(s=>{const [h,m]=s.time.split(':').map(Number);return timetable.indexOf(h*60+m)});
  if(indexes.some((index,j)=>index<0||(j&&index!==indexes[j-1]+1)))continue;
  window.forEach(s=>matched.add(s.time));
 }
 return matched;
}
function bookingCount(date){
 if(date<=now)return 0;
 return ['OUT','IN'].reduce((count,side)=>{
  const slots=bookingSlots(date,side),matched=bookingConsecutiveTimes(date,side,slots);
  return count+slots.filter(s=>s.available&&!s.currentReservation&&bookingMatch(s)&&(!matched||matched.has(s.time))).length;
 },0);
}
function bookingControls(){return `<div class="bk-controls"><div class="bk-courses" role="group" aria-label="コース選択">${['旧コース','新コース'].map(c=>`<button aria-pressed="${draft.course===c}" class="${draft.course===c?'active':''}" onclick="setBookingFilter('course','${c}')">${c}</button>`).join('')}</div><div class="bk-filters">${bookingTypePickerMarkup()}<label>連続枠<span>${bookingIcon('person')}<select aria-label="連続枠" onchange="setBookingFilter('consecutive',Number(this.value))">${[[0,'指定なし'],...Array.from({length:9},(_,i)=>[i+2,(i+2)+'組連続'])].map(([v,t])=>`<option value="${v}" ${bookingUI.consecutive===v?'selected':''}>${t}</option>`).join('')}</select></span></label></div></div>`;}
function selectAvailableBookingSide(){
 // Explicit reservation navigation must keep the saved booking in view.
 if(draft.edit||bookingUI.focusReservationId||!draft.date||draft.date<=now)return;
 if(bookingUI.type==='intro'&&bookingRequiresAccompaniment(draft.date))bookingUI.type='all';
 const hasAvailability=side=>{
  const slots=bookingSlots(draft.date,side),matched=bookingConsecutiveTimes(draft.date,side,slots);
  return slots.some(s=>s.available&&!s.currentReservation&&!s.ownReservation&&bookingMatch(s)&&(!matched||matched.has(s.time)));
 };
 const side=draft.side||'OUT',other=side==='OUT'?'IN':'OUT';
 if(!hasAvailability(side)&&hasAvailability(other))draft.side=other;
 if(typeof bookingBatch!=='undefined')bookingBatch.browseSide=draft.side||'OUT';
}
let bookingAvailabilityFeedbackTimer;
function showBookingAvailabilityFeedback(){
 if(current?.k!=='booking')return;
 const calendar=document.querySelector('.bk-calendar-pair');
 if(!calendar)return;
 clearTimeout(bookingAvailabilityFeedbackTimer);
 const content=[...calendar.children];
 content.forEach(node=>{node.inert=true;});
 calendar.classList.add('bk-availability-updating');calendar.setAttribute('aria-busy','true');
 const feedback=document.createElement('div');feedback.className='bk-availability-feedback';feedback.setAttribute('role','status');
 feedback.innerHTML='<span class="bk-availability-spinner" aria-hidden="true"></span><strong>空き枠を確認中…</strong>';
 calendar.append(feedback);
 // A brief visual transition for local demo filtering, independent of future API latency.
 bookingAvailabilityFeedbackTimer=setTimeout(()=>{
  content.forEach(node=>{node.inert=false;});calendar.removeAttribute('aria-busy');calendar.classList.remove('bk-availability-updating');feedback.remove();
 },500);
}
function setBookingFilter(key,value){const changed=(key==='course'?draft.course:bookingUI[key])!==value;if(key==='course')draft.course=value;else bookingUI[key]=value;clearBookingSelection(false);if(current.k==='times')selectAvailableBookingSide();render(current.k);if(changed)showBookingAvailabilityFeedback();}
function bookingCalendar(){
 return `${bookingControls()}${bookingMonthNavigationMarkup(year,month,'pickBookingMonth')}${bookingCalendarPairMarkup(year,month,'pickBookingDate')}<p class="bk-note">操作体験版・空き枠は表示例です。${typeof bookingBatch!=='undefined'?'複数のスタート枠をまとめて予約できます。':'1組ずつ予約できます。'}</p>`;
}
function pickBookingMonth(y,m){year=y;month=m;render('booking');}
function pickBookingDate(date){prepareBookingDayBrowse(date);draft.date=date;bookingUI.anchor=date;bookingUI.hour=8;clearBookingSelection(false);selectAvailableBookingSide();openPanel('times');}
function bookingReturnCalendar(){year=Number(draft.date.slice(0,4));month=Number(draft.date.slice(5,7))-1;openBookingStep('booking');}
function openBookingStep(k){const depth=history.state?.depth||1;history.replaceState({portal:true,route:{k,arg:null},depth},'',location.pathname+location.search+'#'+k);render(k);}
function bookingDays(){const anchor=bookingUI.anchor||draft.date;return Array.from({length:113},(_,i)=>bookingShift(anchor,i-56)).filter(d=>d>now).map(date=>`<button class="${bookingDayClass(date)} ${date===draft.date?'active':''}" title="${japaneseHolidayName(date)}" aria-label="${formatDate(date,true)} ${japaneseHolidayName(date)}" aria-pressed="${date===draft.date}" onclick="changeBookingDay('${date}')"><small>${'日月火水木金土'[bookingDay(date)]}</small>${Number(date.slice(8))}</button>`).join('');}
function changeBookingDay(date){prepareBookingDayBrowse(date);draft.date=date;clearBookingSelection(false);selectAvailableBookingSide();render('times');}
function changeBookingSide(side){draft.side=side;clearBookingSelection(false);render('times');}
function bookingRows(){const slots=bookingSlots(draft.date),matched=bookingConsecutiveTimes(draft.date,draft.side||'OUT',slots);return slots.filter(s=>s.currentReservation||s.ownReservation||bookingMatch(s)&&(!matched||matched.has(s.time))&&(!bookingUI.only||s.available)).map(s=>{
 if(s.currentReservation)return currentReservationRowMarkup(s,draft.side||'OUT');
 if(s.ownReservation)return ownReservationRowMarkup(s);
 const choices=s.available?s.choices.filter(n=>!bookingUI.party||n===bookingUI.party):[];
 const selectedRow=typeof selectedBookingForSlot==='function'?selectedBookingForSlot(s):(bookingUI.selected&&draft.time===s.time?{...draft,seat:bookingUI.seat}:null);const selected=!!selectedRow;
 const memberBlocked=s.kind==='member'&&!selected?memberGroupChoiceIssue(s.time,s.memberMode==='group'?4:1,'member'):'';
 const memberDisabled=memberBlocked?`disabled title="${esc(memberBlocked)}"`:'';
 const occupants=!bookingUI.only&&s.occupied?(s.kind==='intro'?bookingIntroducedPartyMarkup(s):bookingOccupantsMarkup(sampleBookingParticipants(s))):'';
 const empty=s.kind==='member'&&s.memberMode==='group'?(s.available?`<button style="grid-column:4" class="bk-seat bk-member-group ${selected?'selected':''}" aria-pressed="${!!selected}" ${memberDisabled} aria-label="${s.time} メンバー枠 1組4名で予約" onclick="toggleMemberTimeAll('${s.time}')">4</button>`:''):s.kind==='member'?Array.from({length:s.capacity},(_,i)=>`<button style="grid-column:${5-s.capacity+i}" class="bk-seat bk-member-individual ${selected&&memberSelectedSeats(selectedRow).includes(i)?'selected':''}" aria-pressed="${!!selected&&memberSelectedSeats(selectedRow).includes(i)}" ${memberDisabled} aria-label="${draft.side} ${s.time} メンバータイム ${i+1}枠目 1人で予約" onclick="selectBookingSlot('${s.time}',1,'${s.kind}',${i})"></button>`).join(''):choices.map((n,i)=>`<button style="grid-column:${5-choices.length+i}" class="bk-people ${selected&&selectedRow.people===n?'selected':''}" ${memberGroupChoiceIssue(s.time,n,s.kind)?`disabled title="${esc(memberGroupChoiceIssue(s.time,n,s.kind))}"`:''} aria-pressed="${selected&&selectedRow.people===n}" aria-label="${draft.side} ${s.time} ${n}人で予約" onclick="selectBookingSlot('${s.time}',${n},'${s.kind}')">${n}</button>`).join('');
 return `<div class="bk-slot bk-kind-${s.kind} ${!s.available?'unavailable':''}" data-hour="${s.hour}">${s.kind==='member'&&s.memberMode==='group'&&s.available?`<time><button class="bk-select-time" ${memberDisabled} aria-label="${s.time} 空き枠をまとめて選択・解除" onclick="toggleMemberTimeAll('${s.time}')">${s.time}</button></time>`:`<time>${s.time}</time>`}<div class="bk-slot-main">${occupants}${s.memberMode==='group'&&s.available?'<span class="bk-intro" style="grid-column:1 / span 3">メンバー枠</span>':''}${s.kind==='intro'&&!s.occupied?`<span class="bk-intro" style="grid-column:1 / span ${Math.max(1,4-choices.length)}">紹介枠</span>`:''}<div class="bk-choices">${empty}</div>${!s.available&&bookingUI.only?'':!s.available?'<span class="bk-full">満席</span>':''}</div></div>`;
 }).join('')||'<p class="bk-empty">この条件に合う枠はありません。<br>条件または日付を変更してください。</p>';}
function bookingTimes(){bookingTypeOptions();return `<details class="bk-condition-panel"><summary><span>${esc(draft.course)} · ${bookingUI.consecutive?bookingUI.consecutive+'組連続':'連続枠指定なし'} · ${bookingTypeSummaryMarkup()}</span><b>条件変更</b></summary>${bookingControls()}</details><div class="bk-datebar"><button class="bk-calendar-back" onclick="bookingReturnCalendar()" aria-label="予約カレンダーに戻る">${Number(draft.date.slice(5,7))}月<span>⌄</span></button><div class="bk-dates">${bookingDays()}</div></div><div class="bk-times"><nav class="bk-hours" aria-label="時間帯">${[7,8,9,10].map(n=>`<button class="${bookingUI.hour===n?'active':''}" aria-pressed="${bookingUI.hour===n}" onclick="scrollBookingHour(${n})">${n}時台</button>`).join('')}</nav><div class="bk-time-main"><div class="bk-slot-toolbar"><label><input type="checkbox" ${bookingUI.only?'checked':''} onchange="toggleBookingOnly(this.checked)">予約可能のみ</label><div class="bk-sides" role="group" aria-label="スタートホール">${['OUT','IN'].map(side=>`<button class="${draft.side===side?'active':''}" aria-pressed="${draft.side===side}" onclick="changeBookingSide('${side}')">${side}</button>`).join('')}</div></div><div class="bk-slot-list" tabindex="0" aria-label="スタート枠一覧">${bookingRows()}</div></div></div><div id="bookingSelection" class="bk-selection" ${bookingUI.selected?'':'hidden'}>${bookingSelectionMarkup()}</div><p class="bk-note"><span class="bk-individual-legend">□ 1人予約（1枠1名）</span>　□4 メンバー枠（1組4名）　○ ${bookingRequiresAccompaniment(draft.date)?'通常枠（メンバー同伴）':'通常枠・紹介枠'}（人数）<br>空き枠・プロフィールは表示例です。</p>`;}
function bookingSelectionMarkup(){if(!bookingUI.selected)return `<div class="bk-selection-empty"><h3>選択した予約内容</h3><p>左の空き枠から<br>ご希望の時間・人数を選択してください。</p></div>`;return `<h3 class="bk-selection-title">選択した予約内容</h3>${bookingSelectionFacts(draft)}<div><strong class="bk-selection-summary">${bookingShort(draft.date)} ${esc(draft.course)} ${draft.side} ${esc(draft.time)} ${draft.people}人</strong><button onclick="clearBookingSelection()">選択解除</button></div><button class="bk-primary reservation-action" onclick="proceedBookingGuests()">予約</button>`;}
function mountBookingTimes(){const strip=$('.bk-dates'),active=strip?.querySelector('.active');if(active)strip.scrollLeft=active.offsetLeft-strip.clientWidth/2+active.clientWidth/2;const list=$('.bk-slot-list');if(!list)return;scrollBookingHour(bookingUI.hour);let touchX=0,touchY=0;list.addEventListener('touchstart',e=>{touchX=e.changedTouches[0].clientX;touchY=e.changedTouches[0].clientY;},{passive:true});list.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-touchX,dy=e.changedTouches[0].clientY-touchY;if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.5)changeBookingSide(dx<0?'IN':'OUT');},{passive:true});list.addEventListener('scroll',()=>{const top=list.getBoundingClientRect().top;const row=[...list.querySelectorAll('.bk-slot')].find(r=>r.getBoundingClientRect().bottom>top+10);if(row)setBookingHour(Number(row.dataset.hour));},{passive:true});}
function setBookingHour(hour){bookingUI.hour=hour;document.querySelectorAll('.bk-hours button').forEach((b,i)=>{b.classList.toggle('active',i+7===hour);b.setAttribute('aria-pressed',String(i+7===hour));});}
function scrollBookingHour(hour){setBookingHour(hour);const list=$('.bk-slot-list'),row=list?.querySelector(`[data-hour="${hour}"]`);if(row)list.scrollTop=row.offsetTop;else if(list)list.scrollTop=0;}
function toggleBookingOnly(value){bookingUI.only=value;render('times');}
function selectBookingSlot(time,people,kind,seat=0){bookingUI.seat=seat;draft.time=time;draft.people=people;draft.kind=kind;bookingUI.selected=true;draft.guests=draft.guests.slice(0,memberGuestCount());const list=$('.bk-slot-list'),pos=list.scrollTop;list.innerHTML=bookingRows();list.scrollTop=pos;const box=$('#bookingSelection');box.hidden=false;box.innerHTML=bookingSelectionMarkup();}
function clearBookingSelection(refresh=true){bookingUI.selected=false;draft.time='';if(refresh)render('times');}
function bookingSelectionValid(){if(!draft||!draft.time||draft.kind==='intro'&&bookingRequiresAccompaniment(draft.date))return false;const slot=bookingSlots(draft.date).find(s=>s.time===draft.time);return !!slot&&slot.available&&slot.choices.includes(draft.people);}
function proceedBookingGuests(){if(!bookingSelectionValid()){toast('空き枠を選び直してください');return;}openPanel(draft.people===1?'confirm':'guests');}
function bookingProfile(index){const c=state.companions.find(c=>c.name===bookingMembers[index]?.name);return c?companionDetailMarkup(c.id):'<p>プロフィールがありません。</p>';}
function bookingSummary(){return `${bookingShort(draft.date)} ${draft.course} ${draft.side} ${draft.time} ${draft.people}人`;}
function bookingGuests(){return companionPickerMarkup();}
function bookingGuestTab(tab){bookingUI.tab=tab;render('guests');}
function bookingMemberChoice(m){const chosen=draft.guests.includes(m.name);return `<label class="bk-member-choice"><input type="checkbox" ${chosen?'checked':''} onchange="toggleBookingGuest('${esc(m.name)}',this.checked)"><span class="bk-mini-avatar">${bookingIcon('person')}</span><span>${esc(m.name)} 様</span></label>`;}
function bookingGuestChoices(){return companionChoicesMarkup();}
function bookingSearchResults(){return companionSearchResults();}
function bookingSelectedGuests(){return companionSelectedMarkup();}
function refreshBookingGuests(){refreshCompanionChoices();}
function toggleBookingGuest(name,checked){if(checked){if(draft.guests.includes(name))return;if(draft.guests.filter(Boolean).length>=memberGuestCount()){toast('同伴者は'+(memberGuestCount())+'人まで選べます');refreshBookingGuests();return;}draft.guests=draft.guests.filter(Boolean);draft.guests.push(name);}else draft.guests=draft.guests.filter(n=>n!==name);refreshBookingGuests();}
function addBookingGuest(){registerCompanion();}
function removeBookingGuest(index){draft.guests.splice(index,1);refreshBookingGuests();}
function bookingConfirm(){return `<div class="bk-confirm"><h3>${draft.edit?'ご予約変更内容の確認':'ご予約内容の確認'}</h3><h4>${draft.edit?'変更前・変更後をご確認ください':'ご予約内容をご確認ください'}</h4><p>予約内容に誤りがないかご確認のうえ、<br>「${draft.edit?'変更':'予約'}を確定する」ボタンを押してください</p><dl class="bk-confirm-facts">${bookingConfirmationFacts()}${draft.kind==='intro'?'<dt>紹介者</dt><dd>伊藤 剛 様（未同伴）</dd>':''}</dl>${draft.people>1?`<details class="bk-confirm-guests"><summary>同伴者 ${draft.guests.filter(Boolean).length}人登録済み</summary>${Array.from({length:memberGuestCount()},(_,i)=>`<p>${esc(draft.guests[i]||'未登録')}${draft.guests[i]&&draft.guests[i]!=='未定'?' 様':''}</p>`).join('')}<button class="bk-secondary" onclick="openBookingStep('guests')">同伴者を変更する</button></details>`:''}<button class="bk-primary reservation-action" onclick="commitBooking()">${draft.edit?'変更':'予約'}を確定する</button><button class="bk-secondary" onclick="openBookingStep('times')">選択しなおす</button><p class="bk-note">操作体験版です。実際の予約は行われません。</p></div>`;}

function bookingSelectionFacts(r){return `<dl class="bk-selection-facts"><dt>プレー日</dt><dd>${bookingShort(r.date)}</dd><dt>コース</dt><dd>${esc(r.course)}</dd><dt>スタート</dt><dd>${r.side} <b>${esc(r.time)}</b></dd><dt>人数</dt><dd>${r.people}人</dd><dt>予約枠</dt><dd>${r.kind==='member'?'メンバータイム':r.kind==='intro'?'紹介枠':'通常枠'}</dd></dl>`;}

// Preserve the four seat columns. Only available member seats use an empty square.
function sampleBookingParticipants(slot){
 const count=Math.min(4,Number(slot.occupied)||0);
 const guestCount=slot.kind==='intro'?count:slot.kind==='member'?(count>=3&&slot.variant%2!==0?1:0):Math.max(0,count-(1+(slot.variant||0)%Math.max(1,count)));
 const members=[0,1,2,4,6];
 return [...Array.from({length:count-guestCount},(_,i)=>({type:'member',name:bookingMembers[members[((slot.member||0)+i)%members.length]].name})),...Array.from({length:guestCount},()=>({type:'guest'}))];
}
function bookingRecordParticipants(r){
 const players=[];
 if(r.kind!=='intro'&&r.memberPlaying!==false)players.push({type:'member',own:true});
 for(let i=0;i<Math.min(4,Number(r.people))-players.filter(p=>p.own).length;i++){
  const name=(r.guests||[])[i];
  const person=name&&name!=='未定'&&typeof findCompanionByName==='function'?findCompanionByName(name):null;
  players.push(person?{...person,type:person.type==='member'?'member':'guest'}:{type:name&&name!=='未定'?'guest':r.kind==='intro'||(r.memberGuestReserved&&i===0)?'guest':'pending'});
 }
 return players;
}
function bookingOccupantsMarkup(players){
 const members=players.filter(p=>p.type==='member');
 let html=members.map(p=>{
  if(p.own){const v=state.profileVisibility||{};return `<button class="bk-avatar bk-own-public-avatar" aria-label="${v.name==='full'?'伊藤 剛':'T.I'}様の公開プロフィール" onclick="openPanel('profilePreview')">${v.portrait==='photo'?ownPhotoMarkup():bookingIcon('person')}</button>`;}
  const c=typeof findCompanionByName==='function'?findCompanionByName(p.name):null;
  const index=bookingMembers.findIndex(m=>m.name===p.name);
  return `<button class="bk-avatar" aria-label="メンバーの公開プロフィール" onclick="${c?`openPanel('companionDetail',${esc(JSON.stringify(c.id))})`:`openPanel('bookingProfile',${Math.max(0,index)})`}">${publicMemberPortrait(c||p)}</button>`;
 }).join('');
 let column=members.length+1;
 for(const type of ['guest','pending']){
  const count=players.filter(p=>p.type===type).length;
  if(count){html+=`<span class="bk-guest-band ${type==='pending'?'bk-pending-band':''}" style="grid-column:${column} / span ${count}" data-seats="${count}" aria-label="${type==='guest'?'ゲスト':'未登録'}${count}名">${type==='guest'?`<span>ゲスト</span><span>${count}名</span>`:`未登録${count}名`}</span>`;column+=count;}
 }
 return `<div class="bk-occupants">${html}</div>`;
}

// The introducer identifies the booking; they do not occupy one of its four player seats.
function bookingIntroducedPartyMarkup(slot){
 const memberIndex=[0,1,2,4,6][(Number(slot.member)||0)%5];
 const member=bookingMembers[memberIndex];
 const person=findCompanionByName(member.name)||{...member,type:'member'};
 const name=publicMemberName(person);
 const action=person.id?`openPanel('companionDetail',${esc(JSON.stringify(person.id))})`:`openPanel('bookingProfile',${memberIndex})`;
 return `<div class="bk-introduced-party"><button type="button" class="bk-introducer" aria-label="紹介者 ${esc(name)}様の公開プロフィール（プレーには未同伴）" onclick="${action}"><span class="bk-introducer-avatar">${publicMemberPortrait(person)}</span><span class="bk-introducer-label"><small>紹介者</small><strong>${esc(name)}</strong></span></button><span class="bk-guest-band" data-seats="${Number(slot.occupied)}" aria-label="ゲスト${Number(slot.occupied)}名"><span>ゲスト</span><span>${Number(slot.occupied)}名</span></span></div>`;
}

// A full day's roster remains visible even after an availability filter was used.
function prepareBookingDayBrowse(date){
 if(draft.edit||date<=now)return;
 const full=!['OUT','IN'].some(side=>bookingSlots(date,side).some(s=>s.available));
 if(full)Object.assign(bookingUI,{only:false,type:'all',party:0});
}
