/**
 * =============================================================================
 *  BEAUSEJOUR VOYAGE  -  Google Apps Script (intake + public feed)
 * =============================================================================
 *  What the agency owner does:
 *      opens a link  ->  fills 4 fields  ->  attaches the flyer photo
 *      ->  taps Send.  The program is on the website within a minute.
 *
 *  How the data moves:
 *      Google Form  ->  intake sheet  ->  THIS SCRIPT  ->  JSON  ->  website
 *
 *  The import happens when the website asks for the feed, not in the
 *  background. That matters: background triggers can silently stop working
 *  (authorisation problems) and the programs disappear with nobody noticing.
 *  Here, every single page load retries anything that is still missing.
 *
 *  SETUP: see docs/GOOGLE-SETUP.md
 * =============================================================================
 */

/** Names of the tabs we rely on. */
const PROGRAMS_TAB = 'programs';

/** Form fields we read from the intake tab (must match the form labels). */
const FIELD = {
  title: 'Title',
  price: 'Price',
  description: 'Description',
  photo: 'Photo',
};

/** Feed cache. Short, so a new program shows up quickly. */
const CACHE_SECONDS = 30;

// -----------------------------------------------------------------------------
// The feed the website reads
// -----------------------------------------------------------------------------

function doGet(e) {
  try {
    // Image proxy: ?img=FILE_ID  ->  the file itself.
    // This exists because some Google accounts forbid public sharing.
    // Serving the bytes ourselves makes the photo visible either way.
    const params = e && e.parameter ? e.parameter : {};
    if (params.img) return serveImage(String(params.img));

    const programs = loadPrograms();
    return ContentService.createTextOutput(
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        count: programs.length,
        programs: programs,
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ error: String(err), programs: [] })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Streams a Drive file through the script, so it does not need to be public.
 * Apps Script can only return text, so the bytes are base64 encoded and the
 * website turns them into a data URL.
 */
function serveImage(id) {
  try {
    const file = DriveApp.getFileById(id);
    const blob = file.getBlob();
    const base64 = Utilities.base64Encode(blob.getBytes());
    return ContentService.createTextOutput(
      JSON.stringify({
        mime: blob.getContentType() || 'image/jpeg',
        base64: base64,
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ error: String(err), mime: 'image/jpeg', base64: '' })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Where the website should load a photo from.
 *
 * Google Drive refuses to serve files to some other websites and answers
 * "403 Forbidden" in the visitor's browser, even when the file is public.
 * Testing showed this happens with beausejourvoyage.com as the referring page.
 *
 * So the website always goes through this script, which reads the file with
 * the owner's own access and returns the bytes. It works in every case:
 * public files, private files, and accounts that forbid public sharing.
 */
function imageUrlFor(id, sharingStatus) {
  const feed = PropertiesService.getScriptProperties().getProperty('WEB_APP_URL');
  if (!feed) {
    // The script does not know its own address yet: fall back to the direct
    // link so the photo still has a chance of working.
    return driveUrl(id);
  }
  return feed + '?img=' + id;
}

function loadPrograms() {
  const cache = CacheService.getScriptCache();
  if (CACHE_SECONDS > 0) {
    const cached = cache.get('programs');
    if (cached) return JSON.parse(cached);
  }

  // A row deleted in the sheet must not be re-imported from the form.
  // Checked BEFORE the import, against what was published last time.
  try {
    noticeDeletedRows();
  } catch (err) {
    console.error('Could not check for deletions: ' + err);
  }

  // Import anything the form received but that is not in "programs" yet.
  // Wrapped so a failure here can never break the website.
  try {
    importMissingRows();
  } catch (err) {
    console.error('Catch-up failed (the feed will still be served): ' + err);
  }

  // Record the baseline for the next deletion check, now that the sheet holds
  // everything it should. Without this, the very first read would store an
  // empty list and the next one would look like "everything was deleted".
  try {
    rememberPublishedRows();
  } catch (err) {
    console.error('Could not record the published list: ' + err);
  }

  const programs = readPrograms();
  if (CACHE_SECONDS > 0) cache.put('programs', JSON.stringify(programs), CACHE_SECONDS);
  return programs;
}

// -----------------------------------------------------------------------------
// Catch-up: import form submissions that are not in "programs" yet
// -----------------------------------------------------------------------------

function importMissingRows() {
  const intake = intakeRows();
  if (!intake.length) return 0;

  const existing = existingKeys();
  const retry = programsWithFailedPhoto();
  let imported = 0;
  let repaired = 0;
  let skipped = 0;

  for (const row of intake) {
    const title = normalize(row.title);
    if (!title) continue;

    // Already published: retry the photo if sharing failed last time.
    if (existing.has(title)) {
      const rowNumber = retry.get(title);
      if (rowNumber && row.photo) {
        try {
          const imageUrl = resolvePhotoUrl(row.photo);
          if (imageUrl) {
            updateProgramPhoto(rowNumber, imageUrl);
            repaired++;
            console.log('Photo repaired: ' + row.title);
          }
        } catch (err) {
          console.error('Could not repair the photo of "' + row.title + '": ' + err);
        }
      }
      continue;
    }

    // Deleted on purpose: the owner hid it in the sheet. Never bring it back.
    if (isDeleted(title)) {
      skipped++;
      continue;
    }

    // New program.
    try {
      const imageUrl = resolvePhotoUrl(row.photo);
      appendProgram({
        title: row.title,
        price: row.price,
        description: row.description,
        image_url: imageUrl,
        created_at: row.timestamp,
      });
      existing.add(title);
      imported++;
      console.log('Imported program: ' + row.title);
    } catch (err) {
      // One bad row must never stop the others.
      console.error('Could not import "' + row.title + '": ' + err);
    }
  }

  if (imported > 0 || repaired > 0) CacheService.getScriptCache().remove('programs');
  return imported;
}

/**
 * Same as the catch-up, but run straight after a submission.
 * Kept because a background trigger is faster when it happens to work,
 * and importMissingRows makes sure it can never create a duplicate.
 */
function onFormSubmit(e) {
  try {
    importMissingRows();
  } catch (err) {
    console.error('onFormSubmit failed: ' + err);
  }
}

/**
 * Programs the owner deleted from the "programs" tab.
 *
 * Deleting a row there removes it from the website, but the form still holds
 * the submission, so the catch-up would otherwise put it straight back. Each
 * deletion is therefore remembered by title, permanently, in Script
 * Properties: what you delete stays deleted.
 *
 * To publish it again, use the menu: "6. Restore a deleted program".
 */
function deletedKeys() {
  const raw = PropertiesService.getScriptProperties().getProperty('DELETED_PROGRAMS');
  if (!raw) return new Set();
  const keys = new Set();
  const parts = raw.split('\n');
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i].trim();
    if (key) keys.add(key);
  }
  return keys;
}

function isDeleted(title) {
  return deletedKeys().has(normalize(title));
}

function rememberDeleted(title) {
  const props = PropertiesService.getScriptProperties();
  const keys = deletedKeys();
  keys.add(normalize(title));
  props.setProperty('DELETED_PROGRAMS', Array.from(keys).join('\n'));
}

function forgetDeleted(title) {
  const props = PropertiesService.getScriptProperties();
  const keys = deletedKeys();
  keys.delete(normalize(title));
  props.setProperty('DELETED_PROGRAMS', Array.from(keys).join('\n'));
}

/**
 * Notices rows that disappeared from the "programs" tab and remembers them.
 * Called before reading the feed, so a deletion takes effect immediately
 * instead of the program coming back on the next request.
 */
function noticeDeletedRows() {
  const stored = PropertiesService.getScriptProperties().getProperty('KNOWN_PROGRAMS') || '';
  if (!stored) return; // nothing published yet, nothing can have been deleted

  const current = publishedTitles();
  const parts = stored.split('\n');
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i].trim();
    if (!key) continue;
    if (!current.has(key)) rememberDeleted(key); // used to be there, now it is not
  }
}

