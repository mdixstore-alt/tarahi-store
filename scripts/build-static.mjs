import fs from 'node:fs';
import path from 'node:path';

const BASE='/tarahi-store';
const src='public', dest='site';
fs.cpSync(src,dest,{recursive:true,force:true});

const products=[
['studio-oversized-tee','Studio Oversized Tee','Relaxed fit, soft feel, and an everyday silhouette.','Oversized',2390,2790,'tee-cream.svg','Oat / Off-white','BEST SELLER',24],
['after-hours-graphic-tee','After Hours Tee','A statement graphic for the hours that belong to you.','Graphics',2590,2990,'tee-black.svg','Washed black','NEW',18],
['everyday-essential-tee','Everyday Essential Tee','Your clean, dependable everyday basic.','Essentials',1890,2290,'tee-sage.svg','Sage green','',22],
['mono-type-tee','Mono Type Tee','Minimal type and maximum versatility.','Graphics',2290,2690,'tee-grey.svg','Stone grey','',16],
['sunday-club-tee','Sunday Club Tee','Made for slow mornings and good company.','Oversized',2490,2890,'tee-blue.svg','Dusty blue','LIMITED',15],
['core-relaxed-tee','Core Relaxed Tee','A wardrobe anchor with a soft structured finish.','Essentials',1990,2390,'tee-brown.svg','Cocoa brown','',27]
].map((p,i)=>({id:i+1,slug:p[0],name:p[1],description:p[2],category:p[3],price:p[4],comparePrice:p[5],image:BASE+'/assets/'+p[6],color:p[7],badge:p[8],stock:p[9],featured:true,active:true}));
fs.writeFileSync(path.join(dest,'catalog.json'),JSON.stringify({products,settings:{live:false,shippingFee:250,freeShippingOver:5000,currency:'PKR',store:'Tarahi'}},null,2));
const file=(name,transform)=>{let v=fs.readFileSync(path.join(dest,name),'utf8');fs.writeFileSync(path.join(dest,name),transform(v));};

file('index.html',s=>s.replace(/(src|href)="\/(?!\/)/g,'$1="'+BASE+'/')
  .replace('</head>','<meta name="robots" content="noindex, nofollow"/></head>')
  .replace('Cash on delivery · Pakistan','Preview only · no real orders'));
file('styles.css',s=>s.replace(/url\((['"]?)\/assets\//g,'url($1'+BASE+'/assets/'));
file('app.js',s=>{
  s="const BASE='/tarahi-store';\n"+s;
  s=s.replaceAll('/assets/',BASE+'/assets/');
  s=s.replaceAll('href="/','href="'+BASE+'/');
  s=s.replace('function navigate(url){const dest=new URL(url,location.href);','function navigate(url){const dest=new URL(url,location.href); if(dest.origin===location.origin&&!dest.pathname.startsWith(BASE+"/"))dest.pathname=BASE+dest.pathname;');
  s=s.replace("const pathname=decodeURIComponent(location.pathname);","const pathname=decodeURIComponent(location.pathname).replace(/^\\/tarahi-store(?=\\/|$)/,'')||'/';");
  s=s.replace("else if(pathname==='/checkout')html=checkout();","else if(pathname==='/checkout')html='<section class=\"empty\"><h2>Store preview only.</h2><p>Checkout is disabled. No orders or payments are accepted on this free preview.</p><a href=\"'+BASE+'/shop\" data-link class=\"btn\">Continue browsing ↗</a></section>';");
  s=s.replace("else if(pathname==='/admin')html=await loginPage();","else if(pathname==='/admin')html='<section class=\"empty\"><h2>Admin unavailable in static preview.</h2><p>A connected database and secure server are required before enabling inventory and order management.</p></section>';");
  s=s.replace("else if(['/about','/size-guide','/faq','/track'].includes(pathname))html=infoPage(pathname.slice(1));","else if(pathname==='/track')html='<section class=\"empty\"><h2>Order tracking unavailable.</h2><p>This free preview does not accept or store orders.</p></section>';else if(['/about','/size-guide','/faq'].includes(pathname))html=infoPage(pathname.slice(1));");
  s=s.replace("const r=await fetch('/api/catalog');if(!r.ok)throw Error('Could not load catalog');","const r=await fetch(BASE+'/catalog.json');if(!r.ok)throw Error('Could not load catalog');");
  // Safeguard all POSTs: prevent storing personal data / checkout on static hosting.
  s=s.replace("async function post(url,payload){const r=await fetch(url,","async function post(url,payload){throw Error('This is a browsing-only demo: requests and orders are disabled.');const r=await fetch(url,");
  s=s.replace("window.addEventListener('popstate',()=>render());","window.addEventListener('popstate',()=>render());");
  return s;
});
fs.copyFileSync(path.join(dest,'index.html'),path.join(dest,'404.html'));
fs.writeFileSync(path.join(dest,'.nojekyll'),'');
console.log('Built static Tarahi preview:',products.length,'example products; checkout disabled.');
