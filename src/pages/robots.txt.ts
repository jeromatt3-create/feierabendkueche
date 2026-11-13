import type { APIRoute } from 'astro';
import { resolvePublicRootUrl } from '../utils/rss';

export const GET: APIRoute = ({ site }) => {
  const rootUrl = resolvePublicRootUrl(site);
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${rootUrl}/sitemap-index.xml\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
