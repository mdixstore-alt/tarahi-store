/**
 * Tarahi photo importer (local/offline). Converts raw ZIP or folder of photos
 * into a compact WebP image set and a *draft* review manifest.
 *
 * Usage:
 *   npm install --no-save sharp@0.34.4
 *   node scripts/optimize-product-photos.mjs "/path/to/Tarahi a.zip"
 *
 * Does not activate sales or change the live product catalog.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const target=path.join(root,'public/assets/tarahi-products');
const input=process.argv[2];
if(!input)throw Error('Supply a ZIP file or folder of product photos.');
const stat=await fs.stat(input);
let source=input,tmp;
if(stat.isFile() && input.toLowerCase().endsWith('.zip')){
  tmp=await fs.mkdtemp(path.join(os.tmpdir(),'tarahi-import-'));
  const process=spawnSync('unzip',['-q','-o',path.resolve(input),'-d',tmp],{stdio:'inherit'});
  if(process.status!==0)throw Error('Archive extraction failed. Install unzip, or extract the ZIP first and pass its folder.');
  source=tmp;
}else if(!stat.isDirectory())throw Error('Input must be a ZIP or a directory.');
const allowed=/\.(jpe?g|png|webp|avif|tiff?)$/i;
const imagePaths=[];
async function visit(dir){
  const entries=await fs.readdir(dir,{withFileTypes:true});
  for(const entry of entries){
    if(entry.name.startsWith('.')||entry.name==='__MACOSX')continue;
    const filename=path.join(dir,entry.name);
    if(entry.isDirectory())await visit(filename);
    else if(entry.isFile()&&allowed.test(entry.name))imagePaths.push(filename);
    if(imagePaths.length>1200)throw Error('Archive contains too many photos; limit is 1,200.');
  }
}
await visit(source);
imagePaths.sort((a,b)=>a.localeCompare(b));
if(!imagePaths.length)throw Error('No JPEG, PNG, WebP, AVIF, or TIFF images in source archive.');
await fs.mkdir(target,{recursive:true});
const manifest=[];
const seen=new Set();
for(const [index,filename] of imagePaths.entries()){
  const raw=await fs.readFile(filename);
  const digest=crypto.createHash('sha256').update(raw).digest('hex').slice(0,12);
  if(seen.has(digest))continue;
  seen.add(digest);
  const serial=String(index+1).padStart(3,'0');
  const basename='tarahi-'+serial+'-'+digest;
  const photo=sharp(raw,{failOn:'none',limitInputPixels:100_000_000}).rotate().toColorspace('srgb');
  const meta=await photo.metadata();
  const output=[];
  for(const [variant,width,quality] of [['card',520,74],['detail',1300,80]]){
    const file=basename+'-'+variant+'.webp';
    await sharp(raw,{failOn:'none',limitInputPixels:100_000_000})
      .rotate().flatten({background:'#f7f5f1'}).resize({width,withoutEnlargement:true})
      .webp({quality,effort:5}).toFile(path.join(target,file));
    output.push({variant,url:'/assets/tarahi-products/'+file});
  }
  manifest.push({
    id:serial,
    source:path.relative(source,filename).replaceAll(path.sep,'/'),
    originalBytes:raw.length,
    width:meta.width,
    height:meta.height,
    card:output[0].url,
    detail:output[1].url,
    draftName:'Tarahi Graphic Tee '+serial,
    draftPricePKR:2490,
    sizes:['S','M','L','XL'],
    catalogStatus:'DRAFT - not offered for sale'
  });
}
const manifestFile=path.join(target,'review-manifest.json');
await fs.writeFile(manifestFile,JSON.stringify({generatedAt:new Date().toISOString(),sourceImageCount:imagePaths.length,uniqueImageCount:manifest.length,images:manifest},null,2)+'\n');
const oldBytes=manifest.reduce((n,x)=>n+x.originalBytes,0);
const optimizedNames=(await fs.readdir(target)).filter(x=>/-card\.webp$|-detail\.webp$/.test(x));
const optimizedStats=await Promise.all(optimizedNames.map(x=>fs.stat(path.join(target,x))));
const newBytes=optimizedStats.reduce((n,x)=>n+x.size,0);
console.log(JSON.stringify({originalPhotos:imagePaths.length,uniquePhotos:manifest.length,oldMB:Number((oldBytes/1048576).toFixed(2)),optimizedMB:Number((newBytes/1048576).toFixed(2)),manifest:path.relative(root,manifestFile)},null,2));
if(tmp)await fs.rm(tmp,{recursive:true,force:true});
