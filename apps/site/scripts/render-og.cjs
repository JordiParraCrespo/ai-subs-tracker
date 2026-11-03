// Renders scripts/og.html to public/og.png (1200×630) in headless Chromium.
// Needs Playwright; run from anywhere: `node apps/site/scripts/render-og.cjs`.
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  // CHROMIUM_PATH: a browser other than the one this Playwright version expects.
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(`file://${path.join(__dirname, 'og.html')}`);
  await page.screenshot({ path: path.join(__dirname, '..', 'public', 'og.png') });
  await browser.close();
})();