/** Stores what is published right now, for the next deletion check. */
function rememberPublishedRows() {
  const props = PropertiesService.getScriptProperties();
  const next = Array.from(publishedTitles()).join('\n');
  const stored = props.getProperty('KNOWN_PROGRAMS') || '';
  if (next !== stored) props.setProperty('KNOWN_PROGRAMS', next);
}

function publishedTitles() {
  const keys = new Set();
  const sheet = programsSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return keys;

  const rows = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  for (let i = 0; i < rows.length; i++) {
    const key = normalize(rows[i][0]);
    if (key) keys.add(key);
  }
  return keys;
}

/**
 * Keys of what is already published, so nothing is imported twice.
 */
function existingKeys() {
  const sheet = programsSheet();
  const lastRow = sheet.getLastRow();
  const keys = new Set();
  if (lastRow < 2) return keys;

  const rows = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  for (let i = 0; i < rows.length; i++) {
    const key = normalize(rows[i][1]);
    if (key) keys.add(key);
  }
  return keys;
}

/** Programs whose photo is not public yet: normalized title -> sheet row. */
function programsWithFailedPhoto() {
  const sheet = programsSheet();
  const lastRow = sheet.getLastRow();
  const map = new Map();
  if (lastRow < 2) return map;

  const docProps = PropertiesService.getDocumentProperties();
  const rows = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  for (let i = 0; i < rows.length; i++) {
    const id = extractDriveId(String(rows[i][4] || ''));
    if (!id) continue;
    if (!docProps.getProperty('PHOTO_FAILED_' + id)) continue;
    map.set(normalize(rows[i][1]), i + 2); // +2 -> 1-based sheet row
  }
  return map;
}

