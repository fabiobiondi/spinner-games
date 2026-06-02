// Angular wrappers for the spinner-games web components.
//
// Each wrapper is a standalone *directive* whose selector matches the custom
// element's tag. Importing a directive into a component makes Angular treat the
// tag as "known" (so no `CUSTOM_ELEMENTS_SCHEMA` is needed) and gives the tag's
// inputs full type-checking — while rendering the real custom element directly,
// with no extra wrapper node in the DOM.
//
// Inputs are signal inputs (`input()`, stable since Angular 17.1) and are
// forwarded to the element's reactive *properties* (not stringified
// attributes) via an `effect`. Each input defaults to `undefined`, and
// `setProp` skips `undefined` — so an input the consumer never binds leaves the
// custom element's own default untouched. (Signal-input transforms only run on
// bound values, never on the `undefined` default, so the sentinel survives.)
//
// Usage:
// ```ts
// import { SpinnerPong } from 'spinner-games/angular'
//
// @Component({
//   standalone: true,
//   imports: [SpinnerPong],
//   template: `<spinner-pong autoplay [difficulty]="0.6"></spinner-pong>`,
// })
// export class DemoComponent {}
// ```

import {
  Directive,
  ElementRef,
  effect,
  input,
  booleanAttribute,
  numberAttribute,
} from '@angular/core'

type Obstacles = 'walls' | 'cave'

/**
 * Set a DOM property on the host element, but only when the consumer bound the
 * input (`value !== undefined`). Leaving an input unbound preserves the custom
 * element's own default instead of clobbering it with `undefined`.
 */
function setProp(
  el: ElementRef<HTMLElement>,
  prop: string,
  value: unknown,
): void {
  if (value !== undefined) {
    ;(el.nativeElement as unknown as Record<string, unknown>)[prop] = value
  }
}

/** Typed wrapper for `<spinner-pong>`. */
@Directive({ selector: 'spinner-pong', standalone: true })
export class SpinnerPong {
  /** Demo mode: the game plays itself and user input is disabled. */
  readonly autoplay = input(undefined, { transform: booleanAttribute })

  /** Keep pointer controls working when the pointer leaves the canvas. */
  readonly allowOutsideControls = input(undefined, {
    transform: booleanAttribute,
  })

  /** Paint the panel background behind the game (on by default). */
  readonly showBackground = input(undefined, { transform: booleanAttribute })

  /** First player to this score wins (default 11). */
  readonly winScore = input(undefined, { transform: numberAttribute })

  /** Computer skill, 0 (easy) … 1 (very hard); default 0.6. */
  readonly difficulty = input(undefined, { transform: numberAttribute })

  /** Keep steering with the mouse outside the canvas. */
  readonly trackOutside = input(undefined, { transform: booleanAttribute })

  constructor(private readonly el: ElementRef<HTMLElement>) {
    effect(() => setProp(this.el, 'autoplay', this.autoplay()))
    effect(() =>
      setProp(this.el, 'allowOutsideControls', this.allowOutsideControls()),
    )
    effect(() => setProp(this.el, 'showBackground', this.showBackground()))
    effect(() => setProp(this.el, 'winScore', this.winScore()))
    effect(() => setProp(this.el, 'difficulty', this.difficulty()))
    effect(() => setProp(this.el, 'trackOutside', this.trackOutside()))
  }
}

/** Typed wrapper for `<spinner-breakout>`. */
@Directive({ selector: 'spinner-breakout', standalone: true })
export class SpinnerBreakout {
  /** Demo mode: the game plays itself and user input is disabled. */
  readonly autoplay = input(undefined, { transform: booleanAttribute })

  /** Keep pointer controls working when the pointer leaves the canvas. */
  readonly allowOutsideControls = input(undefined, {
    transform: booleanAttribute,
  })

  /** Paint the panel background behind the game (on by default). */
  readonly showBackground = input(undefined, { transform: booleanAttribute })

  /** Keep steering the paddle with the mouse outside the canvas. */
  readonly trackOutside = input(undefined, { transform: booleanAttribute })

  constructor(private readonly el: ElementRef<HTMLElement>) {
    effect(() => setProp(this.el, 'autoplay', this.autoplay()))
    effect(() =>
      setProp(this.el, 'allowOutsideControls', this.allowOutsideControls()),
    )
    effect(() => setProp(this.el, 'showBackground', this.showBackground()))
    effect(() => setProp(this.el, 'trackOutside', this.trackOutside()))
  }
}

/** Typed wrapper for `<spinner-bubbles>`. */
@Directive({ selector: 'spinner-bubbles', standalone: true })
export class SpinnerBubbles {
  /** Demo mode: the game plays itself and user input is disabled. */
  readonly autoplay = input(undefined, { transform: booleanAttribute })

  /** Keep pointer controls working when the pointer leaves the canvas. */
  readonly allowOutsideControls = input(undefined, {
    transform: booleanAttribute,
  })

  /** Paint the panel background behind the game (on by default). */
  readonly showBackground = input(undefined, { transform: booleanAttribute })

  /** Keep aiming with the mouse outside the canvas. */
  readonly trackOutside = input(undefined, { transform: booleanAttribute })

  /** Seconds between automatic "new row" drops; 0 disables the mechanic. */
  readonly showNewLine = input(undefined, { transform: numberAttribute })

  constructor(private readonly el: ElementRef<HTMLElement>) {
    effect(() => setProp(this.el, 'autoplay', this.autoplay()))
    effect(() =>
      setProp(this.el, 'allowOutsideControls', this.allowOutsideControls()),
    )
    effect(() => setProp(this.el, 'showBackground', this.showBackground()))
    effect(() => setProp(this.el, 'trackOutside', this.trackOutside()))
    effect(() => setProp(this.el, 'showNewLine', this.showNewLine()))
  }
}

/** Typed wrapper for `<spinner-flappy>`. */
@Directive({ selector: 'spinner-flappy', standalone: true })
export class SpinnerFlappy {
  /** Demo mode: the game plays itself and user input is disabled. */
  readonly autoplay = input(undefined, { transform: booleanAttribute })

  /** Keep pointer controls working when the pointer leaves the canvas. */
  readonly allowOutsideControls = input(undefined, {
    transform: booleanAttribute,
  })

  /** Paint the panel background behind the game (on by default). */
  readonly showBackground = input(undefined, { transform: booleanAttribute })

  /** What to dodge: `walls` (default) or `cave`. */
  readonly obstacles = input<Obstacles | undefined>(undefined)

  constructor(private readonly el: ElementRef<HTMLElement>) {
    effect(() => setProp(this.el, 'autoplay', this.autoplay()))
    effect(() =>
      setProp(this.el, 'allowOutsideControls', this.allowOutsideControls()),
    )
    effect(() => setProp(this.el, 'showBackground', this.showBackground()))
    effect(() => setProp(this.el, 'obstacles', this.obstacles()))
  }
}

/**
 * All spinner-games directives, for a one-shot import:
 * ```ts
 * imports: [...SPINNER_GAMES_DIRECTIVES]
 * ```
 */
export const SPINNER_GAMES_DIRECTIVES = [
  SpinnerPong,
  SpinnerBreakout,
  SpinnerBubbles,
  SpinnerFlappy,
] as const
