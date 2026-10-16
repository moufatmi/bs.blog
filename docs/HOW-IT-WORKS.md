# How the website works now

```
Owner fills a Google Form
        ->  Google Sheet  ("programs" tab)
        ->  Apps Script publishes JSON
        ->  The website reads that JSON in the browser
```

**The owner uses one tool: a Google Form.**
No Keystatic, no Supabase, no Make.com, no `npm run build`, no deploy.

A new program appears on the website within seconds of being submitted.

---

## What is the source of truth

The Google Sheet tab called **`programs`**. One row per program:

| Column | Meaning |
|---|---|
| `id` | do not touch |
| `title` | program title (Arabic or French, your choice) |
| `price` | e.g. `16 900 DH` |
| `description` | short text |
| `image_url` | public Google Drive link of the flyer photo |
| `active` | set to `FALSE` to hide a program without deleting it |
| `created_at`, `updated_at` | do not touch |

The owner can edit any of those cells directly to correct a typo.

---

## What the website does

1. At build time it saves a copy of the feed inside the page (a safety net).
2. When a visitor opens the page, the browser fetches the live feed and
   updates the cards: new programs appear, changed ones update, hidden ones
   disappear.
3. The browser keeps the feed for 5 minutes, and falls back to the last known
   good copy if the feed is unreachable, so the page is never empty because of
   a temporary failure.

---

## The owner's procedure

1. Open the form link (sent on WhatsApp)
2. Fill: title, price, description
3. Attach the flyer photo
4. Send

That's it.

---

## Photos

Photos are stored in Google Drive and shared as "anyone with the link", then
referenced by the site. Free, and enough for flyers.

**Use real resolution photos.** The 64x90 pixel images currently in Supabase
are unusable on any screen.

---

## Setup

See `docs/GOOGLE-SETUP.md`. One time, about 30 minutes.

The Apps Script source lives in `google-apps-script/`.

---

## How the site is published

GitHub Actions (`.github/workflows/deploy.yml`) builds and publishes the site
every time you push to `main`. Nothing runs on a server and there is no
`.env` file on the server.

Because Astro replaces `PUBLIC_*` variables **at build time**, the feed URL is
given to the build in two ways:

1. a fallback URL written directly in `deploy.yml`
2. an optional repository variable `PUBLIC_PROGRAMS_FEED_URL`
   (Settings → Secrets and variables → Actions → **Variables**)

If you ever change the sheet or redeploy the script to a new URL, set the
repository variable. You do not need to rebuild from your computer.

---

## Building on your own computer

```bash
npm run dev            # local preview, reads .env
npm run build          # produces dist/
```

Local builds read the `.env` file in the project root. It is gitignored and is
never uploaded, which is why the deploy workflow needs its own copy of the URL.

---

## Old files that are no longer used

`src/content/omra/*.mdoc` are kept only so the already published URLs such as
`/omra/omra-2-djnbr/` keep working. They are frozen: nothing updates them.
They can be deleted later once you are comfortable, along with the pages
`src/pages/omra/[...slug].astro` and `src/pages/ar/omra/[...slug].astro`.