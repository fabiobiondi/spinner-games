import { defineConfig } from 'vite'

// Build the demo homepage (index.html) as a static site for Vercel.
//
// This is intentionally separate from `vite.config.ts`, which builds the
// publishable npm library in Vite "library mode". Here we want a plain app
// build that bundles index.html + /src/index.ts + /playground/api-explorer.js
// into a self-contained static site under `dist-site/`.
export default defineConfig({
  build: {
    outDir: 'dist-site',
    emptyOutDir: true,
  },
})
