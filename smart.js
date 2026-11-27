'use strict';
// Local planning only. All nutrition comes from the existing food database.
function smartDefaults(d){
  d.kitchen ??= {pantry:[],plans:[],batches:[],preferences:{minutes:30,exclude:''}};
  return d.kitchen;
}
function validateKitchen(d){
  const k=smartDefaults(d), unique=items=>new Set(items.map(x=>x.id)).size===items.length;
  if(!k||!Array.isArray(k.pantry)||!Array.isArray(k.plans)||!Array.isArray(k.batches)||!k.preferences||!Number.isFinite(k.preferences.minutes)||k.preferences.minutes<5||k.preferences.minutes>180||typeof k.preferences.exclude!=='string'||k.preferences.exclude.length>500)throw Error('Invalid kitchen data.');
  if(!unique(k.plans)||!unique(k.batches)||new Set(k.pantry.map(x=>x.name)).size!==k.pantry.length)throw Error('Duplicate kitchen records.');
  for(const p of k.pantry)if(!nameOK(p.name)||!positiveWeight(p.grams))throw Error('Invalid pantry amount.');
  for(const p of k.plans){
    if(!nameOK(p.id)||!validDate(p.date)||!meals.includes(p.meal)||!['planned','out','eaten'].includes(p.status)||typeof p.locked!=='boolean')throw Error('Invalid planned meal.');
    if(p.status!=='out'){
      if(!p.recipe||!nameOK(p.recipe.name)||!Array.isArray(p.recipe.ingredients)||!p.recipe.ingredients.length||!Array.isArray(p.recipe.steps)||!p.recipe.steps.every(s=>typeof s==='string'&&s.length<5000)||!positiveWeight(p.servings)||p.servings>20)throw Error('Invalid planned recipe.');
      for(const i of p.recipe.ingredients)if(!nameOK(i.name)||!positiveWeight(i.grams)||!Number.isFinite(i.per100)||i.per100<0||i.per100>1000)throw Error('Invalid planned ingredient.');
      if(!validNumber(Math.round(batchEnergy(p.recipe.ingredients)*p.servings)))throw Error('Planned meal is too large.');
    }
  }
  if(new Set(k.plans.map(p=>p.date+'|'+p.meal)).size!==k.plans.length)throw Error('There is already a meal in that slot.');
  for(const b of k.batches){
    if(!nameOK(b.id)||!nameOK(b.name)||!positiveWeight(b.yieldGrams)||!validDate(b.date)||!['Fridge','Freezer'].includes(b.location)||!Number.isFinite(b.per100)||b.per100<0||b.per100>1000)throw Error('Invalid batch.');
    if(batchRemaining(d,b)<-0.005)throw Error('That portion exceeds the amount left in this batch.');
  }
  for(const e of d.entries)if(e.batchId!==undefined){
    const b=k.batches.find(b=>b.id===e.batchId);
    if(!b||!e.portion||e.portion.unit!=='g'||e.portion.per100!==b.per100)throw Error('Batch portions must keep their original nutrition values.');
  }
}
function batchRemaining(d,b){return Math.max(0,b.yieldGrams)-d.entries.filter(e=>e.batchId===b.id).reduce((s,e)=>s+e.portion.grams,0);}
function smartRecipes(d=state){
  return [...recipeBook.map((r,i)=>({id:'idea-'+i,name:r.name,meal:r.meal,minutes:r.minutes,steps:r.steps,ingredients:r.ingredients.map(([name,grams])=>({name,grams,per100:recipeEnergy.get(name)}))})),...d.savedRecipes.map(r=>({id:r.id,name:r.name,meal:'Dinner',minutes:null,steps:['Use your saved recipe method. Quantities below represent one quarter of your saved batch.'],ingredients:r.ingredients.map(i=>({...i,grams:i.grams/4}))}))];
}
function eligibleRecipes(d,meal,minutes){
  const omit=d.kitchen.preferences.exclude.toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);
  return smartRecipes(d).filter(r=>(r.meal===meal||(['Lunch','Dinner'].includes(meal)&&['Lunch','Dinner'].includes(r.meal)))&&(r.minutes!==null&&r.minutes<=minutes)&&!omit.some(t=>(r.name+' '+r.ingredients.map(i=>i.name).join(' ')).toLowerCase().includes(t)));
}
function rankRecipes(d,meal,minutes,target=null,used=[]){
  return eligibleRecipes(d,meal,minutes).map(r=>{
    const have=r.ingredients.filter(i=>d.kitchen.pantry.some(p=>p.name===i.name&&p.grams>=i.grams)).length;
    const energy=batchEnergy(r.ingredients);
    const score=have/r.ingredients.length*40-(target>0?Math.abs(energy-target)/target*30:0)-used.filter(id=>id===r.id).length*25;
    return {recipe:r,have,energy,score};
  }).sort((a,b)=>b.score-a.score||a.recipe.minutes-b.recipe.minutes);
}
function weekDates(date){const start=local(date);start.setDate(start.getDate()-(start.getDay()+6)%7);return Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return iso(d);});}
function shoppingNeeds(d,dates){
  const sums=new Map();
  for(const p of d.kitchen.plans.filter(p=>dates.includes(p.date)&&p.status==='planned'))for(const i of p.recipe.ingredients)sums.set(i.name,(sums.get(i.name)||0)+i.grams*p.servings);
  return [...sums].map(([name,grams])=>({name,grams:Math.max(0,grams-(d.kitchen.pantry.find(p=>p.name===name)?.grams||0))})).filter(i=>i.grams>0.005).sort((a,b)=>a.name.localeCompare(b.name));
}
function consumePantry(k,ingredients,multiplier){
  k.pantry=k.pantry.map(p=>({...p,grams:Math.max(0,p.grams-ingredients.filter(i=>i.name===p.name).reduce((s,i)=>s+i.grams*multiplier,0))})).filter(p=>p.grams>=0.01);
}
function generatePlan(d,date){
  const dates=weekDates(date),used=d.kitchen.plans.filter(p=>dates.includes(p.date)&&p.status!=='out').map(p=>p.recipe.id);
  let count=0;
  for(const day of dates)for(const meal of meals){
    const old=d.kitchen.plans.find(p=>p.date===day&&p.meal===meal);
    if(old&&(old.locked||old.status!=='planned'))continue;
    const target=d.goal?d.goal*({Breakfast:.25,Lunch:.3,Dinner:.35,Snacks:.1}[meal]):null;
    const options=rankRecipes(d,meal,d.kitchen.preferences.minutes,target,used);
    if(!options.length)continue;
    const r=options[0].recipe;
    d.kitchen.plans=d.kitchen.plans.filter(p=>p!==old);
    d.kitchen.plans.push({id:crypto.randomUUID(),date:day,meal,status:'planned',locked:false,servings:target?Math.max(.25,Math.min(3,Math.round(target/batchEnergy(r.ingredients)*4)/4)):1,recipe:structuredClone(r)});used.push(r.id);count++;
  }
  return count;
}
function safeAction(fn){return ()=>{try{fn();}catch(e){notify(e.message,true);}};}
function renderSmart(){
  const k=smartDefaults(state),dates=weekDates(selected);
  $('planner-range').textContent=label(dates[0],{day:'numeric',month:'short'})+' – '+label(dates[6],{day:'numeric',month:'short'});
  $('kitchen-summary').textContent=k.pantry.length+' pantry ingredients · '+k.batches.filter(b=>batchRemaining(state,b)>0.005).length+' batches available';
  const tabs=$('plan-tabs');tabs.replaceChildren();
  for(const date of dates){const button=action('',()=>selectDay(date),'plan-date',label(date,{weekday:'long',day:'numeric',month:'long'}));button.setAttribute('aria-pressed',String(date===selected));button.append(node('small',label(date,{weekday:'short'})),node('b',local(date).getDate()));tabs.append(button);}
  const grid=$('plan-days');grid.replaceChildren();
  for(const date of dates){
    const day=node('article','','plan-day');day.classList.toggle('active-day',date===selected);day.append(node('h3',label(date,{weekday:'short',day:'numeric',month:'short'})));
    const plans=k.plans.filter(p=>p.date===date);
    const plannedKcal=plans.filter(p=>p.status!=='out').reduce((n,p)=>n+Math.round(batchEnergy(p.recipe.ingredients)*p.servings),0);
    if(plans.length)day.append(node('p',plannedKcal+' kcal planned'+(state.goal?' / '+state.goal+' goal':''),'sub'));
    for(const meal of meals){
      const p=plans.find(p=>p.meal===meal),btn=action('',()=>editPlan(p,date,meal),'plan-slot');
      btn.append(node('small',meal),node('b',p?(p.status==='out'?'Eating out / own plans':p.recipe.name):'Choose a meal'));
      if(p)btn.append(node('small',p.status==='eaten'?'Logged in diary':p.status==='out'?'Kept when regenerating':Math.round(batchEnergy(p.recipe.ingredients)*p.servings)+' kcal · '+p.servings+' serving'+(p.servings===1?'':'s')+(p.locked?' · Locked':'')));
      day.append(btn);
    }
    grid.append(day);
  }
  const list=$('batch-list');list.replaceChildren();
  if(!k.batches.length)list.append(node('p','Turn a saved recipe into a real batch, then scan its label whenever you eat a portion.','sub'));
  for(const b of [...k.batches].reverse()){
    const remaining=Math.max(0,batchRemaining(state,b)),row=node('div','','batch-row'),info=node('div','');
    info.append(node('b',b.name),node('small',Math.round(remaining)+' / '+b.yieldGrams+' g left · '+b.location+' · cooked '+b.date));
    row.append(info,action('Label',()=>batchLabel(b),'quiet'));
    if(remaining>0.005)row.append(action('Log portion',()=>logBatch(b.id),'quiet'));
    row.append(action(b.location==='Fridge'?'Move to freezer':'Move to fridge',safeAction(()=>commit(d=>{d.kitchen.batches.find(x=>x.id===b.id).location=b.location==='Fridge'?'Freezer':'Fridge';})),'quiet'));list.append(row);
  }
}
function kitchenSettings(){
  modal('Planning preferences','Save preferences',()=>{commit(d=>{d.kitchen.preferences={minutes:time.valueAsNumber,exclude:exclude.value.trim()};});notify('Preferences saved');});
  const time=field('Maximum recipe time (minutes)','number',state.kitchen.preferences.minutes,{min:5,max:180,required:true});
  const exclude=field('Ingredients or dishes to avoid, separated by commas','text',state.kitchen.preferences.exclude,{maxLength:500,placeholder:'e.g. tuna, peanut, coconut'});
  fields.append(node('p','This matches words in recipes, not certified allergen information. Check the ingredients yourself. Saved recipes with unknown cooking times are available through Choose a meal.','sub'));
}
function pantryEditor(){
  modal('What is in your kitchen?','',null);
  fields.append(node('p','Record usable weights in the exact preparation shown, such as cooked rice or dry rice. The shopping list subtracts these amounts.','sub'));
  const query=field('Find an ingredient','search',''),choices=node('div','','food-matches');fields.append(choices);
  let picked=null;
  query.oninput=()=>{picked=null;choices.replaceChildren();const terms=query.value.toLowerCase().trim().split(/\s+/);if(!terms[0])return;for(const [name] of dayplateFoods.filter(([name])=>terms.every(t=>name.toLowerCase().includes(t))).slice(0,15))choices.append(action(name,()=>{picked=name;query.value=name;choices.replaceChildren();},'recipe-choice'));};
  const amount=field('Amount currently available (g)','number','',{min:.01,max:100000,step:'any'});
  fields.append(action('Save amount',safeAction(()=>{
    if(!picked||!positiveWeight(amount.valueAsNumber))throw Error('Choose an ingredient and enter its weight.');
    commit(d=>{d.kitchen.pantry=d.kitchen.pantry.filter(p=>p.name!==picked);d.kitchen.pantry.push({name:picked,grams:amount.valueAsNumber});});pantryEditor();
  }),'primary'));
  for(const p of state.kitchen.pantry){const row=node('div','','batch-row');row.append(node('span',p.name+' · '+p.grams+' g'),action('Edit',()=>{picked=p.name;query.value=p.name;amount.value=p.grams;amount.focus();},'quiet'),action('Remove',safeAction(()=>{commit(d=>{d.kitchen.pantry=d.kitchen.pantry.filter(x=>x.name!==p.name);});pantryEditor();}),'quiet'));fields.append(row);}
}
function suggestMeals(){
  modal('What should I eat?','',null);
  fields.append(node('p','Suggestions use your pantry, cooking time and preferences. Choose a calorie preference if useful.','sub'));
  const meal=field('Meal','select','Dinner'),minutes=field('Time available (minutes)','number',state.kitchen.preferences.minutes,{min:5,max:180});
  const remaining=state.goal===null?null:Math.max(0,state.goal-state.entries.filter(e=>e.date===selected).reduce((s,e)=>s+e.kcal,0));
  const target=field('Preferred calories for this meal (optional)','number',remaining===null?'':remaining,{min:0,max:100000});
  const mode=field('Prioritise','select',null);mode.replaceChildren(...[['match','Best match'],['quick','Quicker meals'],['pantry','Use my ingredients']].map(([v,t])=>new Option(t,v)));
  const ready=state.kitchen.batches.filter(b=>batchRemaining(state,b)>0.005);
  if(ready.length){fields.append(node('h3','Already cooked'));for(const b of ready)fields.append(action(b.name+' · '+Math.round(batchRemaining(state,b))+' g left in '+b.location.toLowerCase(),()=>logBatch(b.id),'recipe-choice'));}
  const list=node('div','');fields.append(list);let offset=0;
  function draw(){
    list.replaceChildren();let options=rankRecipes(state,meal.value,minutes.valueAsNumber,target.valueAsNumber);
    if(mode.value==='quick')options.sort((a,b)=>a.recipe.minutes-b.recipe.minutes);
    if(mode.value==='pantry')options.sort((a,b)=>b.have/b.recipe.ingredients.length-a.have/a.recipe.ingredients.length);
    if(!options.length){list.append(node('p','No recipes match. Increase the time or adjust your preferences.'));return;}
    for(const o of options.slice(offset,offset+3)){
      const card=node('article','','suggestion');card.append(node('h3',o.recipe.name),node('p',o.recipe.minutes+' min · '+Math.round(o.energy)+' kcal · enough of '+o.have+'/'+o.recipe.ingredients.length+' ingredients','sub'));
      const missing=o.recipe.ingredients.filter(i=>!state.kitchen.pantry.some(p=>p.name===i.name&&p.grams>=i.grams));
      card.append(node('p',missing.length?'Check / buy: '+missing.map(i=>i.name.split(',')[0]).join(', '):'You have enough of every ingredient for one serving.'));
      card.append(action('View and plan',()=>planRecipe(o.recipe,selected,meal.value),'quiet'));list.append(card);
    }
    if(options.length>3)list.append(action('Show different ideas',()=>{offset=(offset+3>=options.length?0:offset+3);draw();},'quiet'));
  }
  for(const el of [meal,minutes,target,mode])el.onchange=()=>{offset=0;draw();};draw();
}
function choosePlanRecipe(date,meal,existing){
  modal('Choose a meal','',null);const q=field('Search recipes','search',''),list=node('div','');fields.append(list);
  function draw(){list.replaceChildren();for(const r of smartRecipes().filter(r=>r.name.toLowerCase().includes(q.value.toLowerCase())))list.append(action(r.name+' · '+Math.round(batchEnergy(r.ingredients))+' kcal',()=>planRecipe(r,date,meal,existing),'recipe-choice'));}
  q.oninput=draw;draw();
}
function planRecipe(recipe,date,meal,existing){
  modal('Plan '+recipe.name,'Save planned meal',()=>{
    commit(d=>{
      if(existing&&d.kitchen.plans.find(p=>p.id===existing.id)?.status==='eaten')throw Error('This meal has already been logged.');
      const collision=d.kitchen.plans.find(p=>p.date===when.value&&p.meal===category.value&&p.id!==existing?.id);if(collision)throw Error('That slot is occupied. Choose another date or meal.');
      d.kitchen.plans=d.kitchen.plans.filter(p=>p.id!==existing?.id);
      d.kitchen.plans.push({id:existing?.id||crypto.randomUUID(),date:when.value,meal:category.value,status:'planned',locked:existing?.locked||false,servings:qty.valueAsNumber,recipe:structuredClone(recipe)});
    });notify('Meal planned');
  });
  fields.append(node('p',Math.round(batchEnergy(recipe.ingredients))+' kcal per serving','estimate'));
  const ul=node('ul','');recipe.ingredients.forEach(i=>ul.append(node('li',Math.round(i.grams*100)/100+' g '+i.name)));fields.append(ul);
  const ol=node('ol','');recipe.steps.forEach(s=>ol.append(node('li',s)));fields.append(ol);
  const qty=field('Servings','number',existing?.servings||1,{min:.01,max:20,step:'any',required:true}),when=field('Date','date',date,{required:true}),category=field('Meal','select',meal);
}
function editPlan(p,date,meal){
  if(!p){
    modal('Plan '+meal.toLowerCase(),'Eating out / own plans',()=>{commit(d=>d.kitchen.plans.push({id:crypto.randomUUID(),date,meal,status:'out',locked:true}));});
    fields.append(node('p',date),action('Choose a recipe',()=>choosePlanRecipe(date,meal),'primary'));return;
  }
  modal(p.status==='out'?'Eating out / own plans':p.recipe.name,'',null);
  fields.append(node('p',date+' · '+meal+' · '+(p.status==='eaten'?'Already logged':p.status==='out'?'Reserved slot':p.servings+' serving(s), '+Math.round(batchEnergy(p.recipe.ingredients)*p.servings)+' kcal')));
  if(p.status==='planned'){
    fields.append(action('View recipe / move / adjust servings',()=>planRecipe(p.recipe,date,meal,p),'recipe-choice'),action(p.locked?'Unlock meal':'Lock meal',safeAction(()=>{commit(d=>{const x=d.kitchen.plans.find(x=>x.id===p.id);x.locked=!x.locked;});dialog.close();}),'recipe-choice'),action('Choose another recipe',()=>choosePlanRecipe(date,meal,p),'recipe-choice'));
    fields.append(action('I ate this meal',()=>{
      modal('Log this planned meal','Confirm eaten',()=>{
        commit(d=>{
          const live=d.kitchen.plans.find(x=>x.id===p.id);if(!live||JSON.stringify(live)!==JSON.stringify(p)||live.status!=='planned')throw Error('This plan has changed. Reopen it.');
          const n=quantity.valueAsNumber;if(!(n>0&&n<=20))throw Error('Enter servings between 0.01 and 20.');
          d.entries.push({id:crypto.randomUUID(),name:p.recipe.name,meal:p.meal,date:p.date,kcal:Math.round(batchEnergy(p.recipe.ingredients)*n)});
          consumePantry(d.kitchen,p.recipe.ingredients,n);live.status='eaten';live.servings=n;
        });selectDay(p.date);notify('Meal logged and pantry updated');
      });const quantity=field('Servings actually eaten','number',p.servings,{required:true,min:.01,max:20,step:'any'});fields.append(node('p','This logs the meal on '+p.date+' and deducts its ingredients from your pantry.','sub'));
    },'primary'));
  }
  fields.append(action('Remove from plan',()=>{modal('Remove planned meal?','Remove',()=>{commit(d=>{d.kitchen.plans=d.kitchen.plans.filter(x=>x.id!==p.id);});});fields.append(node('p','Existing diary entries and pantry amounts will stay as they are.'));},'danger'));
}
function shoppingList(){
  const dates=weekDates(selected),items=shoppingNeeds(state,dates);
  modal('Shopping for this week','',null);
  fields.append(node('p','Outstanding planned meals only, after subtracting your pantry. Weights retain the recipe preparation, so cooked weights are not dry purchase weights.','sub'));
  if(!items.length)fields.append(node('p','Nothing to buy for the current plan.'));
  for(const i of items)fields.append(node('p',Math.ceil(i.grams)+' g · '+i.name));
  fields.append(action('Download shopping list',()=>{
    downloadText('dayplate-shopping-'+dates[0]+'.txt','Dayplate shopping list\n'+dates[0]+' to '+dates[6]+'\nPreparation weights shown; check pack sizes.\n\n'+items.map(i=>Math.ceil(i.grams)+' g '+i.name).join('\n'));
  },'quiet'));
}
function downloadText(name,text,type='text/plain'){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function createBatch(){
  if(!state.savedRecipes.length){buildRecipe();return;}
  modal('Record a cooked batch','Create batch',()=>{
    const r=state.savedRecipes.find(r=>r.id===recipe.value);if(!r)throw Error('Choose a saved recipe.');
    const n=scale.valueAsNumber,weight=yieldInput.valueAsNumber;if(!(n>0&&n<=20)||!positiveWeight(weight))throw Error('Check the scale and finished weight.');
    commit(d=>{d.kitchen.batches.push({id:crypto.randomUUID(),name:title.value.trim(),date:date.value,location:location.value,yieldGrams:weight,per100:batchEnergy(r.ingredients)*n*100/weight});consumePantry(d.kitchen,r.ingredients,n);});notify('Batch created. Open Label to save its QR code.');
  });
  const recipe=field('Saved recipe','select',null);recipe.replaceChildren(...state.savedRecipes.map(r=>new Option(r.name,r.id)));
  const title=field('Batch name','text','',{required:true,maxLength:160}),scale=field('Recipe multiplier','number',1,{min:.01,max:20,step:'any',required:true}),yieldInput=field('Actual finished weight of this batch (g)','number','',{min:.01,max:100000,step:'any',required:true});
  const date=field('Cooked on','date',today(),{required:true}),location=field('Stored in','select',null);location.replaceChildren(new Option('Fridge'),new Option('Freezer'));
  const info=node('p','','estimate');fields.append(info,node('p','Use the multiplier if you cooked twice or half the saved recipe. Creation deducts those ingredient amounts from your pantry. Storage dates are a record, not a food-safety assessment.','sub'));
  function show(){const r=state.savedRecipes.find(r=>r.id===recipe.value);info.textContent=Math.round(batchEnergy(r.ingredients)*scale.valueAsNumber)+' kcal in this batch';}
  recipe.onchange=()=>{const r=state.savedRecipes.find(r=>r.id===recipe.value);title.value=r.name;yieldInput.value=r.yieldGrams;scale.value=1;show();};scale.oninput=show;recipe.onchange();
}
function batchCode(text){
  try{const url=new URL(text,location.href);if(url.origin!==location.origin||url.pathname!==location.pathname)return '';const m=url.hash.match(/^#batch=([a-zA-Z0-9-]{1,160})$/);return m?.[1]||'';}catch{return '';}
}
function batchLabel(b){
  modal('Label for '+b.name,'',null);
  const url=new URL(location.href);url.search='';url.hash='batch='+b.id;
  const qr=qrcode(0,'M');qr.addData(url.href);qr.make();
  const svg=qr.createSvgTag({cellSize:5,margin:20,scalable:true});
  const image=document.createElement('img');image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);image.alt='QR code for '+b.name;image.className='batch-qr';fields.append(image,node('p',b.name+' · '+b.date+' · '+Math.round(b.per100)+' kcal / 100 g'));
  fields.append(node('p','Scan with your phone camera or Scan a product. This label opens the saved batch in this browser. To use another device, restore a current diary backup there first.','sub'));
  fields.append(action('Download QR image',()=>downloadText('dayplate-batch-'+b.id+'.svg',svg,'image/svg+xml'),'quiet'));
  const link=node('a','Open this batch');link.href=url.href;link.onclick=e=>{e.preventDefault();logBatch(b.id);};fields.append(link);
}
function logBatch(id){
  const b=state.kitchen.batches.find(b=>b.id===id);
  if(!b){modal('Batch not found','',null);fields.append(node('p','This batch is not saved in this browser. Restore a current backup from the device where you created it.'));return;}
  modal(b.name,'Log batch portion',()=>{
    commit(d=>d.entries.push({id:crypto.randomUUID(),batchId:b.id,name:b.name,meal:meal.value,date:date.value,kcal:Math.round(amount.valueAsNumber*b.per100/100),portion:{grams:amount.valueAsNumber,per100:b.per100,unit:'g'}}));selectDay(date.value);notify('Portion logged and batch balance updated');
  });
  fields.append(node('p',Math.round(Math.max(0,batchRemaining(state,b)))+' g remaining · '+Math.round(b.per100)+' kcal / 100 g','estimate'));
  const amount=field('Portion eaten (g)','number','',{min:.01,max:Math.max(0,batchRemaining(state,b)),step:'any',required:true}),meal=field('Meal','select','Lunch'),date=field('Date','date',selected,{required:true});
}
function initSmart(){
  $('plan-prev').onclick=()=>{const d=local(selected);d.setDate(d.getDate()-7);selectDay(iso(d));};
  $('plan-next').onclick=()=>{const d=local(selected);d.setDate(d.getDate()+7);selectDay(iso(d));};
  $('suggest-meal').onclick=suggestMeals;$('pantry').onclick=pantryEditor;$('preferences').onclick=kitchenSettings;$('shopping').onclick=shoppingList;$('new-batch').onclick=createBatch;
  $('generate-plan').onclick=()=>{
    modal('Generate this week’s meals','Generate plan',()=>{let count=0;commit(d=>{count=generatePlan(d,selected);});notify(count?'Updated '+count+' meal slots':'No matching recipes. Try increasing the time or changing preferences.');});
    fields.append(node('p','Creates breakfast, lunch, dinner and a snack for the selected week. Replaces unlocked planned meals and preserves locked meals, eating-out slots and logged meals. Your calorie goal guides recipe choices and portions. Review the plan to suit your needs. Without a goal, each meal uses one serving.'));
  };
  const route=()=>{const id=batchCode(location.href);if(id)logBatch(id);};window.addEventListener('hashchange',route);route();
}
