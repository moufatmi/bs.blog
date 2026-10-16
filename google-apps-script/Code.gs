/**
 * =============================================================================
 *  BEAUSEJOUR VOYAGE  -  Google Apps Script (intake + public feed)
 * =============================================================================
 *  What the agency owner does:
 *      opens a link  ->  fills 4 fields  ->  attaches the flyer photo
 *      ->  taps Send.  The program is on the website within seconds.
 *
 *  What this script does automatically:
 *      1. Takes every form submission
 *      2. Makes the uploaded photo publicly readable
 *      3. Writes one clean row into the "programs" tab
 *      4. Serves those rows as JSON to the website
 *
 *  SETUP: see docs/GOOGLE-SETUP.md (about 30 minutes, once).
 * =============================================================================
 */

/** Names of the tabs we rely on. */
const PROGRAMS_TAB = 'programs';
const INTAKE_TAB = 'intake';

/** Form fields we read from the intake tab (change to match your form). */
const FIELD = {
  title: 'Title',
  price: 'Price',
  description: 'Description',
  photo: 'Photo',
};

/** Cache for the feed (seconds). 0 = no cache. */
const CACHE_SECONDS = 60;

// -----------------------------------------------------------------------------
// Setup
// -----------------------------------------------------------------------------

/** Menu shown inside the Google Sheet. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚙️ Programs')
    .addItem('1️⃣  Setup (run once)', 'setup')
    .addSeparator()
    .addItem('2️⃣  Show the website feed URL', 'showFeedUrl')
    .addItem('3️⃣  Check that everything works', 'runChecks')
    .addToUi();
}

/**
 * One-time setup. Creates the tabs, stores the configuration and tells you
 * what still has to be done by hand.
 */
function setup() {
  const ui = SpreadsheetApp.getUi();

  const sheetIdAnswer = ui.prompt(
    'Setup (1/3)',
    'Paste the ID of this spreadsheet.\n' +
      'It is the part between "/d/" and "/edit" in the URL.\n\n' +
      'Example: 1AbC2dEf3GhI4jKl5MnO6pQr7StU8vWxYz',
    ui.ButtonSet.OK_CANCEL
  );
  if (sheetIdAnswer.getSelectedButton() !== ui.Button.OK) return;
  const sheetId = String(sheetIdAnswer.getResponseText() || '').trim();
  if (!sheetId) return;

  PropertiesService.getScriptProperties().setProperty('SHEET_ID', sheetId);

  // --- the programs tab (the real data) ---
  const ss = SpreadsheetApp.openById(sheetId);
  let programs = ss.getSheetByName(PROGRAMS_TAB);
  if (!programs) {
    programs = ss.insertSheet(PROGRAMS_TAB);
    programs.getRange(1, 1, 1, 8).setValues([[
      'id', 'title', 'price', 'description', 'image_url', 'active', 'created_at', 'updated_at',
    ]]);
    programs.setFrozenRows(1);
    ui.alert('Created the "programs" tab with its columns.');
  }

  // --- the intake tab (where the Google Form writes) ---
  const other = ss.getSheets().find(
    (s) => s.getName() !== PROGRAMS_TAB && s.getLastRow() > 0
  );
  const intakeName = other ? other.getName() : INTAKE_TAB;
  PropertiesService.getScriptProperties().setProperty('INTAKE_TAB_NAME', intakeName);

  // --- upload folder for the photos ---
  const folderAnswer = ui.prompt(
    'Setup (2/3)',
    'Paste the ID of the Drive folder where the form uploads the photos.\n\n' +
      'How to find it: open the form, click the photo question, choose\n' +
      '"Link to folder", pick a folder, open that folder in Drive and copy\n' +
      'its ID from the URL.\n\n' +
      'Leave empty to skip (photos will then stay in the form upload folder).',
    ui.ButtonSet.OK_CANCEL
  );
  if (folderAnswer.getSelectedButton() === ui.Button.OK) {
    const folderId = String(folderAnswer.getResponseText() || '').trim();
    if (folderId) {
      PropertiesService.getScriptProperties().setProperty('UPLOAD_FOLDER_ID', folderId);
    }
  }

  // --- the feed URL, pasted after you deploy the web app ---
  const urlAnswer = ui.prompt(
    'Setup (3/3)',
    'Paste the "web app URL" you got from Deploy → New deployment\n' +
      '(it ends with /exec).\n\n' +
      'You can do this later via the menu: ⚙️ Programs → Show the website feed URL.',
    ui.ButtonSet.OK_CANCEL
  );
  if (urlAnswer.getSelectedButton() === ui.Button.OK) {
    const webUrl = String(urlAnswer.getResponseText() || '').trim();
    if (webUrl) {
      PropertiesService.getScriptProperties().setProperty('WEB_APP_URL', webUrl);
      ui.alert('All set.\n\nPut this in your website .env file:\n\n' +
        'PUBLIC_PROGRAMS_FEED_URL=' + webUrl);
    }
  }

  // --- one-time trigger: run on every new form submission ---
  removeExistingTriggers();
  ScriptApp.newTrigger('onFormSubmit')
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  ui.alert(
    'Setup finished.\n\n' +
      'Next: Deploy → New deployment → type "Web app".\n' +
      'Execute as: Me.  Who has access: Anyone.\n' +
      'Then paste that /exec URL into your website .env file as\n' +
      'PUBLIC_PROGRAMS_FEED_URL and run: npm run build'
  );
}

function removeExistingTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach((t) => {
    if (t.getHandlerFunction() === 'onFormSubmit') ScriptApp.deleteTrigger(t);
  });
}

// -----------------------------------------------------------------------------
// Intake: a new form submission arrives
// -----------------------------------------------------------------------------

function onFormSubmit(e) {
  try {
    if (e && e.namedValues) {
      const v = e.namedValues;
      const title = firstValue(v[FIELD.title]);
      if (!title) return;

      const photoName = firstValue(v[FIELD.photo]);
      const imageUrl = photoName ? publicUrlForUpload(photoName) : '';

      appendProgram({
        title: title,
        price: firstValue(v[FIELD.price]),
        description: firstValue(v[FIELD.description]),
        image_url: imageUrl,
      });

      console.log('New program added:', title);
    }
  } catch (err) {
    console.error('onFormSubmit failed: ' + err);
  }
}

function firstValue(v) {
  if (!v || !v.length) return '';
  return String(v[0] || '').trim();
}

/**
 * Google Forms gives us the file NAME, not its ID, so we look it up.
 * Fallback: the most recent file added to the upload folder.
 */
function publicUrlForUpload(fileName) {
  const folders = uploadFolders();
  if (!folders.length) return '';

  let file = null;
  for (let i = 0; i < folders.length && !file; i++) {
    const byName = folders[i].getFilesByName(fileName);
    if (byName.hasNext()) file = byName.next();
  }

  // The name in the form can differ from the stored name. Fall back to
  // the newest file, but only if it was added in the last 10 minutes.
  if (!file) {
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (let i = 0; i < folders.length && !file; i++) {
      const all = folders[i].getFiles();
      let newest = null;
      while (all.hasNext()) {
        const f = all.next();
        if (f.getMimeType().indexOf('image/') !== 0) continue;
        if (!newest || f.getLastModified().getTime() > newest.getLastModified().getTime()) {
          newest = f;
        }
      }
      if (newest && newest.getLastModified().getTime() >= cutoff) file = newest;
    }
  }

  if (!file) return '';

  // Make it readable by anyone with the link (no login needed to view).
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    console.warn('Could not change sharing: ' + e);
  }

  return 'https://drive.google.com/uc?export=view&id=' + file.getId();
}

function uploadFolders() {
  const out = [];
  const configured = PropertiesService.getScriptProperties().getProperty('UPLOAD_FOLDER_ID');
  try {
    if (configured) out.push(DriveApp.getFolderById(configured));
  } catch (e) {
    console.warn('Configured upload folder not found: ' + e);
  }
  try {
    const named = DriveApp.getFoldersByName('Form Uploads');
    while (named.hasNext()) out.push(named.next());
  } catch (e) {
    /* ignore */
  }
  return out;
}

// -----------------------------------------------------------------------------
// Writing to the programs tab
// -----------------------------------------------------------------------------

