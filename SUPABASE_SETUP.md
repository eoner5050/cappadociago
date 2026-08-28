# CappadociaGo — Supabase Tour Admin Setup

## 1) Install the Supabase client library
In your project terminal:
```
npm install @supabase/supabase-js
```

## 2) Enable server routes (needed for the Add Tour form to save data)
This project's Add Tour page calls a server API route (`/api/add-tour`) to
save data securely. Astro needs an adapter for this to work when deployed
to Vercel:
```
npx astro add vercel
```
This will automatically update `astro.config.mjs` for you (adds the Vercel
adapter and sets `output: 'hybrid'`, meaning all existing pages stay fast
static pages, and only `/api/add-tour` runs as a server function).

If it asks to install dependencies, say yes.

## 3) Run the database schema
1. Open your Supabase project → **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` from this folder, copy all of it, paste it
   into the SQL Editor, and click **Run**.
3. You should see "Success. No rows returned." — this created two tables:
   `tours` and `tour_translations`.

## 4) Add your environment variables
1. Copy `.env.example` to a new file named `.env` (same folder).
2. Go to Supabase Dashboard → **Project Settings** → **API**.
3. Copy the **Project URL** → paste as `PUBLIC_SUPABASE_URL`.
4. Copy the **anon public** key → paste as `PUBLIC_SUPABASE_ANON_KEY`.
5. Copy the **service_role** key (click "Reveal") → paste as
   `SUPABASE_SERVICE_ROLE_KEY`.

⚠️ Never commit `.env` to GitHub, and never share the service_role key —
it has full read/write access to your database. It's only used inside
`src/pages/api/add-tour.ts`, which runs on the server, never in the browser.

## 5) Run it
```
npm run dev
```
Then open: `http://localhost:4321/admin/add-tour`

Fill in the shared details (slug, category, price...), then fill each of
the 3 language tabs (Türkçe / English / Español), and click
**"Save Tour to All 3 Languages"**.

## 6) Deploying to Vercel
When you push to GitHub and Vercel redeploys, add the same 3 environment
variables inside Vercel: **Project → Settings → Environment Variables**.
Without this, the live site's Add Tour page won't be able to save data.

## What's next
Right now the Add Tour page saves data into Supabase, but the site's
homepage and tour pages still show the hardcoded example tours. The next
step is wiring the homepage tour grid and tour detail page to read from
Supabase instead — ask when you're ready for that.
