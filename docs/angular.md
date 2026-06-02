# Angular

`spinner-games/angular` provides a standalone **directive** per game whose
selector matches the custom element's tag. Importing a directive into a
component:

- makes Angular treat the tag as a known element (no `CUSTOM_ELEMENTS_SCHEMA`
  needed),
- gives the tag's inputs full type-checking,
- renders the real custom element directly — no extra wrapper node in the DOM.

Inputs are forwarded to the element's reactive **properties** (not stringified
attributes), and only when you actually bind them — so any input you leave
unbound keeps the element's own default. Importing the entry also registers the
custom elements for you.

## Install

```bash
npm install spinner-games
```

`@angular/core` is an (optional) peer dependency (`>= 17`) — you already have it
in an Angular app.

> The Angular wrappers are built with `ng-packagr` (partial-Ivy), so they ship
> as a proper Angular library and work with the Angular compiler.

## Usage

Import the directive(s) you need into a standalone component:

```ts
import { Component } from '@angular/core'
import { SpinnerPong } from 'spinner-games/angular'

@Component({
  standalone: true,
  imports: [SpinnerPong],
  template: `<spinner-pong autoplay [difficulty]="0.6"></spinner-pong>`,
})
export class LoaderComponent {}
```

Or pull in every directive at once with the `SPINNER_GAMES_DIRECTIVES` bundle:

```ts
import { Component } from '@angular/core'
import { SPINNER_GAMES_DIRECTIVES } from 'spinner-games/angular'

@Component({
  standalone: true,
  imports: [...SPINNER_GAMES_DIRECTIVES],
  template: `
    <spinner-breakout autoplay></spinner-breakout>
    <spinner-flappy obstacles="cave"></spinner-flappy>
  `,
})
export class LoadersComponent {}
```

Each directive matches a tag:

| Directive          | Selector             |
| ------------------ | -------------------- |
| `SpinnerPong`      | `<spinner-pong>`     |
| `SpinnerBreakout`  | `<spinner-breakout>` |
| `SpinnerBubbles`   | `<spinner-bubbles>`  |
| `SpinnerFlappy`    | `<spinner-flappy>`   |

## Inputs

Use property binding (`[difficulty]="0.6"`) for values; booleans accept the bare
attribute (`autoplay`) thanks to `booleanAttribute`, and numbers are coerced via
`numberAttribute`.

| Directive         | Inputs                                                                |
| ----------------- | --------------------------------------------------------------------- |
| `SpinnerPong`     | `autoplay`, `allowOutsideControls`, `showBackground` (on), `trackOutside`, `winScore` (11), `difficulty` (0.6) |
| `SpinnerBreakout` | `autoplay`, `allowOutsideControls`, `showBackground` (on), `trackOutside`                    |
| `SpinnerBubbles`  | `autoplay`, `allowOutsideControls`, `showBackground` (on), `trackOutside`, `showNewLine` (seconds, 0 = off) |
| `SpinnerFlappy`   | `autoplay`, `allowOutsideControls`, `showBackground` (on), `obstacles` (`'walls'` \| `'cave'`) |

## Styling

### Change the color

Color isn't an input — every game reads the `--spinner-color` CSS custom
property. Set it **inline** in the template:

```html
<spinner-bubbles autoplay style="--spinner-color: #4ade80"></spinner-bubbles>
```

…or in the component's stylesheet, which recolors every instance:

```css
spinner-bubbles {
  --spinner-color: #4ade80; /* green */
}
```

Because it's a CSS custom property it **cascades**, so setting it once on any
ancestor themes everything inside:

```html
<div style="--spinner-color: #e879f9">
  <spinner-pong autoplay></spinner-pong>
  <spinner-bubbles autoplay></spinner-bubbles>
</div>
```

> Note: shadow DOM scopes the games' internal styles, so ordinary
> component-level rules won't leak in — but CSS custom properties **do** pierce
> the shadow boundary, which is exactly why `--spinner-color` works. (Inherited
> custom properties bypass Angular's view encapsulation too.)

### Size

Each game fills its container, so size it by constraining the parent:

```html
<div style="max-width: 320px">
  <spinner-bubbles autoplay></spinner-bubbles>
</div>
```

See the full list of custom properties (`--spinner-bg`, per-game aspect ratios)
in [web components → Styling](./web-components.md#styling).
