import { describe, expect, it } from 'vitest';
import { render } from '../entry-server';
import { NAV } from '../sections/site-header';

/**
 * The site ships as the HTML the build prerenders, so these read that HTML.
 * They protect the two things a visitor — or a search engine — gets before
 * any script runs: copy that says what the product does, and links that land.
 */
describe('the prerendered page', () => {
  const html = render();

  it('says what Subtrack is in its one h1', () => {
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain('Use up the AI coding plans you pay for');
    expect(html).toContain('Claude Code and Codex');
  });

  it('has a section for every link in the header', () => {
    // Regression: a nav entry renamed without its section scrolls nowhere.
    for (const { href } of NAV) expect(html).toContain(`id="${href.slice(1)}"`);
  });

  it('never renders an empty link', () => {
    expect(html).not.toMatch(/href=""/);
    expect(html).not.toMatch(/href="#"/);
  });

  it('labels the preview figures as an example', () => {
    // The preview is illustration, not anyone's data, and must say so.
    expect(html).toContain('Example figures');
  });
});
