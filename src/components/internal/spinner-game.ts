import { LitElement, html, type PropertyValues, type CSSResultGroup } from 'lit'
import { property, state } from 'lit/decorators.js'
import { baseStyles } from './styles.js'

export type GameState = 'idle' | 'playing' | 'over'

/**
 * Shared base for the canvas mini-games (`pong`, `breakout`, `flappy`,
 * `bubbles`). It owns everything the games do identically:
 *
 *  - the canvas + 2D context, sized for high-DPI screens
 *  - a `ResizeObserver` that keeps the backing store in sync
 *  - the `requestAnimationFrame` loop with a clamped delta time
 *  - the `autoplay` / `allowOutsideControls` properties and `gameState`
 *  - the start/game-over overlay, the DEMO badge, and the focus handling
 *
 * A concrete game fills in the holes via the abstract members
 * (`step`, `draw`, `resetRound`, `bindPointer`, `unbindPointer`) and, where it
 * needs to, the optional hooks (`onStarted`, `tick`, `onKeyDown`, `onKeyUp`,
 * `aspectFallback`). It also supplies its own `render()`, composing
 * {@link renderBadge} and {@link renderOverlay} with its game-specific text and
 * any extra chrome (e.g. pong's scoreboard).
 *
 * Styling: a game's `static styles` should spread {@link baseStyles} and add
 * only its own `:host { aspect-ratio: ... }` (plus any extras):
 * ```ts
 * static override styles = [baseStyles, css`:host { aspect-ratio: var(--spinner-pong-aspect, 16 / 10); }`]
 * ```
 */
export abstract class SpinnerGame extends LitElement {
  /** Re-exported so subclasses can build their `static styles` array. */
  static readonly baseStyles: CSSResultGroup = baseStyles

  /**
   * Demo mode: the game plays itself and user input is disabled. Useful as a
   * loader/spinner.
   */
  @property({ type: Boolean })
  autoplay = false

  /**
   * Let the game's pointer controls work even when the pointer is outside the
   * canvas. Off by default. Lit lowercases the attribute, so
   * `allowOutsideControls` and `allowoutsidecontrols` are equivalent in HTML.
   */
  @property({ type: Boolean })
  allowOutsideControls = false

  /**
   * Whether to paint the panel background behind the game. On by default; set
   * it to `false` to drop the background so the game floats transparently over
   * whatever is behind it (handy when embedding the spinner on a coloured or
   * patterned surface). The background fill is the `--spinner-bg` custom
   * property (a faint tint of `--spinner-color` by default).
   *
   * Reflected to the `show-background` attribute, which the base styles key the
   * background off — so toggling the property updates the look with no redraw.
   */
  @property({ type: Boolean, reflect: true, attribute: 'show-background' })
  showBackground = true

  @state() protected gameState: GameState = 'idle'

  protected canvas!: HTMLCanvasElement
  protected ctx!: CanvasRenderingContext2D
  private resizeObserver?: ResizeObserver
  private rafId = 0
  private lastTime = 0

  // Current canvas size in CSS pixels.
  protected viewW = 0
  protected viewH = 0

  /**
   * Height/width ratio used only as a fallback when the element has no measured
   * height yet (e.g. before layout). Landscape games keep the default; portrait
   * games (bubbles) override it.
   */
  protected aspectFallback = 0.625

  // Stable wrappers so add/removeEventListener pair up. They forward to the
  // overridable `onKeyDown`/`onKeyUp` methods, which default to no-ops.
  private readonly boundKeyDown = (e: KeyboardEvent) => this.onKeyDown(e)
  private readonly boundKeyUp = (e: KeyboardEvent) => this.onKeyUp(e)

  override firstUpdated() {
    this.canvas = this.renderRoot.querySelector('canvas')!
    this.ctx = this.canvas.getContext('2d')!
    // `cqi` units in the styles need the host as a container.
    this.style.containerType = 'inline-size'
    this.tabIndex = 0

    this.measure()
    this.setupCanvas()
    this.resetRound()

    this.resizeObserver = new ResizeObserver(() => {
      this.measure()
      this.setupCanvas()
    })
    this.resizeObserver.observe(this)

    this.bindPointer()
    this.addEventListener('keydown', this.boundKeyDown)
    this.addEventListener('keyup', this.boundKeyUp)

    if (this.autoplay) this.gameState = 'playing'

    this.lastTime = performance.now()
    this.rafId = requestAnimationFrame(this.loop)
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    cancelAnimationFrame(this.rafId)
    this.resizeObserver?.disconnect()
    this.unbindPointer()
    this.removeEventListener('keydown', this.boundKeyDown)
    this.removeEventListener('keyup', this.boundKeyUp)
  }

