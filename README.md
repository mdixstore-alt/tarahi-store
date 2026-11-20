# Tarahi — Independent online store

> **GitHub Pages preview (November 2026):** The live Pages workflow publishes seven
> curated Tarahi graphic-tee drafts with optimized product photographs from
> `content/tarahi-products-draft.json`. The `/shop` and product pages are previews;
> prices, stock and fabric details are provisional, and ordering is disabled.
> Static GitHub Pages does not run the Node checkout, inventory database, admin
> dashboard or order tracking described below. Those belong to the separate
> Node server if deployed to a compatible host.
>
> See [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) before accepting any customers.
> The Pages workflow now preserves the curated catalog and validates the product
> assets instead of regenerating anonymous listings.

A fully coded, mobile-friendly e-commerce MVP for **tarahi.store**, inspired by the clean presentation and useful shopping flows of MDIX, but branded and styled independently for Tarahi tees. It does **not** alter the MDIX codebase, database or website.

## Included

- Editorial homepage and original T-shirt SVG illustrations
- Catalog with categories, search and price sorting
- Product detail pages, size options, cart drawer, persistent browser cart
- Cash-on-delivery checkout with **server-side pricing, stock validation and SQLite order storage**
- Order reference and private lookup using the matching phone number
- Password-protected `/admin` dashboard for products, prices, stock, visibility and order statuses
- Newsletter opt-in endpoint (only enabled once the store is live)
- Basic protections: input validation, HTML escaping, same-site admin cookie, HMAC-signed session, request-rate limits, origin checks and CSP
- No third-party runtime dependencies

### This is a demo until you provide real stock and business policies

The six included T-shirts, their prices, inventory, descriptions and mockup images are **fabricated illustrative samples**, not Tarahi inventory. With `STORE_LIVE=false` (the default):

- Each page displays a prominent **STORE PREVIEW** banner.
- Checkout creates a `DEMO-...` test order only, with no actual payment, shipment, confirmation SMS or operational fulfillment.
- Demo orders are stored locally for testing, and do not reduce stock.
- Newsletter signup is not enabled.

Do **not** point public buyers to this preview as a live store without replacing the catalog and completing the launch checklist. Cash on delivery is the only payment method supported; there is no credit card or online payment integration.

## Local setup

1. Install **Node.js 22.13 or newer**.
2. From this folder, run `npm start` (no `npm install` necessary; there are no dependencies).
3. Open `http://localhost:3000` in your browser. The storefront works in demo mode without secrets.
4. To enable the admin panel locally, set `ADMIN_PASSWORD` and `COOKIE_SECRET` as environment variables (or load them from your own `.env` tool). The Node server does **not** automatically load a `.env` file.
5. Open `http://localhost:3000/admin`. Avoid using an easily guessed password.

**Examples** (macOS/Linux):

```bash
ADMIN_PASSWORD='use-a-unique-long-password' COOKIE_SECRET='use-32-or-more-random-characters-here' npm start
```

The SQLite database is stored at `DATA_DIR/tarahi.sqlite` (`./data` by default). Back up this directory regularly when live. Do not expose it to the web or commit it to Git.

## Admin guide

- Go to `/admin`, sign in using `ADMIN_PASSWORD`.
- Create actual Tarahi listings using names, slugs, real PKR prices and real stock quantities.
- Set **image** to a locally hosted `/assets/file.webp` or a securely hosted HTTPS image URL. To use local images, place them in `public/assets/` before redeploying. The admin does not yet include an image uploader.
- Unpublish all six example listings by unchecking **Active** for each product. You can keep them hidden for reference.
- Monitor orders and change their statuses in the dashboard. There is no built-in courier label/SMS integration.

Stock is managed at a **product total** level, not independently for each size; edit this if you require variant-specific stock. Test the checkout, size offerings, pricing and delivery rules before accepting customers.

## Live launch requirements

Before changing `STORE_LIVE=true`:

1. Replace all six **sample products**, images, stock numbers, prices, descriptions and brand copy. Hide all sample listings. Publish at least one real product.
2. Verify each garment's size chart. Publish real shipping, delivery timeframe, privacy, returns and exchange terms. Adjust site copy to match.
3. Configure `ADMIN_PASSWORD` (12+ characters), `COOKIE_SECRET` (32+ random characters), `SHIPPING_FEE` and `FREE_SHIPPING_OVER`. Verify the sample `250` and `5000` amounts are **not automatically your real policies**.
4. Arrange COD fulfillment, courier processes, order notifications and customer support. Currently, orders appear only in `/admin`; this code does not send SMS, WhatsApp or email.
5. Install persistent storage; backups are your responsibility. Do not deploy SQLite on an ephemeral filesystem.
6. Set up HTTPS, custom domain DNS and monitoring. Confirm a complete order on staging before making the website public.
7. Review operational security and Pakistan-specific consumer/privacy/commerce obligations with a qualified professional as appropriate.

The server **refuses to start in live mode** if its security variables are weak/missing, shipping values are not explicitly set, or any sample listing is active. Live order references start with `TRH-`; demo references start with `DEMO-`.

## Deploying to Render

`render.yaml` is an optional Blueprint for a **new, separate service**, with Node 22, a persistent 1 GB disk, basic health check and demo mode. It uses a **paid starter instance/disk** by default; review Render's current pricing before creating it. This is not deployed automatically.

1. Create a **new Tarahi GitHub repository** (do not copy into the MDIX repository). Push these files without `data/` contents or secret credentials.
2. In your selected Render workspace, create a new Blueprint from that repository, or create a Node web service with a persistent disk; populate the `ADMIN_PASSWORD` secret.
3. Verify the preview at Render's generated URL.
4. After the live launch checklist is complete, set `STORE_LIVE=true` and redeploy.
5. In Render, attach the custom domain `tarahi.store` (and optionally `www.tarahi.store`) and follow the **exact Render DNS records** shown for your new service. Then update the domain records at your DNS registrar/Hostinger. Do not point Tarahi to MDIX's deployment.
6. Confirm HTTPS, catalog, admin login, checkout, order lookup and the email/phone shown on test orders.

**Important:** I cannot change tarahi.store's existing Hostinger/Zyro placeholder or DNS without the owner's hosting/domain access and the selected deployment workspace.

## Architecture and limitations

- Node.js HTTP server + built-in `node:sqlite` — no ORM, no package manager dependencies
- Plain JavaScript SPA using browser History API. Functional direct routes on the server, but for production-scale SEO consider server rendering or Next.js like MDIX.
- Real COD orders use atomic stock checks and decrements in a SQLite transaction; there are no online payment/webhook functions.
- Single admin password, no admin roles or password reset, no automatic email confirmations and no media upload UI.
- SVG product artwork is **original illustrative placeholder art**, generated with `generate_mockups.py`.
- Use proper privacy terms and access controls before processing real customer data.

## Project structure

```text
server.mjs                Backend API, authentication and SQLite schema
public/index.html         Site shell
public/styles.css         Responsive layout and design
public/app.js             Catalog, cart, checkout, admin and page navigation
public/assets/            Original T-shirt mockups and icon
render.yaml               Optional separate Render deployment blueprint
.env.example              Example settings; not automatically loaded
```

## Testing

```bash
npm test
```

Run both the integration tests and a manual end-to-end test with real product information on staging before launch.
