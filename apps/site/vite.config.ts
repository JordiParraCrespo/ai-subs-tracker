import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // One .env, at the monorepo root. Only VITE_-prefixed values reach the page.
  envDir: path.resolve(import.meta.dirname, '../..'),
  plugins: [react({ compiler: true }), tailwindcss()],
  ssr: {
    // The prerender bundle carries the design system and its icons instead of
    // importing every library the design system's barrel names at run time;
    // tree-shaking keeps only what the page renders.
    noExternal: true,
  },
  server: { port: 3002 },
});
