'use strict';
// Shared member/delegate UI. Notifications, queue neighbours and time travel are demo-only.
const wlEngine=WaitlistEngine,wlBase=Date.parse(now+'T10:00:00+09:00');
let wlForm=null,wlView='list',wlOwnerAtOpen=null,wlRefreshTimer=null;
const wlBell='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>';
function wlOwner(){return isDelegateBooking?proxyMember:'ito';}
function wlKey(){return isDelegateBooking?proxyStorageKey(proxyMember):'takarazuka-portal-v1';}
function wlRead(){let data;try{data=JSON.parse(localStorage.getItem(wlKey()));}catch{}return JSON.parse(JSON.stringify(data?.reservations?data:state));}
function wlCheck(){if(isDelegateBooking&&!proxyCanAct())throw Error('代理予約の利用が停止されています。');if(wlOwnerAtOpen&&wlOwnerAtOpen!==wlOwner())throw Error('担当メンバーが変更されています。開き直してください。');}
function wlMutate(action){wlCheck();const data=wlRead(),w=wlEngine.init(data,wlBase),t=wlEngine.clock(w);wlEngine.tick(w,t,data.reservations,wlOwner());const result=action(data,w,t);localStorage.setItem(wlKey(),JSON.stringify(data));state=data;if(!isDelegateBooking)updateHome();return result;}
function wlError(e){if(/通知先|メール|LINE/.test(e.message||'')){const settings=document.querySelector('.wl-settings');if(settings)settings.open=true;}const el=document.querySelector('#wlError');if(el)el.textContent=e.message||String(e);else toast(e.message||String(e));}
function wlDate(t){return new Date(t).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});}
function wlClock(){const w=state.waitlistDemo;return w?wlEngine.clock(w):wlBase;}
function wlEligible(date){return date>now&&wlClock()<wlEngine.deadline(date);}
function wlFull(date){return date>now&&(draft.course==='新コース'?[18,23,26]:[17,18,24]).includes(Number(date.slice(8)));}
function wlDemoUnavailable(date,side,slot,index){
 const d=Number(date.slice(8)),month=Number(date.slice(5,7)),newCourse=draft.course==='新コース';
 if(wlFull(date))return true;
 if(d===25)return newCourse?slot.hour>=9:slot.hour<10;
 // Stable course/day/side-specific inventory; calendar totals use these same slots.
 const limit=newCourse?3+(d*7+month)%10:5+(d*3+month)%11;
 return (index*7+d*3+month+(side==='IN'?11:0)+(newCourse?5:0))%23>=limit;
}
function wlSeed(w,date,kind,t){
 const tag=date+'|'+kind+'|varied-v2';if(w.seeded.includes(tag))return;
 // Refresh only waiting sample entries; never remove a member's request or an active hold.
 w.requests=w.requests.filter(r=>!(r.sample&&r.date===date&&r.kind===kind&&r.status==='waiting'));
 w.seeded.push(tag);
 for(const mode of ['change','new'])for(const [i,hours] of [[1,[8,9]],[2,[8,9]],[3,[9,10]]]){
  wlEngine.add(w,{owner:'demo-varied-'+kind+'-'+mode+'-'+i,date,kind,mode,hours,course:'any',people:kind==='member'?1:4,channels:['デモ'],sample:true},t-60000*(4-i));
 }
}
function wlDialog(){let el=document.querySelector('#waitlistDialog');if(!el){el=document.createElement('dialog');el.id='waitlistDialog';el.className='wl-dialog';el.setAttribute('aria-labelledby','wlTitle');document.body.append(el);el.addEventListener('close',()=>{clearInterval(wlRefreshTimer);wlRefreshTimer=null;wlOwnerAtOpen=null;wlRefreshUnderlying();});}return el;}
function wlClose(){document.querySelector('#waitlistDialog')?.close();}
function wlShow(){const el=wlDialog();el.dataset.view='';wlOwnerAtOpen=wlOwner();if(!el.open)el.showModal();clearInterval(wlRefreshTimer);wlRefreshTimer=setInterval(()=>{if(wlView==='list'){try{const before=JSON.stringify(state.waitlistDemo?.requests);wlMutate(()=>{});if(before!==JSON.stringify(state.waitlistDemo?.requests))wlDraw();else document.querySelectorAll('[data-wl-expires]').forEach(el=>el.textContent='残り'+Math.max(0,Math.ceil((Number(el.dataset.wlExpires)-wlClock())/60000))+'分');}catch(e){wlError(e);}}},30000);wlDraw();}
function wlOpenList(){try{wlMutate(()=>{});wlView='list';wlShow();}catch(e){wlError(e);}}
function wlOpen(date,id){
 try{
  wlCheck();if(!wlEligible(date))throw Error('この日の受付は終了しました。');
  const data=wlRead();const existing=data.reservations.filter(r=>r.date===date&&r.status!=='cancelled');
  const record=existing.find(r=>r.id===id)||existing[0];
  if(record&&existing.length>1&&!id){wlView='choose';wlForm={date};wlShow();return;}
  if(record?.kind==='intro'||record?.memberPlaying===false)throw Error('紹介予約の変更待ちはフロントへご相談ください。');
  wlForm={date,mode:record?'change':'new',original:record?JSON.parse(JSON.stringify(record)):null,course:(id?record?.course:draft?.course)||record?.course||'旧コース',kind:record?(record.kind==='member'?'member':'normal'):(!isDelegateBooking&&bookingUI.type==='member'?'member':'normal'),hours:[7,8,9,10],people:record?.people||4,line:data.line===true,email:false,emails:data.waitlistDemo?.emails||'',owner:wlOwner()};
  if(wlForm.kind==='member')wlForm.people=1;wlMutate((data,w,t)=>wlSeed(w,date,wlForm.kind,t));wlView='form';wlShow();
 }catch(e){wlError(e);}
}
function wlAllowedHours(){
 if(wlForm.kind!=='member')return [7,8,9,10];
 const original=draft;try{return [...new Set((wlForm.course==='any'?['旧コース','新コース']:[wlForm.course]).flatMap(course=>{draft={date:wlForm.date,course,side:'OUT'};return ['OUT','IN'].flatMap(side=>wlOriginalSlots(wlForm.date,side).filter(s=>s.kind==='member').map(s=>s.hour));}))].sort((a,b)=>a-b);}finally{draft=original;}
}
function wlSet(field,value){
 if(field==='hours'){
  if(value==='all')wlForm.hours=wlAllowedHours();else {value=Number(value);const all=wlAllowedHours().every(h=>wlForm.hours.includes(h));wlForm.hours=all?[value]:wlForm.hours.includes(value)?wlForm.hours.filter(h=>h!==value):[...wlForm.hours,value].sort((a,b)=>a-b);}
 }else wlForm[field]=value;
 if(field==='kind'){wlForm.people=value==='member'?1:4;try{wlMutate((d,w,t)=>wlSeed(w,wlForm.date,value,t));}catch(e){wlError(e);}}
 if(['kind','course'].includes(field))wlForm.hours=wlForm.hours.filter(h=>wlAllowedHours().includes(h));
 wlDraw();
}
function wlSubmit(event){event.preventDefault();try{
 const emails=wlForm.emails.split(/[\s,;、]+/).filter(Boolean);
 if(!wlForm.line&&!wlForm.email)throw Error('通知先を選択してください。');
 if(wlForm.email&&(!emails.length||emails.some(s=>!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))))throw Error('メールアドレスをご確認ください。');
 if(emails.length>3)throw Error('メールアドレスは3件まで登録できます。');
 wlMutate((data,w,t)=>{
  if(wlForm.line&&data.line!==true)throw Error('LINE連携が必要です。メールを選ぶか、メンバー専用LINEから連携してください。');
  const currentRecord=wlForm.original&&data.reservations.find(r=>r.id===wlForm.original.id);
  if(wlForm.mode==='change'&&(!currentRecord||wlEngine.fingerprint(currentRecord)!==wlEngine.fingerprint(wlForm.original)))throw Error('元の予約が変更されています。開き直してください。');
  if(wlForm.mode==='new'&&data.reservations.some(r=>r.date===wlForm.date))throw Error('同日に予約があります。変更待ちをご利用ください。');
  w.emails=wlForm.emails;
  wlEngine.add(w,{owner:wlOwner(),date:wlForm.date,kind:wlForm.kind,mode:wlForm.mode,course:wlForm.course,hours:[...wlForm.hours],people:Number(wlForm.people),original:wlForm.original,fingerprint:wlForm.original?wlEngine.fingerprint(wlForm.original):null,channels:[...(wlForm.line?['LINE']:[]),...(wlForm.email?['メール']:[])]},t);
  wlEngine.tick(w,t,data.reservations,wlOwner());
 });wlView='list';wlDraw();
 }catch(e){wlError(e);}}
