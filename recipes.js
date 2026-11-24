// Weights are per serving and match the preparation in the CoFID food name.
const recipeBook = [
  {name:'Banana and peanut porridge', meal:'Breakfast', minutes:10, ingredients:[
    ['Porridge oats, unfortified',50,'Dry porridge oats'],['Milk, semi-skimmed, pasteurised, average',180,'Semi-skimmed milk'],['Bananas, flesh only',80,'Peeled banana'],['Peanut butter, smooth',15,'Smooth peanut butter']],
    steps:['Simmer the oats and milk in a small pan for 5–7 minutes, stirring. Add a splash of water for a looser texture.','Stir in the peanut butter and top with sliced banana.']},
  {name:'Spinach scramble on toast', meal:'Breakfast', minutes:12, ingredients:[
    ['Eggs, chicken, whole, raw',100,'Egg, weighed without shell'],['Spinach, baby, raw',50,'Baby spinach'],['Bread, wholemeal, average',70,'Wholemeal bread, weighed before toasting'],['Oil, olive',4,'Olive oil']],
    steps:['Toast the bread. Heat the oil in a pan and wilt the spinach.','Beat the eggs, pour them into the pan and stir gently until set. Spoon over the toast.']},
  {name:'Tomato and tuna spaghetti', meal:'Lunch', minutes:20, ingredients:[
    ['Pasta, wholewheat, spaghetti, dried, boiled in unsalted water',170,'Cooked wholewheat spaghetti'],['Tuna, canned in brine, drained',80,'Tinned tuna, drained'],['Tomatoes, canned, whole contents',140,'Tinned tomatoes with juice'],['Garlic, raw',4,'Garlic'],['Oil, olive',5,'Olive oil']],
    steps:['Cook the spaghetti according to the packet and weigh the cooked portion.','Soften the chopped garlic in the oil. Add the tomatoes, break them up and simmer for 8 minutes. Stir in the tuna, heat through and toss with the spaghetti.']},
  {name:'Warm chickpea couscous', meal:'Lunch', minutes:15, ingredients:[
    ['Couscous, plain, raw',55,'Dry couscous'],['Beans, chick peas, canned, re-heated, drained',100,'Tinned chickpeas, drained'],['Spinach, baby, raw',40,'Baby spinach'],['Tomatoes, canned, whole contents',100,'Tinned tomatoes with juice'],['Oil, olive',5,'Olive oil']],
    steps:['Prepare the couscous with boiling water according to the packet.','Warm the oil, chickpeas and tomatoes in a pan. Stir in the spinach until wilted, then fold through the fluffed couscous.']},
  {name:'Ghanaian-inspired black-eyed bean stew', meal:'Dinner', minutes:25, ingredients:[
    ['Beans, blackeye, whole, dried, boiled in unsalted water',180,'Cooked black-eyed beans, drained'],['Tomatoes, canned, whole contents',180,'Tinned tomatoes with juice'],['Onions, raw',60,'Onion'],['Oil, olive',8,'Olive oil'],['Peppers, capsicum, chilli, red, raw',4,'Fresh red chilli'],['Rice, white, basmati, boiled in unsalted water',130,'Cooked basmati rice']],
    steps:['Slice the onion and soften in the oil for 5 minutes. Chop the chilli and stir it in with the tomatoes.','Crush the tomatoes with a spoon and simmer for 10 minutes. Add the cooked beans and a splash of water. Simmer for 5 minutes and serve with hot rice.']},
  {name:'Chicken and pepper rice bowl', meal:'Dinner', minutes:15, ingredients:[
    ['Chicken, breast, grilled without skin, meat only',120,'Cooked skinless grilled chicken breast'],['Rice, brown, wholegrain, boiled in unsalted water',160,'Cooked brown rice'],['Peppers, capsicum, green, raw',90,'Green pepper'],['Oil, olive',5,'Olive oil'],['Garlic, raw',4,'Garlic']],
    steps:['Slice the pepper and fry in the oil for 5–7 minutes. Add the chopped garlic and stir for a minute.','Slice the cooked chicken. Add it to the pan with the cooked rice and a splash of water. Stir until steaming hot throughout.']},
  {name:'Mango yoghurt bowl', meal:'Snacks', minutes:5, ingredients:[
    ['Mangoes, ripe, flesh only, raw',100,'Peeled ripe mango'],['Yogurt, Greek style, plain',100,'Plain Greek-style yoghurt']],
    steps:['Dice the mango. Mash half with a fork and swirl through the yoghurt. Finish with the remaining fruit.']},
  {name:'Apple and peanut butter toast', meal:'Snacks', minutes:5, ingredients:[
    ['Bread, wholemeal, average',40,'Wholemeal bread, weighed before toasting'],['Peanut butter, smooth',12,'Smooth peanut butter'],['Apples, eating, raw, flesh and skin',60,'Apple, cored']],
    steps:['Toast the bread and spread with peanut butter. Thinly slice the apple and arrange on top.']}
];
const recipeEnergy=new Map(typeof dayplateFoods==='undefined'?[]:dayplateFoods);
function servingCalories(recipe){
  return recipe.ingredients.reduce((sum,[food,grams])=>sum+recipeEnergy.get(food)*grams/100,0);
}
function renderRecipes(total){
  if(!recipeEnergy.size){$('recipe-context').textContent='Refresh to load recipe nutrition data.';return;}
  const filter=$('recipe-meal').value;
  const options=recipeBook.filter(r=>filter==='All meals'||r.meal===filter);
  const left=state.goal===null?null:state.goal-total;
  const fits=r=>Math.round(servingCalories(r))<=left;
  if(left!==null) options.sort((a,b)=>Number(fits(b))-Number(fits(a)));
  $('recipe-context').textContent=left===null?'Choose a recipe to see ingredients and log a portion.':
    (options.some(fits)?'Ideas within your remaining '+fmt(left)+' kcal appear first.':'Showing all matching ideas. A full serving of each exceeds the calories remaining for this day.');
  const list=$('recipe-list');list.replaceChildren();
  for(const recipe of options){
    const button=action('',()=>openRecipe(recipe),'recipe-choice');
    button.append(node('b',recipe.name),node('small',recipe.meal+' · '+recipe.minutes+' min · '+Math.round(servingCalories(recipe))+' kcal per serving'));list.append(button);
  }
}
function openRecipe(recipe){
  const energy=servingCalories(recipe);
  modal(recipe.name,'Log recipe',()=>{
    const quantity=servings.valueAsNumber;
    if(!(quantity>0) || !Number.isFinite(quantity)) throw Error('Enter the number of servings you ate.');
    const record={id:crypto.randomUUID(),name:recipe.name+' ('+fmt(quantity)+(quantity===1?' serving)':' servings)'),meal:meal.value,date:date.value,kcal:Math.round(energy*quantity)};
    commit(d=>d.entries.push(record));selectDay(record.date);notify('Recipe logged');
  });
  fields.append(node('p',recipe.minutes+' minutes · '+Math.round(energy)+' kcal per serving','estimate'),node('h3','Ingredients for one serving'));
  const ingredients=node('ul','');
  recipe.ingredients.forEach(([,grams,label])=>ingredients.append(node('li',grams+' g '+label)));
  fields.append(ingredients,node('h3','Method'));
  const method=node('ol','');recipe.steps.forEach(step=>method.append(node('li',step)));fields.append(method);
  const servings=field('Servings eaten','number','1',{min:0.01,max:50,step:'any',required:true,inputMode:'decimal'});
  const estimate=node('p','','estimate');estimate.setAttribute('aria-live','polite');
  servings.oninput=()=>{estimate.textContent=servings.validity.valid?fmt(Math.round(energy*servings.valueAsNumber))+' kcal to log':'';};servings.oninput();fields.append(estimate);
  const meal=field('Meal','select',recipe.meal),date=field('Date','date',selected,{required:true});
}
