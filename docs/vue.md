# Vue

`spinner-games/vue` provides a typed `defineComponent` wrapper per game. Vue 3
already sets known reactive properties (not stringified attributes) on
hyphenated custom-element tags; these wrappers add typed props on top, so you
get autocomplete and template type-checking. Importing the wrappers also
registers the custom elements for you.

## Install

```bash
npm install spinner-games
```

Vue is an (optional) peer dependency — you already have it in a Vue app:

```bash
npm install vue   # >= 3.3, if not already installed
```

## Usage

Use the wrappers straight from a single-file component:

```vue
<script setup lang="ts">
import { Pong, Bubbles } from 'spinner-games/vue'
</script>

<template>
  <Pong autoplay :difficulty="0.6" />
  <Bubbles autoplay :show-new-line="30" />
</template>
```

Each wrapper maps to a tag:

| Component  | Renders              |
| ---------- | -------------------- |
| `Pong`     | `<spinner-pong>`     |
| `Breakout` | `<spinner-breakout>` |
| `Bubbles`  | `<spinner-bubbles>`  |
| `Flappy`   | `<spinner-flappy>`   |

## Props

Bind numeric/object props with `:` (e.g. `:difficulty="0.6"`); boolean props can
be written bare (`autoplay`). Use kebab-case in templates (`:show-new-line`).

| Component  | Props                                                                 |
| ---------- | --------------------------------------------------------------------- |
| `Pong`     | `autoplay`, `allowOutsideControls`, `showBackground` (on), `trackOutside`, `winScore` (11), `difficulty` (0.6) |
| `Breakout` | `autoplay`, `allowOutsideControls`, `showBackground` (on), `trackOutside`                    |
| `Bubbles`  | `autoplay`, `allowOutsideControls`, `showBackground` (on), `trackOutside`, `showNewLine` (seconds, 0 = off) |
| `Flappy`   | `autoplay`, `allowOutsideControls`, `showBackground` (on), `obstacles` (`'walls'` \| `'cave'`) |

## Prefer the raw tags?

You can skip the wrappers and use the custom-element tags directly. Tell Vue's
compiler they're custom elements so it doesn't try to resolve them as Vue
components:

```ts
// vite.config.ts
import vue from '@vitejs/plugin-vue'

export default {
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.startsWith('spinner-'),
        },
      },
    }),
  ],
}
```

Then import the package once (e.g. in `main.ts`) to register the tags, and use
them anywhere:

```vue
<script setup lang="ts">
import 'spinner-games'
</script>

<template>
  <spinner-flappy autoplay obstacles="cave" />
</template>
```

The package ships a `GlobalComponents` augmentation, so those raw tags are typed
in templates too.

## Styling

Style the tag with CSS custom properties (see
[web components → Styling](./web-components.md#styling)) and size it via its
container:

```vue
<template>
  <div style="max-width: 320px">
    <Bubbles autoplay style="--spinner-color: #4ade80" />
  </div>
</template>
```
