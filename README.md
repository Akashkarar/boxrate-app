# BoxRate

A mobile-first web app for a packaging business: scan a handwritten measurement sheet, get instant per-box pricing, track orders by vendor, and print/share professional invoices — all from a phone.

Built as an installable Progressive Web App (PWA), backed by Supabase (Postgres + Auth + Edge Functions) and Google's Gemini API for reading handwritten measurement sheets.

**Live app:** https://akashkarar.github.io/boxrate-app/

---

## Features

- **Photo → priced order in seconds** — take a photo of a handwritten measurement sheet; an AI vision model reads height/length/width, quantity, acrylic, color, and any handwritten description for each box
- **Editable verify screen** — every scanned value is human-checked and correctable before saving, with live price calculation as you type
- **Per-vendor default rates** — box rate and acrylic rate auto-fill from each vendor's saved defaults, editable per box
- **Mixed-vendor scans supported** — a single photo can contain boxes for multiple vendors; each box can be individually reassigned, and orders automatically group/print correctly by vendor regardless of which scan they came from
- **Orders grouped by vendor + date**, not by scan session — scanning the same vendor's order across multiple photos (even with other vendors scanned in between) merges into one order
- **Dashboard** — sales totals per vendor and a box-count/revenue chart, filterable by vendor and date range, with a wider layout on desktop
- **Order history** — browse, edit, or delete any past order; edit mode lets you add/remove/reassign boxes on a saved order
- **PDF invoices, generated client-side** — a clean, printable receipt (vendor, date, per-box description/dimensions/price, total) previewed in-app and shareable via the phone's native share sheet or downloadable directly
- **Secure login** — Supabase Auth with Row Level Security; no data is readable or writable without a valid account
- **Admin user management** — an in-app screen (admin accounts only) to add, remove, or promote/demote user accounts
- **Light/dark theme**, installable as a home-screen app, offline-capable via a service worker

---

## Tech stack

