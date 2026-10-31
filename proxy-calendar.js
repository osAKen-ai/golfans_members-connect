'use strict';
// Calendar/inventory only; intentionally contains no member profiles.
const holidayNames2027={'01-01':'元日','01-11':'成人の日','02-11':'建国記念の日','02-23':'天皇誕生日','03-21':'春分の日','03-22':'振替休日','04-29':'昭和の日','05-03':'憲法記念日','05-04':'みどりの日','05-05':'こどもの日','07-19':'海の日','08-11':'山の日','09-20':'敬老の日','09-23':'秋分の日','10-11':'スポーツの日','11-03':'文化の日','11-23':'勤労感謝の日'};

const now='2027-04-10';
const bookingUI={type:'all',party:0,only:false};
// Minimal fictional reservation roster; no photographs or profile details.
const proxyReservedNames=['山田 太郎','佐藤 花子','鈴木 健一','井上 一郎','高橋 次郎'];
function isJapaneseHoliday(date){return !!japaneseHolidayName(date);}
function japaneseHolidayName(date){return date.startsWith('2027-')?holidayNames2027[date.slice(5)]||'':'';}
function bookingISO(y,m,d){return new Date(Date.UTC(y,m,d)).toISOString().slice(0,10);}
function bookingShift(date,n){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function bookingDay(date){return new Date(date+'T12:00:00Z').getUTCDay();}
function bookingShort(date){const parts=date.split('-').map(Number);return `${parts[1]}/${parts[2]}（${'日月火水木金土'[bookingDay(date)]}${isJapaneseHoliday(date)?'・祝':''}）`;}
function bookingDayClass(date){return bookingDay(date)===0||isJapaneseHoliday(date)?'sun':bookingDay(date)===6?'sat':'';}
function bookingSlots(date,side=draft.side||'OUT'){
 const seed=Number(date.replaceAll('-',''))+(draft.course==='新コース'?5:0)+(side==='IN'?3:0);
 return Array.from({length:34},(_,i)=>{const minutes=7*60+2+i*7,time=Math.floor(minutes/60)+':'+String(minutes%60).padStart(2,'0'),pattern=(seed+i)%10;
  const kind=pattern<3?'member':pattern<5?'intro':'normal';
  let occupied=pattern===0?4:pattern===1?3:pattern===2?1:pattern===5?2:pattern===6?3:pattern===7?4:0;
  const existing=state.reservations.find(r=>r.id!==draft.id&&r.date===date&&r.course===draft.course&&(r.side||'OUT')===side&&r.time===time);
  if(existing)occupied=4;
  const capacity=4-occupied,choices=(kind==='member'?[1]:[2,3,4]).filter(n=>n<=capacity);
  return {time,hour:Math.floor(minutes/60),kind,occupied,capacity,choices,reservedName:occupied?(existing?proxyMemberInfo().name:proxyReservedNames[(seed+i)%proxyReservedNames.length]):'',ownReservation:!!existing,available:date>now&&choices.length>0};
 });
}
function bookingMatch(slot){return (bookingUI.type==='all'||slot.kind===bookingUI.type)&&(!bookingUI.party||slot.choices.includes(bookingUI.party));}
function bookingCount(date){if(date<=now)return 0;return ['OUT','IN'].flatMap(side=>bookingSlots(date,side)).filter(s=>s.available&&!s.currentReservation&&bookingMatch(s)).length;}
function bookingCalendar(){
 return `${bookingControls()}${bookingMonthNavigationMarkup(year,month,'proxyPickMonth')}${bookingCalendarPairMarkup(year,month,'proxyPickDate')}<p class="bk-note">操作体験版・空き枠は表示例です。複数のスタート枠を選択できます。</p>`;
}
