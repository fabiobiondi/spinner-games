// Vue wrappers for the spinner-games web components.
//
// Vue 3 already consumes custom elements well: in a render function a
// hyphenated tag is treated as a custom element and known reactive properties
// are set as DOM *properties* (not stringified attributes). These thin
// `defineComponent` wrappers add typed props on top of that, so you get
// editor autocomplete and type-checking in templates. Importing the core
// package also registers the underlying custom elements as a side effect.
//
// Usage:
// ```vue
// <script setup lang="ts">
// import { Pong } from 'spinner-games/vue'
// </script>
//
// <template>
//   <Pong autoplay :difficulty="0.6" />
// </template>
// ```
//
// Prefer the raw tags instead? Tell Vue they're custom elements:
// ```ts
// // vite.config.ts
// vue({ template: { compilerOptions: { isCustomElement: (t) => t.startsWith('spinner-') } } })
// ```
// The `GlobalComponents` augmentation at the bottom types those raw tags.

import { defineComponent, h, type PropType } from 'vue'

import 'spinner-games' // registers <spinner-pong>, <spinner-breakout>, ...

type Obstacles = 'walls' | 'cave'

// Props shared by every canvas game (from the `SpinnerGame` base element).
const baseProps = {
  /** Demo mode: the game plays itself and user input is disabled. */
  autoplay: { type: Boolean, default: undefined },
  /** Keep pointer controls working when the pointer leaves the canvas. */
  allowOutsideControls: { type: Boolean, default: undefined },
  /** Paint the panel background behind the game (on by default). */
  showBackground: { type: Boolean, default: undefined },
} as const

/** Vue wrapper for `<spinner-pong>`. */
export const Pong = defineComponent({
  name: 'SpinnerPong',
  props: {
    ...baseProps,
    /** First player to this score wins (default 11). */
    winScore: { type: Number, default: undefined },
    /** Computer skill, 0 (easy) … 1 (very hard); default 0.6. */
    difficulty: { type: Number, default: undefined },
    /** Keep steering with the mouse outside the canvas. */
    trackOutside: { type: Boolean, default: undefined },
  },
  setup(props) {
    return () => h('spinner-pong', { ...props })
  },
})

/** Vue wrapper for `<spinner-breakout>`. */
export const Breakout = defineComponent({
  name: 'SpinnerBreakout',
  props: {
    ...baseProps,
    /** Keep steering the paddle with the mouse outside the canvas. */
    trackOutside: { type: Boolean, default: undefined },
  },
  setup(props) {
    return () => h('spinner-breakout', { ...props })
  },
})

/** Vue wrapper for `<spinner-bubbles>`. */
export const Bubbles = defineComponent({
  name: 'SpinnerBubbles',
  props: {
    ...baseProps,
    /** Keep aiming with the mouse outside the canvas. */
    trackOutside: { type: Boolean, default: undefined },
    /** Seconds between automatic "new row" drops; 0 disables the mechanic. */
    showNewLine: { type: Number, default: undefined },
  },
  setup(props) {
    return () => h('spinner-bubbles', { ...props })
  },
})

/** Vue wrapper for `<spinner-flappy>`. */
export const Flappy = defineComponent({
  name: 'SpinnerFlappy',
  props: {
    ...baseProps,
    /** What to dodge: `walls` (default) or `cave`. */
    obstacles: { type: String as PropType<Obstacles>, default: undefined },
  },
  setup(props) {
    return () => h('spinner-flappy', { ...props })
  },
})

/** Vue wrapper for `<spinner-plinko>`. */
export const Plinko = defineComponent({
  name: 'SpinnerPlinko',
  props: {
    ...baseProps,
    /** Number of peg rows (clamped 4..14; default 8). */
    rows: { type: Number, default: undefined },
    /** Number of scoring slots / peg columns (clamped 4..12; default 7). */
    slots: { type: Number, default: undefined },
    /** Balls you get per run to reach zero (default 10). */
    balls: { type: Number, default: undefined },
    /** Score you start from and burn down to 0 (default 500). */
    startScore: { type: Number, default: undefined },
    /** Keep aiming the drop point with the mouse outside the canvas. */
    trackOutside: { type: Boolean, default: undefined },
  },
  setup(props) {
    return () => h('spinner-plinko', { ...props })
  },
})

// Type the raw custom-element tags for consumers who use them directly in
// templates (with `isCustomElement` configured) instead of the wrappers above.
declare module '@vue/runtime-core' {
  export interface GlobalComponents {
    'spinner-pong': typeof Pong
    'spinner-breakout': typeof Breakout
    'spinner-bubbles': typeof Bubbles
    'spinner-flappy': typeof Flappy
    'spinner-plinko': typeof Plinko
  }
}
