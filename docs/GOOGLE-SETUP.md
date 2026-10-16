# Setting up the programs feed (one time, ~30 minutes)

After this, the agency owner needs **one Google Form** and nothing else.

```
Owner fills form  ->  Google Sheet  ->  script publishes JSON  ->  website
```

No build. No deploy. No Keystatic, no Supabase, no Make.com.

---

## Step 1 — Create the spreadsheet

1. Go to <https://sheets.google.com> and create a blank spreadsheet.
2. Name it something obvious, e.g. `Beausejour Programs`.
3. Copy the **spreadsheet ID**: it is the part between `/d/` and `/edit` in the URL.
   Example: `1AbC2dEf3GhI4jKl5MnO6pQr7StU8vWxYz`

## Step 2 — Create the form

1. Go to <https://forms.google.com> and create a blank form.
2. Title it in Arabic and French, e.g. `برنامج جديد / Nouveau programme`.
3. Add these four questions. **The first four labels must be exactly as written**,
   because the script looks for them:

   | Question                    | Type       | Label        |
   |-----------------------------|------------|--------------|
   | Title                       | Short text | `Title`      |
   | Price                       | Short text | `Price`      |
   | Description                 | Paragraph  | `Description`|
   | Photo                       | File upload| `Photo`      |

   If you want French or Arabic labels in the form, change **only what is shown
   to the owner** and keep the technical label in parentheses, for example
   `العنوان (Title)`.

4. In the Photo question settings, choose **Link to folder** and pick a Drive
   folder named `program-photos`. Copy that folder's ID from its URL.

## Step 3 — Link the form to the spreadsheet

1. In the form: the green Sheets icon at the top → **Link to Sheets**.
2. Choose **Create a new spreadsheet**, or select the one from Step 1.
3. Keep the default tab name (usually `Form Responses 1`). The script finds it
   automatically.

## Step 4 — Add the script

1. In the spreadsheet: **Extensions → Apps Script**.
2. Delete the placeholder `Code.gs` content and paste everything from
   `google-apps-script/Code.gs` in this project.
3. Also replace the manifest: **Project Settings → Show "appsscript.json"**,
   open it and paste `google-apps-script/appsscript.json` from this project.
4. Save.

## Step 5 — Run setup once

1. Reload the spreadsheet. A new menu appears: **⚙️ Programs**.
2. Click **1️⃣ Setup (run once)** and answer the three prompts:
   - the spreadsheet ID (from Step 1)
   - the upload folder ID (from Step 2)
   - the web app URL — you can skip this for now and add it later

Setup creates the `programs` tab (the live data), remembers the intake tab and
creates the "on every new submission" trigger.

## Step 6 — Publish the web app (this is what the website reads)

1. In Apps Script: **Deploy → New deployment**.
2. Type: **Web app**.
3. Execute as: **Me**.  Who has access: **Anyone**.
4. Deploy and copy the URL ending in `/exec`.
5. In the spreadsheet menu: **2️⃣ Show the website feed URL** and paste it in,
   so the script remembers it.

## Step 7 — Connect it to the website

The website is built automatically by GitHub Actions every time you push to
`main`. There is no server, so there is no `.env` file on the server: the URL
must be given to the build.

**The URL is already written into the deploy workflow** as a fallback, so it
may already work. To be sure, and to be able to change it later without
touching code:

1. Open your repository on GitHub
2. **Settings → Secrets and variables → Actions → Variables → New repository variable**
3. Name: `PUBLIC_PROGRAMS_FEED_URL`
4. Value: your `/exec` URL
5. Save

Use the **Variables** tab, not the Secrets tab. The URL is public: it is baked
into the page and anyone can read it.

Then push anything to `main` (or run the workflow from the Actions tab) and the
site is rebuilt.

**This is the only deployment you will ever need.** After this, programs added
through the form appear on the site by themselves.

To try it locally instead, add the same line to the `.env` file in the project
root and run `npm run dev`.

---

## Step 8 — Give the owner the link

Send the owner the form link on WhatsApp. Their whole job is:

1. Open the link
2. Type title, price, description
3. Attach the flyer photo
4. Tap **Send**

The program shows up on the website within seconds.

---

## Checking that everything works

In the spreadsheet menu:

- **3️⃣ Import pending submissions now** — imports anything the form received
  but that is not published yet, and tells you how many programs the website
  will now show.
- **4️⃣ Check that everything works** — a full report: configuration, how many
  submissions exist, how many are published, how many are waiting, and whether
  each one has a photo.

To see the data exactly as the website sees it, open the `/exec` URL in your
browser. You should get JSON like:

```json
{
  "updatedAt": "2026-10-16T10:00:00.000Z",
  "count": 1,
  "programs": [
    { "id": "...", "title": "عمرة 2 دجنبر", "image_url": "https://drive.google.com/..." }
  ]
}
```

### No trigger is required

The website imports anything missing **every time it asks for the feed**, so a
submission appears within about a minute without any background job. This is
deliberate: background triggers can stop working silently (authorisation
problems), and the programs then disappear with nobody noticing.

`setup()` offers to create a trigger anyway, purely to make the delay shorter.
Ignore it if you prefer fewer moving parts.

---

## How the owner can edit a program later

Everything is in the **`programs` tab** of the spreadsheet — one row per program:

| Column | Meaning |
|---|---|
| `id` | do not touch |
| `title`, `price`, `description` | free text, safe to edit |
| `image_url` | the Drive link of the photo |
| `active` | set to `FALSE` to hide a program without deleting it |
| `created_at`, `updated_at` | do not touch |

Edit a cell, wait up to a minute, reload the website. Done.

---

## If something goes wrong

**No programs on the site.**
Run **3️⃣ Import pending submissions now** from the Programs menu. It imports
whatever the form received but has not published, and reports the count.

If it says 0 pending while the form clearly has submissions, the script cannot
find the form's tab. Re-run **1️⃣ Setup**, which remembers the right tab name.

**Programs appear but the photos are missing.**
Run **5️⃣ Fix photos (make them public)**. It reports the exact reason per photo,
for example:

- `restricted` — this Google account forbids public sharing. Nothing to fix: the
  script serves the photo itself and the website shows it.
- `cannot open file` — the script cannot reach that file. Check
  `UPLOAD_FOLDER_ID` and that the photo question is linked to that folder.
- `NO PHOTO` — the form row has no photo at all. Attach one and resubmit.

To re-import a program after fixing its photo: delete its row from the
`programs` tab, then run **3️⃣ Import pending submissions now**.

**The website still shows the old programs.**
The browser caches the feed for 90 seconds. Hard-refresh the page, or wait.

**The website shows nothing and the JSON URL returns an error.**
Open the `/exec` URL directly: the error message is included in the JSON.

**A program is wrong.**
Fix the row in the `programs` tab. To undo a submission completely, delete the
row from both `programs` and the form's response tab.

**Google asks you to re-authorise.**
Apps Script needs permission for Sheets and Drive. Re-run setup and approve.
Changing the scopes in `appsscript.json` also requires a new deployment.