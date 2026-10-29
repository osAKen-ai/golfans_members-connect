'use strict';
// Keep the chosen time and the following rows visible when the mobile tray grows.
document.addEventListener('click',function(event){
 if(!window.matchMedia('(max-width: 999px)').matches)return;
 const button=event.target.closest?.('.bk-people, .bk-seat');
 const row=button?.closest('.bk-slot');
 const list=row?.closest('.bk-slot-list');
 if(!list||!list.closest('.booking-times-view')||button.classList.contains('selected'))return;
 const time=row.querySelector('time')?.textContent;
 const height=list.clientHeight;
 requestAnimationFrame(function(){
  if(!list.isConnected||list.clientHeight>=height-1)return;
  const rows=Array.from(list.querySelectorAll('.bk-slot'));
  const index=rows.findIndex(item=>item.querySelector('time')?.textContent===time);
  const chosen=rows[index];
  if(!chosen?.querySelector('.selected'))return;
  const bounds=list.getBoundingClientRect();
  const selectedBounds=chosen.getBoundingClientRect();
  const following=rows[Math.min(index+2,rows.length-1)].getBoundingClientRect();
  // Move only as far as needed, keeping the chosen row visible too.
  const distance=Math.min(selectedBounds.top-bounds.top-8,following.bottom-bounds.bottom+8);
  if(distance>1)list.scrollBy({top:distance,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 });
},true);