function wlConfirm(id){try{wlMutate((data,w,t)=>wlEngine.accept(data,id,t,wlOwner(),{id:isDelegateBooking?proxyAgent:'ito',name:isDelegateBooking?proxyAgentInfo().name:'伊藤 剛'}));wlDraw();toast('予約一覧に反映しました');}catch(e){wlError(e);}}
function wlDecline(id){try{wlMutate((data,w,t)=>{wlEngine.decline(w,id,t,wlOwner());wlEngine.tick(w,t,data.reservations,wlOwner());});wlDraw();}catch(e){wlError(e);}}
function wlRelease(id,count){try{wlMutate((data,w,t)=>{
 const r=w.requests.find(x=>x.id===id&&x.owner===wlOwner());if(!r)return;
 const original=draft;
 try{
  const slots=[];
  for(const course of r.course==='any'?['旧コース','新コース']:[r.course]){draft={date:r.date,course,side:'OUT'};for(const side of ['OUT','IN'])for(const s of wlOriginalSlots(r.date,side)){
   const slot={date:r.date,course,side,time:s.time,kind:s.kind,capacity:s.kind==='member'?1:4};
   if(slots.length<count&&wlEngine.matches(r,slot)&&!w.slots.some(x=>wlEngine.key(x)===wlEngine.key(slot))&&!data.reservations.some(x=>x.date===slot.date&&x.course===course&&(x.side||'OUT')===side&&x.time===s.time))slots.push(slot);
  }}
  if(!slots.length)throw Error('この条件で追加できるデモ枠がありません。');
  wlEngine.release(w,slots);wlEngine.tick(w,t,data.reservations,wlOwner());
 }finally{draft=original;}
 });wlDraw();}catch(e){wlError(e);}}
