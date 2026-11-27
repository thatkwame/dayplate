'use strict';
function showView(){
  const hash=location.hash.slice(1),aliases={meals:'diary',calendar:'diary',planner:'plan',batches:'kitchen','my-recipes':'recipes'};
  const view=aliases[hash]||(['diary','plan','kitchen','recipes'].includes(hash)?hash:'diary');
  document.querySelectorAll('.view').forEach(el=>{el.hidden=el.id!=='view-'+view;});
  document.querySelectorAll('nav [data-view]').forEach(el=>{if(el.dataset.view===view)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  if(!hash.startsWith('batch='))window.scrollTo({top:0,behavior:'instant'});
  if(hash==='calendar')$('calendar').scrollIntoView({block:'start'});
}
window.addEventListener('hashchange',showView);showView();
$('day-prev').onclick=()=>{const d=local(selected);d.setDate(d.getDate()-1);selectDay(iso(d));};
$('day-next').onclick=()=>{const d=local(selected);d.setDate(d.getDate()+1);selectDay(iso(d));};
