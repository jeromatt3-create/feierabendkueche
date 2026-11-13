import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import 'dotenv/config';

const siteUrl = process.env.SITE_URL || 'https://jeromatt3-create.github.io';
const basePath = process.env.BASE_PATH || '/';

export default defineConfig({
  site: siteUrl,
  base: basePath,
  integrations: [sitemap()],
});