function appendProgram(p) {
  const sheet = programsSheet();
  const now = new Date().toISOString();
  sheet.appendRow([
    Utilities.getUuid(),
    p.title || '',
    p.price || '',
    p.description || '',
    p.image_url || '',
    'TRUE',
    now,
    now,
  ]);
}

function programsSheet() {
  const sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  const ss = sheetId ? SpreadsheetApp.openById(sheetId) : SpreadsheetApp.getActive();
  if (!ss) throw new Error('No spreadsheet. Run setup() first.');

  let sheet = ss.getSheetByName(PROGRAMS_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(PROGRAMS_TAB);
    sheet.getRange(1, 1, 1, 8).setValues([[
      'id', 'title', 'price', 'description', 'image_url', 'active', 'created_at', 'updated_at',
    ]]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// -----------------------------------------------------------------------------
// The public feed the website reads
// -----------------------------------------------------------------------------

/**
 * Returns JSON: { updatedAt, count, programs: [...] }
 * A row is hidden from the website when its "active" column is not TRUE,
 * so the owner can hide a program without deleting it.
 */
function doGet(e) {
  try {
    const programs = readPrograms();
    const payload = {
      updatedAt: new Date().toISOString(),
      count: programs.length,
      programs: programs,
    };
    return ContentService.createTextOutput(JSON.stringify(payload))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ error: String(err), programs: [] })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function readPrograms() {
  const cache = CacheService.getScriptCache();
  if (CACHE_SECONDS > 0) {
    const cached = cache.get('programs');
    if (cached) return JSON.parse(cached);
  }

  const sheet = programsSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  const programs = [];

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const active = String(row[5]).trim().toUpperCase();
    if (active === 'FALSE' || active === 'NO' || active === '0') continue;

    const title = String(row[1] || '').trim();
    if (!title) continue;

    programs.push({
      id: String(row[0] || Utilities.getUuid()),
      title: title,
      description: String(row[3] || '').trim(),
      price: String(row[2] || '').trim(),
      image_url: String(row[4] || '').trim(),
      active: true,
      created_at: String(row[6] || ''),
      updated_at: String(row[7] || ''),
    });
  }

  programs.sort(function (a, b) {
    return String(b.created_at).localeCompare(String(a.created_at));
  });

  if (CACHE_SECONDS > 0) cache.put('programs', JSON.stringify(programs), CACHE_SECONDS);
  return programs;
}

// -----------------------------------------------------------------------------
// Diagnostics
// -----------------------------------------------------------------------------

function showFeedUrl() {
  const url = PropertiesService.getScriptProperties().getProperty('WEB_APP_URL');
  SpreadsheetApp.getUi().alert(
    url
      ? 'Website feed URL:\n\n' + url + '\n\nPut it in .env as:\nPUBLIC_PROGRAMS_FEED_URL=' + url
      : 'Not set yet.\n\nDeploy → New deployment → type "Web app",\n' +
        'Execute as: Me, Who has access: Anyone.\nThen paste the /exec URL here.'
  );
}

/** Run this after setup to confirm every part works. */
function runChecks() {
  const lines = [];
  const props = PropertiesService.getScriptProperties();

  lines.push('SHEET_ID ......... ' + (props.getProperty('SHEET_ID') || '❌ not set'));
  lines.push('UPLOAD_FOLDER_ID  ' + (props.getProperty('UPLOAD_FOLDER_ID') || '⚠️ not set'));
  lines.push('WEB_APP_URL ...... ' + (props.getProperty('WEB_APP_URL') || '⚠️ not set'));
  lines.push('Form triggers .... ' + ScriptApp.getProjectTriggers().length);

  try {
    const programs = readPrograms();
    lines.push('Programs ........ ' + programs.length);
    programs.slice(0, 5).forEach(function (p) {
      lines.push('   • ' + p.title + (p.image_url ? '  [photo ok]' : '  [no photo]'));
    });
  } catch (e) {
    lines.push('Programs ........ ❌ ' + e);
  }

  SpreadsheetApp.getUi().alert('Checks:\n\n' + lines.join('\n'));
}