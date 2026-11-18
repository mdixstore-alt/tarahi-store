import fs from 'node:fs';
import path from 'node:path';
const out=path.resolve('dist');
fs.rmSync(out,{recursive:true,force:true});
fs.cpSync(path.resolve('public'),out,{recursive:true});
const samples=[
['studio-oversized-tee','Studio Oversized Tee','Relaxed fit, soft feel, and an everyday silhouette.','Oversized',2390,2790,'tee-cream.svg','Oat / Off-white','BEST SELLER',24],
['after-hours-graphic-tee','After Hours Tee','A statement graphic for the hours that belong to you.','Graphics',2590,2990,'tee-black.svg','Washed black','NEW',18],
['everyday-essential-tee','Everyday Essential Tee','Your clean, dependable everyday basic.','Essentials',1890,2290,'tee-sage.svg','Sage green','',22],
['mono-type-tee','Mono Type Tee','Minimal type and maximum versatility.','Graphics',2290,2690,'tee-grey.svg','Stone grey','',16],
['sunday-club-tee','Sunday Club Tee','Made for slow mornings and good company.','Oversized',2490,2890,'tee-blue.svg','Dusty blue','LIMITED',15],
['core-relaxed-tee','Core Relaxed Tee','A wardrobe anchor with a soft structured finish.','Essentials',1990,2390,'tee-brown.svg','Cocoa brown','',27]
].map((p,i)=>({id:i+1,slug:p[0],name:p[1],description:p[2],category:p[3],price:p[4],comparePrice:p[5],image:'/assets/'+p[6],color:p[7],badge:p[8],stock:p[9],featured:true,active:true}));
fs.writeFileSync(path.join(out,'catalog-preview.json'),JSON.stringify({products:samples,settings:{live:false,shippingFee:250,freeShippingOver:5000,currency:'PKR',store:'Tarahi'}},null,2));
let app=fs.readFileSync(path.join(out,'app.js'),'utf8');
function patch(oldText,newText){if(!app.includes(oldText))throw Error('Missing source match: '+oldText);app=app.replace(oldText,newText);}
patch("const app=document.getElementById('app');","const BASE=location.hostname.endsWith('.github.io')?'/tarahi-store':'';\nconst app=document.getElementById('app');");
patch("history.pushState({},'',dest.pathname+dest.search)","history.pushState({},'',BASE+dest.pathname.replace(new RegExp('^'+BASE),'')+dest.search)");
patch("const pathname=decodeURIComponent(location.pathname);","const pathname=decodeURIComponent(location.pathname.replace(new RegExp('^'+BASE),'')||'/');");
patch("const r=await fetch('/api/catalog');","const r=await fetch(BASE+'/catalog-preview.json');");
patch("const link=e.target.closest('a[data-link]');","const link=e.target.closest('a[href^=\"/\"]');");
patch("else if(pathname==='/checkout')html=checkout();","else if(pathname==='/checkout')html=WHATSAPP_READY?checkout():`<section class=\"empty\"><span class=\"eyebrow\">TARAHI / WHATSAPP ORDERS</span><h2>WhatsApp ordering is being prepared.</h2><p>Our catalog is currently a preview. We're configuring the business WhatsApp number and real inventory before accepting orders.</p><a href=\"/shop\" data-link class=\"btn\">Continue browsing ↗</a></section>`;");
patch("else if(['/about','/size-guide','/faq','/track'].includes(pathname))html=infoPage(pathname.slice(1));","else if(['/about','/size-guide','/faq'].includes(pathname))html=infoPage(pathname.slice(1));else if(pathname==='/track')html='<section class=\"empty\"><h2>Order tracking is unavailable in preview mode.</h2><a class=\"btn\" href=\"/shop\" data-link>Browse products ↗</a></section>';");
patch("else if(pathname==='/admin')html=await loginPage();","else if(pathname==='/admin')html='<section class=\"empty\"><h2>Admin dashboard is unavailable on static hosting.</h2><p>This is a product preview. The sample listings can be changed through GitHub.</p><a class=\"btn\" href=\"/\" data-link>Back home ↗</a></section>';");
patch("app.innerHTML=html;updateCartCount();","app.innerHTML=html;document.querySelectorAll('img[src^=\"/assets/\"]').forEach(img=>img.src=BASE+img.getAttribute('src'));updateCartCount();");
patch("$('#cart-bottom').innerHTML=state.cart.length?","document.querySelectorAll('#cart-contents img[src^=\"/assets/\"]').forEach(img=>img.src=BASE+img.getAttribute('src'));$('#cart-bottom').innerHTML=state.cart.length?");

