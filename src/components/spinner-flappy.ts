import { html, css, type PropertyValues } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { SpinnerGame, baseStyles, readColor } from './internal/spinner-game.js'

/** Which kind of obstacle the ball threads through. */
type Obstacles = 'walls' | 'cave'

interface Pipe {
  x: number // left edge / control-point x, width-fraction (scrolls right -> left)
  gap: number // gap center, height-fraction
  passed: boolean // already counted toward the score
  // Cave mode only: the rocky ceiling and floor at this control point, as
  // height-fractions (0 = top edge, 1 = bottom edge). Undefined for walls.
  top?: number
  bot?: number
}

/**
 * `<spinner-flappy>` — a super-simple Flappy Bird, with a ball for a bird.
 *
 * A ball falls under gravity on a canvas while gapped pipes scroll in from the
 * right; flap to rise and thread each gap. Responsive (fills its parent),
 * starts on a Play button, and is driven with a single input — click/tap or
 * Space/↑/Enter to flap (the first flap also starts the round). Touch a pipe,
 * the floor or fly off the top and it's over.
 *
 * Set the `autoplay` attribute for a self-playing Demo mode: the ball flies
 * itself through the pipes forever and user input is disabled, so it works as a
 * loader/spinner. Set `allowOutsideControls` to let a click anywhere — not just
 * on the canvas — flap. Both are opt-in and off by default.
 *
 * The `obstacles` attribute picks what to dodge: `walls` (default) — the
 * classic paired pipes with a gap — or `cave`, an irregular rocky ceiling and
 * floor with a winding passage to thread between them.
 *
 * The component fills the width of its parent and derives height from
 * `--spinner-flappy-aspect` (default 16/10). To make it fill a fixed-size
 * parent instead, give the element an explicit height in CSS.
 *
 * @example
 * ```html
 * <div style="width: 480px"><spinner-flappy></spinner-flappy></div>
 * <spinner-flappy autoplay></spinner-flappy>
 * <spinner-flappy obstacles="cave"></spinner-flappy>
 * ```
 *
 * @cssprop --spinner-color          - ball/pipe (and cave rock) color (default: #2caac3)
 * @cssprop --spinner-bg             - panel background when showBackground is on (default: faint --spinner-color tint)
 * @cssprop --spinner-flappy-aspect  - width/height ratio when height is auto (default: 16/10)
 */
@customElement('spinner-flappy')
export class SpinnerFlappy extends SpinnerGame {
  static override styles = [
    baseStyles,
    css`
      :host {
        aspect-ratio: var(--spinner-flappy-aspect, 16 / 10);
      }
    `,
  ]

  /**
   * What the ball has to dodge:
   * - `walls` (default) — classic Flappy pipes: paired top/bottom stubs framing
   *   a gap, with open sky between successive pipes.
   * - `cave` — a continuous irregular cave: rocky ceiling and floor everywhere,
   *   with a winding passage to thread between them.
   * Any unrecognized value behaves as `walls`. Lit lowercases the attribute, so
   * `obstacles="cave"` and `OBSTACLES="cave"` are equivalent in HTML.
   */
  @property({ type: String })
  obstacles: Obstacles = 'walls'

  // Guards the runtime `obstacles` re-layout so the initial pass (already done
  // by firstUpdated) doesn't reset twice.
  private obstaclesInited = false

  // State in normalized coordinates (0..1 across each axis) so it survives
  // resizing untouched. Pipe x and speeds are width-fractions; ballY, gravity
  // and the flap impulse are height-fractions.
  private ballY = 0.5
  private ballVY = 0 // height-fraction/s
  private pipes: Pipe[] = []
  private score = 0

  // Deterministic gap generator — seeded from the view width so we steer clear
  // of Math.random (matches the other games' no-RNG convention).
  private rngState = 0x9e3779b9

  // The fixed horizontal position of the ball (width-fraction).
  private readonly birdX = 0.28
  // Proportions (fractions of the relevant axis).
  private readonly ballSize = 0.06 // diameter, fraction of min(width, height)
  private readonly pipeW = 0.16 // width-fraction
  private readonly pipeSpacing = 0.62 // gap between successive pipe left edges
  private readonly gapH = 0.34 // height-fraction of the opening
  private readonly pipeSpeed = 0.42 // scroll speed, width-fraction/s
  private readonly gravity = 2.2 // height-fraction/s^2
  private readonly flapV = 0.62 // upward impulse, height-fraction/s
  private readonly maxFallV = 1.3 // terminal velocity, height-fraction/s