function wlAdvance(minutes){try{wlMutate((data,w,t)=>{w.clock=t+minutes*60000;w.wall=Date.now();wlEngine.tick(w,w.clock,data.reservations,wlOwner());});wlDraw();}catch(e){wlError(e);}}
function wlSetDemoMorning(){try{wlMutate((data,w,t)=>{const date=wlEngine.day(t);w.clock=Date.parse(date+'T10:00:00+09:00')+(wlEngine.minute(t)>=600?86400000:0);w.wall=Date.now();wlEngine.tick(w,w.clock,data.reservations,wlOwner());});wlDraw();}catch(e){wlError(e);}}
function wlFormMarkup(){const f=wlForm,w=state.waitlistDemo,hours=wlAllowedHours(),candidate={...f,id:'zz-new',created:wlEngine.clock(w)};
 return `<form onsubmit="wlSubmit(event)"><div class="wl-date">${dateMarkup(f.date,true)}</div><section class="wl-ranks"><h3>希望時間帯と待ち人数</h3><p>${f.course==='any'?'コース指定なし':esc(f.course)} · ${f.kind==='member'?'メンバータイム':'通常予約'}／受付時の目安</p><div class="wl-options wl-time-ranks" role="group" aria-label="希望時間帯と待ち人数">${['all',...hours].map(h=>{const all=hours.length>0&&hours.every(v=>f.hours.includes(v)),selected=h==='all'?all:!all&&f.hours.includes(h),label=h==='all'?'何時でも':h+'時台',rank=h==='all'?(hours.length?Math.min(...hours.map(v=>wlEngine.rank(w,candidate,v))):null):wlEngine.rank(w,candidate,h);return `<button type="button" class="${selected?'selected':''}" aria-pressed="${selected}" ${rank===null?'disabled':''} onclick="wlSet('hours','${h}')"><span>${label}</span><strong>${rank===null?'—':rank-1}<small>${rank===null?'':'人待ち'}</small></strong><small class="wl-time-state">${selected?'✓ 選択中':'選択'}</small></button>`;}).join('')}</div><small>時間帯をタップして選択（複数選択可）</small><details><summary>待ち順について</summary><p>同じ受付区分・希望条件で、あなたより前にお待ちの人数です。「何時でも」は対象時間帯のうち最も少ない待ち人数を表示します。0人でも空き枠が出るまでお待ちいただきます。変更待ちを優先し、各区分内では受付順にご案内します。</p></details></section>${f.original?`<div class="wl-original"><small>現在のご予約</small><strong>${esc(f.original.course)} ${esc(f.original.side||'OUT')} ${esc(f.original.time)} · ${f.people}名</strong><p>変更が確定するまで、この予約は残ります。</p></div>`:''}<fieldset><legend>予約の種類</legend><div class="wl-options">${[['normal','通常枠'],['member','メンバータイム']].map(([v,label])=>`<button type="button" ${f.original?'disabled':''} class="${f.kind===v?'selected':''}" aria-pressed="${f.kind===v}" onclick="wlSet('kind','${v}')">${label}</button>`).join('')}</div></fieldset>${f.kind==='member'?'<p class="wl-note">メンバータイムはご本人1名です。</p>':`<label class="wl-people">1組の人数 <select aria-label="1組の人数" ${f.original?'disabled':''} onchange="wlSet('people',Number(this.value))">${[2,3,4].map(n=>`<option value="${n}" ${f.people===n?'selected':''}>${n}名</option>`).join('')}</select></label>`}<details class="wl-settings" ${!f.line&&!f.email?'data-auto-open':''}><summary>通知先・ご案内を確認する</summary><fieldset><legend>空き枠の通知先</legend><label class="wl-check"><input type="checkbox" ${f.line?'checked':''} ${!state.line?'disabled':''} onchange="wlSet('line',this.checked)">LINE <small>${state.line?'連携済み（体験用）':'未連携・メンバー専用LINEから連携'}</small></label><label class="wl-check"><input type="checkbox" ${f.email?'checked':''} onchange="wlSet('email',this.checked)">メール</label>${f.email?`<label for="wlEmails">メールアドレス <small>3件まで</small></label><textarea id="wlEmails" rows="2" placeholder="例：member@example.com" oninput="wlForm.emails=this.value">${esc(f.emails)}</textarea><p class="wl-note">複数の場合は改行で区切ってください。体験版ではメール送信・アドレス認証は行いません。</p>`:''}</fieldset><p class="wl-note">ご希望の枠が空きましたら、選択した通知先へご案内します。<br>ご案内・お手続きはプレー前日まで。</p></details><p id="wlError" role="alert"></p><button class="wl-primary" type="submit">${f.mode==='change'?'変更待ち':'キャンセル待ち'}を申し込む ›</button></form>`;
}
function wlCard(r,w,t){const active=['waiting','queued','offered'].includes(r.status),status={waiting:'受付中',queued:'枠確保・配信時刻待ち',offered:'空きが出ました',accepted:'予約確定',declined:'受付終了',expired:'期限終了',invalid:'予約変更により受付終了'}[r.status];return `<article class="wl-card ${r.status==='offered'?'offered':''}"><header><span class="wl-badge">${r.mode==='change'?'変更待ち':'キャンセル待ち'}</span><b>${status}</b></header><h3>${dateMarkup(r.date,true)}</h3><p>${r.course==='any'?'コース指定なし':esc(r.course)} · ${r.kind==='member'?'メンバータイム・ご本人1名':r.people+'名・1組'}<br>${r.hours.length===4?'何時でも':r.hours.map(h=>h+'時台').join('・')}</p>${r.original?`<div class="wl-original"><small>元のご予約${r.status==='accepted'?'（変更前）':'を維持'}</small><strong>${esc(r.original.course)} ${esc(r.original.side||'OUT')} ${esc(r.original.time)}</strong></div>`:''}${r.status==='waiting'?`<div class="wl-rank-line">${r.hours.map(h=>`${h}時台 <b>${wlEngine.rank(w,r,h)}番目</b>`).join(' ／ ')}</div>`:''}${r.status==='queued'?'<p>配信時間になりましたらご案内します。回答の1時間は通知時点から始まります。</p>':''}${r.status==='offered'?`<div class="wl-offer"><small>あなたのために確保しています</small><strong>${esc(r.slot.course)} ${esc(r.slot.side)} ${esc(r.slot.time)}</strong><b>${wlDate(r.expires)}まで <span data-wl-expires="${r.expires}">残り${Math.max(0,Math.ceil((r.expires-t)/60000))}分</span></b><button class="wl-primary" onclick="wlConfirm('${r.id}')">${r.mode==='change'?'この時間に変更する':'この枠で予約する'} ›</button></div>`:''}${active?`<button class="wl-secondary" onclick="wlDecline('${r.id}')">${r.mode==='change'?'元の予約のままにする':'キャンセル待ちを取り消す'}</button>`:''}<small class="wl-note">通知先：${esc(r.channels.join('・'))}（体験用）</small>${active?`<details class="wl-simulator"><summary>空きが出たときの動きを試す</summary><p>操作体験用です。実際の通知は送信しません。</p><div class="wl-options"><button onclick="wlRelease('${r.id}',1)">1枠の空きを作る</button><button onclick="wlRelease('${r.id}',2)">2枠の空きを作る</button></div></details>`:''}</article>`;}
function wlListMarkup(){const w=state.waitlistDemo,t=wlEngine.clock(w),rows=w.requests.filter(r=>r.owner===wlOwner());return `<p class="wl-intro">変更待ちを優先し、各区分内では受付順にご案内します。待ち順は希望コース・時間帯ごとに表示します。</p>${rows.length?rows.slice().reverse().map(r=>wlCard(r,w,t)).join(''):'<div class="wl-empty">現在、キャンセル待ち・変更待ちはありません。<br>予約カレンダーのベルからお申し込みいただけます。</div>'}<p id="wlError" role="alert"></p><details class="wl-simulator"><summary>通知・確保時間の体験パネル</summary><p>デモ日時：<strong>${wlDate(t)}</strong><br>仮設定：配信10:00〜17:00／回答は18:00まで。<br>表示する他の待機者もサンプルです。</p><div class="wl-options"><button onclick="wlAdvance(61)">61分進める</button><button onclick="wlSetDemoMorning()">次の10:00へ</button></div><h4>仮確保・同時配信の状況</h4>${w.requests.filter(r=>['queued','offered'].includes(r.status)).map(r=>`<p>${r.owner===wlOwner()?'ご本人':'サンプル会員'} · ${r.mode==='change'?'変更待ち':'キャンセル待ち'}<br>${esc(r.slot.course)} ${esc(r.slot.side)} ${esc(r.slot.time)} · ${r.status==='offered'?wlDate(r.expires)+'まで':'配信待ち'}</p>`).join('')||'<p>仮確保中の枠はありません。</p>'}<h4>動作履歴</h4>${w.log.slice(0,12).map(l=>`<p>${wlDate(l.at)} ${l.owner===wlOwner()?'ご本人':'サンプル会員'}<br>${esc(l.text)}</p>`).join('')||'<p>まだご案内はありません。</p>'}</details><button class="wl-primary" onclick="wlGoList()">予約一覧へ</button>`;}
function wlDraw(){const el=wlDialog();const keep=el.dataset.view===wlView,scroll=keep?el.scrollTop:0,expanded=keep?[...el.querySelectorAll('details[open]')].map(x=>x.querySelector('summary')?.textContent):[];const title=wlView==='form'?(wlForm.mode==='change'?'希望時間への変更待ち':'キャンセル待ち'):wlView==='choose'?'変更する組を選択':'キャンセル待ち・変更待ち';el.innerHTML=`<header class="wl-header"><h2 id="wlTitle">${title}</h2><button aria-label="キャンセル待ち画面を閉じる" onclick="wlClose()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg></button></header><div class="wl-body">${wlView==='form'?wlFormMarkup():wlView==='choose'?wlRead().reservations.filter(r=>r.date===wlForm.date).map(r=>`<button class="wl-secondary" onclick="wlOpen('${r.date}','${esc(r.id)}')">${esc(r.course)} ${esc(r.side||'OUT')} ${esc(r.time)} · ${r.people}名 ›</button>`).join(''):wlListMarkup()}<p class="wl-demo-note">操作体験版 · 実際の予約・LINE・メール配信は行いません。</p></div>`;el.dataset.view=wlView;el.querySelectorAll('details').forEach(x=>x.open=expanded.includes(x.querySelector('summary')?.textContent)||(!keep&&x.hasAttribute('data-auto-open')));el.scrollTop=scroll;}
function wlGoList(){wlClose();if(isDelegateBooking)proxyGo('list');else{reservationUI.status='reserved';reservationUI.from='';reservationUI.to='';openPanel('reservations');}}
function wlRefreshUnderlying(){if(isDelegateBooking){if(current)proxyRender();}else if(current)render(current.k,current.arg);}
function wlEntry(){return `<button class="wl-entry" onclick="wlOpenList()">${wlBell}<span>キャンセル待ち・変更待ちを確認</span><b>›</b></button>`;}
const wlOriginalSlots=bookingSlots;
bookingSlots=function(date,side){const rows=wlOriginalSlots(date,side),w=state.waitlistDemo;return rows.map((s,i)=>{const full=wlDemoUnavailable(date,side||draft.side||'OUT',s,i);const hold=w?.slots.some(x=>x.date===date&&x.course===draft.course&&x.side===(side||draft.side||'OUT')&&x.time===s.time&&['held','booked'].includes(x.status));return full||hold?{...s,occupied:4,capacity:0,choices:[],available:false}:s;});};
// No full/zero labels: a bell is the entry to waiting on otherwise eligible days.
bookingCalendarMonthMarkup=function(y,m,handler,secondary=false){const first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate();let cells='';for(let i=0;i<Math.ceil((first+days)/7)*7;i++){const date=bookingISO(y,m,i-first+1),outside=i<first||i>=first+days,count=outside?0:bookingCount(date),waiting=!outside&&!count&&wlEligible(date);cells+=`<button class="bk-day ${bookingDayClass(date)} ${date===draft.date?'chosen':''} ${waiting?'wl-wait-day':''}" ${!count&&!waiting?'disabled':''} aria-label="${formatDate(date,true)} ${count?'空き'+count+'枠':waiting?'キャンセル待ち':'受付対象外'}" onclick="${waiting?'wlOpen':handler}('${date}')"><span>${Number(date.slice(8))}</span>${count?`<small>${count}枠</small>`:waiting?`<span class="wl-day-bell">${wlBell}</span>`:'<small class="bk-no-slots"></small>'}</button>`;}return `<section class="bk-month-panel ${secondary?'bk-month-secondary':''}" aria-label="${y}年${m+1}月"><div class="bk-calendar-title">${y}年${m+1}月 <small>日付を選んで空き枠を確認</small></div><div class="bk-calendar">${'日月火水木金土'.split('').map((d,i)=>`<span class="bk-weekday ${i===0?'sun':i===6?'sat':''}">${d}</span>`).join('')}${cells}</div></section>`;};
const wlPreviousCalendar=bookingCalendar;
bookingCalendar=function(){return wlPreviousCalendar()+`<div class="wl-legend">${wlBell}<span>キャンセル待ちのお申し込み</span></div>${wlEntry()}<p class="bk-note">体験用：旧・新コースで、空き枠数や空きのある日・時間帯を変えて表示しています。</p>`;};
function wlDecorate(container){if(!container||isDelegateBooking&&!proxyCanAct())return;const k=current?.k;if(['reservations','list'].includes(k)&&!container.querySelector('.wl-entry'))container.insertAdjacentHTML('afterbegin',wlEntry());if(['detail','groupDetail','reservationGroup'].includes(k)){const id=typeof current.arg==='string'?current.arg:current.arg?.id,r=state.reservations.find(x=>x.id===id);if(r&&wlEligible(r.date)&&!container.querySelector('.wl-change-entry')){const btn=document.createElement('button');btn.className='bk-secondary wl-change-entry';btn.innerHTML=wlBell+' 希望時間への変更待ち';btn.onclick=()=>wlOpen(r.date,r.id);const target=container.querySelector('.rs-detail-page')||container;target.append(btn);}}if(k==='times'&&draft&&wlEligible(draft.date)&&!container.querySelector('.wl-time-entry')){const el=document.createElement('button');el.className='wl-entry wl-time-entry';el.innerHTML=wlBell+' 希望の時間がない方はこちら ›';el.onclick=()=>wlOpen(draft.date);container.append(el);}}
if(isDelegateBooking){const prev=proxyRender;proxyRender=function(){prev();wlDecorate(document.querySelector('#proxyMain'));};}else{const prev=render;render=function(k,arg){prev(k,arg);wlDecorate(document.querySelector('#panelBody'));};}
// A second same-day submission must use change waiting, while one submission may contain multiple groups.
function wlDuplicateBooking(){const data=wlRead();if(!draft)return false;const original=draft.edit?data.reservations.find(r=>r.id===draft.id):null;return data.reservations.some(r=>r.date===draft.date&&r.id!==original?.id&&(!original?.batchId||r.batchId!==original.batchId));}
if(isDelegateBooking){const prev=proxyCommit;proxyCommit=function(){if(wlDuplicateBooking()){toast('同日に予約があります。予約詳細から変更待ちをご利用ください。');return;}return prev();};}else{const prev=commitBooking;commitBooking=function(){if(wlDuplicateBooking()){toast('同日に予約があります。予約詳細から変更待ちをご利用ください。');return;}return prev();};}
if(isDelegateBooking){wlDecorate(document.querySelector('#proxyMain'));}else wlDecorate(document.querySelector('#panelBody'));