/** Replaces the photo of an already published program. */
function updateProgramPhoto(rowNumber, imageUrl) {
  programsSheet().getRange(rowNumber, 5).setValue(imageUrl || '');
}

function normalize(value) {
  return String(value == null ? '' : value)
    .replace(/[\sـ]+/g, ' ')
    .trim()
    .toLowerCase();
}

// -----------------------------------------------------------------------------
// The form intake sheet
// -----------------------------------------------------------------------------

function intakeRows() {
  const sheet = intakeSheet();
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const col = {};
  for (let i = 0; i < headers.length; i++) {
    col[String(headers[i]).trim()] = i;
  }

  // If the form labels are different, fall back to position.
  const iTitle = col[FIELD.title] != null ? col[FIELD.title] : 1;
  const iPrice = col[FIELD.price] != null ? col[FIELD.price] : 2;
  const iDesc = col[FIELD.description] != null ? col[FIELD.description] : 3;
  const iPhoto = col[FIELD.photo] != null ? col[FIELD.photo] : 4;

  const width = sheet.getLastColumn();
  const values = sheet.getRange(2, 1, lastRow - 1, width).getValues();
  const rows = [];

  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    const at = iTitle < width ? v[iTitle] : '';
    if (!at || !String(at).trim()) continue;

    rows.push({
      title: String(at).trim(),
      price: iPrice < width ? String(v[iPrice] || '').trim() : '',
      description: iDesc < width ? String(v[iDesc] || '').trim() : '',
      photo: iPhoto < width ? cellText(v[iPhoto]) : '',
      timestamp: new Date(v[0]).toISOString(),
    });
  }

  return rows;
}

/** A cell can hold a plain name or a Drive hyperlink formula. */
function cellText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  const text = String(value).trim();
  return text === 'null' || text === 'undefined' ? '' : text;
}

function intakeSheet() {
  const ss = openSpreadsheet();

  const remembered = PropertiesService.getScriptProperties().getProperty('INTAKE_TAB_NAME');
  if (remembered) {
    const sheet = ss.getSheetByName(remembered);
    if (sheet) return sheet;
  }

  // The first tab that is not "programs" and looks like a form response sheet.
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    if (sheet.getName() === PROGRAMS_TAB) continue;
    if (sheet.getLastRow() < 1) continue;

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].join(' ');
    if (headers.indexOf(FIELD.title) >= 0) {
      PropertiesService.getScriptProperties().setProperty('INTAKE_TAB_NAME', sheet.getName());
      return sheet;
    }
  }
  return null;
}

// -----------------------------------------------------------------------------
// Photos
// -----------------------------------------------------------------------------

