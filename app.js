'use strict';
const $ = id => document.getElementById(id);
const meals = ['Breakfast','Lunch','Dinner','Snacks'];
const symbols = ['☕','☀','☾','◈'];
const key = 'dayplate.diary.v1';
const fmt = n => n.toLocaleString('en-GB');
function iso(d) {
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
}
const local = s => new Date(s+'T12:00:00');
const today = () => iso(new Date());
const label = (s,options) => local(s).toLocaleDateString('en-GB',options);
const validDate = s => typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(local(s))===s;
const validNumber = n => Number.isSafeInteger(n) && n>=0 && n<=100000;
function validate(d) {
  if (!d || d.version!==1 || !(d.goal===null || (validNumber(d.goal) && d.goal>0)) || !Array.isArray(d.entries)) throw Error('Choose a valid Dayplate backup.');
  const ids = new Set();
  for (const e of d.entries) {
    if (!e || typeof e.id!=='string' || !e.id || ids.has(e.id) || !validDate(e.date) || !meals.includes(e.meal) || typeof e.name!=='string' || !e.name.trim() || e.name.length>160 || !validNumber(e.kcal)) throw Error('This diary contains an invalid entry.');
    ids.add(e.id);
  }
  return d;
}
function read() {
  const raw=localStorage.getItem(key);
  return raw===null ? {version:1,entries:[],goal:null} : validate(JSON.parse(raw));
}
let state={version:1,entries:[],goal:null}, selected=today(), month=selected.slice(0,7);
let noticeTimer;
function notify(msg,sticky=false) {
  clearTimeout(noticeTimer); $('notice').textContent=msg;
  if(!sticky) noticeTimer=setTimeout(()=>$('notice').textContent='',3300);
}
function refresh() {
  try { state=read(); render(); } catch { render(); notify('Your saved diary could not be read. Check browser storage permissions.',true); }
}
function commit(change) {
  const fresh=read();change(fresh);validate(fresh);
  localStorage.setItem(key,JSON.stringify(fresh));state=fresh;render();
}
function node(tag,txt,cls) {
  const el=document.createElement(tag);el.textContent=txt;if(cls) el.className=cls;return el;
}
function action(txt,fn,cls,aria) {
  const el=node('button',txt,cls);el.type='button';el.onclick=fn;
  if(aria) el.setAttribute('aria-label',aria);return el;
}
function selectDay(date) {selected=date;month=date.slice(0,7);render();}
function render() {
  const entries=state.entries.filter(e=>e.date===selected);
  const totals=new Map();
  for(const e of state.entries) totals.set(e.date,(totals.get(e.date)||0)+e.kcal);
  const total=totals.get(selected)||0;
  $('dateLabel').textContent=label(selected,{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  $('total').textContent=fmt(total);$('goal').textContent=state.goal?'Goal · '+fmt(state.goal)+' kcal':'Set a daily goal';
  $('remaining').textContent=state.goal ? fmt(Math.abs(state.goal-total))+(total>state.goal?' kcal above goal':' kcal remaining') : '';
  $('groups').replaceChildren();
  meals.forEach((meal,i)=>{
    const group=node('div','','group'),head=node('div','','grouphead'),summary=node('div','');
    const list=entries.filter(e=>e.meal===meal);
    summary.append(node('b',meal),node('small',list.length?fmt(list.reduce((s,e)=>s+e.kcal,0))+' kcal':'No food logged'));
    const icon=node('span',symbols[i],'icon');icon.ariaHidden='true';
    head.append(icon,summary,action('+',()=>food(meal),'plus','Log food for '+meal));group.append(head);
    for(const e of list) {
      const row=node('div','','entry');row.append(node('span',e.name),node('small',fmt(e.kcal)+' kcal'),action('Edit',()=>food(meal,e),'','Edit '+e.name));group.append(row);
    }
    $('groups').append(group);
  });
  $('month').textContent=label(month+'-01',{month:'long',year:'numeric'});
  const days=$('days');days.replaceChildren();
  const weekdays=['M','T','W','T','F','S','S'];weekdays.forEach(d=>days.append(node('small',d)));
  const first=local(month+'-01');
  for(let i=0;i<(first.getDay()+6)%7;i++) days.append(node('span',''));
  const last=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
  for(let i=1;i<=last;i++){
    const date=month+'-'+String(i).padStart(2,'0'), logged=totals.has(date);
    const btn=action(i,()=>selectDay(date),'',date+(logged?', '+fmt(totals.get(date))+' kcal':''));
    btn.classList.toggle('selected',date===selected);btn.classList.toggle('logged',logged);btn.setAttribute('aria-pressed',String(date===selected));days.append(btn);
  }
  const start=local(selected);start.setDate(start.getDate()-(start.getDay()+6)%7);
  const week=weekdays.map((_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return iso(d);});
  const values=week.map(d=>totals.get(d)||0), max=Math.max(...values,1);
  $('weekRange').textContent=[week[0],week[6]].map(d=>label(d,{day:'numeric',month:'short'})).join(' – ');
  $('weekly').textContent=fmt(values.reduce((s,n)=>s+n,0))+' kcal';$('chart').replaceChildren();
  week.forEach((d,i)=>{
    const text=label(d,{weekday:'long',day:'numeric',month:'short'})+' · '+(totals.has(d)?fmt(values[i])+' kcal':'No food logged');
    const b=action('',()=>selectDay(d),'',text),track=node('i',''),bar=node('em','',values[i]?'filled':'');bar.style.height=(values[i]/max*100)+'%';
    track.append(bar);b.append(track,node('span',weekdays[i]));b.title=text;$('chart').append(b);
  });
}
function moveMonth(delta){const d=local(month+'-01');d.setMonth(d.getMonth()+delta);month=iso(d).slice(0,7);render();}
$('prev').onclick=()=>moveMonth(-1);$('next').onclick=()=>moveMonth(1);$('today').onclick=()=>selectDay(today());
const dialog=$('dialog'), fields=$('fields');let submit;
function modal(title,button,handler){
  fields.replaceChildren();$('modalTitle').textContent=title;$('save').textContent=button;$('save').hidden=!button;$('error').textContent='';submit=handler;
  if(!dialog.open)dialog.showModal();
}
function field(title,type,value,props={}){
  const id='input'+fields.children.length, lab=node('label',title);lab.htmlFor=id;
  const el=document.createElement(type==='select'?'select':'input');el.id=id;
  if(type==='select') meals.forEach(m=>el.add(new Option(m,m)));else el.type=type;
  Object.assign(el,props);if(value!==null)el.value=value;fields.append(lab,el);return el;
}
document.querySelector('.close').onclick=()=>dialog.close();
$('form').onsubmit=async event=>{event.preventDefault();if(!submit)return;
  try {await submit();dialog.close();}catch(err){$('error').textContent=err.message||'Unable to save your changes.';}
};
function food(meal='Breakfast',entry=null){
  modal(entry?'Edit food':'Log food','Save food',()=>{
    const name=description.value.trim();if(!name)throw Error('Enter a food or meal.');
    const record={id:entry?.id || crypto.randomUUID(),name,meal:category.value,date:date.value,kcal:Number(kcal.value)};
    commit(d=>{
      if(entry && !d.entries.some(e=>e.id===entry.id))throw Error('This entry has already been removed.');
      d.entries=d.entries.filter(e=>e.id!==record.id);d.entries.push(record);
    });
    selectDay(record.date);notify('Food saved');
  });
  const description=field('Food or meal','text',entry?.name||'',{required:true,maxLength:160,placeholder:'e.g. Jollof rice and chicken'});
  const kcal=field('Calories for this portion (kcal)','number',entry?.kcal??'',{min:0,max:100000,step:1,required:true,inputMode:'numeric'});
  const category=field('Meal','select',meal),date=field('Date','date',entry?.date||selected,{required:true});
  if(entry)fields.append(action('Delete entry',()=>{modal('Delete this entry?','Delete entry',()=>{commit(d=>{d.entries=d.entries.filter(e=>e.id!==entry.id);});notify('Entry deleted');});fields.append(node('p',entry.name+' · '+fmt(entry.kcal)+' kcal'));},'danger'));
  description.focus();
}
$('add').onclick=()=>food();
$('goal').onclick=()=>{
  modal('Daily calorie goal','Save goal',()=>{commit(d=>{d.goal=input.value?Number(input.value):null;});notify('Goal saved');});
  const input=field('Daily goal (kcal)','number',state.goal??'',{min:1,max:100000,step:1});fields.append(node('p','Applies to all diary dates. Leave blank to remove your goal.','sub'));input.focus();
};
$('data').onclick=()=>{
  modal('My diary data','',null);fields.append(node('p','Your diary is saved in this browser. Export a backup to keep a copy or move it to another device.'));
  fields.append(action('Download backup',()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='dayplate-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  },'quiet'));
  const file=field('Restore a backup','file',null,{accept:'.json,application/json'});
  file.onchange=async()=>{
    try{
      if(!file.files.length)return;
      const backup=validate(JSON.parse(await file.files[0].text()));
      modal('Restore this diary?','Replace diary',()=>{commit(d=>Object.assign(d,backup));notify('Backup restored');});
      fields.append(node('p','This will replace the entries and goal in this browser with the '+backup.entries.length+' entries and goal from your backup.'));
    }catch{$('error').textContent='Choose a valid Dayplate JSON backup.';file.value='';}
  };
};
window.addEventListener('storage',event=>{if(!event.key||event.key===key)refresh();});refresh();