  // Cave-mode tuning. The cave is a chain of control points (reusing `pipes`),
  // each carrying a ceiling/floor. The passage center and half-height take a
  // small bounded random walk between points, so it always stays threadable —
  // important since the autopilot has to fly it forever in demo mode.
  private readonly caveSpacing = 0.22 // control-point spacing, width-fraction
  private readonly caveCenterStep = 0.06 // max passage-center shift per point
  private readonly caveHalfStep = 0.04 // max half-height change per point
  private readonly caveHalfMin = 0.16 // narrowest passage half-height
  private readonly caveHalfMax = 0.24 // widest passage half-height
  private readonly caveEdge = 0.05 // keep rock pinned against both view edges

  override render() {
    const message = this.over ? `${this.score}` : ''
    return html`
      <canvas></canvas>
      ${this.renderBadge()}
      ${this.renderOverlay(message, 'Click or Space to flap')}
    `
  }

  override updated(changed: PropertyValues) {
    // Base handles the `allowOutsideControls` re-bind.
    super.updated(changed)
    // Switching obstacle type after init: rebuild the field so the new style
    // lays out cleanly (walls points carry no cave outline, and vice-versa).
    // firstUpdated already laid out the initial type, so skip that first pass.
    if (changed.has('obstacles')) {
      if (this.obstaclesInited && this.ctx) this.reset()
      this.obstaclesInited = true
    }
  }

  /**
   * Listen for the flap on the canvas (default) or the whole window, so that
   * with `allowOutsideControls` a click anywhere flaps.
   */
  protected override bindPointer() {
    if (this.allowOutsideControls) {
      window.addEventListener('pointerdown', this.onPointerDown)
    } else {
      this.canvas.addEventListener('pointerdown', this.onPointerDown)
    }
  }

  protected override unbindPointer() {
    window.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas?.removeEventListener('pointerdown', this.onPointerDown)
  }

  /** A lift-off flap so the ball doesn't drop the instant a round starts. */
  protected override onStarted() {
    this.flap()
  }

  /** Re-center the ball and lay out a fresh field of obstacles. */
  protected override resetRound() {
    this.ballY = 0.5
    this.ballVY = 0
    this.score = 0
    // Re-seed deterministically from the view so a given layout replays the
    // same, yet different sizes differ — no Math.random.
    this.rngState = (0x9e3779b9 ^ Math.round(this.viewW)) >>> 0
    this.pipes = []
    if (this.obstacles === 'cave') {
      // The cave is continuous, so fill the whole view (and a little off each
      // edge) with control points — the ball has rock above and below from the
      // very first frame.
      for (let x = -this.caveSpacing; x < 1 + this.caveSpacing; x += this.caveSpacing) {
        this.pushObstacle(x)
      }
    } else {
      // Walls: a few pipes starting just past the right edge — a little runway.
      let x = 1.05
      for (let i = 0; i < 3; i++) {
        this.pushObstacle(x)
        x += this.pipeSpacing
      }
    }
  }

  /** Alias kept for the internal callers (`die`, `updated`) that re-lay the field. */
  private reset() {
    this.resetRound()
  }

  /** Append one obstacle (a pipe or a cave control point) at width-fraction `x`. */
  private pushObstacle(x: number) {
    if (this.obstacles === 'cave') {
      const { top, bot } = this.nextCave(this.pipes[this.pipes.length - 1])
      // Points laid out behind the ball at reset are pre-counted; ones that
      // scroll in from the right (x > birdX) are scored as the ball passes them.
      this.pipes.push({ x, gap: (top + bot) / 2, top, bot, passed: x < this.birdX })
    } else {
      this.pipes.push({ x, gap: this.nextGap(), passed: false })
    }
  }

  /** Next gap center, kept clear of the top/bottom so a pipe always shows. */
  private nextGap(): number {
    const margin = this.gapH / 2 + 0.06
    return margin + this.rng() * (1 - 2 * margin)
  }

  /**
   * Next cave ceiling/floor, continuing from the previous control point. The
   * passage center and half-height each take a small bounded random walk, kept
   * within the view edges — so the tunnel wanders and pulses but never closes.
   */
  private nextCave(prev?: Pipe): { top: number; bot: number } {
    if (!prev || prev.top === undefined || prev.bot === undefined) {
      // Seed with a comfortably open, centered mouth so a run always starts clean.
      const hh = (this.caveHalfMin + this.caveHalfMax) / 2
      return { top: 0.5 - hh, bot: 0.5 + hh }
    }
    let center = (prev.top + prev.bot) / 2 + (this.rng() * 2 - 1) * this.caveCenterStep
    let half = (prev.bot - prev.top) / 2 + (this.rng() * 2 - 1) * this.caveHalfStep
    half = Math.max(this.caveHalfMin, Math.min(this.caveHalfMax, half))
    center = Math.max(this.caveEdge + half, Math.min(1 - this.caveEdge - half, center))
    return { top: center - half, bot: center + half }
  }

