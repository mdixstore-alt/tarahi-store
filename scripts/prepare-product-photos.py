#!/usr/bin/env python3
"""Convert uploaded Tarahi product photos into small, metadata-free WebP product images.

Source: product-photos/ (jpg, jpeg, png or webp). One folder = one product.
When photos exist, replace the generated static preview catalog with draft listings.
Real sales remain disabled via public/whatsapp-settings.json.
"""
import json
import re
from pathlib import Path
from collections import defaultdict
from PIL import Image, ImageOps

ROOT = Path("product-photos")
DIST = Path("dist")
OUTPUT = DIST / "assets" / "products"
CATALOG = DIST / "catalog-preview.json"
DRAFTS = Path("content/tarahi-products-draft.json")
SUPPORTED = {".jpg", ".jpeg", ".png", ".webp"}
MAX_PRODUCTS = 30

def slugify(s):
    text = re.sub(r"[^a-z0-9]+", "-", str(s).lower()).strip("-")
    return text[:65].strip("-") or "tarahi-tee"

def readable(name):
    value = re.sub(r"[_-]+", " ", name).strip()
    if len(value) < 4 or re.fullmatch(r"(?:img|dsc|image|photo)?[0-9\s]+", value, re.I):
        return ""
    return value.title()[:80]

def photo_groups():
    result = defaultdict(list)
    if not ROOT.exists():
        return result
    for f in sorted(ROOT.rglob("*")):
        if not f.is_file() or f.suffix.lower() not in SUPPORTED:
            continue
        rel = f.relative_to(ROOT)
        if len(rel.parts) > 1:
            group_name = str(rel.parts[0])
        else:
            group_name = re.sub(r"(?i)(?:[-_\s](?:front|back|side|detail|closeup|main|cover|[0-9]{1,2}))+?$", "", f.stem)
        result[group_name or f.stem].append(f)
    return result

def optimize(source, target):
    with Image.open(source) as original:
        original = ImageOps.exif_transpose(original)
        original.thumbnail((900, 1200), Image.Resampling.LANCZOS)
        if original.mode in ("RGBA", "LA") or "transparency" in original.info:
            rgba = original.convert("RGBA")
            canvas = Image.new("RGB", rgba.size, "#f7f5f0")
            canvas.paste(rgba, mask=rgba.getchannel("A"))
            img = canvas
        else:
            img = original.convert("RGB")
        img.save(target, format="WEBP", quality=79, method=6)
        return {"width": img.width, "height": img.height, "bytes": target.stat().st_size}

def main():
    groups = photo_groups()
    if not groups:
        print("No product-photos uploaded; keeping existing demo illustrations.")
        return
    OUTPUT.mkdir(parents=True, exist_ok=True)
    draft_data = json.loads(DRAFTS.read_text(encoding="utf-8"))
    draft_list = draft_data.get("drafts", [])
    products = []
    used_slugs = set()
    for i, (group_name, photos) in enumerate(sorted(groups.items())[:MAX_PRODUCTS]):
        draft = draft_list[i % len(draft_list)] if draft_list else {}
        candidate = readable(group_name)
        name = candidate if candidate else draft.get("name", f"Tarahi Graphic Tee {i+1:02d}")
        # Never claim an inferred label or price is confirmed.
        name = name[:90]
        slug = slugify(name)
        if slug in used_slugs:
            slug += f"-{i+1}"
        used_slugs.add(slug)
        main_photo = sorted(photos, key=lambda p:(0 if any(t in p.stem.lower() for t in ["front", "main", "cover"]) else 1, p.name))[0]
        dest = OUTPUT / f"{slug}.webp"
        try:
            photo_meta = optimize(main_photo, dest)
        except Exception as e:
            print(f"Skipping unreadable image {main_photo}: {e}")
            continue
        price = int(draft.get("price") or 2490)
        products.append({
            "id": len(products)+1,
            "slug": slug,
            "name": name,
            "description": "Tarahi T-shirt from our photo archive. Design name, price and stock shown here are provisional.",
            "category": "Graphics",
            "price": price,
            "comparePrice": 0,
            "image": "/assets/products/"+dest.name,
            "color": draft.get("color") or "As pictured",
            "badge": "PREVIEW",
            "stock": 10,
            "featured": True,
            "active": True,
            "catalogDraft": True
        })
        print(f"Optimized {main_photo}: {photo_meta['width']}x{photo_meta['height']}, {photo_meta['bytes']//1024} KB")
    if not products:
        print("No readable product images; keeping demo catalog.")
        return
    data=json.loads(CATALOG.read_text(encoding="utf-8"))
    data["products"]=products
    data["settings"]["live"]=False
    data["catalogNotice"]="Product names, prices, colors and stock are unverified preview estimates. Do not accept orders."
    CATALOG.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"Generated {len(products)} draft product listings with optimized photographs.")

if __name__=="__main__":
    main()
