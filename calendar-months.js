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
 const elapsed=(y-base.getFullYear())*12+m-base.getMonth(),start=new Date(base.getFullYear(),base.getMonth()+Math.max(0,Math.floor(elapsed/6))*6,1);
 const previous=new Date(y,m-1,1),next=new Date(y,m+1,1);
 return `<div class="bk-month-navigation"><button class="bk-month-arrow" aria-label="前の月" ${current<=base?'disabled':''} onclick="${handler}(${previous.getFullYear()},${previous.getMonth()})">‹</button><div class="bk-months" aria-label="予約月">${Array.from({length:6},(_,i)=>{const d=new Date(start.getFullYear(),start.getMonth()+i,1);return `<button aria-pressed="${d.getMonth()===m&&d.getFullYear()===y}" class="${d.getMonth()===m&&d.getFullYear()===y?'active':''}" onclick="${handler}(${d.getFullYear()},${d.getMonth()})">${d.getMonth()===0?d.getFullYear()+'年 ':''}${d.getMonth()+1}月</button>`;}).join('')}</div><button class="bk-month-arrow" aria-label="次の月" onclick="${handler}(${next.getFullYear()},${next.getMonth()})">›</button></div>`;
}
