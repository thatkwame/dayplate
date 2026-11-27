'use strict';
const positiveWeight=n=>Number.isFinite(n)&&n>=0.01&&n<=100000;
const nameOK=s=>typeof s==='string'&&s.trim().length>0&&s.length<=160;
function validateRecipes(recipes){
  if(!Array.isArray(recipes))throw Error('Invalid recipe list.');
  const ids=new Set();
  for(const r of recipes){
    if(!r||!nameOK(r.id)||ids.has(r.id)||!nameOK(r.name)||!positiveWeight(r.yieldGrams)||!Array.isArray(r.ingredients)||!r.ingredients.length)throw Error('Check the recipe name, ingredients and finished weight.');
    for(const i of r.ingredients){
      if(!i||!nameOK(i.name)||!positiveWeight(i.grams)||!Number.isFinite(i.per100)||i.per100<0||i.per100>1000)throw Error('Check each ingredient and its weight.');
    }
    ids.add(r.id);
  }
}
function batchEnergy(items){return items.reduce((sum,i)=>sum+i.grams*i.per100/100,0);}
function density(r){return batchEnergy(r.ingredients)*100/r.yieldGrams;}
function renderPersonal(){
  const list=$('saved-list');list.replaceChildren();
  if(!state.savedRecipes.length)list.append(node('p','Save a batch once, then log each portion by weight.','sub'));
  for(const r of state.savedRecipes){
    const row=node('div','','batch-row');const info=node('div','');info.append(node('b',r.name),node('small',fmt(Math.round(density(r)))+' kcal per 100 g · '+fmt(r.yieldGrams)+' g batch'));
    row.append(info,action('Log portion',()=>food('Dinner',null,{name:r.name,portion:{per100:density(r),grams:''}}),'quiet'),action('Edit',()=>buildRecipe(r),'quiet'));list.append(row);
  }
}
function recentFoods(){
  modal('Recent foods','',null);
  const latest=new Map();
  for(const e of [...state.entries].reverse().sort((a,b)=>b.date.localeCompare(a.date))){
    const k=e.name.toLowerCase();
    if(!latest.has(k))latest.set(k,e);
  }
  if(!latest.size){fields.append(node('p','Foods you log will appear here with their last portion.'));return;}
  const query=field('Find a recent food','search','');const list=node('div','');fields.append(list);
  function show(){
    list.replaceChildren();
    for(const e of latest.values()){
      if(!e.name.toLowerCase().includes(query.value.toLowerCase()))continue;
      const button=action('',()=>food(e.meal,null,e),'recipe-choice');
      button.append(node('b',e.name),node('small',(e.portion?fmt(e.portion.grams)+' '+(e.portion.unit||'g')+' · ':'')+fmt(e.kcal)+' kcal · '+e.date));list.append(button);
    }
    if(!list.children.length)list.append(node('p','No matching recent foods.'));
  }
  query.oninput=show;show();
}
function repeatMeal(){
  const history=state.entries.filter(e=>e.date<selected);
  if(!history.length){modal('Repeat meal','',null);fields.append(node('p','No meals logged before '+selected+'. Choose a later diary date or log your first meal.'));return;}
  let preview=[];
  modal('Repeat meal','Add to diary',()=>{
    const result=preview.filter(row=>row.include.checked).map(({entry,input})=>{
      const n=input.valueAsNumber;
      const item={...entry,id:crypto.randomUUID(),date:selected,meal:target.value,kcal:n};
      delete item.batchId;
      if(entry.portion){item.portion={...entry.portion,grams:n};item.kcal=Math.round(n*item.portion.per100/100);}
      return item;
    });
    if(!result.length)throw Error('Select at least one food.');
    commit(d=>d.entries.push(...result));notify('Meal added');
  });
  const dates=[...new Set(history.map(e=>e.date))].sort().reverse();
  const source=field('Copy from date','select',null);source.replaceChildren(...dates.map(d=>new Option(d,d)));
  const meal=field('Original meal','select',null),target=field('Add to meal','select',null);
  fields.append(node('p','Adding to '+selected+'. Select the foods and adjust their portions.','sub'));
  const list=node('div','');fields.append(list);
  function updateRows(){
    list.replaceChildren();target.value=meal.value;
    preview=history.filter(e=>e.date===source.value&&e.meal===meal.value).map(entry=>{
      const label=node('label',entry.name,'repeat-pick'),include=document.createElement('input');include.type='checkbox';include.checked=true;label.prepend(include);
      const amount=node('label',entry.portion?'Portion ('+(entry.portion.unit||'g')+')':'Calories (kcal)'),input=document.createElement('input');
      Object.assign(input,{type:'number',min:entry.portion?0.01:0,max:100000,step:entry.portion?'any':1,required:true,value:entry.portion?.grams??entry.kcal});
      amount.append(input);include.onchange=()=>{input.disabled=!include.checked;};list.append(label,amount);
      return {entry,include,input};
    });
  }
  function updateMeals(){meal.replaceChildren(...meals.filter(m=>history.some(e=>e.date===source.value&&e.meal===m)).map(m=>new Option(m)));updateRows();}
  source.onchange=updateMeals;meal.onchange=updateRows;updateMeals();
}
function buildRecipe(original=null){
  const items=(original?.ingredients||[]).map(i=>({...i}));
  let chosen=null;
  modal(original?'Edit recipe':'Create recipe','Save recipe',()=>{
    if(search.value.trim()||grams.value)throw Error('Add the pending ingredient or clear its name and weight.');
    const recipe={id:original?.id||crypto.randomUUID(),name:title.value.trim(),yieldGrams:weight.valueAsNumber,ingredients:items};
    validateRecipes([recipe]);
    commit(d=>{
      const index=d.savedRecipes.findIndex(r=>r.id===recipe.id);
      if(original && JSON.stringify(d.savedRecipes[index])!==JSON.stringify(original))throw Error('This recipe changed in another tab. Close and reopen it.');
      if(index<0)d.savedRecipes.push(recipe);else d.savedRecipes[index]=recipe;
    });notify('Recipe saved');
  });
  const title=field('Recipe name','text',original?.name||'',{required:true,maxLength:160});
  const weight=field('Finished batch weight (g)','number',original?.yieldGrams??'',{required:true,min:0.01,max:100000,step:'any'});
  fields.append(node('p','Weigh the cooked food without its container.','sub'));
  const list=node('div','');fields.append(list);
  const search=field('Find an ingredient','search','',{autocomplete:'off'}),matches=node('div','','food-matches');fields.append(matches);
  const grams=field('Ingredient weight (g)','number','',{min:0.01,max:100000,step:'any'});
  search.oninput=()=>{
    chosen=null;matches.replaceChildren();const terms=search.value.trim().toLowerCase().split(/\s+/);if(!terms[0])return;
    const found=(typeof dayplateFoods==='undefined'?[]:dayplateFoods).filter(([n])=>terms.every(t=>n.toLowerCase().includes(t)));
    for(const food of found.slice(0,20))matches.append(action(food[0],()=>{chosen=food;search.value=food[0];matches.replaceChildren();grams.focus();}));
    if(!found.length)matches.textContent='No match. Try another ingredient name.';
  };
  fields.append(action('Add ingredient',()=>{
    if(!chosen||!positiveWeight(grams.valueAsNumber)){$('error').textContent='Select an ingredient and enter its weight.';return;}
    items.push({name:chosen[0],per100:chosen[1],grams:grams.valueAsNumber});
    chosen=null;search.value='';grams.value='';$('error').textContent='';draw();search.focus();
  },'quiet'));
  const estimate=node('p','','estimate');fields.append(estimate);
  function draw(){
    list.replaceChildren();
    items.forEach((item,index)=>{
      const row=node('div','','batch-row');row.append(node('span',item.name+' · '+fmt(item.grams)+' g'),action('Remove',()=>{items.splice(index,1);draw();},'quiet','Remove '+item.name));list.append(row);
    });
    estimate.textContent=fmt(Math.round(batchEnergy(items)))+' kcal in batch'+(positiveWeight(weight.valueAsNumber)?' · '+fmt(Math.round(batchEnergy(items)*100/weight.valueAsNumber))+' kcal per 100 g':'');
  }
  weight.oninput=draw;draw();
}
