# CLAUDE.md: AJ GROUPS websites (handoff and working notes)

Read this first. It records where the project stands, how it is built, the decisions already made, and what is still open, so a new Claude Code session (or a new account) can carry on without the old conversation.

Last updated: 16 Nov 2026.

## What this is
The websites for **AJ GROUPS**, founded and led by **Allwyn**. A group of small businesses, each with its own site, all in one repo.

- Static HTML, CSS and vanilla JavaScript. **No build step.**
- Live at `https://roosewelt-nacth.github.io/AJ-groups/` (GitHub Pages, branch `main`, repo root).
- Repo: `https://github.com/Roosewelt-nacth/AJ-groups` (public). Anything committed is public, so **never commit secrets, access codes, phone numbers or customer data.**
- Target launch: **22 Nov 2026** (AJ GROUPS, Bun Bun Bakes, Fovo, Alven first). Do not publish this date on the sites until Allwyn approves it.

## Folder map
| Folder | What it is |
|---|---|
| `/` (`index.html`) | Opens the AJ GROUPS page |
| `aj-groups/` | Group page: a swipe deck of 11 chapters (ventures, founder, story, contact). Plain folder name, nothing to do with the brand or domain |
| `alven/` | Alven Studio (marketing) |
| `fovo/` | House of Fovo (photography). `draft-mac/` is an unused earlier version |
| `bunbun/` | Bun Bun Bakes (bakery). The most developed site. See below |
| `bunbun/baker/` | Baker dashboard (installable web app, hidden from search) |
| `clothing/` | Atelier. Not linked yet and hidden from search |
| `assets/` | Shared `motion.js`, `vt.js` (v=6), `vt.css`, and images |
| `server/` | `worker.js` (Cloudflare Worker for orders) and `SETUP.md` (plain-language setup) |
| `tools/` | Helper scripts (`prep_photos.py` prepares menu photos) |
| `client/` | Scratch and review files, not part of the public site |

Older drafts live outside the repo in `AJ-Groups-Drafts` (next to this folder on the original computer). They are not needed to continue.

## Run and check locally
```bash
python -m http.server 5173
```
Open http://localhost:5173. There is no build, lint or test suite. Quick syntax check for a module: `node --input-type=module --check < file.js`.

Phone testing: the preview's "mobile" emulation can crop screenshots and mislead. Use a 375 px wide iframe page and scroll with `scrollTo`, or open the site on a real phone via the computer's Wi-Fi address.

## Deploy
Commit to `main` and push. GitHub Pages updates in about one to two minutes. Git identity on the original machine: user `Roosewelt-nacth`.

Browsers cache modules by query string. When you change a JS file in `bunbun/`, **bump its `?v=` number** where it is imported (currently `main.js?v=53`, `menu.js?v=15`, `store.js?v=2`, `tracker.js?v=4`, `pay.js?v=1`, `extras.js?v=2`, `desserts.js?v=13`). `assets/vt.js` is at `?v=6`.

## Bun Bun Bakes (bunbun/)
Files: `index.html` (page and CSS), `main.js` (studio, snow, order form), `desserts.js` (procedural 3D desserts, three.js 0.170.0 via importmap), `menu.js` (all editable business data), `extras.js`, `tracker.js`, `pay.js`, `store.js`.

**Edit business data in `menu.js`:** `MENU`, `XMAS` and `XMAS_CAT` (Christmas range, `demo:true`), `DELIVERY` (radius, fees, cutoff, slots), `TRACKER`, `PAYMENT`, `BACKEND`. Prices, batches, dates and alcohol wording are **sample data** until Allwyn confirms them.

**Features built:** 3D cake and dessert studio; December Christmas look (automatic 1 to 26 Dec, force with `?xmas=1`, disable with `?xmas=0`; three themes: Plum and Gold, Holly and Berry, Snow and Rum); layered snow that settles on objects and sheds on scroll (`?snow=0` disables); glass UI over a blurred backdrop; live cake message styles, share link and card, delivery map with ETA, saved dates with countdowns; order form with a delivery slot; seven-stage order tracker; "Pay now" step.

### Order flow: two modes
- **Demo mode** (`BACKEND.url` is empty, the current state): orders are stored in the customer's own browser (`localStorage`). **The bakery receives nothing.** The baker page only shows orders placed on the same device.
- **Remote mode:** set `BACKEND = { url: 'https://<worker-address>' }` in `menu.js`. Orders go to a Cloudflare Worker with KV storage. The baker reads them at `/bunbun/baker/` with a secret access code.

### Payments (free flow, by design)
UPI deep link (`upi://pay?...` with the order number in the note) or a payment link, a customer tap "I've paid", then **the baker confirms** after the money shows in their own UPI or bank app. This is not foolproof and the site cannot know on its own whether money arrived. Fill `PAYMENT` in `menu.js` (`upiId` or `link`, `payeeName`, `depositPercent`). Automatic UPI checking (an Android notification reader) was discussed and deferred.

