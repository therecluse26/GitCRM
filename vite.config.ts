import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { CSP, HEADERS, LEAD_CSP } from './scripts/csp.ts';

// The Content Security Policy goes into the built page only, right after the charset and before
// every script and stylesheet. The dev server needs inline scripts and a WebSocket. The build also
// gets a _headers file for hosts that read one, such as Cloudflare Pages (spec 09).
const csp: Plugin = {
  name: 'gitcrm-csp',
  apply: 'build',
  transformIndexHtml(html, { path }) {
    const charset = '<meta charset="UTF-8" />';
    if (!html.includes(charset)) throw new Error(`${path} needs ${charset}, so the policy can follow it`);
    // lead.html is the public form page (spec 15): its own, smaller policy.
    const policy = path.endsWith('/lead.html') ? LEAD_CSP : CSP;
    return html.replace(charset, `${charset}\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
  },
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: '_headers', source: HEADERS });
  },
};

export default defineConfig({
  // Relative asset paths keep the build host-agnostic (ADR-010).
  base: './',
  build: {
    // The polyfill would become a chunk shared by both pages, and the form page must be one file (spec 15).
    modulePreload: { polyfill: false },
    rollupOptions: { input: { index: fileURLToPath(new URL('./index.html', import.meta.url)), lead: fileURLToPath(new URL('./lead.html', import.meta.url)) } },
  },
  plugins: [react(), tailwindcss(), csp],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
