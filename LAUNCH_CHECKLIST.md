# Tarahi.store — launch readiness

Updated: 20 November 2026

This checklist covers the **GitHub Pages static preview** deployed by `.github/workflows/deploy-pages.yml`.
It is not a live checkout. The separate Node/Render server code is a different deployment option.

## Current status

- [x] Seven curated graphic-tee draft listings with Tarahi product photography.
- [x] Optimized WebP assets referenced in the store catalog.
- [x] `tarahi.store` included in the generated Pages `CNAME`.
- [x] Non-existent categories removed from static preview navigation.
- [x] Preview ordering disabled and unverified product information labelled as draft.
- [x] Deployment validator checks preview image paths and safe configuration.
- [ ] Confirm GitHub Pages **DNS check successful** and **Enforce HTTPS** enabled.
- [ ] Verify https://tarahi.store and deep links on a phone (no browser privacy warning).
- [ ] Verify selling prices, final stock per size, materials, fit, and product care.
- [ ] Publish accurate delivery fee/regions/estimated timelines and return/exchange policy.
- [ ] Confirm WhatsApp business contact, operational order handling, and fulfillment process.
- [ ] Test the order-request flow end to end before enabling it.
- [ ] Replace the temporary preview-only `noindex` setting when the store is truly ready for search traffic.

## Verify each listing

| Product | Price | Stock by size | Fabric & fit | Photos | Ready for sale |
|---|---|---|---|---|---|
| Harvest Script Tee — Midnight Navy | Pending confirmation | Pending | Pending | Uploaded | No |
| Golden Pear Graphic Tee — Heather Grey | Pending confirmation | Pending | Pending | Uploaded | No |
| Cactus Sun Graphic Tee — Midnight Navy | Pending confirmation | Pending | Pending | Uploaded | No |
| Pink Portal Graphic Tee — Heather Grey | Pending confirmation | Pending | Pending | Uploaded | No |
| Electric Mosaic Graphic Tee — Jet Black | Pending confirmation | Pending | Pending | Uploaded | No |
| Stillwater Boat Graphic Tee — Midnight Navy | Pending confirmation | Pending | Pending | Uploaded | No |
| Festival Script Graphic Tee — Midnight Navy | Pending confirmation | Pending | Pending | Uploaded | No |

The PKR prices shown in `content/tarahi-products-draft.json` are proposals only. The `stock:10` quantity generated for GitHub Pages is a visual cart-demo limit, **not real inventory**.

## Launch workflow

1. In GitHub repository Settings → Pages, ensure the custom domain is `tarahi.store` and GitHub Pages reports a successful DNS check.
2. Remove conflicting old host A/AAAA records at the DNS provider; keep the four published GitHub Pages apex A records and the `www` CNAME.
3. After HTTPS is valid, verify the public homepage, `/shop?category=Graphics`, each product gallery, mobile navigation, and preview-only checkout.
4. Record verified commercial details in `content/tarahi-products-draft.json` and ensure the published policies are accurate.
5. The static WhatsApp request flow is configured with `public/whatsapp-settings.json`, but keep `acceptingOrders` and `catalogVerified` **false** until verified products and operational ordering are ready.
6. When ready to accept orders, test a customer request and manual confirmation, and decide whether static WhatsApp inquiries are adequate or a secure hosted backend is needed for inventory and order tracking.
7. After launch, review technical SEO, search indexing, performance metrics, and privacy-conscious traffic analytics.

## Do not mistake preview functionality for live operations

GitHub Pages cannot persist store orders, manage stock, or offer a secure server-side admin dashboard. These require a deployed backend. Do not publish an order-tracking or card-payment claim on the static preview.
