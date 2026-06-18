// React wrappers for the spinner-games web components.
//
// Built on `@lit/react`'s `createComponent`, which gives each custom element a
// real React component: props are forwarded to the element's reactive
// properties (not stringified attributes) and refs point at the element
// instance. The element classes are pulled from the core package, whose import
// also registers the custom elements as a side effect.
//
// Usage:
// ```tsx
// import { Pong } from 'spinner-games/react'
//
// <Pong autoplay difficulty={0.6} />
// ```

import * as React from 'react'
import { createComponent } from '@lit/react'

import {
  SpinnerPong as SpinnerPongElement,
  SpinnerBreakout as SpinnerBreakoutElement,
  SpinnerBubbles as SpinnerBubblesElement,
  SpinnerFlappy as SpinnerFlappyElement,
  SpinnerPlinko as SpinnerPlinkoElement,
} from 'spinner-games'

// None of the games dispatch custom events yet, so `events` is empty for all of
// them. Add entries here (mapping a React prop name to the DOM event name) if a
// component starts emitting events.

/** React wrapper for `<spinner-pong>`. */
export const Pong = createComponent({
  react: React,
  tagName: 'spinner-pong',
  elementClass: SpinnerPongElement,
})

/** React wrapper for `<spinner-breakout>`. */
export const Breakout = createComponent({
  react: React,
  tagName: 'spinner-breakout',
  elementClass: SpinnerBreakoutElement,
})

/** React wrapper for `<spinner-bubbles>`. */
export const Bubbles = createComponent({
  react: React,
  tagName: 'spinner-bubbles',
  elementClass: SpinnerBubblesElement,
})

/** React wrapper for `<spinner-flappy>`. */
export const Flappy = createComponent({
  react: React,
  tagName: 'spinner-flappy',
  elementClass: SpinnerFlappyElement,
})

/** React wrapper for `<spinner-plinko>`. */
export const Plinko = createComponent({
  react: React,
  tagName: 'spinner-plinko',
  elementClass: SpinnerPlinkoElement,
})

// Re-export the element classes too, for refs and instanceof checks.
export {
  SpinnerPongElement,
  SpinnerBreakoutElement,
  SpinnerBubblesElement,
  SpinnerFlappyElement,
  SpinnerPlinkoElement,
}
