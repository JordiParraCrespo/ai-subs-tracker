import type { APIRoute } from 'astro';

import { absolute } from '@/lib/locale';

export const GET: APIRoute = () =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${absolute('/sitemap-index.xml')}\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
