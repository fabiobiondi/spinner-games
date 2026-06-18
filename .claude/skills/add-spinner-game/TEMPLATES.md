# Templates

Copy-ready code for each step. Replace `NAME` (lowercase tag word, e.g. `snake`),
`Name` (PascalCase, e.g. `Snake`) consistently. Tag = `spinner-NAME`,
class = `SpinnerName`, wrapper name = `Name`.

Study an existing game close to yours first: pong/breakout (paddle + pointer),
flappy (single tap/flap, has an enum `obstacles` prop), bubbles (portrait,
`showNewLine` prop). Mirror the closest one.

---

## §1 — `src/components/spinner-NAME.ts`

Minimal skeleton. Fill in the simulation. Add `@property` fields for any
game-specific options.

```ts
import { html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { SpinnerGame, baseStyles, clamp, readColor } from './internal/spinner-game.js'

/**
 * `<spinner-NAME>` — one-line description of the game.
 *
 * Responsive (fills its parent), starts on a Play button, controllable with
 * mouse/touch and/or keyboard. Set `autoplay` for a self-playing demo loader.
 *
 * @cssprop --spinner-color         - draw color (default: #2caac3)
 * @cssprop --spinner-bg            - panel background when showBackground is on
 * @cssprop --spinner-NAME-aspect   - width/height ratio when height is auto
 */
@customElement('spinner-NAME')
export class SpinnerName extends SpinnerGame {
  static override styles = [
    baseStyles,
    css`
      :host {
        aspect-ratio: var(--spinner-NAME-aspect, 16 / 10);
      }
    `,
  ]

  // Example game-specific property — delete or replace.
  // @property({ type: Number }) speed = 1

  // Simulation state in normalized 0..1 coords (survives resize).
  private x = 0.5
  private y = 0.5

  override render() {
    const message = this.over ? 'Game over' : ''
    return html`
      <canvas></canvas>
      ${this.renderBadge()}
      ${this.renderOverlay(message, 'How to play hint here')}
    `
  }

  /** Reset to a fresh round. Called on init and from start(). */
  protected override resetRound() {
    this.x = 0.5
    this.y = 0.5
  }

  /** Advance the simulation by dt seconds. Only called while playing. */
  protected override step(dt: number) {
    // ...move state, detect collisions, set `this.gameState = 'over'` to end.
    // In autoplay, drive the game itself and loop forever (it's a loader).
  }

  /** Paint the current frame. Called every frame. */
  protected override draw() {
    const ctx = this.ctx
    const w = this.viewW
    const h = this.viewH
    if (!w || !h) return
    const color = readColor(this)
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = color
    ctx.fillRect(this.x * w - 6, this.y * h - 6, 12, 12)
  }

  /** Attach pointer/touch listeners (canvas vs window per controls). */
  protected override bindPointer() {
    // this.canvas.addEventListener('pointermove', this.onPointerMove)
  }

  /** Detach whatever bindPointer attached. */
  protected override unbindPointer() {
    // this.canvas?.removeEventListener('pointermove', this.onPointerMove)
  }

  // Optional keyboard control:
  // protected override onKeyDown(e: KeyboardEvent) {
  //   if (this.autoplay) return
  //   if (e.key === ' ' || e.key === 'Enter') {
  //     if (this.gameState !== 'playing') this.start()
  //     e.preventDefault()
  //   }
  // }
}

declare global {
  interface HTMLElementTagNameMap {
    'spinner-NAME': SpinnerName
  }
}
```

Portrait game (like bubbles)? Set `protected override aspectFallback = 1.6` (h/w)
and use a portrait `aspect-ratio` such as `5 / 8`.

---

## §2 — `src/index.ts`

Add one line to the export block:

```ts
export { SpinnerName } from './components/spinner-NAME.js'
```

---

## §3 — `wrappers/react/index.ts`

Import the element class (in the destructured `from 'spinner-games'` block, as
`SpinnerNameElement`), add the wrapper, and add the class to the bottom re-export.

```ts
/** React wrapper for `<spinner-NAME>`. */
export const Name = createComponent({
  react: React,
  tagName: 'spinner-NAME',
  elementClass: SpinnerNameElement,
})
```

If the game ever dispatches custom events, pass an `events: { onThing: 'thing' }`
map (none of the current games do).

---

## §4 — `wrappers/vue/index.ts`

Spread `baseProps`, add only game-specific props, then register the tag in the
`GlobalComponents` augmentation at the bottom.

```ts
/** Vue wrapper for `<spinner-NAME>`. */
export const Name = defineComponent({
  name: 'SpinnerName',
  props: {
    ...baseProps,
    // game-specific props, each `{ type: ..., default: undefined }`
    // speed: { type: Number, default: undefined },
  },
  setup(props) {
    return () => h('spinner-NAME', { ...props })
  },
})
```

