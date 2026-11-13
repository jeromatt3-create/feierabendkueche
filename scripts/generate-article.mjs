import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import yaml from 'js-yaml';
import { getCategoryBySlug } from '../src/config/site.config.mjs';
import { generateWithGemini, hasGeminiCredentials } from './gemini-client.mjs';
import { slugifyGerman } from './discover-trends.mjs';
import { generatePinImage } from './generate-pins.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT_DIR, 'src', 'content', 'articles');
const IMAGES_DIR = path.join(ROOT_DIR, 'public', 'images', 'articles');

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function splitTitleTwoLines(title, maxChars = 30) {
  const words = String(title || '').split(/\s+/);
  let line1 = '';
  let line2 = '';
  for (const word of words) {
    if ((line1 + ' ' + word).trim().length <= maxChars && !line2) {
      line1 = (line1 + ' ' + word).trim();
    } else {
      line2 = (line2 + ' ' + word).trim();
    }
  }
  if (line2.length > 34) line2 = line2.slice(0, 31).trim() + '...';
  return [line1 || title.slice(0, maxChars), line2];
}

export function buildArticleHeroSvg({ title, categorySlug }) {
  const cat = getCategoryBySlug(categorySlug);
  const accent = cat.accent || '#3f6212';
  const [line1, line2] = splitTitleTwoLines(title);
  const cleanCat = cat.name.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu, '').trim().toUpperCase();

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="55%" stop-color="#c2410c"/>
      <stop offset="100%" stop-color="${escapeXml(accent)}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <circle cx="1040" cy="140" r="190" fill="#ffffff" opacity="0.06"/>
  <circle cx="160" cy="520" r="210" fill="#ffffff" opacity="0.05"/>
  <rect x="80" y="86" width="380" height="46" rx="23" fill="#ffffff" opacity="0.16"/>
  <text x="270" y="116" font-family="DejaVu Sans, Segoe UI, Arial, sans-serif" font-size="21" font-weight="800" fill="#ffffff" text-anchor="middle">${escapeXml(cleanCat)}</text>
  <text x="80" y="250" font-family="DejaVu Sans, Segoe UI, Arial, sans-serif" font-size="50" font-weight="800" fill="#ffffff">${escapeXml(line1)}</text>
  <text x="80" y="322" font-family="DejaVu Sans, Segoe UI, Arial, sans-serif" font-size="50" font-weight="800" fill="#fde68a">${escapeXml(line2)}</text>
  <text x="80" y="405" font-family="DejaVu Sans, Segoe UI, Arial, sans-serif" font-size="26" fill="#e2e8f0">FeierabendKüche  •  Praxisnahe Schritt-für-Schritt-Hilfe</text>
  <rect x="80" y="472" width="320" height="58" rx="12" fill="#3f6212"/>
  <text x="240" y="509" font-family="DejaVu Sans, Segoe UI, Arial, sans-serif" font-size="23" font-weight="800" fill="#ffffff" text-anchor="middle">Jetzt Anleitung lesen</text>
</svg>
`;
}

function buildPrompt(topicObj) {
  const today = new Date().toISOString().slice(0, 10);
  return `
Du bist Chefredakteur für das deutsche Online-Magazin "FeierabendKüche" (Schnelle, günstige Feierabend-Rezepte unter 25 Minuten).
Heutiges Datum: ${today}.
THEMA: "${topicObj.title}" | Keyword: "${topicObj.targetKeyword || topicObj.title}" | Kategorie: "${topicObj.category}".

AUFGABE:
Recherchiere aktuelle, verlässliche Fakten für Deutschland (ohne Erfinden fiktiver Gesetze/Werte) und schreibe einen extrem hilfreichen deutschen Ratgeber (keine Produktwerbung, keine Affiliate-Links!).
3. "servings": Zahl (z. B. 2).
4. "prepMinutes": realistische Gesamtdauer in Minuten als Zahl (z. B. 20).
5. "calories": z. B. "ca. 510 kcal".
6. "costPerServing": z. B. "ca. 2,40 €".
7. "ingredients": 6 bis 8 reale Supermarkt-Zutaten mit NUMERISCHER "amount" (z. B. 250, 1.5), "unit" (g, ml, EL, Stück) und "item".
8. "keyTakeaways": 3 kurze Küchen-Highlights.
9. "steps": 3 konkrete Kochschritte (step, title, summary, tip).
- "bodyMarkdown": ausführlicher, klar gegliederter Praxis-Text auf Deutsch (mind. 750–1.000 Wörter) mit ## Überschriften und Listen.
- "faqs": 3–4 echte Nutzerfragen mit klaren Antworten.

Antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt:
{
  "title": "Prägnanter SEO-Titel (55-75 Zeichen)",
  "description": "Überzeugende Meta-Description (130-160 Zeichen)",
  "keywords": ["Keyword 1", "Keyword 2", "Keyword 3", "Keyword 4"],
  "readingTime": 6,
  "servings": 2,
  "prepMinutes": 18,
  "calories": "ca. 510 kcal",
  "costPerServing": "ca. 2,50 €",
  "ingredients": [{ "amount": 250, "unit": "g", "item": "Zutat" }],
  "keyTakeaways": ["Fakt 1", "Fakt 2", "Fakt 3"],
  "steps": [
    { "step": 1, "title": "Titel", "summary": "Was zu tun ist.", "tip": "Konkreter Praxistipp." },
    { "step": 2, "title": "Titel", "summary": "Was zu tun ist.", "tip": "Konkreter Praxistipp." },
    { "step": 3, "title": "Titel", "summary": "Was zu tun ist.", "tip": "Konkreter Praxistipp." }
  ],
  "faqs": [
    { "question": "Häufige Frage?", "answer": "Klare Antwort." }
  ],
  "bodyMarkdown": "## Hintergrund & Grundlagen\n\n..."
}
`.trim();
}

export async function generateArticle({ topic, category = '', slug = '', dryRun = false } = {}) {
  const fallbackCat = Object.keys({"unter-20-minuten":{"slug":"unter-20-minuten","name":"Unter 20 Minuten","icon":"⏱️","description":"Blitzrezepte für Tage, an denen es nach Feierabend richtig schnell gehen muss.","accent":"#c2410c"},"one-pot-pfanne":{"slug":"one-pot-pfanne","name":"One-Pot & Pfanne","icon":"🍳","description":"Alles aus einem Topf oder einer Pfanne – maximaler Geschmack bei minimalem Abwasch.","accent":"#ea580c"},"ofen-airfryer":{"slug":"ofen-airfryer","name":"Ofen & Airfryer","icon":"🥐","description":"Blechgerichte & knusprige Heißluftfritteusen-Ideen ohne Danebenstehen.","accent":"#d97706"},"meal-prep-buero":{"slug":"meal-prep-buero","name":"Meal-Prep & Büro","icon":"🥗","description":"Vorbereitete Lunchboxen und Resteverwertung, die kalt und aufgewärmt schmecken.","accent":"#3f6212"},"guenstig-kochen":{"slug":"guenstig-kochen","name":"Günstig & Satt","icon":"🥔","description":"Herzhafte Sattmacher aus Vorratszutaten für unter 3 Euro pro Portion.","accent":"#b45309"}})[0];
  const topicObj = typeof topic === 'string'
    ? { title: topic, targetKeyword: topic, category: category || fallbackCat, slug: slug || slugifyGerman(topic) }
    : { ...topic, slug: slug || topic?.slug || slugifyGerman(topic?.title || 'ratgeber'), category: topic?.category || category || fallbackCat };

  const today = new Date().toISOString().slice(0, 10);
  const articlePath = path.join(ARTICLES_DIR, `${topicObj.slug}.md`);
  const imageRelPath = `/images/articles/${topicObj.slug}.svg`;
  const imageAbsPath = path.join(IMAGES_DIR, `${topicObj.slug}.svg`);

  if (dryRun) {
    return { dryRun: true, slug: topicObj.slug, articlePath, imageAbsPath, frontmatterValid: true, promptLength: buildPrompt(topicObj).length, topic: topicObj };
  }
  if (!hasGeminiCredentials()) throw new Error('Fehlender GEMINI_API_KEY.');

  console.log(`🤖 Generiere Beitrag für "FeierabendKüche": "${topicObj.title}" (${topicObj.category})...`);
  const response = await generateWithGemini({ prompt: buildPrompt(topicObj), temperature: 0.45, expectJson: true });
  const p = response.data || {};
  const finalTitle = String(p.title || topicObj.title).trim();

  const fm = {
    title: finalTitle,
    description: String(p.description || finalTitle).trim(),
    pubDate: today,
    updatedDate: today,
    category: topicObj.category,
    heroImage: imageRelPath,
    keywords: Array.isArray(p.keywords) && p.keywords.length ? p.keywords.map(String) : [topicObj.targetKeyword || finalTitle],
    readingTime: Number(p.readingTime) || 6,
    keyTakeaways: Array.isArray(p.keyTakeaways) ? p.keyTakeaways.slice(0, 4).map(String) : [],
    steps: Array.isArray(p.steps) ? p.steps.slice(0, 6).map((s, idx) => ({
      step: Number(s.step) || idx + 1,
      title: String(s.title || `Schritt ${idx + 1}`),
      summary: String(s.summary || ''),
      tip: String(s.tip || ''),
    })) : [],
    faqs: Array.isArray(p.faqs) ? p.faqs.filter((f) => f.question && f.answer).map((f) => ({
      question: String(f.question),
      answer: String(f.answer),
    })) : [],
  };

  if ('editorial-warm' === 'fintech-modern') {
    fm.savingPotential = String(p.savingPotential || '');
    fm.exampleCalculation = Array.isArray(p.exampleCalculation)
      ? p.exampleCalculation.slice(0, 4).map((r) => ({ label: String(r.label || ''), value: String(r.value || '') }))
      : [];
  } else if ('editorial-warm' === 'editorial-warm') {
    fm.servings = Number(p.servings) || 2;
    fm.prepMinutes = Number(p.prepMinutes) || 20;
    fm.calories = String(p.calories || '');
    fm.costPerServing = String(p.costPerServing || '');
    fm.ingredients = Array.isArray(p.ingredients)
      ? p.ingredients.slice(0, 12).map((i) => ({
          amount: Number(i.amount) || 1,
          unit: String(i.unit || 'Stück'),
          item: String(i.item || ''),
        }))
      : [];
  } else if ('editorial-warm' === 'tech-diagnostic') {
    fm.errorCodes = Array.isArray(p.errorCodes) ? p.errorCodes.slice(0, 5).map(String) : [];
    fm.brands = String(p.brands || '');
    fm.selfFixLevel = String(p.selfFixLevel || 'Selbst prüfbar');
    fm.timeRequired = String(p.timeRequired || 'ca. 15 Min.');
    fm.savedCost = String(p.savedCost || '');
  }

  const md = `---\n${yaml.dump(fm, { lineWidth: 1000, noRefs: true }).trim()}\n---\n\n${String(p.bodyMarkdown || '').trim()}\n`;

  await fs.mkdir(ARTICLES_DIR, { recursive: true });
  await fs.mkdir(IMAGES_DIR, { recursive: true });
  await fs.writeFile(articlePath, md, 'utf8');
  await fs.writeFile(imageAbsPath, buildArticleHeroSvg({ title: finalTitle, categorySlug: topicObj.category }), 'utf8');

  const pinRes = await generatePinImage({
    slug: topicObj.slug,
    title: finalTitle,
    categorySlug: topicObj.category,
    steps: fm.steps,
    keyTakeaways: fm.keyTakeaways,
  });

  console.log(`✅ Artikel gespeichert: ${articlePath}`);
  console.log(`📌 Pinterest-Pin gespeichert: ${pinRes.pinAbsPath}`);
  console.log(`📊 Tokens: ${response.usage.totalTokens} | Kosten: ~${response.usage.estimatedEur.toFixed(5)} € | Search Grounding: ${response.groundingUsed ? 'aktiv' : 'aus'}`);

  return { dryRun: false, slug: topicObj.slug, title: finalTitle, category: topicObj.category, articlePath, imageAbsPath, pinAbsPath: pinRes.pinAbsPath, usage: response.usage, productCount: fm.steps.length };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const dryRun = process.argv.includes('--dry-run');
  const topicArg = process.argv.find((a) => a.startsWith('--topic='));
  const catArg = process.argv.find((a) => a.startsWith('--category='));
  const result = await generateArticle({
    topic: topicArg ? topicArg.split('=')[1] : 'Praxisratgeber im Alltag',
    category: catArg ? catArg.split('=')[1] : '',
    dryRun,
  });
  console.log(JSON.stringify(result, null, 2));
}
