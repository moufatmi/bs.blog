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

### How form submissions get in

The Google Form writes to its own tab (`Form Responses 1`). When the website
asks for the feed, the script compares that tab with the `programs` tab and
imports anything missing — resolving the photo, making it publicly readable,
and appending a clean row.

**There is no background job involved.** This matters: a trigger can stop
working silently (authorisation problems) and the programs then vanish with
nobody noticing. Importing on read cannot fail unnoticed, because the website
keeps asking until everything is there.

A new program therefore appears within about a minute.

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

Photos are stored in Google Drive. There are two ways the website gets them:

1. **Normal case** — the script makes the file readable with "anyone with the
   link" and the site uses that link. Cheap and fast.
2. **When public sharing is refused** — some Google accounts (usually Workspace
   domains) forbid public links. The script then serves the file itself through
   `?img=FILE_ID`, and the site turns the bytes into an image. Slightly heavier,
   but it works regardless of the account policy.

You do not have to care which one is in use: if a photo cannot be shared, the
site still shows it.

**Use real resolution photos.** Tiny images look blurry on any screen, and the
image proxy re-sends the file on every page view, so keep flyers reasonable
(under ~2 MB).

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