```ts
// in declare module '@vue/runtime-core' → GlobalComponents:
'spinner-NAME': typeof Name
```

`default: undefined` is required on every prop so unbound props fall back to the
element's own defaults instead of being clobbered.

---

## §5 — `wrappers/angular/src/spinner-games.directives.ts`

Add a directive whose selector is the tag. Every input defaults to `undefined`
with the right transform (`booleanAttribute` / `numberAttribute`; plain `input()`
for string/enum), and an `effect` forwards it via `setProp`. Then add the class to
`SPINNER_GAMES_DIRECTIVES`.

```ts
/** Typed wrapper for `<spinner-NAME>`. */
@Directive({ selector: 'spinner-NAME', standalone: true })
export class SpinnerName {
  readonly autoplay = input(undefined, { transform: booleanAttribute })
  readonly allowOutsideControls = input(undefined, { transform: booleanAttribute })
  readonly showBackground = input(undefined, { transform: booleanAttribute })
  // game-specific inputs, e.g.:
  // readonly speed = input(undefined, { transform: numberAttribute })

  constructor(private readonly el: ElementRef<HTMLElement>) {
    effect(() => setProp(this.el, 'autoplay', this.autoplay()))
    effect(() => setProp(this.el, 'allowOutsideControls', this.allowOutsideControls()))
    effect(() => setProp(this.el, 'showBackground', this.showBackground()))
    // effect(() => setProp(this.el, 'speed', this.speed()))
  }
}
```

```ts
// add to the array:
export const SPINNER_GAMES_DIRECTIVES = [
  SpinnerPong, SpinnerBreakout, SpinnerBubbles, SpinnerFlappy,
  SpinnerName,
] as const
```

---

## §6 — `wrappers/angular/src/public-api.ts`

Add the class to the named export from `./spinner-games.directives`:

```ts
export {
  SpinnerPong, SpinnerBreakout, SpinnerBubbles, SpinnerFlappy,
  SpinnerName,
  SPINNER_GAMES_DIRECTIVES,
} from './spinner-games.directives'
```

---

## §7 — `README.md`

Add `<spinner-NAME>` to:
- the Status line listing playable games,
- the "Shared conventions" intro list of playable games,
- the conventions table footnotes if it has special control behavior,
- a usage example for any game-specific property,
- the "Project structure" tree (`spinner-NAME.ts  # one-line description`).

---

## §8 — Consistency & theming reference

The whole point of the library is that the games are visually and behaviorally a
**set**. A new game must be indistinguishable in look-and-feel from the others.
The shared chrome and theming live in `src/components/internal/styles.ts` and
`internal/utils.ts` — read them before styling anything.

### Visual chrome — reuse, don't rebuild

`baseStyles` already provides the full-bleed canvas, the start/game-over overlay,
the Play / Play again button, the hint line, the DEMO badge, the panel background,
the responsive button/hint sizing, and the focus ring. So:

- Always `static override styles = [baseStyles, css\`...\`]`. Add **only** your
  `:host { aspect-ratio: ... }` and genuinely game-specific chrome (like pong's
  `.scores`). Never re-declare `.overlay`, `button`, `.demo-badge`, `canvas`, or
  the focus `box-shadow`.
- Name your aspect knob `--spinner-NAME-aspect` and give it a default in the rule.

### Theming — one color, derived everywhere

There is a single theme input: **`--spinner-color`** (default `#2caac3`).
Everything else is derived from it, so users theme a game with one CSS variable.

- **Canvas**: get the color with `readColor(this)` (it resolves `--spinner-color`,
  falling back to `#2caac3`) and use it for every `fillStyle`/`strokeStyle`. Do
  **not** hardcode hex colors in `draw()`.
- **CSS**: use `currentColor` (the host sets `color: var(--spinner-color, ...)`)
  and `color-mix(in srgb, currentColor N%, transparent)` for tints — exactly how
  the button (50%/65%), overlay (6%), and focus ring (40%) are built.
- **Background**: handled by the base via `showBackground` + `--spinner-bg`
  (a faint `currentColor` tint by default). In `draw()` start every frame with
  `ctx.clearRect(0, 0, w, h)` so the panel/transparency shows — never fill an
  opaque background yourself.

### Text & sizing