/**
 * Returns a public link for the photo of an intake row.
 * The form stores only the file NAME, so we look the file up in Drive and
 * switch it to "anyone with the link" so the website can display it.
 *
 * The sharing step is the fragile part: if it fails we report it loudly and
 * remember the broken id, so the next feed request tries again instead of
 * publishing a link that asks visitors to sign in.
 */
function resolvePhotoUrl(cellValue) {
  const text = cellText(cellValue);
  if (!text) return '';

  let id = '';
  try {
    const linked = extractDriveId(text);
    if (linked) {
      id = linked;
    } else {
      const file = findFileByName(text);
      if (!file) {
        console.warn('Photo not found in Drive: ' + text);
        return '';
      }
      id = file.getId();
    }
  } catch (err) {
    console.error('Could not locate the photo "' + text + '": ' + err);
    return '';
  }

  const status = ensurePublic(id);
  if (status !== 'ok') rememberFailedPhoto(id, status);
  else forgetFailedPhoto(id);

  // Always route through the script: Drive blocks hotlinks from the website
  // with a 403 even for public files.
  return imageUrlFor(id, status);
}

/**
 * Makes a Drive file readable by anyone with the link.
 * Returns: 'ok' | 'no-access' | 'restricted' | 'error: <detail>'
 */
function ensurePublic(id) {
  let file;
  try {
    file = DriveApp.getFileById(id);
  } catch (err) {
    const text = String(err);
    console.error('ensurePublic: cannot open ' + id + ': ' + text);
    return 'error: cannot open file - ' + text;
  }

  try {
    const permission = file.getSharingPermission();
    if (permission && permission.getAccess() !== DriveApp.Access.PRIVATE) return 'ok';
  } catch (err) {
    // Older scripts, or files the API will not describe. Try to share anyway.
    console.warn('getSharingPermission failed on ' + id + ': ' + err);
  }

  const attempts = [
    { access: DriveApp.Access.ANYONE_WITH_LINK, permission: DriveApp.Permission.VIEW },
    { access: DriveApp.Access.ANYONE, permission: DriveApp.Permission.VIEW },
  ];
  let detail = '';

  for (let i = 0; i < attempts.length; i++) {
    try {
      file.setSharing(attempts[i].access, attempts[i].permission);
      return 'ok';
    } catch (err) {
      detail = String(err);
      console.warn('setSharing attempt ' + (i + 1) + ' on ' + id + ' failed: ' + detail);
    }
  }

  return 'restricted - ' + detail;
}

function rememberFailedPhoto(id, reason) {
  const props = PropertiesService.getDocumentProperties();
  props.setProperty('PHOTO_FAILED_' + id, reason + ' @ ' + new Date().toISOString());
  console.warn('Photo ' + id + ' is not public yet (' + reason + '). Will retry.');
}

function forgetFailedPhoto(id) {
  PropertiesService.getDocumentProperties().deleteProperty('PHOTO_FAILED_' + id);
}

/**
 * Pulls a Drive file id out of a link.
 * Real ids are long, but we stay lenient: a false positive only produces a
 * broken image, while being too strict would lose the photo entirely.
 */
function extractDriveId(text) {
  const patterns = [
    /\/d\/([a-zA-Z0-9_-]{6,})/,
    /[?&]id=([a-zA-Z0-9_-]{6,})/,
  ];
  for (let i = 0; i < patterns.length; i++) {
    const match = text.match(patterns[i]);
    if (match) return match[1];
  }
  return '';
}

function driveUrl(id) {
  return 'https://drive.google.com/uc?export=view&id=' + id;
}



function findFileByName(fileName) {
  const folders = uploadFolders();
  const wanted = fileName.trim();

  for (let i = 0; i < folders.length; i++) {
    const byName = folders[i].getFilesByName(wanted);
    while (byName.hasNext()) return byName.next();
  }

  // Google sometimes renames the stored file. Fall back to a partial match.
  for (let i = 0; i < folders.length; i++) {
    const all = folders[i].getFiles();
    while (all.hasNext()) {
      const file = all.next();
      if (file.getMimeType().indexOf('image/') !== 0) continue;
      if (file.getName().indexOf(wanted) >= 0 || wanted.indexOf(file.getName()) >= 0) {
        return file;
      }
    }
  }

  return null;
}

