import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tarahi-integration-'));
const port=31000+crypto.randomInt(0,10000);
const url=`http://127.0.0.1:${port}`;
const password='IntegrationTestPassword!123';
const proc=spawn(process.execPath,['server.mjs'],{
  cwd:path.resolve(import.meta.dirname,'..'),
  env:{...process.env,PORT:String(port),DATA_DIR:dir,STORE_LIVE:'false',ADMIN_PASSWORD:password,COOKIE_SECRET:'integration-test-hmac-secret-1234567890'},
  stdio:['ignore','pipe','pipe']
});
let cookie='';
async function call(endpoint,method='GET',payload){
  const res=await fetch(url+endpoint,{method,headers:{...(payload?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:payload?JSON.stringify(payload):undefined});
  let data={};try{data=await res.json();}catch{}
  return {status:res.status,data,headers:res.headers};
}
async function wait(){for(let i=0;i<70;i++){try{const x=await call('/api/health');if(x.status===200)return;}catch{}await new Promise(r=>setTimeout(r,90));}throw new Error('Server failed to start');}

test('Catalog, COD checkout, tracking, admin and validation',async()=>{
  try{
    await wait();
    const catalog=await call('/api/catalog');
    assert.equal(catalog.status,200);
    assert.equal(catalog.data.products.length,6);
    assert.equal(catalog.data.settings.live,false);
    const item=catalog.data.products[0];
    const checkout={name:'Test Buyer',phone:'03001234567',city:'Lahore',address:'House 25, Street 6, Model Town',items:[{id:item.id,size:'M',quantity:2}]};
    assert.equal((await call('/api/checkout','POST',{...checkout,phone:'short'})).status,400);
    const placed=await call('/api/checkout','POST',checkout);
    assert.equal(placed.status,201);
    assert.match(placed.data.reference,/^DEMO-\d{4}-[A-F0-9]{8}$/);
    assert.equal(placed.data.total,item.price*2+250);
    assert.equal((await call('/api/track','POST',{reference:placed.data.reference,phone:'bad'})).status,404);
    const track=await call('/api/track','POST',{reference:placed.data.reference,phone:checkout.phone});
    assert.equal(track.status,200);
    assert.equal(track.data.order.is_demo,1);
    assert.equal((await call('/api/admin/overview')).status,401);
    assert.equal((await call('/api/admin/login','POST',{password:'incorrect'})).status,401);
    const login=await call('/api/admin/login','POST',{password});
    assert.equal(login.status,200);
    cookie=login.headers.get('set-cookie')?.split(';')[0] || '';
    assert.ok(cookie.startsWith('tarahi_admin='));
    const overview=await call('/api/admin/overview');
    assert.equal(overview.status,200);
    assert.equal(overview.data.orders.length,1);
    assert.equal(overview.data.stats.revenue,0); // demo revenue must not count
    const orderId=overview.data.orders[0].id;
    assert.equal((await call(`/api/admin/orders/${orderId}`,'PATCH',{status:'shipped'})).status,200);
    const newProduct=await call('/api/admin/products','POST',{name:'Real Sample Test Tee',slug:'real-test-tee',category:'Graphics',price:3100,stock:5,active:true});
    assert.equal(newProduct.status,201);
    assert.equal((await call(`/api/admin/products/${newProduct.data.id}`,'PATCH',{stock:3,price:2900,active:false})).status,200);
    assert.equal((await call('/api/catalog')).data.products.length,6);
    assert.equal((await call('/api/newsletter','POST',{email:'test@example.org',consent:true})).status,403);
    assert.equal((await call('/api/admin/logout','POST',{})).status,200);
  }finally{
    proc.kill('SIGTERM');
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