const whatsAppConfig=JSON.parse(fs.readFileSync(path.resolve('public/whatsapp-settings.json'),'utf8'));
const businessNumber=String(whatsAppConfig.businessNumber||'').replace(/[^0-9]/g,'');
const whatsappReady=Boolean(whatsAppConfig.acceptingOrders && whatsAppConfig.catalogVerified && /^\d{10,15}$/.test(businessNumber));
if(whatsAppConfig.acceptingOrders && !whatsappReady)throw Error('WhatsApp orders require a valid international business number and verified real product catalog.');
app="const WHATSAPP_NUMBER="+JSON.stringify(businessNumber)+"; const WHATSAPP_READY="+JSON.stringify(whatsappReady)+";\n"+app;
app=app.replace('Submit demo order ↗','Continue to WhatsApp ↗')
 .replace('DEMO MODE:</strong> This will create a test order only. No purchase, shipment or payment will occur.','WHATSAPP ORDER:</strong> Your order is only a request until you press Send in WhatsApp and Tarahi confirms availability and final shipping.')
 .replace('This is a demo storefront — no real orders.','You will confirm your order through WhatsApp.')
 .replace('No online payment will be charged.','Your details go to WhatsApp only when you choose to send the prepared message.')
 .replace('Demo amounts for preview only','Shipping and total are subject to Tarahi confirmation');
const startMark="if(f.id==='checkout-form'){";
const endMark="}else if(f.id==='track-form'){";
const startIdx=app.indexOf(startMark),endIdx=app.indexOf(endMark,startIdx);
if(startIdx<0||endIdx<0)throw Error('Unable to locate the checkout handler');
const handler=`if(f.id==='checkout-form'){
      if(!WHATSAPP_READY)throw Error('WhatsApp ordering is not enabled yet.');
      const lines=['Hello Tarahi! I would like to request the following items:', '',
        ...state.cart.map((item,i)=>{
          const p=product(item.id);
          return (i+1)+'. '+p.name+' / '+p.color+' / Size '+item.size+' / Qty '+item.quantity+' / '+fmt(p.price*item.quantity);
        }),
        '', 'Subtotal: '+fmt(subtotal()),
        'Estimated shipping: '+fmt(shipping()),
        'Estimated total: '+fmt(subtotal()+shipping()),
        '', 'Name: '+val('name'),
        'Phone: '+val('phone'),
        'City: '+val('city'),
        'Delivery address: '+[val('address'),val('area')].filter(Boolean).join(', '),
        'Email: '+(val('email')||'Not provided'),
        'Note: '+(val('note')||'None'),
        '', 'Payment preference: Cash on delivery (subject to confirmation)',
        'Please confirm availability, delivery charges and final order total before processing.',
        'Sent from Tarahi website'];
      const url='https://wa.me/'+WHATSAPP_NUMBER+'?text='+encodeURIComponent(lines.join('\\n'));
      const popup=window.open(url,'_blank','noopener,noreferrer');
      if(!popup)window.location.assign(url);
      toast('Press Send in WhatsApp to request your order. Tarahi will confirm it manually.');
    `;
app=app.slice(0,startIdx)+handler+app.slice(endIdx);
console.log('WhatsApp ordering configured:',whatsappReady?'enabled':'disabled until business number and verified products are supplied');

fs.writeFileSync(path.join(out,'app.js'),app);
let html=fs.readFileSync(path.join(out,'index.html'),'utf8');
html=html.replace('<head>','<head>\n  <base href="/tarahi-store/">');
html=html.replace(/(href|src)="\/(assets\/|styles\.css|app\.js)/g,'$1="/tarahi-store/$2');
if(!html.includes('href="/tarahi-store/styles.css"') || !html.includes('src="/tarahi-store/app.js"') || !html.includes('href="/tarahi-store/assets/favicon.svg"')) throw Error('GitHub Pages asset paths failed validation');
html=html.replace('A NEW KIND OF EVERYDAY · TARAHI STUDIO','PREVIEW ONLY · SAMPLE PRODUCTS · NO ORDERS ACCEPTED');
fs.writeFileSync(path.join(out,'index.html'),html);
fs.copyFileSync(path.join(out,'index.html'),path.join(out,'404.html'));
fs.writeFileSync(path.join(out,'.nojekyll'),'');
console.log('Built GitHub Pages preview; 6 sample products; no live checkout.');
