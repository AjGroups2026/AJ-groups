# Bun Bun orders backend: free setup

This connects the website, the order tracker and the baker dashboard so every order from every customer shows up in one place. It runs on Cloudflare's free plan. Allwyn (or whoever owns the business) creates the account and types the secret code. Nobody else needs to see it.

Until this is set up, everything still works in demo mode (orders stay on one device).

## What you need
- A free Cloudflare account (https://dash.cloudflare.com/sign-up).
- About 20 minutes. No coding and no card.

## Steps (all in the Cloudflare dashboard)
1. **Create the storage.** Go to *Storage & Databases → KV → Create a namespace*. Name it `bunbun-orders`.
2. **Create the worker.** Go to *Workers & Pages → Create → Create Worker*. Name it `bunbun-orders`, deploy the starter, then choose *Edit code*. Delete the starter code, paste the whole of `server/worker.js`, and click *Deploy*.
3. **Connect the storage.** In the worker, open *Settings → Bindings → Add → KV namespace*. Variable name: `ORDERS` (exactly, capitals). Namespace: `bunbun-orders`. Save.
4. **Set the secrets.** In *Settings → Variables and Secrets* add:
   - `BAKER_CODE` as a **Secret**: a long private access code for the baker page (12 or more characters).
   - `ALLOW_ORIGIN` as a Text variable: the website address only, for example `https://ajgroups2026.github.io`. Later, your own domain.
   - Optional alerts to the baker's phone (free): `TELEGRAM_BOT_TOKEN` (Secret) and `TELEGRAM_CHAT_ID` (Text). See "Telegram alerts" below.
5. **Copy the worker address.** It looks like `https://bunbun-orders.YOURNAME.workers.dev`.
6. **Connect the website.** Put that address in `bunbun/menu.js`, in `BACKEND = { url: '...' }`, and publish the site. (You can send me the address; it is not secret. Never send me the access code.)
7. **Try it.** Place a test order on the site, then open `/bunbun/baker/` on the same site and sign in with the access code.

## The baker page
- Address: `https://YOUR-SITE/bunbun/baker/`. It is not linked from the website and search engines are told to ignore it.
- On the baker's phone: open it, then *Add to Home screen* so it opens like an app.
- Tap **Turn on alerts** once so the phone beeps and shows a notification for each new order while the page is open.
- Daily flow: a new order appears under **Needs action**. Call the customer, move the order to *Baker confirmed*. When money arrives in your UPI or bank app, tap **Payment received**, then move the order along. The customer's tracker follows each tap.

## Telegram alerts (optional, free)
1. In Telegram, message `@BotFather`, send `/newbot` and follow the steps. It gives you a token: save it as the `TELEGRAM_BOT_TOKEN` secret.
2. Send any message to your new bot. Open `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser and find `"chat":{"id": ...}`. That number is `TELEGRAM_CHAT_ID`.
3. You now get a Telegram message for each new order and each "I've paid".

## Free plan limits (plenty for a bakery)
- 100,000 requests a day.
- KV allows 1,000 writes a day. Each order uses a few writes, so this is hundreds of orders a day.

## Who can see what (owner-only access)
| Information | Who can see it |
|---|---|
| Customer name, phone, cake details, notes | The baker page (needs the access code) and the Cloudflare account owner. No one else. |
| A customer's own order status | That customer only, through a private token that is created for their order and stored only on their device. Order numbers alone are not enough. |
| Phone numbers on the customer's own device | Not stored there when the backend is connected. Only the order number, name and token are kept. |
| The access code | Only the people the owner tells. It is never in the website files. |

What protects it:
- The baker list, order changes and deletion all need the access code. Wrong guesses are slowed down, and after 8 wrong tries an address is locked out for 15 minutes.
- The access code must be at least 12 characters, or the baker page stays closed.
- The site only accepts orders from your own website address (`ALLOW_ORIGIN`). Set it, do not leave it empty.
- Customer text is always shown as plain text on the baker page, so a malicious name or note cannot run code.
- The CSV export defuses spreadsheet formulas.
- By default the baker page forgets the code when the browser closes, and signs out after 20 minutes of no activity. Ticking "Keep me signed in" is only for the baker's own phone.
- Orders are deleted automatically after 180 days. The baker can delete any order at once with **Delete order**. The order form tells customers this.
- Personal details are never put in the website's public files or in the GitHub repository.

What the owner must do:
- Turn on **two-step login** on the Cloudflare account and on the Google account tied to it. This is the real lock on the whole system.
- Choose a long access code, change it if a phone is lost or a team member leaves, and sign out on shared devices.
- Share the access code only with people who work in the kitchen.
- Telegram alerts contain the order number, first name and total, not the phone number. They pass through Telegram, so leave them off if that is not acceptable.
- Optional: in Cloudflare *Security → WAF → Rate limiting rules*, limit `POST /api/orders` to about 10 requests a minute per visitor, to stop spam.
- This is a good-practice setup for a small bakery, not a legal opinion. If you sell widely, check India's data protection rules and add a privacy policy page.
- Payment confirmation is still done by the baker, who sees the money arrive. The site never touches card or bank details.