| Layer                | Technology                                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Frontend             | React + Vite, plain CSS (no framework), [lucide-react](https://lucide.dev) icons                                                  |
| Charts               | [Recharts](https://recharts.org)                                                                                                  |
| PDF generation       | [jsPDF](https://github.com/parallax/jsPDF) + [jspdf-autotable](https://github.com/simonbengtsson/jsPDF-AutoTable)                 |
| PDF preview (in-app) | [pdf.js](https://mozilla.github.io/pdf.js/) — renders pages to canvas, since mobile WebViews can't reliably show PDF blobs inline |
| Backend              | [Supabase](https://supabase.com) — Postgres database, Auth, Edge Functions, Row Level Security                                    |
| AI extraction        | Google Gemini API (vision), called from a Supabase Edge Function                                                                  |
| Hosting              | GitHub Pages, deployed via GitHub Actions                                                                                         |
| PWA                  | `vite-plugin-pwa` (manifest + service worker)                                                                                     |

---

## Architecture

```
┌─────────────────┐      ┌──────────────────────┐      ┌────────────────────┐
│   React PWA      │ ──── │  Supabase Postgres    │      │  Gemini API         │
│  (GitHub Pages)  │      │  + Auth + RLS          │      │  (vision model)     │
└────────┬─────────┘      └──────────┬─────────────┘      └──────────┬──────────┘
         │                            │                                │
         │  supabase-js               │                                │
         └───────────────►  Edge Functions (Deno) ───────────────────┘
                             • extract-boxes   → calls Gemini to read a photo
                             • admin-users     → creates/deletes/promotes accounts
```

The frontend never talks to Gemini directly, and never holds a privileged database key — both the AI API key and the database's admin key live only inside Edge Functions, which run server-side on Supabase.

### Data model

- **`vendors`** — name, default box rate, default acrylic rate
- **`batches`** — a technical container for one scan session (date + a loosely-associated vendor); not the source of truth for grouping
- **`box_items`** — one row per box: dimensions, qty, color, acrylic flag + rate, description, rate, computed unit/total price, **its own `vendor_id`** and **its own `batch_date`**
- **`profiles`** — one row per login account, with a `role` of `admin` or `staff`

**Important design decision:** an "order" in the UI is defined as the combination of `(vendor_id, batch_date)` on `box_items` — **not** by which `batches` row a box happens to be attached to. This is what allows a single photo scan to contain boxes for several different vendors while still grouping, displaying, and printing correctly per vendor. Two database views compute this:

- `order_summary` — one row per (vendor, date): box count, total price
- `vendor_sales_summary` — one row per vendor: order count, total boxes, total sales

### Security

Row Level Security (RLS) is enabled on every table. Policies require `auth.role() = 'authenticated'` — no anonymous access to any business data. User creation/deletion/role changes go through the `admin-users` Edge Function, which checks the caller is an admin (via their `profiles.role`) before using the Supabase service-role key to perform the action — the powerful service-role key never reaches the browser.

---

## Project structure

```
boxrate-app/
├── src/
│   ├── App.jsx              # top-level routing, auth gate, bottom nav
│   ├── auth.js               # login session + profile hook
│   ├── Login.jsx              # sign-in screen
│   ├── Admin.jsx               # user management (admins only)
│   ├── CapturePhoto.jsx         # scan screen — vendor pick, camera/gallery
│   ├── VerifyGrid.jsx            # editable box list after a scan, before saving
│   ├── BatchDetail.jsx            # view/edit/print/delete a saved order
│   ├── Dashboard.jsx               # vendor totals + chart + filter
│   ├── Orders.jsx                   # order history list + filter
│   ├── VendorManager.jsx             # vendor CRUD + default rates
│   ├── pdf.js                         # builds the PDF (jsPDF + autotable)
│   ├── PdfPreviewDialog.jsx            # in-app PDF preview + share/download
│   ├── shared.jsx                       # design tokens, custom dropdown/date
│   │                                      picker/confirm-dialog components
│   ├── supabaseClient.js                 # Supabase client (public anon key)
│   └── index.css                          # theme variables, print styles,
│                                            responsive breakpoints
├── public/                  # PWA icons
├── vite.config.js            # base path + vite-plugin-pwa config
└── .github/workflows/         # auto-deploy to GitHub Pages on push
```

Supabase-side code (migrations, Edge Functions) is managed separately via the Supabase CLI — see [Supabase setup](#supabase-setup) below.

---

## Local setup

### Prerequisites

- [Node.js](https://nodejs.org) (LTS)
- A Supabase project (free tier is enough)
- A free [Gemini API key](https://aistudio.google.com/apikey)

### Install & run

```bash
git clone <this-repo>
cd boxrate-app
npm install
npm run dev
```

Open the printed `localhost` URL.

### Build for production

```bash
npm run build
```

Outputs a static site to `dist/`, ready to deploy anywhere (GitHub Pages, Netlify, Vercel, etc.).

---

## Supabase setup

1. Create a Supabase project.
2. Install the [Supabase CLI](https://supabase.com/docs/guides/cli) and run `supabase login`.
3. `supabase link --project-ref <your-project-ref>`
4. Apply the schema: `supabase db push` (or run the SQL migrations manually via the SQL Editor if you're not using the CLI).
5. Deploy the Edge Functions:
   ```bash
   supabase functions deploy extract-boxes
   supabase functions deploy admin-users
   ```
6. Set the Gemini API key as a function secret (Dashboard → Edge Functions → Secrets):
   ```
   GEMINI_API_KEY=your-key-here
   ```
7. Update `src/supabaseClient.js` with your project's URL and anon key.
8. Create your first user manually (Dashboard → Authentication → Users → Add user, with "Auto Confirm User" checked), then promote it to admin:
   ```sql
   update profiles set role = 'admin' where email = 'you@example.com';
   ```
   From then on, more users can be added from the app's Admin screen.

---

## Deployment

Deployment is automatic: any push to `main` triggers `.github/workflows/deploy.yml`, which builds the app and publishes it to GitHub Pages.

**If you fork this repo**, update `vite.config.js`'s `base` path to match your repo name, and update the GitHub Pages settings (Settings → Pages → Source → GitHub Actions).

---

## Known limitations

- **Gemini model versions get retired periodically** by Google — if photo scanning suddenly stops working, check [ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models) for the current recommended model and update the `GEMINI_MODEL` constant in the `extract-boxes` Edge Function.
- **User roles are simple** — admin vs. staff, with no fine-grained per-vendor or per-data permissions. All logged-in accounts see all business data, since that matches how this app is actually used (a small, fully-shared operation).
- **No offline write support** — the app works offline for viewing already-cached screens (PWA), but scanning, saving, or editing orders requires an internet connection.
