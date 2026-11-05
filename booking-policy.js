'use strict';
// Shared demo policy: a reserved group carries its member/guest composition before names are known.
const policyDelegate=typeof proxyBatch!=='undefined';
function policyRows(){return draft?.edit?[draft]:policyDelegate?proxyBatch.slots:bookingBatch.slots;}
function policyRefresh(){if(policyDelegate)proxyRefreshTimes();else refreshBookingSelection();}
function policyRender(){if(policyDelegate)proxyRender();else render(current.k,current.arg);}
function policyPeople(r){return Number(r.guestPlayers??(r.kind==='intro'?r.people:r.kind==='normal'?Math.max(2,Number(r.people)-1):r.memberGuestReserved?1:0));}
function policyPersonType(name){
 const people=policyDelegate?proxyCompanions():state.companions||[];
 const person=people.find(c=>c.name===name);
 return person?.type==='member'?'member':'guest';
}
function policyCompositionIssue(r){
 if(r.status==='cancelled')return '';
 const n=Number(r.people),g=policyPeople(r),m=n-g;
 if(!Number.isInteger(n)||n<1||n>4||!Number.isInteger(g)||g<0||g>n)return '人数の内訳を確認してください。';
 if(r.kind==='normal'&&(g<2||m<1))return 'メンバー同伴枠はメンバー1名以上・ゲスト2名以上でご予約ください。';
 if(r.kind==='member'&&r.memberTimeMode!=='group'&&(n>2||n===2&&g!==1))return '個人予約は本人1名、または本人とゲスト1名です。メンバー複数名の場合は1組予約をお選びください。';
 if(r.kind==='member'&&(g>1||m<1||r.memberPlaying===false))return 'メンバータイムは予約者本人の同伴必須・ゲスト最大1名です。';
 if(r.kind==='intro'&&g!==n)return '紹介枠はゲストのみの予約です。';
 const names=(r.guests||[]).filter(n=>n&&n!=='未定');
 const knownGuests=names.filter(n=>policyPersonType(n)==='guest').length;
 const knownMembers=names.length-knownGuests+(r.kind!=='intro'&&r.memberPlaying!==false?1:0);
 if(knownGuests>g||knownMembers>m)return '登録したメンバー・ゲストの人数が予約内訳と異なります。内訳または同伴者を確認してください。';
 return '';
}
function policyConsecutiveIssue(rows){
 const active=rows.filter(r=>r.status!=='cancelled');
 if(active.length<2)return '';
 if(active.some(r=>r.kind==='member'))return 'メンバータイムは本人同伴の個人予約、または1組予約をご利用ください。';
 const first=active[0];
 if(active.some(r=>r.date!==first.date||r.course!==first.course||(r.side||'OUT')!==(first.side||'OUT')))return '複数組は同じ日・コース・OUT／INの連続枠でご予約ください。';
 const times=active.map(r=>bookingMinutes(r.time)).sort((a,b)=>a-b);
 if(times.some((t,i)=>i&&t-times[i-1]!==7))return '複数組は連続するスタート枠をお選びください。電話予約も同じ条件です。';
 return '';
}
const policyOriginalGroupIssue=bookingGroupIssue;
bookingGroupIssue=function(rows){return rows.map(policyCompositionIssue).find(Boolean)||policyConsecutiveIssue(rows)||policyOriginalGroupIssue(rows);};
function policyInit(r){if(r.guestPlayers===undefined)r.guestPlayers=policyPeople(r);r.memberGuestReserved=r.kind==='member'&&r.guestPlayers===1;return r;}
function policyNormalize(){
 for(const r of policyRows())policyInit(r);
 if(policyDelegate)proxyNormalizeBatch();else normalizeBookingBatch();
}
function policyBackground(r){
 const original=draft;
 try{draft={...r};return (typeof wlOriginalSlots==='function'?wlOriginalSlots:currentBookingInventory)(r.date,r.side||'OUT',true).find(s=>s.time===r.time);}
 finally{draft=original;}
}
function policyCapacityIssue(r){
 if(r.kind!=='member')return '';
 const slot=policyBackground(r);
 const other=(state.reservations||[]).filter(x=>x.id!==r.id&&x.status!=='cancelled'&&x.date===r.date&&x.course===r.course&&(x.side||'OUT')===(r.side||'OUT')&&x.time===r.time);
 const occupied=Number(slot?.occupied)||0;
 if(Number(r.people)+occupied+other.reduce((n,x)=>n+Number(x.people),0)>4)return 'メンバータイムの空き人数を超えています。';
 const backgroundGuests=slot&&typeof sampleBookingParticipants==='function'?sampleBookingParticipants(slot).filter(p=>p.type==='guest').length:occupied>=3&&slot?.variant%2?1:0;
 if(backgroundGuests+other.reduce((n,x)=>n+policyPeople(x),0)+policyPeople(r)>1)return 'このスタート枠ではゲスト枠が使用済みです。ゲストは1組に最大1名です。';
 return '';
}
if(typeof memberTimeIssue==='function')memberTimeIssue=function(r){return r.kind==='member'?(policyCompositionIssue(r)||policyCapacityIssue(r)):'';};
const policyNormalizeBase=policyDelegate?proxyNormalizeBatch:normalizeBookingBatch;
if(policyDelegate)proxyNormalizeBatch=function(){policyNormalizeBase();for(const r of proxyBatch.slots)policyInit(r);};
else normalizeBookingBatch=function(){policyNormalizeBase();for(const r of bookingBatch.slots)policyInit(r);};
function policyOptions(r,i){
 if(r.kind==='intro')return '';
 const cap=Math.min(r.memberTimeMode==='group'?4:2,Number(r.availableCapacity)||4);
 const group=r.memberTimeMode==='group';
 return `<div class="bk-composition"><strong>${r.side||'OUT'} ${r.time} の内訳</strong>${r.kind==='member'?`<label>予約方法<select aria-label="${i+1}組目の予約方法" onchange="policySetMode(${i},this.value)"><option value="individual" ${!group?'selected':''}>個人予約（本人＋ゲスト1名まで）</option><option value="group" ${group?'selected':''}>1組予約（ゲスト1名まで）</option></select></label>`:''}${r.kind==='member'?`<label>予約人数<select aria-label="${i+1}組目の予約人数" onchange="policySetPeople(${i},Number(this.value))">${Array.from({length:cap},(_,n)=>n+1).map(n=>`<option value="${n}" ${n===Number(r.people)?'selected':''}>${n}名</option>`).join('')}</select></label>`:''}<label>ゲスト<select aria-label="${i+1}組目のゲスト人数" onchange="policySetGuests(${i},Number(this.value))">${(r.kind==='member'?(group?(r.people>1?[0,1]:[0]):r.people>1?[1]:[0]):Array.from({length:Math.max(0,r.people-2)},(_,n)=>n+2)).map(n=>`<option value="${n}" ${n===policyPeople(r)?'selected':''}>${n}名</option>`).join('')}</select></label><span>メンバー ${r.people-policyPeople(r)}名${r.memberPlaying!==false?'（ご本人含む）':''}</span><small>${r.kind==='member'?(group?'本人同伴必須・最大4名のうちゲスト1名まで':'本人同伴必須・ゲスト最大1名'):'メンバー1名以上・ゲスト2名以上'}</small></div>`;
}
function policySetMode(i,mode){
 const r=policyRows()[i];if(!r||r.kind!=='member')return;
 const next={...r,memberTimeMode:mode,people:mode==='group'?Math.min(4,Number(r.availableCapacity)||4):1,guestPlayers:0,guests:[],seat:0};
 const issue=policyCompositionIssue(next)||policyCapacityIssue(next);if(issue){toast(issue);policyRefresh();return;}
 Object.assign(r,next);policyInit(r);policyRefresh();
}
function policySetPeople(i,n){
 const r=policyRows()[i];if(!r||r.kind!=='member')return;
 const next={...r,people:n,seat:0,guestPlayers:r.memberTimeMode==='group'?Math.min(policyPeople(r),n-1):n-1};
 const issue=policyCompositionIssue(next)||policyCapacityIssue(next);
 if(issue){toast(issue);policyRefresh();return;}
 Object.assign(r,next);r.guests=(r.guests||[]).slice(0,n-1);policyInit(r);policyRefresh();
}
function policySetGuests(i,n){
 const r=policyRows()[i];if(!r)return;
 const next={...r,guestPlayers:n,memberGuestReserved:r.kind==='member'&&n===1};
 const issue=policyCompositionIssue(next)||policyCapacityIssue(next);
 if(issue){toast(issue);policyRefresh();return;}
 Object.assign(r,next);policyRefresh();
}
const policySelectionBase=policyDelegate?proxySelectionMarkup:(typeof occupancySelection==='function'?occupancySelection:bookingSelectionMarkup);
function policySelection(){let html=policySelectionBase();if(policyRows().some(r=>r.kind==='member'))html=html.replace(/続けて別の枠も(?:<br\s*\/?>)?\s*選択できます/g,'同じスタート枠で人数を指定できます');return html.replace('<div class="bk-selection-actions">',policyRows().map(policyOptions).join('')+'<div class="bk-selection-actions">');}
if(policyDelegate)proxySelectionMarkup=policySelection;else bookingSelectionMarkup=policySelection;
// Search checks every intervening tee time, without bypassing existing reservations/holds or daily caps.
function policySearchWindows(date=draft.date,side=draft.side||'OUT',count=Number(bookingUI.groups)||1){
 const slots=bookingSlots(date,side),windows=[];
 if(count<2||count>bookingSeasonRule(date).limit)return windows;
 for(let i=0;i<=slots.length-count;i++){
  const run=slots.slice(i,i+count);
  if(run.some((s,j)=>!s.available||s.currentReservation||s.ownReservation||s.kind==='member'||!bookingMatch(s)||!s.choices.includes(bookingUI.party||4)||j&&bookingMinutes(s.time)-bookingMinutes(run[j-1].time)!==7))continue;
  const rows=run.map((s,j)=>policyInit({date,course:draft.course,side,time:s.time,kind:s.kind,people:bookingUI.party||4,memberPlaying:j===0&&s.kind!=='intro',guests:[],availableCapacity:s.capacity,seat:0,...(policyDelegate?{owner:proxyMember}:{})}));
  if(!bookingGroupIssue(rows))windows.push(rows);
 }
 return windows;
}
function policySearchMarkup(){
 if(draft.edit)return '';
 const count=Number(bookingUI.groups)||1,limit=10;
 return `<section class="bk-consecutive"><label>連続枠検索<select aria-label="連続で予約する組数" onchange="bookingUI.groups=Number(this.value);policyRender()"><option value="1" ${count===1?'selected':''}>1組・個別選択</option>${Array.from({length:Math.min(10,limit)-1},(_,i)=>i+2).map(n=>`<option value="${n}" ${n===count?'selected':''}>${n}組連続</option>`).join('')}</select></label>${count===1?`<div class="bk-member-modes" role="group" aria-label="メンバータイムの予約方法"><button aria-pressed="${bookingUI.memberMode!=='group'}" onclick="bookingUI.memberMode='individual';policyRender()">個人予約</button><button aria-pressed="${bookingUI.memberMode==='group'}" onclick="bookingUI.memberMode='group';policyRender()">1組予約・最大4名</button></div>`:''}${count>1?'<small>同じコース・OUT／INの連続枠をまとめて選べます。</small>':''}</section>`;
}
function policySearchResults(){
 const rows=policySearchWindows();
 return rows.length?rows.map((r,i)=>`<button type="button" class="bk-run-choice" onclick="policyChooseRun(${i})"><strong>${r[0].side} ${r[0].time} ～ ${r.at(-1).time}</strong><span>${r.length}組・各${r[0].people}名 <b>まとめて選択 ›</b></span></button>`).join(''):'<p class="bk-empty">条件に合う連続枠はありません。日付・OUT／IN・組数を変更してください。</p>';
}
function policyChooseRun(index){
 const rows=policySearchWindows()[index];if(!rows){toast('空き状況を再検索してください');return;}
 const issue=bookingGroupIssue(rows);if(issue){toast(issue);return;}
 if(policyDelegate){proxyBatchContext();proxyBatch.slots=rows;proxyBatch.owner=proxySlotKey(rows.find(r=>r.kind!=='intro')||rows[0]);proxyNormalizeBatch();}
 else{bookingBatch.slots=rows;bookingBatch.ownerKey=bookingSlotKey(rows.find(r=>r.kind!=='intro')||rows[0]);bookingBatch.flow=false;normalizeBookingBatch();}
 draft.time=rows[0].time;policyRefresh();
}
const policyRowsBase=policyDelegate?proxyTimeRows:bookingRows;
function policyTimeRows(...args){
 if(!draft.edit&&Number(bookingUI.groups)>1)return policySearchResults();
 const html=policyRowsBase(...args);if(bookingUI.memberMode!=='group'||draft.edit)return html;
 return html.replace(/<div class="bk-choices">((?:<button[^>]*class="bk-seat[^>]*><\/button>)+)<\/div>/g,(all,buttons)=>{
  const time=buttons.match(/aria-label="(?:OUT|IN) (\d+:\d+)/)?.[1];
  if(!time)return all;
  const cap=(buttons.match(/<button/g)||[]).length;
  return `<div class="bk-choices"><button class="bk-member-group" style="grid-column:${5-cap} / span ${cap}" onclick="policySelectGroup('${time}')">1組まとめて予約<small>最大${cap}名</small></button></div>`;
 });
}
function policySelectGroup(time){
 const existing=policyRows().find(r=>r.time===time&&r.side===(draft.side||'OUT'));
 if(!existing){if(policyDelegate)proxySelectTime(time,1,draft.side||'OUT');else selectBookingSlot(time,1,'member',0);}
 const i=policyRows().findIndex(r=>r.time===time&&r.side===(draft.side||'OUT'));if(i>=0)policySetMode(i,'group');
}
if(policyDelegate)proxyTimeRows=policyTimeRows;else bookingRows=policyTimeRows;
const policyTimesBase=policyDelegate?proxyTimesMarkup:bookingTimes;
function policyTimes(){
 if(Number(bookingUI.groups)>bookingSeasonRule(draft.date).limit)bookingUI.groups=1;
 return policyTimesBase().replace('□ メンバータイム（1枠1名）','□ メンバータイム（選択後、最大4名まで指定）').replace('<div class="bk-datebar">',policySearchMarkup()+'<div class="bk-datebar">');
}
if(policyDelegate)proxyTimesMarkup=policyTimes;else bookingTimes=policyTimes;
const policyCountBase=bookingCount;
bookingCount=function(date){if(date<=now)return 0;return Number(bookingUI.groups)>1?['OUT','IN'].reduce((n,side)=>n+policySearchWindows(date,side).length,0):policyCountBase(date);};
const policyControlsBase=bookingControls;
bookingControls=function(){return policyControlsBase()+policySearchMarkup();};
// Apply composition and capacity checks to all save paths, including later companion registration.
const policyFinishBase=finishCompanionPicker;
finishCompanionPicker=function(){const issue=policyCompositionIssue(draft)||policyCapacityIssue(draft);if(issue){toast(issue);return;}return policyFinishBase();};
if(!policyDelegate){const savedFinish=finishSavedCompanionRegistration;finishSavedCompanionRegistration=function(){const issue=policyCompositionIssue(draft)||policyCapacityIssue(draft);if(issue){toast(issue);return;}return savedFinish();};}
const policyCommitBase=policyDelegate?proxyCommit:commitBooking;
function policyCommit(){
 const rows=draft?.edit?[draft]:policyRows();
 const issue=rows.map(r=>policyCompositionIssue(r)||policyCapacityIssue(r)).find(Boolean)||(!draft?.guestOnly?bookingGroupIssue(draft?.edit?(policyDelegate?proxyGroupRows():memberGroupRows()):rows):'');
 if(issue){toast(issue);return;}
 return policyCommitBase();
}
if(policyDelegate)proxyCommit=policyCommit;else commitBooking=policyCommit;
// The confirmation repeats the declared composition; names may still be registered later.
const policyConfirmBase=policyDelegate?proxyMemberConfirm:bookingConfirm;
function policyConfirm(){
 let html=policyConfirmBase(),i=0;
 return html.replace(/<section class="bk-batch-group">/g,match=>{const r=policyRows()[i++];return match+(r?`<p class="bk-composition-summary">メンバー ${r.people-policyPeople(r)}名・ゲスト ${policyPeople(r)}名</p>`:'');});
}
if(policyDelegate)proxyMemberConfirm=policyConfirm;else bookingConfirm=policyConfirm;

const policyCalendarMonthBase=bookingCalendarMonthMarkup;
bookingCalendarMonthMarkup=function(...args){const html=policyCalendarMonthBase(...args);return Number(bookingUI.groups)>1?html.replace(/(\d+)枠/g,'$1候補'):html;};
