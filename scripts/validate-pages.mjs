import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve('dist');
const read = name => fs.readFileSync(path.join(out, name), 'utf8');
const catalog = JSON.parse(read('catalog-preview.json'));
const config = JSON.parse(read('whatsapp-settings.json'));
const html = read('index.html');
const products = catalog.products || [];
const problems = [];
const assert = (okay, message) => { if (!okay) problems.push(message); };
const localAsset = value => typeof value === 'string' && value.startsWith('/assets/') && !value.includes('..');
const present = value => localAsset(value) && fs.existsSync(path.join(out, value.slice(1)));

assert(products.length === 7, 'Expected seven curated preview products');
assert(catalog.settings?.live === false, 'GitHub Pages must remain a preview');
assert(config.acceptingOrders !== true || config.catalogVerified === true, 'Ordering cannot start with an unverified catalog');
assert(read('CNAME').trim() === 'tarahi.store', 'Missing tarahi.store domain configuration');
assert(html.includes('name="robots" content="noindex, nofollow"'), 'Unverified preview pages must not be indexed');
assert(!html.includes('href="/shop?category=Oversized"'), 'Empty Oversized category still linked');
assert(!html.includes('href="/shop?category=Essentials"'), 'Empty Essentials category still linked');
assert(!html.includes('id="newsletter-form"'), 'Preview must not invite newsletter submissions');
assert(html.includes('href="/delivery"') && html.includes('href="/privacy"'), 'Preview policy and privacy links missing');
assert(html.includes('class="skip-link"') && html.includes('aria-expanded="false"'), 'Accessible navigation markup missing');
assert(html.includes('property="og:image"'), 'Social sharing preview image missing');
const app = read('app.js');
assert(app.includes('related-products') && app.includes('gallery-progress'), 'Related products or gallery controls missing');
assert(app.includes('Indicative price'), 'Draft price label missing');
assert(app.includes("if(type==='delivery')") && app.includes("if(type==='privacy')"), 'Preview information pages missing');
assert(!app.includes('Join the Tarahi list ↗'), 'Inactive newsletter call to action still visible');
assert(app.includes("['All',...new Set(state.products.map(p=>p.category).filter(Boolean))]"), 'Empty categories may still appear');


const slugs = new Set();
for (const p of products) {
  assert(typeof p.slug === 'string' && !slugs.has(p.slug), 'Duplicate or missing product slug');
  slugs.add(p.slug);
  assert(p.category === 'Graphics', `Unexpected category for ${p.slug}`);
  assert(p.catalogDraft === true, `Preview status absent for ${p.slug}`);
  assert(present(p.image), `Missing catalog photo: ${p.slug}`);
  assert(p.photoVerified === true, `Photo not verified for ${p.slug}`);
  assert(Array.isArray(p.images) && p.images.length >= 1, `Missing gallery for ${p.slug}`);
  for (const image of p.images || []) {
    assert(present(image), `Missing gallery asset for ${p.slug}: ${image}`);
  }
}

if (problems.length) {
  console.error('Tarahi preview validation failed:\n' + problems.map(p => '- ' + p).join('\n'));
  process.exit(1);
}
console.log(`Tarahi preview validated: ${products.length} draft items, image galleries, routes and domain settings.`);
