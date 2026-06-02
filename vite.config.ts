import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

// Core library build: the self-registering web components + type declarations.
// `npm run dev` serves index.html as a playground instead.
//
// The framework wrappers live in `wrappers/` and are built separately (React +
// Vue via `vite.config.wrappers.ts`, Angular via ng-packagr). They import this
// core by its package name `spinner-games`, so it stays a single shared copy
// and its custom elements are registered exactly once.
export default defineConfig({
  plugins: [dts({ include: ['src'] })],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      // Keep Lit external so consumers dedupe a single copy.
      external: /^lit/,
    },
  },
})