  override willUpdate(changed: PropertyValues) {
    // Reflect the game-over state to a `game-over` host attribute so the styles
    // can dim the frozen game (canvas, score line, any scoreboard) to 50% while
    // keeping the Play-again button and the instructions at full opacity. It's a
    // plain attribute (not a reactive property), so toggling it here triggers no
    // extra update; idle/playing simply leave it off.
    if (changed.has('gameState')) {
      this.toggleAttribute('game-over', this.over)
    }
  }

  override updated(changed: PropertyValues) {
    // Re-target the pointer listeners when an outside-control flips at runtime.
    // `trackOutside` only exists on the games that declare it; the check is a
    // harmless no-op for those (like flappy) that don't.
    if (
      (changed.has('trackOutside') || changed.has('allowOutsideControls')) &&
      this.canvas
    ) {
      this.unbindPointer()
      this.bindPointer()
    }

    // React to `autoplay` flipping at runtime. The very first update is handled
    // by `firstUpdated` (old value is undefined), so we only act on a genuine
    // toggle: turning it on starts a fresh demo round, turning it off drops the
    // game back to its idle "Play" state.
    if (
      changed.has('autoplay') &&
      changed.get('autoplay') !== undefined &&
      this.canvas
    ) {
      this.resetRound()
      this.gameState = this.autoplay ? 'playing' : 'idle'
    }
  }

  protected measure() {
    const rect = this.getBoundingClientRect()
    this.viewW = rect.width
    this.viewH = rect.height || rect.width * this.aspectFallback
  }

  /** Size the backing store for crisp rendering on high-DPI screens. */
  protected setupCanvas() {
    if (!this.viewW || !this.viewH) return
    const dpr = window.devicePixelRatio || 1
    this.canvas.width = Math.round(this.viewW * dpr)
    this.canvas.height = Math.round(this.viewH * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  /** Start (or restart) a game from the Play button or a keyboard start. */
  protected start = () => {
    this.resetRound()
    this.gameState = 'playing'
    this.onStarted()
    this.focus()
  }

  private loop = (now: number) => {
    const dt = Math.min((now - this.lastTime) / 1000, 0.05)
    this.lastTime = now
    if (this.gameState === 'playing') this.step(dt)
    this.tick(dt)
    this.draw()
    this.rafId = requestAnimationFrame(this.loop)
  }

  // ---- Shared render helpers --------------------------------------------

  protected get over(): boolean {
    return this.gameState === 'over'
  }

  /**
   * Whether the start/over overlay should be hidden: while playing, or in
   * autoplay (the loader runs straight away) until the game ends.
   */
  protected get hideOverlay(): boolean {
    return this.gameState === 'playing' || (this.autoplay && !this.over)
  }

  /** The little DEMO badge, shown only in autoplay. */
  protected renderBadge() {
    return this.autoplay
      ? html`<span class="demo-badge">DEMO</span>`
      : null
  }

  /**
   * The start/game-over overlay: a status line, the Play / Play again button,
   * and a hint. Returns `null` when {@link hideOverlay} is true. The `message`
   * and `hint` are game-specific text the subclass computes per state.
   */
  protected renderOverlay(message: unknown, hint: unknown) {
    if (this.hideOverlay) return null
    return html`
      <div class="overlay">
        <p>${message}</p>
        <button @click=${this.start}>${this.over ? 'Play again' : 'Play'}</button>
        <p class="hint">${hint}</p>
      </div>
    `
  }

  // ---- Hooks for subclasses ---------------------------------------------

  /** Advance the simulation by `dt` seconds. Called only while playing. */
  protected abstract step(dt: number): void

  /** Paint the current frame. Called every frame. */
  protected abstract draw(): void

  /** Reset to a fresh round. Called on init and from {@link start}. */
  protected abstract resetRound(): void

  /** Attach the game's pointer listeners (canvas vs window per controls). */
  protected abstract bindPointer(): void

  /** Detach whatever {@link bindPointer} attached. */
  protected abstract unbindPointer(): void

  /** Runs right after a game starts (e.g. flappy's lift-off flap). */
  protected onStarted(): void {}

  /** Per-frame work that runs even when not playing (e.g. particle fades). */
  protected tick(_dt: number): void {}

  protected onKeyDown(_e: KeyboardEvent): void {}
  protected onKeyUp(_e: KeyboardEvent): void {}
}

// Re-export so games can pull everything they need from one module.
export { baseStyles } from './styles.js'
export { clamp, readColor } from './utils.js'
