# Using the web components (no framework)

`spinner-games` ships as standard [custom elements](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements),
so they work in plain HTML and with any framework. Importing the package once
registers every tag as a side effect — there is no `customElements.define`
boilerplate for you to write.

The tags:

| Tag                  | Element class      |
| -------------------- | ------------------ |
| `<spinner-pong>`     | `SpinnerPong`      |
| `<spinner-breakout>` | `SpinnerBreakout`  |
| `<spinner-bubbles>`  | `SpinnerBubbles`   |
| `<spinner-flappy>`   | `SpinnerFlappy`    |

## Install

```bash
npm install spinner-games
```

## With a bundler (Vite, webpack, etc.)

Import the package once — anywhere that runs before the tags are used (e.g. your
app entry point). That single import registers all four elements.

```js
import 'spinner-games'
```

```html
<spinner-pong></spinner-pong>
<spinner-breakout autoplay></spinner-breakout>
```

Want only one game in your bundle? Import just its element class — the
`@customElement` decorator still registers the tag as a side effect:

```js
import { SpinnerFlappy } from 'spinner-games'
```

```html
<spinner-flappy obstacles="cave"></spinner-flappy>
```

## Without a build step (CDN / ES modules)

Pull the ES module straight from a CDN that serves npm packages
([esm.sh](https://esm.sh), [unpkg](https://unpkg.com), [jsDelivr](https://www.jsdelivr.com)):

```html
<!doctype html>
<html>
  <body>
    <spinner-bubbles autoplay></spinner-bubbles>

    <script type="module">
      import 'https://esm.sh/spinner-games'
    </script>
  </body>
</html>
```

## Setting properties from JavaScript

Attributes set strings; the games also expose typed reactive **properties**.
Booleans (`autoplay`, `trackOutside`, `allowOutsideControls`) work as bare
attributes, while numbers/strings can be set as properties for full fidelity:

```js
const pong = document.querySelector('spinner-pong')
pong.difficulty = 0.8   // property (number)
pong.autoplay = true    // property (boolean)
```

## Props

See [README → Shared conventions](../README.md#shared-conventions) for the full,
authoritative table. In brief:

| Tag                  | Props                                                                 |
| -------------------- | --------------------------------------------------------------------- |
| `<spinner-pong>`     | `autoplay`, `allowOutsideControls`, `showBackground` (on), `trackOutside`, `winScore` (11), `difficulty` (0.6) |
| `<spinner-breakout>` | `autoplay`, `allowOutsideControls`, `showBackground` (on), `trackOutside`                    |
| `<spinner-bubbles>`  | `autoplay`, `allowOutsideControls`, `showBackground` (on), `trackOutside`, `showNewLine` (seconds, 0 = off) |
| `<spinner-flappy>`   | `autoplay`, `allowOutsideControls`, `showBackground` (on), `obstacles` (`walls` \| `cave`)   |

## Styling

Each game fills its parent's width and derives its height from an aspect-ratio
token, so size it by sizing (or constraining) its container:

```html
<div style="max-width: 320px">
  <spinner-pong autoplay></spinner-pong>
</div>
```

CSS custom properties:

| Property                   | Default  | What it sets                                  |
| -------------------------- | -------- | --------------------------------------------- |
| `--spinner-color`          | `#2caac3`| Line / ball / paddle / score color            |
| `--spinner-bg`             | faint `--spinner-color` tint | Panel background when `showBackground` is on |
| `--spinner-pong-aspect`    | `16 / 10`| `<spinner-pong>` width/height ratio           |
| `--spinner-breakout-aspect`| `16 / 10`| `<spinner-breakout>` width/height ratio       |
| `--spinner-bubbles-aspect` | `4 / 5`  | `<spinner-bubbles>` width/height ratio        |
| `--spinner-flappy-aspect`  | `16 / 10`| `<spinner-flappy>` width/height ratio         |

```css
spinner-bubbles {
  --spinner-color: #4ade80;
  --spinner-bubbles-aspect: 1 / 1; /* square */
}
```

To make a game fill a fixed-size parent instead of using its aspect ratio, give
the parent an explicit height and let the element stretch to it.
