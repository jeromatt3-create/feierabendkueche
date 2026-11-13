import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import yaml from 'js-yaml';
import { getCategoryBySlug } from '../src/config/site.config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT_DIR, 'src', 'content', 'articles');
const PINS_DIR = path.join(ROOT_DIR, 'public', 'images', 'pins');
const FONT = 'DejaVu Sans, Liberation Sans, Segoe UI, Arial, sans-serif';

function stripEmojis(str) {
  return String(str || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu, '').replace(/\s+/g, ' ').trim();
}
function escapeXml(str) {
  return String(str || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function wrapLines(text, maxChars = 24, maxLines = 3) {
  const words = stripEmojis(text).split(/\s+/).filter(Boolean);
  const lines = []; let current = '';
  for (const w of words) {
    const c = current ? `${current} ${w}` : w;
    if (c.length <= maxChars) current = c;
    else {
      if (current) lines.push(current);
      if (lines.length >= maxLines) { current = ''; break; }
      current = w.length > maxChars ? w.slice(0, maxChars - 1) : w;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines.length > 0 ? lines : ['Ratgeber'];
}

export function buildPinSvg({ title, categorySlug, steps = [], keyTakeaways = [] }) {
  const cat = getCategoryBySlug(categorySlug);
  const titleLines = wrapLines(title, 23, 3);
  const startY = titleLines.length <= 2 ? 275 : 245;
  const titleSvg = titleLines.map((l, i) => `<text x="72" y="${startY + i * 72}" font-family="${FONT}" font-size="54" font-weight="800" fill="${i === titleLines.length - 1 ? '#fde68a' : '#ffffff'}">${escapeXml(l)}</text>`).join('\n  ');

  const items = (steps.length ? steps.map((s) => ({ label: `SCHRITT ${s.step}`, title: s.title, sub: s.summary })) : keyTakeaways.map((t, i) => ({ label: `TIPP ${i + 1}`, title: t, sub: '' }))).slice(0, 3);
  const cardsSvg = items.map((pt, idx) => {
    const y = 505 + idx * 256;
    const badgeColor = idx === 0 ? '#3f6212' : idx === 1 ? '#c2410c' : '#0f172a';
    const l1 = wrapLines(pt.title, 36, 1)[0] || '';
    const sub = wrapLines(pt.sub || pt.title, 44, 2);
    return `
  <g transform="translate(72, ${y})">
    <rect width="856" height="226" rx="22" fill="#ffffff" fill-opacity="0.97"/>
    <rect x="28" y="24" width="210" height="40" rx="20" fill="${badgeColor}"/>
    <text x="133" y="51" font-family="${FONT}" font-size="20" font-weight="800" fill="#ffffff" text-anchor="middle">${escapeXml(pt.label)}</text>
    <text x="28" y="112" font-family="${FONT}" font-size="31" font-weight="800" fill="#0f172a">${escapeXml(l1)}</text>
    <text x="28" y="156" font-family="${FONT}" font-size="23" font-weight="500" fill="#475569">${escapeXml(sub[0] || '')}</text>
    <text x="28" y="190" font-family="${FONT}" font-size="23" font-weight="500" fill="#475569">${escapeXml(sub[1] || '')}</text>
  </g>`;
  }).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1500" width="1000" height="1500">
  <defs>
    <linearGradient id="pinBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="56%" stop-color="#c2410c"/>
      <stop offset="100%" stop-color="${escapeXml(cat.accent || '#3f6212')}"/>
    </linearGradient>
  </defs>
  <rect width="1000" height="1500" fill="url(#pinBg)"/>
  <circle cx="880" cy="140" r="240" fill="#ffffff" opacity="0.06"/>
  <rect x="72" y="72" width="430" height="52" rx="26" fill="#ffffff" opacity="0.16"/>
  <text x="287" y="106" font-family="${FONT}" font-size="21" font-weight="800" fill="#ffffff" text-anchor="middle">FEIERABENDKÜCHE  •  REZEPT</text>
  <rect x="524" y="72" width="404" height="52" rx="26" fill="#3f6212"/>
  <text x="726" y="106" font-family="${FONT}" font-size="21" font-weight="800" fill="#ffffff" text-anchor="middle">${escapeXml(stripEmojis(cat.name).toUpperCase())}</text>
  ${titleSvg}
  <text x="72" y="472" font-family="${FONT}" font-size="25" font-weight="600" fill="#e2e8f0">Auf einen Blick – so geht es Schritt für Schritt:</text>
  ${cardsSvg}
  <rect x="72" y="1310" width="856" height="110" rx="20" fill="#0f172a" fill-opacity="0.9" stroke="#fde68a" stroke-width="3"/>
  <text x="500" y="1358" font-family="${FONT}" font-size="27" font-weight="800" fill="#fde68a" text-anchor="middle">Vollständige Anleitung &amp; FAQ lesen</text>
  <text x="500" y="1396" font-family="${FONT}" font-size="22" font-weight="600" fill="#f8fafc" text-anchor="middle">FeierabendKüche</text>
</svg>`;
}

export async function generatePinImage({ slug, title, categorySlug, steps = [], keyTakeaways = [] }) {
  await fs.mkdir(PINS_DIR, { recursive: true });
  const svg = buildPinSvg({ title, categorySlug, steps, keyTakeaways });
  const pinAbsPath = path.join(PINS_DIR, `${slug}.png`);
  const pngBuffer = await sharp(Buffer.from(svg, 'utf8')).png({ quality: 90 }).toBuffer();
  await fs.writeFile(pinAbsPath, pngBuffer);
  return { slug, pinAbsPath, pinRelPath: `/images/pins/${slug}.png`, bytes: pngBuffer.length };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const files = (await fs.readdir(ARTICLES_DIR)).filter((f) => f.endsWith('.md')).sort();
  for (const file of files) {
    const raw = await fs.readFile(path.join(ARTICLES_DIR, file), 'utf8');
    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) continue;
    const data = yaml.load(m[1]);
    await generatePinImage({ slug: file.replace(/\.md$/, ''), title: data.title, categorySlug: data.category, steps: data.steps || [], keyTakeaways: data.keyTakeaways || [] });
  }
  console.log(`✅ Pins für ${files.length} Beiträge erstellt.`);
}
