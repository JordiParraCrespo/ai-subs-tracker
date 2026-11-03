import { renderToString } from 'react-dom/server';
import { Site } from './site';

/** The page's markup, for `scripts/prerender.mjs` to write into `index.html`. */
export function render() {
  return renderToString(<Site />);
}
