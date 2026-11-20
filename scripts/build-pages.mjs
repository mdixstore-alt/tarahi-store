import fs from 'node:fs';
import path from 'node:path';
const out=path.resolve('dist');
fs.rmSync(out,{recursive:true,force:true});
fs.cpSync(path.resolve('public'),out,{recursive:true});
// The initial catalog is explicitly provisional. It shows user-authorized draft
// names and prices using illustrations until product-photos/ contains actual photos.
const sourceDrafts=JSON.parse(fs.readFileSync(path.resolve('content/tarahi-products-draft.json'),'utf8')).drafts;
if(!Array.isArray(sourceDrafts)||!sourceDrafts.length)throw Error('No Tarahi draft products found.');
const placeholderArt=['tee-grey.svg','tee-grey.svg','tee-blue.svg','tee-blue.svg','tee-black.svg','tee-sage.svg'];
const samples=sourceDrafts.map((p,i)=>({
  id:i+1,
  slug:p.slug,
  name:p.name,
  description:(p.description||'Tarahi T-shirt design.')+' Price, fabric and stock are provisional until confirmed.',
  category:p.category||'Graphics',
  price:Number(p.price)||2490,
  comparePrice:0,
  image:(p.image&&fs.existsSync(path.join(out,p.image.replace(/^\//,''))))?p.image:'/assets/'+placeholderArt[i%placeholderArt.length],
  images:(Array.isArray(p.images)?p.images:[]).filter(v=>typeof v==='string'&&v.startsWith('/assets/')&&fs.existsSync(path.join(out,v.replace(/^\//,'')))),
  details:Array.isArray(p.details)?p.details:[],
  photoVerified:p.photoVerified===true,
  color:p.color||'As pictured',
  badge:p.badge||'DRAFT',
  stock:10, // Cart interaction only; not actual inventory. Orders are disabled.
  featured:true,
  active:true,
  catalogDraft:true
}));
fs.writeFileSync(path.join(out,'catalog-preview.json'),JSON.stringify({
  products:samples,
  settings:{live:false,shippingFee:250,freeShippingOver:5000,currency:'PKR',store:'Tarahi'},
  catalogNotice:'All '+samples.filter(p=>p.photoVerified).length+' product listings show optimized original Tarahi photography. Names, prices and stock are provisional. WhatsApp ordering is disabled.'
},null,2));

let app=fs.readFileSync(path.join(out,'app.js'),'utf8');
function patch(oldText,newText){if(!app.includes(oldText))throw Error('Missing source match: '+oldText);app=app.replace(oldText,newText);}
patch("const app=document.getElementById('app');","const BASE=location.hostname.endsWith('.github.io')?'/tarahi-store':'';\nconst app=document.getElementById('app');");
patch("history.pushState({},'',dest.pathname+dest.search)","history.pushState({},'',BASE+dest.pathname.replace(new RegExp('^'+BASE),'')+dest.search)");
patch("const pathname=decodeURIComponent(location.pathname);","const pathname=decodeURIComponent(location.pathname.replace(new RegExp('^'+BASE),'')||'/');");
patch("const r=await fetch('/api/catalog');","const r=await fetch(BASE+'/catalog-preview.json');");
patch("const link=e.target.closest('a[data-link]');","const link=e.target.closest('a[href^=\"/\"]');");
patch("else if(pathname==='/checkout')html=checkout();","else if(pathname==='/checkout')html=whatsappCheckout();");
patch("else if(['/about','/size-guide','/faq','/track'].includes(pathname))html=infoPage(pathname.slice(1));","else if(['/about','/size-guide','/faq'].includes(pathname))html=infoPage(pathname.slice(1));else if(pathname==='/track')html='<section class=\"empty\"><h2>Order tracking is unavailable in preview mode.</h2><a class=\"btn\" href=\"/shop\" data-link>Browse products ↗</a></section>';");
patch("else if(pathname==='/admin')html=await loginPage();","else if(pathname==='/admin')html='<section class=\"empty\"><h2>Admin dashboard is unavailable on static hosting.</h2><p>This is a product preview. The sample listings can be changed through GitHub.</p><a class=\"btn\" href=\"/\" data-link>Back home ↗</a></section>';");
patch("app.innerHTML=html;updateCartCount();","app.innerHTML=html;document.querySelectorAll('img[src^=\"/assets/\"]').forEach(img=>img.src=BASE+img.getAttribute('src'));if(pathname==='/checkout')waRefreshPreview();updateCartCount();");
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

patch("state.settings=j.settings;$('#demo-banner').hidden=!!j.settings.live;","state.settings=j.settings;await loadWhatsAppConfig();$('#demo-banner').hidden=!!j.settings.live;");
const addon=fs.readFileSync('scripts/whatsapp-checkout-addon.js','utf8');
if(!/\nstart\(\);\s*$/.test(app))throw Error('Missing application entry point');
app=app.replace(/\nstart\(\);\s*$/,'\n'+addon+'\nstart();\n');
if(!app.includes('function whatsappCheckout()')||!app.includes('await loadWhatsAppConfig()'))throw Error('WhatsApp build validation failed');
const waConfig=JSON.parse(fs.readFileSync(path.join(out,'whatsapp-settings.json'),'utf8'));
if(waConfig.acceptingOrders && (!waConfig.catalogVerified||!(/^[1-9][0-9]{7,14}$/).test(waConfig.businessNumber||'')))throw Error('WhatsApp orders cannot be enabled without verified products and an international business phone');
// Keep category navigation aligned with the actual curated catalog.
patch("['All','Oversized','Essentials','Graphics'].map(c=>", "['All',...new Set(state.products.map(p=>p.category).filter(Boolean))].map(c=>");
// Featured collection should show a photographed product from the current graphic edit.
patch('<div class="collection-art"><img loading="lazy" src="/assets/tee-black.svg" alt="Tarahi After Hours oversized tee" /></div>', '<div class="collection-art"><img loading="lazy" decoding="async" src="/assets/products/electric-mosaic-tee/front.webp" alt="Electric Mosaic graphic tee by Tarahi" /></div>');
patch('THE OVERSIZED EDIT', 'THE GRAPHIC EDIT');
patch('Room to<br/>be yourself.', 'Made to<br/>stand out.');
patch('Laid-back proportions, effortless styling. The pieces you reach for without a second thought.', 'Original artwork, everyday silhouettes. Find a graphic that feels like you.');
patch('href="/shop?category=Oversized" data-link>Discover oversized ↗', 'href="/shop?category=Graphics" data-link>Explore graphics ↗');
// Preview-only FAQ: no claims that photos are mockups or orders are being placed.
patch('Not yet. This is a demonstration website. Orders placed here are marked as demo and will not be fulfilled until the store is activated.', 'Not yet. This is a product preview. Orders cannot be submitted while prices and stock are being verified.');
patch('The planned checkout supports cash on delivery in Pakistan. It will be enabled for real orders after operational details are confirmed.', 'Cash on delivery is planned. Availability and final terms will be confirmed before ordering opens.');
patch('No. Product images are illustrative mockups, not photographs of real inventory.', 'The seven listings use Tarahi product photographs. Prices, materials and stock availability are still provisional.');
fs.writeFileSync(path.join(out,'app.js'),app);
let html=fs.readFileSync(path.join(out,'index.html'),'utf8');
// Resolve the public asset base at runtime. GitHub Pages project previews use
// /tarahi-store/; the custom tarahi.store domain serves these files from /.
html=html.replace('<head>','<head>\n  <script>const baseEl=document.createElement("base");baseEl.href=location.hostname.endsWith(".github.io")?"/tarahi-store/":"/";document.head.appendChild(baseEl);</script>');
html=html.replace(/(href|src)="\/(assets\/|styles\.css|app\.js)/g,'$1="$2');
if(!html.includes('href="styles.css"') || !html.includes('src="app.js"') || !html.includes('href="assets/favicon.svg"')) throw Error('Storefront asset paths failed validation');
html=html.replace('A NEW KIND OF EVERYDAY · TARAHI STUDIO','PREVIEW ONLY · DRAFT CATALOG · NO ORDERS ACCEPTED');
// Avoid promoting empty categories and features unavailable on static GitHub Pages.
html=html.replace(/<a href="\/shop\?category=(?:Oversized|Essentials)" data-link>[^<]*<\/a>/g,'');
html=html.replace(/<a href="\/track" data-link>Track your order<\/a>/g,'');
html=html.replace('<a href="/admin" data-link>Store admin</a>','');
if(!html.includes('<form id="newsletter-form">'))throw Error('Missing preview newsletter form');
html=html.replace(/<form id="newsletter-form">[\s\S]*?<\/form>/, '<p class="muted">Signups will open when Tarahi launches. This preview does not collect email addresses.</p>');
html=html.replace('Sample products and prices are for demonstration only. Orders are not fulfilled.', 'Seven photographed products. Prices and stock remain unverified; orders are not open.');
html=html.replace('Tarahi. Thoughtfully designed tees and everyday clothing. Explore the collection.', 'Explore seven original Tarahi graphic T-shirt designs. This is a preview; prices and stock are provisional.');
// Avoid indexing unfinished prices, policies, and unavailable checkout pages.
html=html.replace('<meta name="theme-color"', '<meta name="robots" content="noindex, nofollow" />\n  <meta name="theme-color"');
fs.writeFileSync(path.join(out,'index.html'),html);
fs.copyFileSync(path.join(out,'index.html'),path.join(out,'404.html'));
fs.writeFileSync(path.join(out,'.nojekyll'),'');
// Publish the custom domain with each GitHub Pages artifact.
fs.writeFileSync(path.join(out,'CNAME'),'tarahi.store\n');
console.log('Built GitHub Pages preview; '+samples.length+' draft products; '+samples.filter(p=>p.photoVerified).length+' with real photos; no live checkout.');
