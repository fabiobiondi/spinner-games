# React

`spinner-games/react` provides a real React component per game, built on
[`@lit/react`](https://www.npmjs.com/package/@lit/react)'s `createComponent`.
Props are forwarded to the element's reactive **properties** (not stringified
attributes), and `ref` points at the underlying custom-element instance.
Importing the wrappers also registers the custom elements for you.

## Install

```bash
npm install spinner-games
```

React is an (optional) peer dependency — you already have it in a React app:

```bash
npm install react react-dom   # >= 18, if not already installed
```

## Usage

```tsx
import { Pong, Flappy } from 'spinner-games/react'

export function Loader() {
  return (
    <>
      <Pong autoplay difficulty={0.6} />
      <Flappy obstacles="cave" />
    </>
  )
}
```

Each component maps to a tag:

| Component  | Renders             |
| ---------- | ------------------- |
| `Pong`     | `<spinner-pong>`    |
| `Breakout` | `<spinner-breakout>`|
| `Bubbles`  | `<spinner-bubbles>` |
| `Flappy`   | `<spinner-flappy>`  |

## Props

| Component  | Props                                                                 |
| ---------- | --------------------------------------------------------------------- |
| `Pong`     | `autoplay`, `allowOutsideControls`, `showBackground` (on), `trackOutside`, `winScore` (11), `difficulty` (0.6) |
| `Breakout` | `autoplay`, `allowOutsideControls`, `showBackground` (on), `trackOutside`                    |
| `Bubbles`  | `autoplay`, `allowOutsideControls`, `showBackground` (on), `trackOutside`, `showNewLine` (seconds, 0 = off) |
| `Flappy`   | `autoplay`, `allowOutsideControls`, `showBackground` (on), `obstacles` (`'walls'` \| `'cave'`) |

Because props map to properties, pass real values (`difficulty={0.6}`,
`autoplay`) rather than strings.

## Refs and `instanceof`

`ref` gives you the actual element instance. The element classes are re-exported
for typing and `instanceof` checks:

```tsx
import { useRef } from 'react'
import { Pong, SpinnerPongElement } from 'spinner-games/react'

function Game() {
  const ref = useRef<SpinnerPongElement>(null)
  // ref.current is the <spinner-pong> DOM element
  return <Pong ref={ref} autoplay />
}
```

## Styling

Style the rendered tag with CSS custom properties (see
[web components → Styling](./web-components.md#styling)). Size the component by
constraining its container:

```tsx
<div style={{ maxWidth: 320 }}>
  <Bubbles autoplay style={{ '--spinner-color': '#4ade80' } as React.CSSProperties} />
</div>
```

> Note: none of the games dispatch custom events yet, so there are no event
> props. They can be added to the wrappers if a game starts emitting events.
