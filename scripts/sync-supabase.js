import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. قراءة متغيرات البيئة من ملف .env
function loadEnv() {
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (key && rest.length > 0) {
      env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

const env = loadEnv();
const supabaseUrl = env.PUBLIC_SUPABASE_URL || 'https://vfmsusxvlzmpvygnsnex.supabase.co';
const supabaseKey = env.PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_33VCCFs6ouSW04ZRuHkXUQ_985Eg4lN';

const supabase = createClient(supabaseUrl, supabaseKey);

// 2. تنظيف وتصحيح رابط الصورة
function cleanImageUrl(url) {
  if (!url) return '';
  if (url.includes('{"Key"')) {
    const match = url.match(/"Key":"([^"]+)"/);
    if (match && match[1]) {
      return `https://vfmsusxvlzmpvygnsnex.supabase.co/storage/v1/object/public/${match[1]}`;
    }
  }
  return url.replace('/program-images/program-images/', '/program-images/');
}

// 3. توليد Slug آمن (ASCII فقط) من أي عنوان: عربي، فرنسي، أو مختلط
//    ملاحظة: الترجمة تقريبية وهدفها قراءة الرابط فقط،
//    العنوان العربي الأصلي يبقى كما هو في الـ frontmatter داخل الملف.
const ARABIC_DIGITS = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

const ARABIC_LETTERS = {
  'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'a', 'ٱ': 'a',
  'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh',
  'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh',
  'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'o', 'غ': 'gh',
  'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
  'ه': 'h', 'ة': 'a', 'و': 'w', 'ى': 'a', 'ي': 'y',
};

// الحروف المركّبة (lam-alef) تُعالج قبل الحروف المفردة
const ARABIC_LIGATURES = { 'لا': 'la', 'لأ': 'la', 'لإ': 'li', 'لآ': 'la' };

// أسماء الملفات المحجوزة في Windows
const WINDOWS_RESERVED = new Set([
  'con', 'prn', 'aux', 'nul',
  'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
  'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9',
]);

const MAX_SLUG_LENGTH = 80;

// تحويل أي نص (عربي/فرنسي/مختلط) إلى كلمات لاتينية ASCII
function toAsciiWords(input) {
  let text = String(input).normalize('NFKC');

  // 1) إزالة التشكيل والتطويل
  text = text.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '');

  // 2) الأرقام العربية/الهندية → أرقام لاتينية
  text = text.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (ch) => ARABIC_DIGITS[ch] ?? ch);

  // 3) الحروف العربية → حروف لاتينية
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const ligature = text.slice(i, i + 2);
    if (ARABIC_LIGATURES[ligature]) {
      out += ARABIC_LIGATURES[ligature];
      i += 1;
      continue;
    }
    const ch = text[i];
    if (ch === 'ء' || ch === 'ئ' || ch === 'ؤ') continue; // همزات لا تُنقل
    out += ARABIC_LETTERS[ch] ?? ch;
  }

  return out;
}

function createSlug(title, id) {
  const suffix = String(id ?? '').slice(0, 8).toLowerCase().replace(/[^a-z0-9]/g, '');
  const fallback = `omra-${suffix || 'program'}`;

  if (!title || !String(title).trim()) return fallback;

  const slug = toAsciiWords(title)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '') // إزالة النبرات الفرنسية (é → e)
    .replace(/[^a-z0-9]+/g, '-')    // أي رمز آخر يصبح فاصلاً
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');

  if (!slug) return fallback;
  if (WINDOWS_RESERVED.has(slug)) return `omra-${slug}`;
  return slug;
}

// قراءة البيانات الوصفية من ملف .mdoc موجود (لمنع التكرار)
function readFrontmatter(filePath) {
  const empty = { title: '', supabaseId: '' };
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const block = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!block) return empty;
    const read = (field) => {
      const m = block[1].match(new RegExp(`^${field}:\\s*"?([\\s\\S]*?)"?\\s*$`, 'm'));
      return m ? m[1].replace(/^"|"$/g, '').trim() : '';
    };
    return { title: read('title'), supabaseId: read('supabaseId') };
  } catch {
    return empty;
  }
}

// توحيد شكل العنوان للمقارنة (تجاهل المسافات المتعددة والتطويل)
function normalizeTitle(title) {
  return String(title ?? '').replace(/[\s\u0640]+/g, ' ').trim().toLowerCase();
}

