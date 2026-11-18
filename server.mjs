import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'tarahi.sqlite'));
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000;');
db.exec(`CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'Essentials',
  price INTEGER NOT NULL CHECK(price>=0), compare_price INTEGER NOT NULL DEFAULT 0,
  image TEXT NOT NULL DEFAULT '', color TEXT NOT NULL DEFAULT '', badge TEXT NOT NULL DEFAULT '',
  stock INTEGER NOT NULL DEFAULT 0 CHECK(stock>=0), featured INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT, reference TEXT NOT NULL UNIQUE, customer_name TEXT NOT NULL,
  phone TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', address TEXT NOT NULL, city TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '', subtotal INTEGER NOT NULL, shipping INTEGER NOT NULL,
  total INTEGER NOT NULL, method TEXT NOT NULL DEFAULT 'cod', status TEXT NOT NULL DEFAULT 'new',
  is_demo INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL, name TEXT NOT NULL, size TEXT NOT NULL,
  quantity INTEGER NOT NULL, unit_price INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS newsletter (
  email TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`);

const examples = [
 ['studio-oversized-tee','Studio Oversized Tee','Relaxed fit, soft feel, and an everyday silhouette.','Oversized',2390,2790,'/assets/tee-cream.svg','Oat / Off-white','BEST SELLER',24],
 ['after-hours-graphic-tee','After Hours Tee','A statement graphic for the hours that belong to you.','Graphics',2590,2990,'/assets/tee-black.svg','Washed black','NEW',18],
 ['everyday-essential-tee','Everyday Essential Tee','Your clean, dependable everyday basic.','Essentials',1890,2290,'/assets/tee-sage.svg','Sage green','',22],
 ['mono-type-tee','Mono Type Tee','Minimal type and maximum versatility.','Graphics',2290,2690,'/assets/tee-grey.svg','Stone grey','',16],
 ['sunday-club-tee','Sunday Club Tee','Made for slow mornings and good company.','Oversized',2490,2890,'/assets/tee-blue.svg','Dusty blue','LIMITED',15],
 ['core-relaxed-tee','Core Relaxed Tee','A wardrobe anchor with a soft structured finish.','Essentials',1990,2390,'/assets/tee-brown.svg','Cocoa brown','',27]
];
if (db.prepare('SELECT COUNT(*) AS n FROM products').get().n === 0) {
  const stmt=db.prepare(`INSERT INTO products(slug,name,description,category,price,compare_price,image,color,badge,stock)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  for (const p of examples) stmt.run(...p);
}

const PORT = Number(process.env.PORT || 3000);
const LIVE = process.env.STORE_LIVE === 'true';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SECRET = process.env.COOKIE_SECRET || crypto.randomBytes(32).toString('hex');
const SHIPPING = Number.isFinite(Number(process.env.SHIPPING_FEE)) ? Math.max(0,Math.floor(Number(process.env.SHIPPING_FEE))) : 250;
const FREE_SHIP = Number.isFinite(Number(process.env.FREE_SHIPPING_OVER)) ? Math.max(0,Math.floor(Number(process.env.FREE_SHIPPING_OVER))) : 5000;
if (LIVE) {
  if(ADMIN_PASSWORD.length<12 || !process.env.COOKIE_SECRET || process.env.COOKIE_SECRET.length<32) throw new Error('Live store requires a strong ADMIN_PASSWORD and COOKIE_SECRET (32+ chars).');
  if(!process.env.SHIPPING_FEE || !process.env.FREE_SHIPPING_OVER || !Number.isFinite(Number(process.env.SHIPPING_FEE)) || !Number.isFinite(Number(process.env.FREE_SHIPPING_OVER))) throw new Error('Configure numeric live shipping fees explicitly before enabling orders.');
  const sampleSlugs=examples.map(p=>p[0]);
  const remaining=db.prepare(`SELECT COUNT(*) AS n FROM products WHERE active=1 AND slug IN (${sampleSlugs.map(()=>'?').join(',')})`).get(...sampleSlugs).n;
  if(remaining || !db.prepare('SELECT COUNT(*) AS n FROM products WHERE active=1').get().n) throw new Error('Remove all active sample products and publish real inventory before turning STORE_LIVE=true.');
}
const secure = process.env.NODE_ENV === 'production';
const maxBody = 64 * 1024;
const rateMap = new Map();

function rateLimit(ip, route, limit = 25, windowMs = 60_000) {
  const key = `${ip}-${route}`, now=Date.now();
  const cur=rateMap.get(key);
  if (!cur || cur.reset < now) { rateMap.set(key,{count:1,reset:now+windowMs}); return false; }
  cur.count++;
  return cur.count>limit;
}
setInterval(()=>{const now=Date.now();for(const [k,v] of rateMap)if(v.reset<now)rateMap.delete(k);},120_000).unref();
function send(res,status,data, headers={}) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});
  res.end(JSON.stringify(data));
}
function fail(res,status,message){send(res,status,{error:message});}
function clean(s, max=200){return typeof s === 'string' ? s.trim().slice(0,max):'';}
function normPhone(s){return String(s||'').replace(/[^0-9+]/g,'').replace(/^0092/,'92');}
function body(req){return new Promise((resolve,reject)=>{
  let text='';
  req.on('data',chunk=>{text+=chunk;if(text.length>maxBody){reject(new Error('Request too large'));req.destroy();}});
  req.on('end',()=>{try{resolve(JSON.parse(text||'{}'));}catch{reject(new Error('Invalid JSON'));}});
  req.on('error',reject);
});}
function checkOrigin(req){const origin=req.headers.origin;if(!origin)return true;try{
  const o=new URL(origin);return o.host===req.headers.host && ['https:','http:'].includes(o.protocol);
}catch{return false;}}
function hash(v){return crypto.createHmac('sha256',SECRET).update(v).digest('hex');}
function session(req){
  const cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('tarahi_admin='));
  if(!cookie)return false;
  const token=decodeURIComponent(cookie.split('=').slice(1).join('='));
  const parts=token.split('.');if(parts.length!==2)return false;
  const [raw,mac]=parts;const expected=hash(raw);
  if(!/^[0-9a-f]{64}$/.test(mac)||!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(mac)))return false;
  const when=Number(raw);return Number.isInteger(when)&&when<=Date.now()&&when>Date.now()-12*3600_000;
}
const cookieAttrs=`Path=/; HttpOnly; SameSite=Strict${secure?'; Secure':''}`;
function auth(req,res){if(!session(req)){fail(res,401,'Admin login required');return false;}return true;}
const productSql=`SELECT id,slug,name,description,category,price,compare_price AS comparePrice,image,color,badge,stock,featured,active FROM products`;
function products(includeInactive=false){return db.prepare(`${productSql} ${includeInactive?'':'WHERE active=1'} ORDER BY featured DESC,id ASC`).all().map(p=>({...p,active:!!p.active,featured:!!p.featured}));}
function uniqueRef(){return `${LIVE?'TRH':'DEMO'}-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;}
const statuses=['new','confirmed','packed','shipped','delivered','cancelled'];

async function api(req,res,u) {
  const route=u.pathname, method=req.method;
  if(method!=='GET' && !checkOrigin(req)) return fail(res,403,'Invalid request origin');
  if(route==='/api/health'&&method==='GET')return send(res,200,{ok:true,live:LIVE});
  if(route==='/api/catalog'&&method==='GET')return send(res,200,{products:products(),settings:{live:LIVE,shippingFee:SHIPPING,freeShippingOver:FREE_SHIP,currency:'PKR',store:'Tarahi'}});
  if(route==='/api/checkout'&&method==='POST'){
    if(rateLimit(req.socket.remoteAddress||'',route,8,600_000))return fail(res,429,'Too many checkout attempts. Try later.');
    const b=await body(req);
    const name=clean(b.name,90),phone=normPhone(b.phone),email=clean(b.email,180),city=clean(b.city,80),address=clean(b.address,280),note=clean(b.note,300);
    if(name.length<2||phone.replace(/\D/g,'').length<10||city.length<2||address.length<8)return fail(res,400,'Please enter a valid name, phone number, city and delivery address.');
    if(email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return fail(res,400,'Invalid email address.');
    if(!Array.isArray(b.items)||!b.items.length||b.items.length>30)return fail(res,400,'Cart is empty or too large.');
    const grouped=new Map();
    for(const i of b.items){
      if(!Number.isSafeInteger(i.id)||!Number.isInteger(i.quantity)||i.quantity<1||i.quantity>10||!['XS','S','M','L','XL','XXL'].includes(i.size))return fail(res,400,'Invalid cart item.');
      const key=`${i.id}:${i.size}`;grouped.set(key,{id:i.id,size:i.size,quantity:(grouped.get(key)?.quantity||0)+i.quantity});
    }
    let subtotal=0;const items=[];
    const byProduct=new Map();for(const i of grouped.values())byProduct.set(i.id,(byProduct.get(i.id)||0)+i.quantity);
    for(const i of grouped.values()){
      if(i.quantity>10)return fail(res,400,'Too many units of an item.');
      const p=db.prepare('SELECT id,name,price,stock FROM products WHERE id=? AND active=1').get(i.id);
      if(!p||p.stock<byProduct.get(i.id))return fail(res,409,'One or more items are no longer available in the requested quantity.');
      subtotal+=p.price*i.quantity; items.push({...i,name:p.name,price:p.price});
    }
    if(subtotal>3_000_000)return fail(res,400,'Order total too large.');
    const ship=FREE_SHIP>0&&subtotal>=FREE_SHIP?0:SHIPPING;
    // BEGIN IMMEDIATE ensures stock checks and decrements share the same write transaction.
    let reference;
    try{
      db.exec('BEGIN IMMEDIATE');
      for(const [id,quantity] of byProduct){let row=db.prepare('SELECT stock FROM products WHERE id=?').get(id);if(!row||row.stock<quantity)throw new Error('Stock changed. Please try again.');}
      reference=uniqueRef();
      const order=db.prepare(`INSERT INTO orders(reference,customer_name,phone,email,address,city,note,subtotal,shipping,total,is_demo)
       VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(reference,name,phone,email,address,city,note,subtotal,ship,subtotal+ship,LIVE?0:1);
      const itemStmt=db.prepare('INSERT INTO order_items(order_id,product_id,name,size,quantity,unit_price) VALUES(?,?,?,?,?,?)');
      for(const i of items){itemStmt.run(order.lastInsertRowid,i.id,i.name,i.size,i.quantity,i.price);if(LIVE)db.prepare('UPDATE products SET stock=stock-? WHERE id=?').run(i.quantity,i.id);}
      db.exec('COMMIT');
    }catch(e){try{db.exec('ROLLBACK');}catch{}return fail(res,409,e.message||'Order could not be saved');}
    return send(res,201,{reference,total:subtotal+ship,live:LIVE,message:LIVE?'Your cash-on-delivery order was recorded.':'Demo order saved locally. This is not a real purchase.'});
  }
  if(route==='/api/track'&&method==='POST'){
    if(rateLimit(req.socket.remoteAddress||'',route,15,600_000))return fail(res,429,'Try again later.');
    const b=await body(req);const ref=clean(b.reference,40),phone=normPhone(b.phone);
    const order=db.prepare('SELECT reference,status,created_at,total,is_demo,phone FROM orders WHERE reference=?').get(ref);
    if(!order || order.phone!==phone)return fail(res,404,'No matching order found.');
    delete order.phone;return send(res,200,{order});
  }
  if(route==='/api/newsletter'&&method==='POST'){
    if(!LIVE)return fail(res,403,'Newsletter is not open during the demo.');
    if(rateLimit(req.socket.remoteAddress||'',route,6,600_000))return fail(res,429,'Try again later.');
    const b=await body(req);const email=clean(b.email,180).toLowerCase();
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||b.consent!==true)return fail(res,400,'Valid email and consent required.');
    db.prepare('INSERT OR IGNORE INTO newsletter(email) VALUES(?)').run(email);return send(res,200,{ok:true});
  }
  if(route==='/api/admin/login'&&method==='POST'){
    if(rateLimit(req.socket.remoteAddress||'',route,6,900_000))return fail(res,429,'Too many login attempts.');
    if(!ADMIN_PASSWORD)return fail(res,503,'Set ADMIN_PASSWORD to enable the admin panel.');
    const b=await body(req);const pw=String(b.password||'');
    const v1=crypto.createHash('sha256').update(pw).digest(),v2=crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
    if(!crypto.timingSafeEqual(v1,v2))return fail(res,401,'Incorrect password');
    const raw=String(Date.now()),val=`${raw}.${hash(raw)}`;
    return send(res,200,{ok:true},{'Set-Cookie':`tarahi_admin=${encodeURIComponent(val)}; ${cookieAttrs}; Max-Age=43200`});
  }
  if(route==='/api/admin/logout'&&method==='POST')return send(res,200,{ok:true},{'Set-Cookie':`tarahi_admin=; ${cookieAttrs}; Max-Age=0`});
  if(route==='/api/admin/me'&&method==='GET')return send(res,200,{authenticated:session(req),live:LIVE});
  if(route==='/api/admin/overview'&&method==='GET'){
    if(!auth(req,res))return;
    const stats=db.prepare(`SELECT COUNT(*) AS orders, COALESCE(SUM(CASE WHEN is_demo=0 AND status!='cancelled' THEN total END),0) AS revenue FROM orders`).get();
    return send(res,200,{stats,orders:db.prepare(`SELECT id,reference,customer_name,city,phone,total,status,is_demo,created_at FROM orders ORDER BY id DESC LIMIT 150`).all(),products:products(true)});
  }
  if(route==='/api/admin/products'&&method==='POST'){
    if(!auth(req,res))return;
    const b=await body(req),name=clean(b.name,120),slug=clean(b.slug,120).toLowerCase();
    if(name.length<3||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||!Number.isInteger(b.price)||b.price<0||!Number.isInteger(b.stock)||b.stock<0)return fail(res,400,'Valid name, slug, price and stock required.');
    try{const r=db.prepare(`INSERT INTO products(name,slug,description,category,price,compare_price,image,color,badge,stock,active)
       VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(name,slug,clean(b.description,600),clean(b.category,60)||'Essentials',b.price,Number(b.comparePrice)||0,clean(b.image,250),clean(b.color,50),clean(b.badge,30),b.stock,b.active?1:0);return send(res,201,{id:Number(r.lastInsertRowid)});}catch{return fail(res,400,'Product slug already exists or data is invalid.');}
  }
  const productMatch=route.match(/^\/api\/admin\/products\/(\d+)$/);
  if(productMatch&&method==='PATCH'){
    if(!auth(req,res))return;
    const b=await body(req);const valid=['name','description','category','price','comparePrice','image','color','badge','stock','featured','active'];
    const map={comparePrice:'compare_price'};
    const parts=[],values=[];
    for(const k of valid){if(!(k in b))continue;
      let v=b[k];if(['price','comparePrice','stock'].includes(k)){if(!Number.isInteger(v)||v<0)return fail(res,400,`Invalid ${k}`);}else if(['active','featured'].includes(k))v=v?1:0;else v=clean(v,k==='description'?600:250);
      parts.push(`${map[k]||k}=?`);values.push(v);
    }
    if(!parts.length)return fail(res,400,'No fields to update.');values.push(Number(productMatch[1]));
    const r=db.prepare(`UPDATE products SET ${parts.join(', ')} WHERE id=?`).run(...values);return send(res,r.changes?200:404,{ok:!!r.changes});
  }
  const statusMatch=route.match(/^\/api\/admin\/orders\/(\d+)$/);
  if(statusMatch&&method==='PATCH'){
    if(!auth(req,res))return;
    const b=await body(req);if(!statuses.includes(b.status))return fail(res,400,'Invalid status');
    const r=db.prepare('UPDATE orders SET status=? WHERE id=?').run(b.status,Number(statusMatch[1]));return send(res,r.changes?200:404,{ok:!!r.changes});
  }
  return fail(res,404,'Not found');
}

const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' https: data:; script-src 'self'; style-src 'self'; connect-src 'self'; font-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  try{
    if(u.pathname.startsWith('/api/'))return await api(req,res,u);
    if(req.method!=='GET'&&req.method!=='HEAD')return fail(res,405,'Method not allowed');
    let requested=u.pathname==='/'?'/index.html':u.pathname;
    const file=path.resolve(publicDir,`.`+decodeURIComponent(requested));
    if(!file.startsWith(publicDir+path.sep)&&file!==publicDir)return fail(res,403,'Forbidden');
    let target=file;if(!fs.existsSync(target)||!fs.statSync(target).isFile())target=path.join(publicDir,'index.html');
    const ext=path.extname(target);res.writeHead(200,{'Content-Type':mime[ext]||'application/octet-stream','Cache-Control':ext==='.html'?'no-cache':'public, max-age=86400'});
    if(req.method==='HEAD')return res.end();fs.createReadStream(target).pipe(res);
  }catch(e){console.error('Request error:',e);if(!res.headersSent)fail(res,500,'Server error');else res.end();}
});
server.listen(PORT,'0.0.0.0',()=>console.log(`Tarahi ${LIVE?'LIVE':'DEMO'} store running on http://localhost:${PORT}`));