function uploadFolders() {
  const out = [];

  const configured = PropertiesService.getScriptProperties().getProperty('UPLOAD_FOLDER_ID');
  try {
    if (configured) out.push(DriveApp.getFolderById(configured));
  } catch (err) {
    console.warn('Upload folder not accessible: ' + err);
  }

  try {
    const named = DriveApp.getFoldersByName('Form Uploads');
    while (named.hasNext()) out.push(named.next());
  } catch (err) {
    /* ignore */
  }

  if (!out.length) {
    try {
      out.push(DriveApp.getRootFolder());
    } catch (err) {
      /* ignore */
    }
  }

  return out;
}

// -----------------------------------------------------------------------------
// The programs tab (what the website publishes)
// -----------------------------------------------------------------------------

function appendProgram(p) {
  const now = new Date().toISOString();
  programsSheet().appendRow([
    Utilities.getUuid(),
    p.title || '',
    p.price || '',
    p.description || '',
    p.image_url || '',
    'TRUE',
    p.created_at || now,
    now,
  ]);
}

/**
 * Reads the published programs.
 * "active" is FALSE means the owner hides a program without deleting it.
 */
function readPrograms() {
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

  return programs;
}

function openSpreadsheet() {
  const sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (sheetId) return SpreadsheetApp.openById(sheetId);
  const active = SpreadsheetApp.getActive();
  if (!active) throw new Error('No spreadsheet configured. Run setup() first.');
  return active;
}

function programsSheet() {
  const ss = openSpreadsheet();
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
// Setup and diagnostics
// -----------------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚙️ Programs')
    .addItem('1️⃣  Setup (run once)', 'setup')
    .addSeparator()
    .addItem('2️⃣  Show the website feed URL', 'showFeedUrl')
    .addItem('3️⃣  Import pending submissions now', 'runImport')
    .addItem('4️⃣  Check that everything works', 'runChecks')
    .addItem('5️⃣  Fix photos (make them public)', 'runFixPhotos')
    .addItem('6️⃣  Restore a deleted program', 'runRestore')
    .addToUi();
}

/**
 * Menu: bring a deleted program back.
 *
 * Deleting a row in the "programs" tab hides it from the website for good.
 * This undoes that: the program is imported again and shown.
 */
function runRestore() {
  const ui = SpreadsheetApp.getUi();
  const deleted = Array.from(deletedKeys());

  if (!deleted.length) {
    ui.alert('No program has been deleted.\n\nTo hide a program, set "active" to FALSE\ninstead of deleting its row.');
    return;
  }

  const answer = ui.prompt(
    'Restore a program',
    'Deleted programs:\n\n' +
      deleted.map(function (t) { return '   • ' + t; }).join('\n') +
      '\n\nType the exact name of the one to restore:',
    ui.ButtonSet.OK_CANCEL
  );
  if (answer.getSelectedButton() !== ui.Button.OK) return;

  const wanted = normalize(answer.getResponseText());
  if (!wanted) return;
  if (deleted.indexOf(wanted) < 0) {
    ui.alert('No deleted program is named "' + wanted + '".\n\nType the name exactly as shown above.');
    return;
  }

  forgetDeleted(wanted);
  CacheService.getScriptCache().remove('programs');
  importMissingRows();

  ui.alert('Restored. It will be back on the website within a minute.');
}

/**
 * Menu: make every published photo readable by anyone with the link.
 * This is the step that decides whether visitors see the picture or a
 * Google sign-in page.
 */
