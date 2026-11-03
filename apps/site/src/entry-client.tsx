import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { Site } from './site';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing from index.html');

const page = (
  <StrictMode>
    <Site />
  </StrictMode>
);

// A build prerenders the page into #root and the browser adopts that markup;
// `vite dev` serves the template empty, so there it renders from scratch.
if (root.firstElementChild) hydrateRoot(root, page);
else createRoot(root).render(page);
