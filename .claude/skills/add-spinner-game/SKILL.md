---
name: add-spinner-game
description: Scaffold a new canvas mini-game web component for the spinner-games library, wired through every framework wrapper. Use when adding/creating a new game, a new `<spinner-*>` component, or a new loader/spinner, or when the user mentions adding a game to spinner-games.
---

# Add a spinner-games game

A "game" is a self-registering Lit custom element `<spinner-NAME>` that extends
`SpinnerGame`. Adding one fully means touching two groups of files:

- **Code (6 files)** — the component, the core barrel, and the three framework
  wrappers (React, Vue, Angular). Skip any and the game won't be usable from that
  framework.
- **Docs & site (7 files)** — the README, the homepage playground (`index.html`),
  the interactive API explorer (`playground/api-explorer.js`), and the four
  per-framework guides in `docs/`. Skip these and the game ships but is invisible
  on the site and undocumented.

The README's own "Adding a game" section lists only the first three steps — it is
incomplete. Use the full checklist below.

Copy-ready code for every step is in [TEMPLATES.md](TEMPLATES.md). Read it before
writing files.

## Before you start

Ask the user (if not already clear):
- **Game name** — one lowercase word, e.g. `snake`. Tag = `spinner-snake`,
  class = `SpinnerSnake`, React/Vue/Angular name = `Snake`.
- **What it does** — the mechanic, controls, and any game-specific properties
  (like pong's `difficulty` or flappy's `obstacles`).
- **Orientation** — landscape (default) or portrait (set `aspectFallback` and the
  `:host` aspect-ratio accordingly, like `spinner-bubbles`).

## Checklist (do in order)

Code:
- [ ] 1. `src/components/spinner-NAME.ts` — the component (see TEMPLATES.md §1)
- [ ] 2. `src/index.ts` — `export { SpinnerNAME } from './components/spinner-NAME.js'`
- [ ] 3. `wrappers/react/index.ts` — `createComponent` + add to the re-export block
- [ ] 4. `wrappers/vue/index.ts` — `defineComponent` + add to `GlobalComponents`
- [ ] 5. `wrappers/angular/src/spinner-games.directives.ts` — `@Directive` + add to `SPINNER_GAMES_DIRECTIVES`
- [ ] 6. `wrappers/angular/src/public-api.ts` — export the new directive class

Docs & site (see TEMPLATES.md §9):
- [ ] 7. `README.md` — add the tag to the game lists, conventions intro, per-game prop blurb, and project structure
- [ ] 8. `index.html` (homepage) — add a `.game-card`, add the tag to the shared `.game-card` CSS selector, and to the global-controls `querySelectorAll` string
- [ ] 9. `playground/api-explorer.js` — add a `GAMES` entry (label/tag/element/component/props) so the game shows in the interactive Documentation section
- [ ] 10. `docs/web-components.md`, `docs/react.md`, `docs/vue.md`, `docs/angular.md` — add the game to both tables (tag↔class/component and per-game props), plus an example if it has notable props

## The component contract (file 1)

Extend `SpinnerGame` (NOT `LitElement` directly) and `@customElement('spinner-NAME')`.
The base class owns the canvas, DPR sizing, `ResizeObserver`, the rAF loop, the
Play/Game-over overlay, the DEMO badge, `autoplay`, `allowOutsideControls`,
`showBackground`, and `gameState`. You only fill the holes:

**Required abstract methods** — `step(dt)`, `draw()`, `resetRound()`,
`bindPointer()`, `unbindPointer()`.
**Optional hooks** — `onStarted()`, `tick(dt)`, `onKeyDown(e)`, `onKeyUp(e)`,
and the `aspectFallback` field.
**`render()`** — return the `<canvas>`, then compose `this.renderBadge()` and
`this.renderOverlay(message, hint)`.

### Conventions (match the existing games)

- **Styles**: `static override styles = [baseStyles, css\`:host { aspect-ratio: ... }\`]`.
  Add only your own `:host` aspect-ratio + game-specific chrome.
- **Coordinates**: keep simulation state in normalized 0..1 coords so it survives
  resizing untouched; multiply by `viewW`/`viewH` only in `draw()`.
- **Helpers**: import `clamp` and `readColor` from the base; paint with
  `readColor(this)` so `--spinner-color` is honored.
- **No `Math.random()`**: the existing games are deterministic (see pong's `serve`).
  Prefer deterministic motion; if you need variety, derive it from game state.
- **`autoplay`/demo**: while `this.autoplay`, ignore user input and make the game
  drive itself and loop forever (it's used as a loader). Guard input handlers with
  `if (this.autoplay) return`.
- **Tag typing**: end the file with the `declare global { interface
  HTMLElementTagNameMap { 'spinner-NAME': SpinnerNAME } }` block.

## Consistency with the other games (required)

A new game must look and feel like a sibling, not a one-off. Match the existing
games on all three axes — full details and rationale in
[TEMPLATES.md §8](TEMPLATES.md#8--consistency--theming-reference).

- **Visual chrome**: never reinvent the overlay, Play button, DEMO badge, or focus
  ring — they all come from `baseStyles`, which you must spread. Add only your own
  `:host` aspect-ratio and game-specific chrome.
- **Theming = one color knob**: everything draws from `--spinner-color` (default
  `#2caac3`). In `draw()` paint with `readColor(this)`; in CSS use `currentColor` +
  `color-mix(...)`. **Never hardcode a color.** `clearRect` each frame so the
  `--spinner-bg` panel / transparency shows through — don't paint an opaque bg.
- **Text chrome**: font `ui-monospace, "SF Mono", Menlo, monospace`, sizes via
  `clamp(min, Ncqi, max)` (the host is a `container-type: inline-size` container).
- **Game-over dimming**: game-specific chrome dims itself with its own
  `:host([game-over]) .thing { opacity: 0.5 }` (like pong's `.scores`).
- **Properties**: inherit the base props (`autoplay`, `allowOutsideControls`,
  `showBackground`) — don't redefine them. Game-specific props use `@property({
  type: Boolean | Number })`, enums as a string-union type (like flappy's
  `obstacles`), multi-word attributes via explicit `attribute: 'kebab-case'` (like
  `track-outside`). Give every prop a sensible default, clamp numeric ranges, and
  write a JSDoc line per prop plus a `@cssprop` per custom property.
- **Mirror every prop across all 4 surfaces**: core `@property` → React (auto) →
  Vue prop with `default: undefined` → Angular `input(undefined, { transform:
  booleanAttribute | numberAttribute })`. A prop missing from a wrapper is a bug.
- **Controls**: Space/Enter starts; support pointer + keyboard; honor `autoplay`
  (disable input, self-play, loop forever).

## Verify (low-risk: always run)

```bash
npm run typecheck      # tsc for core + wrappers
npm run build          # core + wrappers + angular build must pass
npm run dev            # open the playground and confirm the game renders & plays
```

A game isn't done until typecheck and build are green and you've seen it run.
