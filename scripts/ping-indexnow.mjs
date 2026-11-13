import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { getCategoryList } from '../src/config/site.config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT_DIR, 'src', 'content', 'articles');
const INDEXNOW_KEY = 'b4e8f2a9c1d34e5f8a7b6c5d4e3f2a1b';
const DEFAULT_LIVE_ROOT = 'https://jeromatt3-create.github.io/feierabendkueche';

function resolveLiveRootUrl() {
  const siteUrl = (process.env.SITE_URL || '').trim().replace(/\/+$/, '');
  const basePath = (process.env.BASE_PATH || '').trim().replace(/\/+$/, '');
  if (!siteUrl || siteUrl.includes('dein-') || siteUrl.includes('localhost') || !siteUrl.startsWith('http')) {
    return DEFAULT_LIVE_ROOT;
  }
  return `${siteUrl}${basePath === '/' ? '' : basePath}`;
}

export async function pingIndexNow() {
  const liveRoot = resolveLiveRootUrl();
  const parsedRoot = new URL(liveRoot);
  const urls = new Set([`${liveRoot}/`, `${liveRoot}/ueber-uns/`]);
  for (const cat of getCategoryList()) urls.add(`${liveRoot}/kategorie/${cat.slug}/`);
  for (const f of (await fs.readdir(ARTICLES_DIR)).sort()) {
    if (f.endsWith('.md')) urls.add(`${liveRoot}/artikel/${f.replace(/\.md$/, '')}/`);
  }
  const urlList = Array.from(urls);
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: parsedRoot.host,
        key: INDEXNOW_KEY,
        keyLocation: `${liveRoot}/${INDEXNOW_KEY}.txt`,
        urlList,
      }),
    });
    console.log(`IndexNow (${DEFAULT_LIVE_ROOT}): HTTP ${res.status} für ${urlList.length} URLs`);
  } catch (err) {
    console.warn('IndexNow Warnung:', err.message);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await pingIndexNow();
}
