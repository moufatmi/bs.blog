/**
 * Programs feed - the single source of truth for the website.
 *
 * Data comes from a Google Sheet through a Google Apps Script web app.
 * The agency owner publishes programs by filling a form; the site reads the
 * result here. No build and no deploy are needed for a new program.
 *
 * Setup: docs/GOOGLE-SETUP.md
 */

export interface FeedProgram {
  id: string;
  title: string;
  description: string | null;
  price: string | null;
  image_url: string | null;
  created_at?: string;
  active?: boolean;
}

interface FeedPayload {
  updatedAt?: string;
  count?: number;
  programs?: FeedProgram[];
  error?: string;
}

/** Public web app URL, e.g. https://script.google.com/macros/s/XXXX/exec */
export const FEED_URL: string = (import.meta.env.PUBLIC_PROGRAMS_FEED_URL || '').trim();

/** Browser cache so we do not hit Apps Script on every page view. */
const CACHE_KEY = 'bsv_programs_feed_v1';
const CACHE_TTL_MS = 5 * 60 * 1000;

export function isFeedConfigured(): boolean {
  return FEED_URL.length > 0;
}

/**
 * A missing feed URL produces a silently empty section, which is exactly the
 * kind of problem that goes unnoticed for months. Say it out loud instead.
 */
export function warnIfFeedMissing(): boolean {
  if (isFeedConfigured()) return false;
  console.warn(
    '\n' +
      '='.repeat(66) +
      '\n  WARNING: PUBLIC_PROGRAMS_FEED_URL is not set.\n' +
      '  The programs section will stay empty.\n' +
      '  Local build : add it to the .env file in the project root.\n' +
      '  GitHub build: add it as a repository variable\n' +
      '                (Settings -> Secrets and variables -> Actions -> Variables)\n' +
      '                then push again to rebuild.\n' +
      '='.repeat(66) +
      '\n'
  );
  return true;
}

/**
 * Keeps only the fields the cards need, makes sure every program has an id so
 * the browser can tell new entries from ones already on the page, and drops
 * anything the owner has switched off in the sheet ("active" column).
 */
export function normalizePrograms(raw: unknown): FeedProgram[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: FeedProgram[] = [];
  const seen = new Set<string>();

  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const p = item as Record<string, unknown>;

    // The owner hides a program by setting active to FALSE in the sheet.
    // The script already filters these, but we check again so a stale feed can
    // never publish a program that was supposed to be hidden.
    if (!isActive(p.active)) continue;

    const title = String(p.title ?? '').trim();
    if (!title) continue;

    let id = String(p.id ?? '').trim();
    if (!id || seen.has(id)) {
      // A missing or duplicated id would break the "which card is new?" check.
      id = `${title}-${String(p.created_at ?? '').trim()}-${out.length}`;
    }
    seen.add(id);

    out.push({
      id,
      title,
      description: String(p.description ?? '').trim() || null,
      price: String(p.price ?? '').trim() || null,
      image_url: String(p.image_url ?? '').trim() || null,
      created_at: p.created_at ? String(p.created_at) : undefined,
      active: true,
    });
  }

  return out;
}

function isActive(value: unknown): boolean {
  if (value === undefined || value === null || value === true) return true;
  if (value === false) return false;
  const text = String(value).trim().toLowerCase();
  return !(text === 'false' || text === 'no' || text === '0' || text === 'off');
}

/**
 * Fetches the feed. Never throws: an empty list is returned on any problem so
 * a feed outage can never break the page.
 */
export async function fetchProgramsFeed(options?: {
  url?: string;
  useBrowserCache?: boolean;
}): Promise<FeedProgram[]> {
  const url = (options?.url ?? FEED_URL).trim();
  if (!url) return [];

  if (options?.useBrowserCache && typeof localStorage !== 'undefined') {
    const cached = readBrowserCache(url);
    if (cached) return cached;
  }

  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const payload = (await res.json()) as FeedPayload;
    if (payload?.error) console.error('Programs feed error:', payload.error);

    const programs = normalizePrograms(payload?.programs);
    if (options?.useBrowserCache && typeof localStorage !== 'undefined') {
      writeBrowserCache(url, programs);
    }
    return programs;
  } catch (err) {
    console.error('Could not load the programs feed:', err);
    // Stale data beats an empty section.
    if (options?.useBrowserCache && typeof localStorage !== 'undefined') {
      const stale = readBrowserCache(url, true);
      if (stale) return stale;
    }
    return [];
  }
}

interface BrowserCache {
  at: number;
  programs: FeedProgram[];
}

function readBrowserCache(url: string, allowStale = false): FeedProgram[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BrowserCache & { url?: string };
    if (parsed.url !== url || !Array.isArray(parsed.programs)) return null;
    const age = Date.now() - (parsed.at || 0);
    if (!allowStale && age > CACHE_TTL_MS) return null;
    return normalizePrograms(parsed.programs);
  } catch {
    return null;
  }
}

function writeBrowserCache(url: string, programs: FeedProgram[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ url, at: Date.now(), programs }));
  } catch {
    /* private mode or quota - not important */
  }
}