  /**
   * Cave ceiling/floor at width-fraction `x`, linearly interpolated between the
   * straddling control points. The interpolation matches the straight segments
   * drawn in `draw`, so collision and the visible outline never disagree.
   */
  private caveBounds(x: number): { top: number; bot: number } {
    const pts = this.pipes
    if (!pts.length) return { top: 0, bot: 1 }
    if (x <= pts[0].x) return { top: pts[0].top ?? 0, bot: pts[0].bot ?? 1 }
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      if (x <= b.x) {
        const t = (x - a.x) / (b.x - a.x || 1)
        return {
          top: (a.top ?? 0) + ((b.top ?? 0) - (a.top ?? 0)) * t,
          bot: (a.bot ?? 1) + ((b.bot ?? 1) - (a.bot ?? 1)) * t,
        }
      }
    }
    const last = pts[pts.length - 1]
    return { top: last.top ?? 0, bot: last.bot ?? 1 }
  }

  /** Small deterministic PRNG (xorshift32) — avoids Math.random. */
  private rng(): number {
    let x = this.rngState
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    this.rngState = x >>> 0
    return this.rngState / 0xffffffff
  }

  /** Give the ball an upward kick. */
  private flap() {
    this.ballVY = -this.flapV
  }

  private onPointerDown = (e: PointerEvent) => {
    if (this.autoplay) return // demo mode: input is disabled
    e.preventDefault()
    if (this.gameState === 'playing') this.flap()
    else this.start()
  }

  protected override onKeyDown(e: KeyboardEvent) {
    if (this.autoplay) return // demo mode: input is disabled
    switch (e.key) {
      case ' ':
      case 'ArrowUp':
      case 'Enter':
        if (this.gameState === 'playing') this.flap()
        else this.start()
        e.preventDefault()
        break
    }
  }

  protected override step(dt: number) {
    // Ball "radius" is anisotropic in normalized space — derive per axis.
    const bs = this.ballSize * Math.min(this.viewW, this.viewH)
    const rx = this.viewW ? bs / 2 / this.viewW : 0
    const ry = this.viewH ? bs / 2 / this.viewH : 0

    // Autopilot: aim at the next reachable opening and flap when sinking below
    // it. The natural fall between flaps gives the demo its bobbing.
    if (this.autoplay) {
      const target =
        this.obstacles === 'cave'
          ? this.caveTarget(rx)
          : this.nextGapTarget(rx)
      if (this.ballY > target && this.ballVY > -0.1) this.flap()
    }

    // Gravity integrates velocity, velocity integrates position.
    this.ballVY = Math.min(this.ballVY + this.gravity * dt, this.maxFallV)
    this.ballY += this.ballVY * dt

    // Ceiling: in walls mode the top edge is a soft lid (classic Flappy can't
    // leave the top). In cave mode the rocky roof is lethal instead, handled
    // by the collision check below — so don't clamp here.
    if (this.obstacles !== 'cave' && this.ballY < ry) {
      this.ballY = ry
      if (this.ballVY < 0) this.ballVY = 0
    }

    // Scroll obstacles left, recycle ones that have fully exited, and keep the
    // run topped up so the rightmost is always feeding in at a fixed spacing.
    const cave = this.obstacles === 'cave'
    const spacing = cave ? this.caveSpacing : this.pipeSpacing
    // Cave control points carry no width — keep one just off the left edge so
    // the leftmost segment still has something to interpolate against.
    const cull = cave ? this.caveSpacing : this.pipeW
    for (const p of this.pipes) p.x -= this.pipeSpeed * dt
    while (this.pipes.length && this.pipes[0].x + cull < 0) {
      this.pipes.shift()
    }
    let rightmost = this.pipes.length ? this.pipes[this.pipes.length - 1].x : 0
    // The cave must reach a touch past the right edge so its outline never ends
    // mid-canvas; walls only need to feed in up to the edge.
    const fillTo = cave ? 1 + this.caveSpacing : 1
    while (rightmost < fillTo) {
      rightmost += spacing
      this.pushObstacle(rightmost)
    }

    if (cave) {
      // Score per control point cleared, then test the ball against the rocky
      // ceiling/floor interpolated at its fixed x.
      for (const p of this.pipes) {
        if (!p.passed && p.x < this.birdX) {
          p.passed = true
          this.score++
        }
      }
      const { top, bot } = this.caveBounds(this.birdX)
      if (this.ballY - ry < top || this.ballY + ry > bot) {
        this.die()
        return
      }
    } else {
      // Collisions + scoring against each pipe the ball is near.
      for (const p of this.pipes) {
        // Score once the ball's center clears the pipe's right edge.
        if (!p.passed && p.x + this.pipeW < this.birdX) {
          p.passed = true
          this.score++
        }
        // Only the overlapping pipe can hit us.
        if (this.birdX + rx < p.x || this.birdX - rx > p.x + this.pipeW) continue
        const gapTop = p.gap - this.gapH / 2
        const gapBottom = p.gap + this.gapH / 2
        if (this.ballY - ry < gapTop || this.ballY + ry > gapBottom) {
          this.die()
          return
        }
      }
    }

    // Floor: hitting the bottom ends the run. (In cave mode the floor rock is
    // lethal sooner, but this stays as a backstop.)
    if (this.ballY + ry >= 1) {
      this.ballY = 1 - ry
      this.die()
    }
  }

  /** Demo autopilot: gap center of the next pipe the ball hasn't cleared. */
  private nextGapTarget(rx: number): number {
    for (const p of this.pipes) {
      if (p.x + this.pipeW < this.birdX - rx) continue // already behind us
      return p.gap
    }
    return 0.5
  }

  /**
   * Demo autopilot for cave mode: aim at the center of the passage a little
   * ahead of the ball, so it anticipates the upcoming bend rather than chasing it.
   */
  private caveTarget(rx: number): number {
    const { top, bot } = this.caveBounds(this.birdX + rx + 0.04)
    return (top + bot) / 2
  }

  /** End the run — or, in demo mode, silently restart so the loader never stops. */
  private die() {
    if (this.autoplay) {
      this.reset()
      return
    }
    this.gameState = 'over'
  }

  protected override draw() {
    const ctx = this.ctx
    const w = this.viewW
    const h = this.viewH
    if (!w || !h) return

    const color = readColor(this)

    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = color

    if (this.obstacles === 'cave') {
      this.drawCave(ctx, w, h)
    } else {
      // Pipes — outline only (border, no fill): a top stub and a bottom stub
      // framing the gap.
      const pw = this.pipeW * w
      const gh = this.gapH * h
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      for (const p of this.pipes) {
        const px = p.x * w
        const gapTop = (p.gap - this.gapH / 2) * h
        // Inset by half the line width so the stroke renders crisp.
        ctx.strokeRect(px + 0.5, 0.5, pw - 1, gapTop - 1) // top pipe
        ctx.strokeRect(px + 0.5, gapTop + gh + 0.5, pw - 1, h - (gapTop + gh) - 1) // bottom pipe
      }
    }

    // Ball.
    const r = (this.ballSize * Math.min(w, h)) / 2
    ctx.beginPath()
    ctx.arc(this.birdX * w, this.ballY * h, r, 0, Math.PI * 2)
    ctx.fill()

    // Score, while playing.
    if (this.gameState === 'playing' && !this.autoplay) {
      ctx.font = `600 ${Math.round(Math.min(w, h) * 0.1)}px ui-monospace, "SF Mono", Menlo, monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = 0.85
      ctx.fillText(String(this.score), w / 2, h * 0.06)
      ctx.globalAlpha = 1
    }
  }

  /**
   * Fill the rock above the ceiling line and below the floor line, tracing
   * straight segments through the control points (and flat out to each edge so
   * the cave never ends mid-canvas). Straight segments here match the linear
   * interpolation in `caveBounds`, so what you see is exactly what collides.
   */
  private drawCave(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const pts = this.pipes
    if (!pts.length) return
    const first = pts[0]
    const last = pts[pts.length - 1]

    // Ceiling rock, hanging from the top edge.
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, (first.top ?? 0) * h)
    for (const p of pts) ctx.lineTo(p.x * w, (p.top ?? 0) * h)
    ctx.lineTo(w, (last.top ?? 0) * h)
    ctx.lineTo(w, 0)
    ctx.closePath()
    ctx.fill()

    // Floor rock, rising from the bottom edge.
    ctx.beginPath()
    ctx.moveTo(0, h)
    ctx.lineTo(0, (first.bot ?? 1) * h)
    for (const p of pts) ctx.lineTo(p.x * w, (p.bot ?? 1) * h)
    ctx.lineTo(w, (last.bot ?? 1) * h)
    ctx.lineTo(w, h)
    ctx.closePath()
    ctx.fill()
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'spinner-flappy': SpinnerFlappy
  }
}