function runFixPhotos() {
  const programs = readPrograms();
  let fixed = 0;
  let failed = 0;
  const report = [];

  for (let i = 0; i < programs.length; i++) {
    const p = programs[i];
    const id = extractDriveId(String(p.image_url || ''));
    if (!id) continue;

    const status = ensurePublic(id);
    if (status === 'ok') {
      forgetFailedPhoto(id);
      fixed++;
      report.push('   OK      ' + p.title);
    } else {
      failed++;
      rememberFailedPhoto(id, status);
      report.push('   FAILED  ' + p.title + '  (' + status + ')');
    }
  }

  const message =
    'Photos checked: ' + (fixed + failed) + '\n' +
    'Made public: ' + fixed + '\n' +
    'Still failing: ' + failed + '\n\n' +
    report.join('\n');

  if (failed === 0) {
    SpreadsheetApp.getUi().alert(message + '\n\nDone. Reload the website.');
    return;
  }

  SpreadsheetApp.getUi().alert(
    message +
      '\n\n"restricted" usually means this Google account belongs to a ' +
      'Workspace domain that forbids public sharing.\n\n' +
      'How to check: open the photo in Drive, right-click it, ' +
      '"Share" -> "Anyone with the link" -> "Viewer".\n' +
      'If that option is greyed out, ask the Workspace admin to allow it, ' +
      'or put the photos somewhere else.'
  );
}

/**
 * One-time setup. No trigger is required any more: the website imports
 * anything missing every time it asks for the feed.
 */
function setup() {
  const ui = SpreadsheetApp.getUi();

  const sheetIdAnswer = ui.prompt(
    'Setup (1/2)',
    'Paste the ID of this spreadsheet.\n' +
      'It is the part between "/d/" and "/edit" in the URL.\n\n' +
      'Example: 1AbC2dEf3GhI4jKl5MnO6pQr7StU8vWxYz',
    ui.ButtonSet.OK_CANCEL
  );
  if (sheetIdAnswer.getSelectedButton() !== ui.Button.OK) return;
  const sheetId = String(sheetIdAnswer.getResponseText() || '').trim();
  if (!sheetId) return;

  PropertiesService.getScriptProperties().setProperty('SHEET_ID', sheetId);
  const ss = SpreadsheetApp.openById(sheetId);

  // The published tab.
  if (!ss.getSheetByName(PROGRAMS_TAB)) {
    const sheet = ss.insertSheet(PROGRAMS_TAB);
    sheet.getRange(1, 1, 1, 8).setValues([[
      'id', 'title', 'price', 'description', 'image_url', 'active', 'created_at', 'updated_at',
    ]]);
    sheet.setFrozenRows(1);
  }

  // Which tab the form writes to.
  for (let i = 0; i < ss.getSheets().length; i++) {
    const sheet = ss.getSheets()[i];
    if (sheet.getName() === PROGRAMS_TAB) continue;
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].join(' ');
    if (headers.indexOf(FIELD.title) >= 0) {
      PropertiesService.getScriptProperties().setProperty('INTAKE_TAB_NAME', sheet.getName());
      break;
    }
  }

  // Where the form stores the uploaded photos.
  const folderAnswer = ui.prompt(
    'Setup (2/2)',
    'Paste the ID of the Drive folder that receives the form uploads.\n\n' +
      'Open the form, click the photo question, choose "Link to folder",\n' +
      'then copy that folder ID from its URL.\n\n' +
      'You can leave this empty and set it later.',
    ui.ButtonSet.OK_CANCEL
  );
  if (folderAnswer.getSelectedButton() === ui.Button.OK) {
    const folderId = String(folderAnswer.getResponseText() || '').trim();
    if (folderId) PropertiesService.getScriptProperties().setProperty('UPLOAD_FOLDER_ID', folderId);
  }

  // Optional: a background trigger makes new programs appear a little faster.
  const triggerAnswer = ui.prompt(
    'Setup (optional)',
    'Create a background trigger so programs are imported instantly?\n\n' +
      'Not required: the website imports anything missing by itself.\n' +
      'Only useful if you notice a delay of more than a minute.',
    ui.ButtonSet.YES_NO
  );
  if (triggerAnswer.getSelectedButton() === ui.Button.YES) {
    try {
      removeExistingTriggers();
      ScriptApp.newTrigger('onFormSubmit').forSpreadsheet(ss).onFormSubmit().create();
    } catch (err) {
      ui.alert('Could not create the trigger (not a problem): ' + err);
    }
  }

  // Import whatever is already waiting, and show the result.
  let imported = 0;
  try {
    imported = importMissingRows();
  } catch (err) {
    ui.alert('Setup finished, but the first import failed:\n\n' + err);
    return;
  }

  ui.alert(
    'Setup finished.\n\n' +
      'Imported ' + imported + ' pending program(s) from the form.\n\n' +
      'Next: Deploy → New deployment → type "Web app".\n' +
      'Execute as: Me.  Who has access: Anyone.\n' +
      'Then put that /exec URL in your website .env as\n' +
      'PUBLIC_PROGRAMS_FEED_URL'
  );
}

function removeExistingTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onFormSubmit') ScriptApp.deleteTrigger(triggers[i]);
  }
}

function showFeedUrl() {
  const url = PropertiesService.getScriptProperties().getProperty('WEB_APP_URL');
  SpreadsheetApp.getUi().alert(
    url
      ? 'Website feed URL:\n\n' + url + '\n\nPut it in .env as:\nPUBLIC_PROGRAMS_FEED_URL=' + url
      : 'Not set yet.\n\nDeploy → New deployment → type "Web app",\n' +
        'Execute as: Me, Who has access: Anyone.\nThen paste the /exec URL here.'
  );
}

/** Menu: import anything pending, right now. */
function runImport() {
  let imported = 0;
  let message = '';
  try {
    imported = importMissingRows();
    message = 'Imported ' + imported + ' program(s).\n\n';
  } catch (err) {
    message = 'Import failed:\n\n' + err + '\n\n';
  }

  const feed = readPrograms();
  message += 'The website will now publish ' + feed.length + ' program(s).';
  SpreadsheetApp.getUi().alert(message);
}

/** Menu: tell us what is configured and what is missing. */
function runChecks() {
  const props = PropertiesService.getScriptProperties();
  const lines = [];

  lines.push('SHEET_ID ......... ' + (props.getProperty('SHEET_ID') || '❌ not set'));
  lines.push('UPLOAD_FOLDER_ID . ' + (props.getProperty('UPLOAD_FOLDER_ID') || '⚠️ not set'));
  lines.push('WEB_APP_URL ...... ' + (props.getProperty('WEB_APP_URL') || '⚠️ not set'));
  lines.push('Background trigger ' + ScriptApp.getProjectTriggers().length + ' (not required)');
  lines.push('');

  try {
    const intake = intakeRows();
    const existing = existingKeys();
    const pending = intake.filter(function (r) {
      return normalize(r.title) && existing.indexOf(normalize(r.title)) < 0;
    });

    lines.push('Form submissions . ' + intake.length);
    lines.push('Published ........ ' + existing.size);
    lines.push('Waiting to import  ' + pending.length);

    if (pending.length) {
      lines.push('');
      lines.push('Waiting:');
      pending.slice(0, 5).forEach(function (r) {
        lines.push('   • ' + r.title + (r.photo ? '' : '  [no photo]'));
      });
      lines.push('');
      lines.push('Run "3. Import pending submissions now",');
      lines.push('or just reload the website: it imports by itself.');
    }

    // Photos are the part that breaks silently: a link can be stored while the
    // file stays private, and visitors then get a Google sign-in page.
    const programs = readPrograms();
    let publicOk = 0;
    let needsFix = 0;
    let noPhoto = 0;

    for (let i = 0; i < programs.length; i++) {
      const id = extractDriveId(String(programs[i].image_url || ''));
      if (!id) {
        noPhoto++;
        continue;
      }
      const status = ensurePublic(id);
      if (status === 'ok') publicOk++;
      else needsFix++;
    }

    lines.push('');
    lines.push('Photos: ' + publicOk + ' public, ' + needsFix + ' need fixing, ' + noPhoto + ' without a photo');
    if (needsFix > 0) lines.push('Run "5. Fix photos (make them public)".');

    programs.slice(0, 5).forEach(function (p) {
      const id = extractDriveId(String(p.image_url || ''));
      let mark = '[NO PHOTO]';
      if (id) {
        mark = PropertiesService.getDocumentProperties().getProperty('PHOTO_FAILED_' + id)
          ? '[photo NOT public]'
          : '[photo ok]';
      }
      lines.push('   • ' + p.title + '  ' + mark);
    });
  } catch (e) {
    lines.push('');
    lines.push('❌ ' + e);
  }

  SpreadsheetApp.getUi().alert(lines.join('\n'));
}