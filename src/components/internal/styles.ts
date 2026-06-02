import { css } from 'lit'

/**
 * The chrome shared by every canvas game: the full-bleed canvas, the start/
 * game-over overlay with its Play button and hint, the DEMO badge, and the
 * focus ring. Identical across all games, so it lives here once.
 *
 * Two things are deliberately NOT here, because they vary per game:
 *  - the `:host` `aspect-ratio` (each game keeps its own `--spinner-<game>-aspect`)
 *  - any game-specific overlay (e.g. pong's `.scores`)
 *
 * The `:host` rule below carries only the parts that are truly common; each game
 * adds a second `:host { aspect-ratio: ... }` block, and the two merge.
 *
 * Usage:
 * ```ts
 * static override styles = [baseStyles, css`:host { aspect-ratio: var(--spinner-pong-aspect, 16 / 10); }`]
 * ```
 */
export const baseStyles = css`
  :host {
    display: block;
    position: relative;
    width: 100%;
    outline: none;
    color: var(--spinner-color, #2caac3);
  }
  /*
   * Panel background, toggled by the \`showBackground\` property (reflected to the
   * \`show-background\` attribute). Defaults to a faint tint of the current
   * \`--spinner-color\`, so it reads on any surface and follows the theme colour;
   * override it with \`--spinner-bg\`. With \`showBackground\` off the attribute is
   * gone and the host stays transparent.
   */
  :host([show-background]) {
    background: var(--spinner-bg, color-mix(in srgb, currentColor 8%, transparent));
  }
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    touch-action: none;
  }
  .overlay {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    gap: 10px;
    background: color-mix(in srgb, currentColor 6%, transparent);
  }
  /*
   * With the panel background off the start/over overlay drops its dimming tint
   * too, so the game (and the Play button) float over the bare page instead of a
   * faint panel.
   */
  :host(:not([show-background])) .overlay {
    background: transparent;
  }
  .overlay p {
    margin: 0;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: clamp(12px, 5cqi, 20px);
    opacity: 0.85;
  }
  .overlay p.hint {
    font-size: clamp(10px, 3.5cqi, 14px);
    opacity: 0.6;
  }
  /*
   * Game over: dim the frozen game and its status/score line to 50% alpha so the
   * Play-again button and the instructions (the hint) stand out as the clear next
   * step. The host carries the \`game-over\` attribute only while the game is over
   * (reflected by SpinnerGame), so idle/playing are untouched. Game-specific
   * chrome (e.g. pong's \`.scores\`) dims via its own \`:host([game-over])\` rule.
   */
  :host([game-over]) canvas,
  :host([game-over]) .overlay p:not(.hint) {
    opacity: 0.5;
  }
  .demo-badge {
    position: absolute;
    top: 6px;
    right: 8px;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: clamp(9px, 3cqi, 12px);
    letter-spacing: 0.18em;
    opacity: 0.5;
    pointer-events: none;
    user-select: none;
  }
  button {
    font: inherit;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: clamp(12px, 5cqi, 18px);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: inherit;
    /* Play / Play again: the game's main colour (currentColor) at 0.5 opacity. */
    background: color-mix(in srgb, currentColor 50%, transparent);
    border: 1.5px solid currentColor;
    border-radius: 4px;
    padding: 0.5em 1.4em;
    cursor: pointer;
    transition: background 0.15s;
  }
  button:hover,
  button:focus-visible {
    background: color-mix(in srgb, currentColor 65%, transparent);
    outline: none;
  }
  /*
   * Play / Play again button sizing on the small layouts. The host is a
   * \`container-type: inline-size\` container, so these queries key off the host's
   * own width. Padding is em-based, so scaling the font-size scales the whole
   * button proportionally.
   *
   * Host widths (demo card width minus 1rem padding + 1px border):
   * xsmall ~122px · small ~226px · medium ~356px · large ~486px.
   *
   * xsmall + small (≤300px): 40% smaller than base — 5cqi → 3cqi, 12px → 7.2px,
   * 18px → 10.8px.
   */
  @container (max-width: 300px) {
    button {
      font-size: clamp(7.2px, 3cqi, 10.8px);
    }
  }
  /*
   * small only (180–300px, i.e. ~226px host; the 180px floor excludes xsmall):
   * 30% larger than the xsmall reduction above — that −40% value × 1.3.
   * Net vs base ≈ 0.6 × 1.3 = 0.78. Source order + the narrower band let this
   * win over the rule above for the small band.
   */
  @container (min-width: 180px) and (max-width: 300px) {
    button {
      font-size: clamp(9.36px, 3.9cqi, 14.04px);
    }
  }
  /*
   * Instructions hint on the small band (180–300px host). The base clamp
   * \`clamp(10px, 3.5cqi, 14px)\` floors at 10px here (3.5cqi ≈ 7.9px at ~226px);
   * nudge it up a little (~+20% floor) so the instructions read more clearly at
   * this size: 10 → 12, 3.5 → 4.2, 14 → 16.
   */
  @container (min-width: 180px) and (max-width: 300px) {
    .overlay p.hint {
      font-size: clamp(12px, 4.2cqi, 16px);
    }
  }
  /*
   * Below the small band (xsmall, <180px host): the host is too narrow for the
   * instructions to be useful, so drop the hint entirely. The 180px ceiling
   * mirrors the small band's 180px floor, keeping the two bands disjoint.
   */
  @container (max-width: 179.98px) {
    .overlay p.hint {
      display: none;
    }
  }
  :host(:focus-visible) {
    box-shadow: 0 0 0 2px color-mix(in srgb, currentColor 40%, transparent);
  }
`
