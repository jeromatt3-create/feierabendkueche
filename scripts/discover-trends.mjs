import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { SITE_CONFIG, getCategoryList } from '../src/config/site.config.mjs';
import { generateWithGemini, hasGeminiCredentials } from './gemini-client.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT_DIR, 'src', 'content', 'articles');
const QUEUE_PATH = path.join(ROOT_DIR, 'src', 'config', 'topic-queue.json');

export function slugifyGerman(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72);
}

export async function getExistingArticles() {
  try {
    const files = (await fs.readdir(ARTICLES_DIR)).filter((f) => f.endsWith('.md'));
    const items = [];
    for (const file of files) {
      const content = await fs.readFile(path.join(ARTICLES_DIR, file), 'utf8');
      const m = content.match(/^title:\s*["']?(.+?)["']?\s*$/m);
      items.push({ slug: file.replace(/\.md$/, ''), title: m ? m[1] : file.replace(/\.md$/, '') });
    }
    return items;
  } catch { return []; }
}

export async function loadTopicQueue() {
  try { return JSON.parse(await fs.readFile(QUEUE_PATH, 'utf8')); } catch { return []; }
}

export async function markQueueItemPublished(queueId) {
  if (!queueId) return;
  const queue = await loadTopicQueue();
  let updated = false;
  const next = queue.map((item) => {
    if (item.id === queueId) {
      updated = true;
      return { ...item, status: 'published', publishedAt: new Date().toISOString() };
    }
    return item;
  });
  if (updated) await fs.writeFile(QUEUE_PATH, JSON.stringify(next, null, 2) + '\n', 'utf8');
}

export async function discoverNextTopic({ requestedTopic = '', requestedCategory = '', dryRun = false, excludedSlugs = [] } = {}) {
  const validCategories = getCategoryList().map((c) => c.slug);
  const existing = await getExistingArticles();
  const existingSlugs = new Set([...existing.map((e) => e.slug), ...excludedSlugs]);
  const queue = await loadTopicQueue();

  if (requestedTopic) {
    const category = validCategories.includes(requestedCategory) ? requestedCategory : validCategories[0];
    return { title: requestedTopic, slug: slugifyGerman(requestedTopic), category, targetKeyword: requestedTopic, buyerIntent: 'informational', queueId: null, source: 'cli-override', rationale: 'Manuell vorgegebenes Thema.' };
  }

  const pendingQueue = queue.filter((item) => {
    if (item.status === 'published' || existingSlugs.has(item.id)) return false;
    if (requestedCategory && item.category !== requestedCategory) return false;
    return true;
  });

  const queueFallback = pendingQueue[0] || {
    id: `ratgeber-${Date.now()}`,
    category: validCategories.includes(requestedCategory) ? requestedCategory : validCategories[0],
    keyword: 'Schnelle, günstige Feierabend-Rezepte unter 25 Minuten',
    intent: 'informational',
  };

  if (dryRun || !hasGeminiCredentials()) {
    return { title: queueFallback.keyword, slug: slugifyGerman(queueFallback.id || queueFallback.keyword), category: queueFallback.category, targetKeyword: queueFallback.keyword, buyerIntent: 'informational', queueId: queueFallback.id || null, source: dryRun ? 'dry-run-queue' : 'queue-fallback', rationale: 'Aus topic-queue.json gewählt.' };
  }

  const currentMonth = new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  const allowedCategoriesText = Object.values(SITE_CONFIG.categories).map((c) => `- "${c.slug}": ${c.name} (${c.description})`).join('\n');
  const categoryConstraint = requestedCategory ? `WICHTIG: Wähle zwingend Kategorie "${requestedCategory}".` : 'Wähle eine passende Kategorie aus der Liste.';

  const prompt = `
Du bist SEO-Redakteur für das deutsche Portal "FeierabendKüche" (Schnelle, günstige Feierabend-Rezepte unter 25 Minuten).
Saison: ${currentMonth}.

AUFGABE:
Wähle GENAU EIN stark gesuchtes, praxisnahes Long-Tail-Thema für Deutschland (KEINE Produktvergleiche, KEINE Affiliate-Themen!), das noch nicht existiert.

Bereits veröffentlicht (NICHT wiederholen):
${existing.map((e) => `- ${e.title} (${e.slug})`).join('\n')}

Erlaubte Kategorien:
${allowedCategoriesText}
${categoryConstraint}

Queue-Vorschläge:
${pendingQueue.slice(0, 8).map((q) => `- [${q.id}] (${q.category}) ${q.keyword}`).join('\n')}

Antworte AUSSCHLIESSLICH mit validem JSON:
{
  "title": "Klarer deutscher SEO-Titel (55-75 Zeichen)",
  "slug": "url-slug-ohne-umlaute",
  "category": "erlaubte-kategorie",
  "targetKeyword": "Haupt-Suchbegriff",
  "queueId": "id-aus-queue-oder-null",
  "rationale": "Kurze Begründung (1 Satz)."
}
`.trim();

  try {
    const res = await generateWithGemini({ prompt, temperature: 0.35, expectJson: true });
    const pick = res.data;
    const chosenCategory = validCategories.includes(pick.category) ? pick.category : queueFallback.category;
    const slug = slugifyGerman(pick.slug || pick.title);
    if (!slug || existingSlugs.has(slug)) throw new Error(`Slug "${slug}" existiert bereits.`);
    return {
      title: pick.title || queueFallback.keyword,
      slug,
      category: requestedCategory && validCategories.includes(requestedCategory) ? requestedCategory : chosenCategory,
      targetKeyword: pick.targetKeyword || pick.title || queueFallback.keyword,
      buyerIntent: 'informational',
      queueId: pick.queueId || null,
      source: res.groundingUsed ? 'gemini-search-trends' : 'gemini-trends',
      rationale: pick.rationale || 'Gemini Trend-Analyse.',
      usage: res.usage,
    };
  } catch (err) {
    console.warn(`⚠️ Discovery-Fallback (${err.message})`);
    return { title: queueFallback.keyword, slug: slugifyGerman(queueFallback.id || queueFallback.keyword), category: queueFallback.category, targetKeyword: queueFallback.keyword, buyerIntent: 'informational', queueId: queueFallback.id || null, source: 'queue-fallback', rationale: 'Fallback auf topic-queue.json.' };
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const dryRun = process.argv.includes('--dry-run');
  const catArg = process.argv.find((a) => a.startsWith('--category='));
  const res = await discoverNextTopic({ requestedCategory: catArg ? catArg.split('=')[1] : '', dryRun });
  console.log(JSON.stringify(res, null, 2));
}