- Any text you add (scores, labels) uses the mono stack
  `ui-monospace, "SF Mono", Menlo, monospace` and `font-variant-numeric:
  tabular-nums` for numbers (see pong's `.scores`).
- Size with container-query units: `clamp(minPx, Ncqi, maxPx)`. The host is
  `container-type: inline-size`, so everything scales to the host width with no JS.

### Game-over dimming

The base reflects a `game-over` attribute and dims the canvas + status line to
50%. Any game-specific chrome must opt into the same convention:
```css
:host([game-over]) .scores { opacity: 0.5; }
```

### Property / API consistency

- **Inherited, never redefined**: `autoplay`, `allowOutsideControls`,
  `showBackground` live on `SpinnerGame`. Use them; don't re-declare them.
- **Types**: booleans `@property({ type: Boolean })`; numbers `@property({ type:
  Number })` (clamp to a valid range in code, like pong's `difficulty`); enums as a
  TS string-union type + a string property (like flappy's `obstacles`).
- **Attribute names**: single word → Lit lowercases it automatically; multi-word →
  set an explicit kebab attribute, e.g. `@property({ type: Boolean, attribute:
  'track-outside' })`.
- **Defaults**: every prop gets a sensible default so the bare tag just works.
- **Docs**: one JSDoc line per property (mirrored verbatim into the Vue/Angular
  wrappers) and one `@cssprop` per custom property in the class JSDoc.
- **Parity across wrappers**: a game-specific prop must appear in all four places —
  core `@property`, React (forwarded automatically), Vue (`default: undefined`),
  Angular (`input(undefined, { transform: booleanAttribute | numberAttribute })`,
  or plain `input<T>(undefined)` for enums). Mismatched names/types between
  surfaces are the most common bug.

### Controls

Match the shared interaction model: Space/Enter starts a round; support pointer
and (where it fits) keyboard; guard every input handler with
`if (this.autoplay) return`; and in `autoplay` drive the game yourself and restart
forever so it works as a loader/spinner.

---

## §9 — Website docs & playground

A new game ships invisible unless you also register it on the site. Four places:

### §9a — Homepage playground (`index.html`)

Three edits, all small:

1. A card in the games grid (mirror the simplest existing card):
   ```html
   <div class="game-card">
     <h2>Name</h2>
     <spinner-NAME id="NAME"></spinner-NAME>
   </div>
   ```
2. Add the tag to the shared `.game-card` sizing selector:
   ```css
   .game-card spinner-pong,
   .game-card spinner-breakout,
   /* … */
   .game-card spinner-NAME {
     width: 100%;
   }
   ```
3. Add the tag to the global-controls `querySelectorAll` (the string that drives
   all grid games at once from the controls above the grid):
   ```js
   const gridGames = grid.querySelectorAll(
     'spinner-pong, spinner-breakout, spinner-bubbles, spinner-flappy, spinner-NAME'
   )
   ```

Portrait games keep their aspect-ratio automatically (only `width: 100%` is set),
so no special card sizing is needed.

### §9b — Interactive API explorer (`playground/api-explorer.js`)

Add an entry to the `GAMES` object. `props` lists ONLY the game-specific props
(the shared `autoplay` / `showBackground` / `allowOutsideControls` come from
`SHARED_PROPS` automatically; reuse the `TRACK_OUTSIDE` constant if the game has
`trackOutside`). `def` is the element's own default and drives snippet generation.

```js
NAME: {
  label: 'Name',
  tag: 'spinner-NAME',
  element: 'SpinnerName',   // element class / Angular directive name
  component: 'Name',        // React / Vue component name
  props: [
    TRACK_OUTSIDE, // include only if the game has trackOutside
    { key: 'speed', kind: 'number', def: 1, min: 0, max: 10, step: 1, hint: 'short description' },
    // kinds: 'bool' | 'number' (min/max/step) | 'enum' (options: [...])
    // add `attr: 'kebab-name'` for a multi-word attribute
  ],
},
```

### §9c — Per-framework guides (`docs/*.md`)

Each of `docs/web-components.md`, `docs/react.md`, `docs/vue.md`,
`docs/angular.md` has **two tables** plus examples. Add a row to both:

- The name↔tag table — e.g. in `docs/react.md`: `| Name | \`<spinner-NAME>\` |`
  (web-components.md maps `<spinner-NAME>` → `SpinnerName`; angular.md uses the
  directive class name).
- The per-game props table — list the shared props then the game-specific ones
  with defaults, matching the existing rows:
  `| Name | \`autoplay\`, \`allowOutsideControls\`, \`showBackground\` (on), \`trackOutside\`, \`speed\` (1) |`

Add a short usage example if the game has a notable prop (as flappy/bubbles do).

---

## Optional: usage example apps

The repo also has `react-usage/`, `vue-usage/`, `angular-usage/`, and `js-usage/`
demo apps. They're not required for the library to work, but add the new game to
them if you want it shown in the live demos.
