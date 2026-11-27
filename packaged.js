'use strict';
function gtin(text){
  let code=String(text).trim();
  if(/^https?:\/\//i.test(code)){
    try{
      const url=new URL(code);
      const gs1=url.pathname.match(/\/01\/(\d{14})(?:\/|$)/);
      const off=(url.hostname==='openfoodfacts.org'||url.hostname.endsWith('.openfoodfacts.org'))&&url.pathname.match(/\/product\/(\d+)(?:\/|$)/);
      code=gs1?.[1]||off?.[1]||'';
    }catch{return '';}
  }else code=code.replace(/[ -]/g,'');
  if(!/^(?:\d{8}|\d{12,14})$/.test(code))return '';
  const digits=[...code].reverse();
  return digits.reduce((sum,d,i)=>sum+Number(d)*(i%2?3:1),0)%10===0?code:'';
}
function readNutrient(n,key){
  const value=n[key];
  if(value==null||String(value).trim()==='')return null;
  const number=Number(value);return Number.isFinite(number)&&number>=0?number:null;
}
function productFromOFF(raw,code){
  const n=raw.nutriments||{};
  let kcal=readNutrient(n,'energy-kcal_100g');
  const kj=readNutrient(n,'energy-kj_100g')??readNutrient(n,'energy_100g');
  if(kcal===null&&kj!==null)kcal=Math.round(kj/4.184*10)/10;
  const name=[raw.product_name_en||raw.product_name,raw.brands].filter(Boolean).join(' · ').slice(0,160);
  const macros={};
  for(const nutrient of ['proteins','carbohydrates','fat']){
    const value=readNutrient(n,nutrient+'_100g');if(value!==null)macros[nutrient]=value;
  }
  return {name,code,kcal,unit:/^(ml|cl|dl|l)$/i.test(raw.product_quantity_unit)?'ml':'g',macros};
}
function checkProduct(p){
  return p && nameOK(p.name) && gtin(p.code)===p.code && !!p.code && ['g','ml'].includes(p.unit) && Number.isFinite(p.kcal)&&p.kcal>=0&&p.kcal<=1000;
}
function packageEditor(product,source){
  modal('Review product','Save food',()=>{
    const item={...product,macros:product.unit===unit.value&&product.kcal===rate.valueAsNumber?product.macros:{},name:title.value.trim(),kcal:rate.valueAsNumber,unit:unit.value};
    if(!checkProduct(item))throw Error('Check the product name and the energy per 100 g or 100 ml.');
    const amount=quantity.valueAsNumber;
    const record={id:crypto.randomUUID(),name:item.name,meal:meal.value,date:date.value,kcal:Math.round(amount*item.kcal/100),portion:{grams:amount,per100:item.kcal,unit:item.unit}};
    commit(d=>{d.products=d.products.filter(p=>p.code!==item.code);d.products.unshift(item);d.entries.push(record);});
    selectDay(record.date);notify('Product saved to your diary and saved products');
  });
  fields.append(node('p',source+' · '+product.code,'sub'));
  const title=field('Product name','text',product.name,{required:true,maxLength:160});
  fields.append(node('p','Check the values and unit against your pack. Saving remembers this label for next time.','sub'));
  const unit=field('Nutrition label basis','select',null);
  unit.replaceChildren(new Option('Per 100 g','g'),new Option('Per 100 ml','ml'));unit.value=product.unit;
  const rate=field('Energy per 100 (kcal)','number',product.kcal??'',{min:0,max:1000,step:'any',required:true});
  const quantity=field('Portion','number','',{min:0.01,max:100000,step:'any',required:true});
  const estimate=node('p','','estimate');estimate.setAttribute('aria-live','polite');fields.append(estimate);
  function update(){
    quantity.labels[0].textContent='Portion ('+unit.value+')';
    estimate.textContent=rate.value!==''&&quantity.valueAsNumber>0?fmt(Math.round(quantity.valueAsNumber*rate.valueAsNumber/100))+' kcal for this portion':'';
    if(estimate.textContent && product.unit===unit.value && product.kcal===rate.valueAsNumber){
      for(const [key,label] of [['proteins','protein'],['carbohydrates','carbs'],['fat','fat']]){
        const value=product.macros?.[key];if(Number.isFinite(value))estimate.textContent+=' · '+fmt(Math.round(value*quantity.valueAsNumber/10)/10)+' g '+label;
      }
    }
  }
  unit.onchange=rate.oninput=quantity.oninput=update;update();
  const meal=field('Meal','select','Breakfast'),date=field('Date','date',selected,{required:true});
}
function packagedFood(){
  modal('Scan a product','',null);
  const session=node('div','');fields.append(session);
  const active=()=>dialog.open&&session.isConnected;
  const status=node('p','Use the striped barcode or a product QR code. Camera images stay on this device.','sub');status.setAttribute('role','status');fields.append(status);
  const view=node('div','');view.id='pack-reader';fields.append(view);
  let reader=null,busy=false,scanning=false,received=false;
  async function stop(){
    if(reader?.isScanning){try{await reader.stop();}catch{}}
    scanning=false;
  }
  dialog.addEventListener('close',stop,{once:true});
  const camera=action('Start camera',async()=>{
    if(scanning){await stop();camera.textContent='Start camera';return;}
    if(typeof Html5Qrcode==='undefined'){status.textContent='Camera scanner unavailable. Enter the barcode below.';return;}
    camera.disabled=true;received=false;
    try{
      reader??=new Html5Qrcode(view.id);
      await reader.start({facingMode:'environment'},{fps:8},async value=>{
        if(received||!active())return;
        const batch=batchCode(value);
        if(batch){received=true;await stop();if(active())logBatch(batch);return;}
        const code=gtin(value);
        if(!code){status.textContent='This code has no recognised product number. Try the striped barcode.';return;}
        received=true;await stop();if(!active())return;
        camera.textContent='Start camera';input.value=code;await lookup();
      });
      if(!active())await stop();else {scanning=true;camera.textContent='Stop camera';}
    }catch{if(active())status.textContent='Could not start the camera. Allow camera access, use a photo or type the barcode.';}
    finally{camera.disabled=false;}
  },'quiet');
  fields.append(camera);
  const photo=field('Read barcode from a photo','file',null,{accept:'image/*'});
  photo.onchange=async()=>{
    if(!photo.files.length)return;
    try{await stop();camera.textContent='Start camera';reader??=new Html5Qrcode(view.id);
      const result=await reader.scanFile(photo.files[0],false);if(!active())return;
      const batch=batchCode(result);if(batch){logBatch(batch);return;}
      input.value=gtin(result);if(!input.value)throw Error();await lookup();
    }catch{if(active())status.textContent='No product barcode recognised. Try a clearer photo or enter the digits.';}
  };
  const input=field('Barcode number or product QR link','text','',{placeholder:'Digits beneath the barcode'});
  const manual=action('Enter label details',()=>openProduct({name:'',code:gtin(input.value),kcal:null,unit:'g'},'Your label'),'quiet');
  async function openProduct(product,source){
    if(!product.code){status.textContent='Enter a valid barcode number from the pack.';return;}
    await stop();if(active())packageEditor(product,source);
  }
  async function lookup(){
    const batch=batchCode(input.value);if(batch){await stop();if(active())logBatch(batch);return;}
    const code=gtin(input.value);
    if(!code){status.textContent='Enter a valid 8, 12, 13 or 14-digit product barcode, or a QR link containing its product number.';return;}
    if(busy)return;
    const saved=state.products?.find(p=>p.code===code);
    if(saved){await openProduct(saved,'Saved product');return;}
    busy=true;status.textContent='Looking up '+code+'…';
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
    try{
      const url='https://world.openfoodfacts.org/api/v3/product/'+code+'.json?fields=product_name_en,product_name,brands,nutriments,product_quantity_unit';
      const response=await fetch(url,{signal:controller.signal,credentials:'omit'});
      if(!active()||gtin(input.value)!==code)return;
      if(response.status===404){await openProduct({code,name:'',unit:'g',kcal:null},'Product missing · enter values from the pack');return;}
      if(!response.ok)throw Error();
      const data=await response.json();if(!active()||gtin(input.value)!==code)return;
      if(!data.product){await openProduct({code,name:'',unit:'g',kcal:null},'Product missing · enter values from the pack');return;}
      await openProduct(productFromOFF(data.product,code),'Open Food Facts');
    }catch{if(active())status.textContent='Lookup unavailable. Retry or choose Enter label details.';}
    finally{clearTimeout(timer);busy=false;}
  }
  input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();lookup();}};
  fields.append(action('Look up product',lookup,'primary'),manual);
  const link=node('a','Open Food Facts · open product data (ODbL)');link.href='https://world.openfoodfacts.org/data';link.target='_blank';link.rel='noopener';const attribution=node('p','');attribution.append(link);fields.append(attribution);
  if(state.products?.length){
    fields.append(node('h3','Saved products'));
    for(const p of state.products)fields.append(action(p.name+' · '+p.kcal+' kcal/100 '+p.unit,()=>openProduct(p,'Saved product'),'recipe-choice'));
  }
}
