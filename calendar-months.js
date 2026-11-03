// Both portals use the same month grid. The second panel is desktop-only.
function bookingCalendarMonthMarkup(y,m,handler,secondary=false){
 const first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate();let cells='';
 for(let i=0;i<Math.ceil((first+days)/7)*7;i++){
 const date=bookingISO(y,m,i-first+1),outside=i<first||i>=first+days,n=Number(date.slice(8)),count=outside?0:bookingCount(date);
 cells+=`<button class="bk-day ${bookingDayClass(date)} ${date===draft.date?'chosen':''}" ${!count?'disabled':''} title="${japaneseHolidayName(date)}" aria-label="${formatDate(date,true)} ${japaneseHolidayName(date)} ${count?'空き'+count+'枠':'受付対象外'}" onclick="${handler}('${date}')"><span>${n}</span>${count?`<small>${count}枠</small>`:'<small class="bk-no-slots">—</small>'}</button>`;
 }
 return `<section class="bk-month-panel ${secondary?'bk-month-secondary':''}" aria-label="${y}年${m+1}月"><div class="bk-calendar-title">${y}年${m+1}月 <small>日付を選んで空き枠を確認</small></div><div class="bk-calendar">${'日月火水木金土'.split('').map((d,i)=>`<span class="bk-weekday ${i===0?'sun':i===6?'sat':''}">${d}</span>`).join('')}${cells}</div></section>`;
}
function bookingCalendarPairMarkup(y,m,handler){
 const other=new Date(y,m+1,1);
 return `<div class="bk-calendar-pair">${bookingCalendarMonthMarkup(y,m,handler)}${bookingCalendarMonthMarkup(other.getFullYear(),other.getMonth(),handler,true)}</div>`;
}
function bookingMonthNavigationMarkup(y,m,handler){
 const current=new Date(y,m,1),base=new Date(now+'T12:00:00');base.setDate(1);
 const elapsed=(y-base.getFullYear())*12+m-base.getMonth(),start=new Date(base.getFullYear(),base.getMonth()+Math.max(0,Math.floor(elapsed/5))*5,1);
 const previous=new Date(y,m-1,1),next=new Date(y,m+1,1);
 return `<div class="bk-month-navigation"><button class="bk-month-arrow" aria-label="前の月" ${current<=base?'disabled':''} onclick="${handler}(${previous.getFullYear()},${previous.getMonth()})">‹</button><div class="bk-months" aria-label="予約月">${Array.from({length:5},(_,i)=>{const d=new Date(start.getFullYear(),start.getMonth()+i,1);return `<button aria-pressed="${d.getMonth()===m&&d.getFullYear()===y}" class="${d.getMonth()===m&&d.getFullYear()===y?'active':''}" onclick="${handler}(${d.getFullYear()},${d.getMonth()})">${d.getMonth()===0?d.getFullYear()+'年 ':''}${d.getMonth()+1}月</button>`;}).join('')}</div><button class="bk-month-arrow" aria-label="次の月" onclick="${handler}(${next.getFullYear()},${next.getMonth()})">›</button></div>`;
}

// Delegate touch gestures so month re-renders do not accumulate listeners.
(()=>{
 let gesture=null,suppressClickUntil=0;
 document.addEventListener('touchstart',e=>{
  const grid=e.target.closest?.('.bk-calendar-pair');
  gesture=grid&&e.touches.length===1?{grid,x:e.touches[0].clientX,y:e.touches[0].clientY,axis:null}:null;
 },{passive:true});
 document.addEventListener('touchmove',e=>{
  if(!gesture)return;
  if(e.touches.length!==1){gesture=null;return;}
  const dx=e.touches[0].clientX-gesture.x,dy=e.touches[0].clientY-gesture.y;
  if(!gesture.axis&&Math.max(Math.abs(dx),Math.abs(dy))>12)
   gesture.axis=Math.abs(dx)>Math.abs(dy)*1.5?'horizontal':'vertical';
  if(gesture.axis==='horizontal'&&e.cancelable)e.preventDefault();
 },{passive:false});
 document.addEventListener('touchend',e=>{
  const g=gesture;gesture=null;
  if(!g||e.touches.length||!e.changedTouches.length||!g.grid.isConnected)return;
  const dx=e.changedTouches[0].clientX-g.x,dy=e.changedTouches[0].clientY-g.y;
  if(g.axis==='vertical'||Math.abs(dx)<60||Math.abs(dx)<=Math.abs(dy)*1.5)return;
  suppressClickUntil=Date.now()+450;
  if(e.cancelable)e.preventDefault();
  const arrows=g.grid.parentElement.querySelectorAll('.bk-month-navigation .bk-month-arrow');
  const arrow=arrows[dx<0?1:0];
  if(arrow&&!arrow.disabled)arrow.click();
 },{passive:false});
 document.addEventListener('touchcancel',()=>{gesture=null;},{passive:true});
 document.addEventListener('click',e=>{
  if(Date.now()<suppressClickUntil&&e.target.closest?.('.bk-calendar-pair')){
   e.preventDefault();e.stopImmediatePropagation();
  }
 },true);
})();
