'use strict';
// Shared confirmation and cancellation flow. Only the selected active records change.
function cancellationRows(arg){
 const id=typeof arg==='string'?arg:arg?.id;
 const record=state.reservations.find(r=>r.id===id);
 if(!record)return [];
 return (arg?.all&&record.batchId?state.reservations.filter(r=>r.batchId===record.batchId):[record]).filter(r=>!r.status||r.status==='reserved');
}
function cancellationGo(route,arg){if(isDelegateBooking)proxyGo(route,arg);else openPanel(route,arg);}
function openReservationCancellation(id,all=false){cancellationGo('cancel',{id,all});}
function cancellationBack(){
 const arg=current.arg,id=typeof arg==='string'?arg:arg?.id;
 cancellationGo(isDelegateBooking?'detail':arg?.all?'reservationGroup':'detail',id);
}
function cancellationFacts(rows,selectable=false){return rows.map((r,i)=>`<section class="rs-cancel-slot">${selectable?`<label><input type="checkbox" name="cancelSlot" value="${esc(r.id)}" checked onchange="updateCancellationCount()"><strong>${i+1}組目をキャンセル</strong></label>`:''}<h3>${dateMarkup(r.date,true)}</h3><p>${esc(r.course)} · <strong>${esc(r.side||'OUT')} ${esc(r.time)}</strong> · ${r.people}名</p><p class="rs-cancel-guests">${r.guests.filter(Boolean).map(n=>esc(n)+(n==='未定'?'':' 様')).join('、')||'同伴者未登録'}</p></section>`).join('');}
function cancellationMarkup(arg){
 const rows=cancellationRows(arg);
 if(!rows.length)return `<div class="rs-cancellation"><p>この予約はすでに取り消されているか、見つかりません。</p>${cancellationListButton()}</div>`;
 return `<div class="rs-cancellation"><h2>予約をキャンセルしますか？</h2><p>${rows.length>1?'取り消す組にチェックを入れてください。チェックを外した組は予約を残します。':'取り消す日付・スタート時間をご確認ください。'}</p>${cancellationFacts(rows,true)}<p class="rs-cancel-warning">確定すると、選択した組の予約を取り消します。</p><button id="confirmCancellation" class="bk-primary reservation-cancel-confirm" onclick="confirmReservationCancellation()">${rows.length}組のキャンセルを確定する</button><button class="bk-secondary" onclick="cancellationBack()">キャンセルせずに戻る</button><p id="cancellationError" role="alert"></p><p class="bk-note">操作体験版です。実際のゴルフ場の予約は取り消されません。</p></div>`;
}
function cancellationListButton(){return `<button class="bk-primary" onclick="cancellationGo('${isDelegateBooking?'list':'reservations'}')">予約一覧へ進む ›</button>`;}
function updateCancellationCount(){const n=document.querySelectorAll('input[name="cancelSlot"]:checked').length;const b=$('#confirmCancellation');b.disabled=!n;b.textContent=n?`${n}組のキャンセルを確定する`:'キャンセルする組を選択してください';}
function applyReservationCancellation(data,ids,operator){
 if(!ids.length)throw Error('キャンセルする組を選択してください。');
 const rows=ids.map(id=>data.reservations.find(r=>r.id===id&&(!r.status||r.status==='reserved')));
 if(rows.some(r=>!r))throw Error('予約状況が変わりました。予約一覧から再度ご確認ください。');
 const stamp=new Date().toISOString();
 data.reservationHistory=data.reservationHistory||[];
 for(const r of rows)data.reservationHistory.push({...r,guests:[...r.guests],status:'cancelled',cancelledAt:now,audit:[...(r.audit||[]),{action:'cancel',...operator,at:stamp}]});
 data.reservations=data.reservations.filter(r=>!ids.includes(r.id));
 return rows;
}
function confirmReservationCancellation(){
 const button=$('#confirmCancellation');if(!button||button.disabled)return;
 const offered=cancellationRows(current.arg).map(r=>r.id);
 const ids=Array.from(document.querySelectorAll('input[name="cancelSlot"]:checked')).map(n=>n.value);
 if(!ids.length||ids.some(id=>!offered.includes(id)))return;
 button.disabled=true;
 try{
  if(isDelegateBooking){proxySaveMutation(data=>applyReservationCancellation(data,ids,{operatorId:proxyAgent,operatorName:proxyAgentInfo().name}));proxyListStatus='reserved';}
  else{
   const before=state;
   let latest;try{latest=JSON.parse(localStorage.getItem('takarazuka-portal-v1'));}catch{}
   const next=JSON.parse(JSON.stringify(latest?.reservations?latest:state));
   applyReservationCancellation(next,ids,{operatorId:'ito',operatorName:'伊藤 剛'});
   state=next;save();
   if(saveFailed){state=before;updateHome();throw Error('保存できませんでした。もう一度お試しください。');}
   reservationUI.status='reserved';reservationUI.from='';reservationUI.to='';
  }
  cancellationGo('cancelled',ids);
 }catch(error){$('#cancellationError').textContent=error.message;button.disabled=false;}
}
function cancellationCompleteMarkup(ids){
 const rows=state.reservationHistory.filter(r=>Array.isArray(ids)&&ids.includes(r.id)&&r.status==='cancelled');
 return `<div class="rs-cancellation"><section class="cp-registration-success" role="status"><h3>予約をキャンセルしました</h3><p>${rows.length}組の取消が完了しました。</p></section>${cancellationFacts(rows)}<p>取り消した予約は、予約一覧の「キャンセル済み」から確認できます。</p>${cancellationListButton()}</div>`;
}
if(isDelegateBooking){
 const previous=proxyRender;
 proxyRender=function(){previous();if(!proxyCanAct())return;const {k,arg}=current;if(k==='cancel'||k==='cancelled')$('#proxyMain').innerHTML=proxyFlowWrap(k==='cancel'?cancellationMarkup(arg):cancellationCompleteMarkup(arg),k==='cancel'?'予約のキャンセル':'キャンセル完了','list');};
}else{
 const previous=render;
 render=function(k,arg){previous(k,arg);if(k==='cancel'||k==='cancelled')$('#panelBody').innerHTML=k==='cancel'?cancellationMarkup(arg):cancellationCompleteMarkup(arg);};
}
// Refresh member records when the secretary changes the same browser-local data.
// Keep in-progress input intact while updating the underlying reservation state.
if(!isDelegateBooking)window.addEventListener('storage',function(event){
 if(event.key!=='takarazuka-portal-v1'||!event.newValue)return;
 let latest;try{latest=JSON.parse(event.newValue);}catch{return;}
 if(!Array.isArray(latest.reservations)||!Array.isArray(latest.reservationHistory))return;
 state=latest;updateHome();
 if(['reservations','detail','archiveDetail','reservationGroup','cancel','cancelled','registered'].includes(current?.k))render(current.k,current.arg);
});
