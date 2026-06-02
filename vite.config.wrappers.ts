import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

// React + Vue wrapper build. Emits `dist/react/*` and `dist/vue/*` alongside
// the core output (which is produced first by `vite.config.ts`).
//
// The core is kept external (`spinner-games`) so the wrappers reference the
// single shared copy of the elements instead of bundling — and registering —
// their own. `entryRoot: 'wrappers'` maps `wrappers/react/index.ts` to
// `dist/react/index.*` and `wrappers/vue/index.ts` to `dist/vue/index.*`.
export default defineConfig({
  plugins: [
    dts({
      // No `paths` alias here: the core is resolved via the package's own
      // `exports` (TS self-reference to dist/index.d.ts, built first), so the
      // emitted declarations keep `from 'spinner-games'` instead of a rewritten
      // relative path — and still pick up the real element prop types.
      tsconfigPath: 'tsconfig.wrappers.build.json',
      include: ['wrappers/react', 'wrappers/vue'],
      entryRoot: 'wrappers',
    }),
  ],
  build: {
    // Don't wipe the core / Angular output already in dist.
    emptyOutDir: false,
    lib: {
      entry: {
        'react/index': 'wrappers/react/index.ts',
        'vue/index': 'wrappers/vue/index.ts',
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        /^lit/,
        /^@lit\/react/,
        'react',
        'react-dom',
        'react/jsx-runtime',
        'vue',
        'spinner-games',
      ],
    },
  },
})