### Security model (do not weaken)
- Baker list, update and delete need the access code (at least 12 characters); 8 wrong tries lock an address out for 15 minutes.
- Orders only accepted from `ALLOW_ORIGIN` (the website address). Must be set to the real domain when it exists.
- A customer sees their own order status only through a private per-order token kept on their device. Order numbers alone are not enough.
- Customer text is escaped on the baker page; CSV export defuses spreadsheet formulas; orders auto-delete after 180 days; baker can delete any order.
- **Never ask for, receive or store the access code, bank details, UPI credentials, gateway keys or Telegram tokens.** Allwyn enters them himself in the Cloudflare dashboard. The worker address itself is not secret.
- `server/SETUP.md` has the full free setup (Cloudflare KV namespace `bunbun-orders`, binding `ORDERS`, secret `BAKER_CODE`, variable `ALLOW_ORIGIN`, optional Telegram alerts).

## Site-wide behaviour
- Phone bottom nav (`.mo-dock`) and the header hide on scroll down and return on scroll up, on every site (`assets/vt.js`).
- `robots.txt` hides `/bunbun/baker/` and the clothing site from search.
- Forms on the other sites are demos until a form service is connected.

## Decisions already made
- Quiet, premium look. The Bun Bun hero is the **logo** (a decorated hero and a plum-cake hero were both rejected as childish or wrong).
- Free tools only for now (GitHub Pages, Cloudflare free plan, UPI).
- Domain: Allwyn agreed to create a domain. `ajgroups.com`, `ajgroups.in`, `ajgroups.co.in`, `aj-groups.com` and `ajgroup.in` are **already registered by others** (checked 16 Nov 2026). Looked available then (confirm at a registrar): `ajgroupsindia.in`, `ajgroupsindia.com`, `ajcircle.in`, `ajcircle.com`, `aj-groups.in`, `ajgroupsofficial.in`. Preferred: `ajgroupsindia.in`, or a rename such as `ajcircle`.
- Email: start with Zoho Mail free plan (up to 5 mailboxes); Google Workspace Base is the upgrade (about 99 rupees per user per month before GST, per Google's page; other figures were from resellers and unverified).
- Gift hampers for Bun Bun: planned, not built. Three tiers (Petite, Classic with plum cake, Grand), a build-your-own option, a corporate enquiry form, aim for 40 to 50 percent cost, FSSAI and alcohol labelling checked, an alcohol-free option. Waiting on Allwyn's ideas, costs and capacity.
- Mobile "swipe card" redesign for the group page (dark glass card stack with a stats row, tag chip, ✓/✕ actions, floating pill nav) was **prototyped and then reverted by request** to keep the page simple. The prototype is not in the repo. If it is wanted again, rebuild it as a separate mobile-only layout and do not show internal facts such as the launch date or chapter count as "stats".

## Open items (waiting on people, not on code)
1. **Allwyn:** pick and buy the domain in his own registrar account, turn on two-step login, set up email. Then the site needs: a `CNAME` file, the Pages custom domain with HTTPS, canonical links, `sitemap.xml`, and `ALLOW_ORIGIN` set to the new domain.
2. **Allwyn:** deploy the Cloudflare backend per `server/SETUP.md` and send the **worker address** (not the code). Then set `BACKEND.url` in `bunbun/menu.js`, bump `?v=`, push.
3. **Allwyn:** a UPI id or payment link for `PAYMENT`.
4. Real content: prices, batches, dates, alcohol wording, photos, hot-drinks menu, founder story and portrait, real contact form backend.
5. Later: AJ Softwares and AJ Little World pages, privacy and terms pages, favicon and share image, the possible "bakery ordering kit" product with Bun Bun as the pilot.
6. **Not yet verified:** a run on a real iPhone and Android, and the Clothing page's phone dock.

## How to continue from a new account
1. Install Git, Python 3 and Claude Code. Sign in to the new account.
2. Sign in to GitHub as a user with **write access** to `Roosewelt-nacth/AJ-groups` (ask the owner to add the new account as a collaborator, or fork it), then:
   ```bash
   git clone https://github.com/Roosewelt-nacth/AJ-groups.git
   cd AJ-groups
   python -m http.server 5173
   ```
3. Open the folder in Claude Code. It reads this file automatically. A good first message: "Read CLAUDE.md and tell me where we are and what is waiting on Allwyn."
4. Claude's saved memory does **not** move between accounts, so this file is the memory. Keep it updated when decisions change.
5. Set the git identity on the new machine (`git config user.name` and `user.email`) and check pushes work before relying on them.

## Working preferences (from the owner)
- Show a local preview before anything is pushed. Push only when asked.
- Keep it simple and premium. Avoid childish or cluttered decoration.
- Check every page and every screen size (phone included) before calling work done.
- Say plainly what was not verified. Prefer free options and explain costs in plain words.