async function syncPrograms() {
  console.log('🔄 جاري جلب البرامج من Supabase...');
  const { data: programs, error } = await supabase
    .from('programs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ خطأ أثناء جلب البيانات من Supabase:', error.message);
    process.exit(1);
  }

  if (!programs || programs.length === 0) {
    console.log('ℹ️ لا توجد برامج في Supabase للمزامنة.');
    return;
  }

  const omraDir = path.join(rootDir, 'src', 'content', 'omra');
  if (!fs.existsSync(omraDir)) {
    fs.mkdirSync(omraDir, { recursive: true });
  }

  let createdCount = 0;
  let skippedCount = 0;

  // خرائط للمنع العين من تكرار البرنامج نفسه:
  //  byId    : id البرنامج في Supabase -> اسم الملف (مطابقة دقيقة)
  //  byTitle : عنوان الملف القديم (المنشأ يدوياً بدون id) -> اسم الملف
  const byId = new Map();
  const byTitle = new Map();
  for (const file of fs.readdirSync(omraDir).filter((f) => f.endsWith('.mdoc'))) {
    const meta = readFrontmatter(path.join(omraDir, file));
    if (meta.supabaseId) byId.set(meta.supabaseId, file);
    else if (meta.title) byTitle.set(normalizeTitle(meta.title), file);
  }

  for (const prog of programs) {
    const programTitle = prog.title || 'عمرة وجدة';
    const baseSlug = createSlug(programTitle, prog.id);
    let slug = baseSlug;
    let filePath = path.join(omraDir, `${slug}.mdoc`);

    // 1) نفس البرنامج مزامن مسبقاً (طابق الـ id) → لا نفعل شيئاً حفاظاً على تعديلات Keystatic
    if (prog.id && byId.has(prog.id)) {
      console.log(`⏩ تم تخطي "${programTitle}" (مزامن مسبقاً: ${byId.get(prog.id)})`);
      skippedCount++;
      continue;
    }

    // 2) ملف قديم بدون id يحمل نفس العنوان → لا ننشئ نسخة ثانية منه
    const legacyMatch = byTitle.get(normalizeTitle(programTitle));
    if (legacyMatch) {
      console.log(`⏩ تم تخطي "${programTitle}" (موجود مسبقاً باسم: ${legacyMatch})`);
      skippedCount++;
      continue;
    }

    // 3) اسم الملف مستخدم من برنامج آخر → نضيف جزءاً من الـ id لضمان التفرد
    if (fs.existsSync(filePath)) {
      const existing = readFrontmatter(filePath);
      const uniqueSuffix = String(prog.id ?? '').slice(0, 8).toLowerCase().replace(/[^a-z0-9]/g, '');
      slug = uniqueSuffix ? `${baseSlug}-${uniqueSuffix}` : `${baseSlug}-2`;
      filePath = path.join(omraDir, `${slug}.mdoc`);

      if (fs.existsSync(filePath)) {
        console.log(`⏩ تم تخطي "${programTitle}" (الملف موجود مسبقاً: ${slug}.mdoc)`);
        skippedCount++;
        continue;
      }
      console.log(`⚠️  تعارض في الاسم مع "${existing.title}" → تم اعتماد: ${slug}.mdoc`);
    }

    // العنوان العربي يبقى كما هو في الـ frontmatter (تهريب YAML منفصل عن نص Markdown)
    const yamlEscape = (value) => String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const title = yamlEscape(programTitle);
    const description = yamlEscape(prog.description || prog.title || 'برنامج عمرة مع رحلة مباشرة من مطار وجدة أنجاد');
    const image = cleanImageUrl(prog.image_url);
    const price = prog.price || '16 900 DH';

    const mdocContent = `---
title: "${title}"
description: "${description}"
image: "${image}"
price: "${price}"
supabaseId: "${yamlEscape(prog.id ?? '')}"
duration: "15 jours"
features:
  - Vol direct depuis Aéroport Oujda Angads
  - Hôtels 4 étoiles proches du Haram
  - Visa d'entrée Omra inclus
  - Accompagnement religieux et administratif
  - Transferts internes en bus climatisé moderne
availabilityNote: Places limitées - Réservez vite
---
Accomplissez votre **${programTitle}** au départ de **Oujda** avec l'agence **Beauséjour Voyage**.

### المميزات والخدمات المشمولة في هذا العرض:
- **طيران مباشر** ذهاباً وإياباً من مطار وجدة أنجاد.
- **إقامة فندقية مريحة** قريبة من الحرمين الشريفين.
- **مرافقة وتأطير ديني وإداري** من طرف أطر الوكالة طيلة أيام الرحلة.
`;

    fs.writeFileSync(filePath, mdocContent, 'utf-8');
    if (prog.id) byId.set(prog.id, `${slug}.mdoc`);
    console.log(`✅ تم إنشاء برنامج جديد لـ Keystatic: ${slug}.mdoc  ←  "${programTitle}"`);
    createdCount++;
  }

  console.log(`\n🎉 اكتملت المزامنة بنجاح!`);
  console.log(`📄 البرامج الجديدة المنشأة: ${createdCount}`);
  console.log(`🔁 البرامج التي تم تخطيها: ${skippedCount}`);
  console.log(`👉 افتح الآن: http://127.0.0.1:4321/keystatic لرؤيتها وتعديلها مباشرة!`);
}

syncPrograms().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
