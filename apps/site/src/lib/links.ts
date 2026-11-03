/**
 * Where the page's links go. The download and source links are the
 * repository's; the sign-in link is the web app, which a deployment names in
 * `VITE_SITE_APP_URL` (root `.env.example`).
 */
const REPOSITORY = 'https://github.com/JordiParraCrespo/ai-subs-tracker';

export const links = {
  download: `${REPOSITORY}/releases`,
  source: REPOSITORY,
  signIn: import.meta.env.VITE_SITE_APP_URL || 'http://localhost:3000',
} as const;
