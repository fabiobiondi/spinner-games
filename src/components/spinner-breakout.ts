import { html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { SpinnerGame, baseStyles, clamp, readColor } from './internal/spinner-game.js'

// A single shard of a brick-break "explosion", mirroring the pop burst in
// `<spinner-bubbles>`. Position/velocity are in normalized coordinates (x in
// width-fractions, y in height-fractions) like the rest of the game, so they
// survive resizing; the velocity is pre-scaled per axis at spawn time so the
// burst still reads as a round ring on screen despite the anisotropic metric.
// Purely cosmetic — never touched by game logic.
interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number // remaining seconds, counts down to 0
  maxLife: number
}

/**
 * `<spinner-breakout>` — minimal Arkanoid/Breakout, you vs a wall of bricks.
 *
 * Plain rectangles on a canvas: a paddle at the bottom, a square ball and a
 * wall of bricks up top. Responsive (fills its parent), starts on a Play
 * button, and is controllable with mouse/touch or the keyboard (←/→ or A/D;
 * Space/Enter to start). Clear the wall to win; miss the ball and it's over.
 *
 * Set the `autoplay` attribute for a self-playing Demo mode: the game plays
 * itself as a loader/spinner and user input is disabled. Set `track-outside`
 * (or the broader `allowOutsideControls`) to keep steering with the mouse even
 * after the pointer leaves the canvas. Both are opt-in and off by default.
 *
 * The component fills the width of its parent and derives height from
 * `--spinner-breakout-aspect` (default 16/10). To make it fill a fixed-size
 * parent instead, give the element an explicit height in CSS.
 *
 * @example
 * ```html
 * <div style="width: 480px"><spinner-breakout></spinner-breakout></div>
 * <spinner-breakout autoplay></spinner-breakout>
 * ```
 *
 * @cssprop --spinner-color            - brick/ball/paddle color (default: #2caac3)
 * @cssprop --spinner-bg               - panel background when showBackground is on (default: faint --spinner-color tint)
 * @cssprop --spinner-breakout-aspect  - width/height ratio when height is auto (default: 16/10)
 */
@customElement('spinner-breakout')
export class SpinnerBreakout extends SpinnerGame {
  static override styles = [
    baseStyles,
    css`
      :host {
        aspect-ratio: var(--spinner-breakout-aspect, 16 / 10);
      }

      /*
       * Drop the prompt below the brick wall. The base overlay is a centred
       * grid that, with three children, splits the height into thirds and
       * leaves the Play button sitting up on the bricks (which end at ~36% of
       * the height). Here a spacer row clears the wall, then the Play /
       * Play-again button sits just under it with the "Use arrows" hint
       * beneath, while the status message sits just above the paddle.
       *
       * Row template (grid-row): 1 spacer · 2 button · 3 hint · 4 spacer ·
       * 5 message · 6 bottom spacer. The trailing 12% spacer clears the paddle
       * (whose top is at ~91.5% of the height) so the "Cleared!" status floats
       * just above the user's bar instead of at the very bottom edge.
       * align-items:start anchors each item to the top of its row;
       * justify-items stays centred from the base \`place-items: center\`.
       */
      .overlay {
        align-items: start;
        grid-template-rows: 40% min-content min-content 1fr min-content 12%;
      }
      .overlay > button {
        grid-row: 2;
      }
      .overlay > .hint {
        grid-row: 3;
      }
      .overlay > .msg {
        grid-row: 5;
      }
    `,
  ]

  /** Keep following the mouse even after the pointer leaves the canvas area. */
  @property({ type: Boolean, attribute: 'track-outside' })
  trackOutside = false

  @state() private won = false

  // State in normalized coordinates (0..1 across each axis) so it survives
  // resizing untouched. Velocities are in fraction-of-axis per second.
  private ballX = 0.5
  private ballY = 0.5
  private ballVX = 0
  private ballVY = 0
  private paddleCenter = 0.5
  private pointerX: number | null = null
  private keyLeft = false
  private keyRight = false
  private bricks: boolean[] = [] // row-major; true = still standing

  // Short-lived shards thrown off when a brick breaks; purely cosmetic, never
  // touched by game logic.
  private particles: Particle[] = []
  // Deterministic PRNG — this environment forbids Math.random. Mirrors the LCG
  // used by `<spinner-bubbles>` so the burst gets the same lively randomness.
  private seed = 987654321

  // Proportions (fractions of the relevant axis).
  private readonly cols = 8
  private readonly rows = 4
  private readonly paddleW = 0.13
  private readonly paddleH = 0.025
  private readonly paddleBottom = 0.06 // gap from the bottom edge
  private readonly ballSize = 0.022
  private readonly brickTop = 0.1
  private readonly brickH = 0.05
  private readonly brickGapX = 0.012
  private readonly brickGapY = 0.02
  private readonly ballSpeedX = 0.45 // width-fraction/s
  private readonly ballSpeedY = 0.7 // height-fraction/s
  private readonly autoSpeed = 1.3 // auto-paddle cap (width-fraction/s)
  private readonly keyboardSpeed = 1.6 // player paddle speed (width-fraction/s)

  override render() {
    const message = this.over && this.won ? 'Cleared!' : ''
    return html`
      <canvas></canvas>
      ${this.renderBadge()}
      ${this.renderOverlay(message, 'Use arrows left/right or mouse')}
    `
  }

  /**
   * Arkanoid-only overlay layout: the Play/Play-again button sits just below
   * the brick wall with the "Use arrows" hint right beneath it, and the status
   * message (the "Cleared!" win status) is pinned to the very bottom. The vertical
   * placement is driven by the grid-row rules in `styles`. Scoped to this
   * component so the other games keep the default centred order.
   */
  protected override renderOverlay(message: unknown, hint: unknown) {
    if (this.hideOverlay) return null
    return html`
      <div class="overlay">
        <button @click=${this.start}>${this.over ? 'Play again' : 'Play'}</button>
        <p class="hint">${hint}</p>
        <p class="msg">${message}</p>
      </div>
    `
  }

  /**
   * Listen on the canvas (default) or the whole window — the latter when either
   * `track-outside` or `allowOutsideControls` keeps the mouse steering active
   * past the canvas edge.
   */
  protected override bindPointer() {
    if (this.trackOutside || this.allowOutsideControls) {
      window.addEventListener('pointermove', this.onPointerMove)
    } else {
      this.canvas.addEventListener('pointermove', this.onPointerMove)
      this.canvas.addEventListener('pointerleave', this.onPointerLeave)
    }
  }

  protected override unbindPointer() {
    window.removeEventListener('pointermove', this.onPointerMove)
    this.canvas?.removeEventListener('pointermove', this.onPointerMove)
    this.canvas?.removeEventListener('pointerleave', this.onPointerLeave)
  }

  /** Reset to a fresh round: full wall, centered paddle, ball served. */
  protected override resetRound() {
    this.resetWall()
    this.paddleCenter = 0.5
    this.serve()
    this.particles = []
    this.won = false
  }

  // ---- PRNG --------------------------------------------------------------

  private rand(): number {
    // Linear congruential generator — deterministic, no Math.random.
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff
    return this.seed / 0x7fffffff
  }

  /** (Re)build the full wall of bricks. */
  private resetWall() {
    this.bricks = new Array(this.cols * this.rows).fill(true)
  }

  /** Drop the ball from just above the paddle, angled up and outward. */
  private serve() {
    this.ballX = 0.5
    this.ballY = 1 - this.paddleBottom - this.paddleH - 0.05
    // Deterministic-ish horizontal direction, free of Math.random.
    const dir = Math.round(this.viewW) % 2 === 0 ? 1 : -1
    this.ballVX = this.ballSpeedX * 0.4 * dir
    this.ballVY = -this.ballSpeedY
  }

  private onPointerMove = (e: PointerEvent) => {
    if (this.autoplay) return // demo mode: input is disabled
    const rect = this.canvas.getBoundingClientRect()
    this.pointerX = (e.clientX - rect.left) / rect.width
    this.keyLeft = this.keyRight = false // pointer takes over from keyboard
  }

  private onPointerLeave = () => {
    this.pointerX = null
  }

  protected override onKeyDown(e: KeyboardEvent) {
    if (this.autoplay) return // demo mode: input is disabled
    switch (e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.keyLeft = true
        this.pointerX = null
        e.preventDefault()
        break
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.keyRight = true
        this.pointerX = null
        e.preventDefault()
        break
      case ' ':
      case 'Enter':
        if (this.gameState !== 'playing') this.start()
        e.preventDefault()
        break
    }
  }

  protected override onKeyUp(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A')
      this.keyLeft = false
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D')
      this.keyRight = false
  }

  protected override step(dt: number) {
    const halfW = this.paddleW / 2

    // Paddle. In demo (autoplay) it tracks the ball on its own and user input
    // is ignored entirely. Otherwise: keyboard if pressed, else pointer, else
    // hold position — a playable paddle never moves on its own.
    if (this.autoplay) {
      const move = clamp(
        this.ballX - this.paddleCenter,
        -this.autoSpeed * dt,
        this.autoSpeed * dt,
      )
      this.paddleCenter += move
    } else if (this.keyLeft || this.keyRight) {
      const d = (this.keyRight ? 1 : 0) - (this.keyLeft ? 1 : 0)
      this.paddleCenter += d * this.keyboardSpeed * dt
    } else if (this.pointerX !== null) {
      this.paddleCenter = this.pointerX
    }
    this.paddleCenter = clamp(this.paddleCenter, halfW, 1 - halfW)

    // Move ball. Remember where it started this frame so the brick collision
    // can tell which face it crossed (see collideBricks).
    const prevX = this.ballX
    const prevY = this.ballY
    this.ballX += this.ballVX * dt
    this.ballY += this.ballVY * dt

    // Ball "radius" is anisotropic in normalized space — derive per axis.
    const bs = this.ballSize * Math.min(this.viewW, this.viewH)
    const rx = this.viewW ? bs / 2 / this.viewW : 0
    const ry = this.viewH ? bs / 2 / this.viewH : 0

    // Side walls.
    if (this.ballX < rx) {
      this.ballX = rx
      this.ballVX = Math.abs(this.ballVX)
    } else if (this.ballX > 1 - rx) {
      this.ballX = 1 - rx
      this.ballVX = -Math.abs(this.ballVX)
    }

    // Top wall.
    if (this.ballY < ry) {
      this.ballY = ry
      this.ballVY = Math.abs(this.ballVY)
    }

    // Paddle collision (only while travelling down).
    const paddleY = 1 - this.paddleBottom - this.paddleH
    if (
      this.ballVY > 0 &&
      this.ballY + ry >= paddleY &&
      this.ballY - ry <= paddleY + this.paddleH &&
      this.ballX >= this.paddleCenter - halfW &&
      this.ballX <= this.paddleCenter + halfW
    ) {
      this.ballY = paddleY - ry
      this.bounce()
    }

    // Brick collisions.
    this.collideBricks(rx, ry, prevX, prevY)

    // Wall cleared.
    if (this.bricks.every((b) => !b)) {
      if (this.autoplay) {
        this.resetWall()
      } else {
        this.won = true
        this.gameState = 'over'
        return
      }
    }

    // Ball fell below the paddle.
    if (this.ballY - ry > 1) {
      if (this.autoplay) {
        this.serve()
      } else {
        this.won = false
        this.gameState = 'over'
      }
    }
  }

  /** Reflect the ball off the paddle, angling by where it hit. */
  private bounce() {
    const hit = clamp(
      (this.ballX - this.paddleCenter) / (this.paddleW / 2),
      -1,
      1,
    )
    let vx = this.ballSpeedX * hit
    // Avoid a near-vertical bounce that could stall the ball in a column.
    const min = this.ballSpeedX * 0.2
    if (Math.abs(vx) < min) {
      const dir = vx === 0 ? (this.ballX < 0.5 ? 1 : -1) : Math.sign(vx)
      vx = min * dir
    }
    this.ballVX = vx
    this.ballVY = -this.ballSpeedY
  }

  /**
   * Knock out the first brick the ball overlaps and reflect off it.
   *
   * `prevX`/`prevY` are the ball's centre at the start of the frame. They are
   * what keeps a single contact from chewing through several bricks: rather than
   * inverting whichever axis has the smaller raw overlap (which flips the wrong
   * way once the ball is sitting deep inside the wall), we reflect on the axis
   * the ball actually *crossed* this frame and then snap it back out of the
   * brick, into the empty gap. At these speeds the ball travels far less than a
   * brick per frame, so it never tunnels and the crossed axis is unambiguous.
   */
  private collideBricks(rx: number, ry: number, prevX: number, prevY: number) {
    const brickW =
      (1 - this.brickGapX * (this.cols + 1)) / this.cols

    for (let row = 0; row < this.rows; row++) {
      const by = this.brickTop + row * (this.brickH + this.brickGapY)
      // Quick vertical reject for the whole row.
      if (this.ballY + ry < by || this.ballY - ry > by + this.brickH) continue

      for (let col = 0; col < this.cols; col++) {
        const i = row * this.cols + col
        if (!this.bricks[i]) continue

        const bx = this.brickGapX + col * (brickW + this.brickGapX)
        if (this.ballX + rx < bx || this.ballX - rx > bx + brickW) continue

        // Hit: remove the brick and throw off a little burst from its centre.
        this.bricks[i] = false
        this.spawnBurst(bx + brickW / 2, by + this.brickH / 2)

        // Which face did we come through this frame? If the ball was clear of
        // the brick on exactly one axis last frame, that's the axis it crossed.
        const crossedX = prevX + rx <= bx || prevX - rx >= bx + brickW
        const crossedY = prevY + ry <= by || prevY - ry >= by + this.brickH

        let reflectX: boolean
        if (crossedX && !crossedY) reflectX = true
        else if (crossedY && !crossedX) reflectX = false
        else {
          // Corner hit (or, defensively, an already-overlapping ball): fall back
          // to the shallower overlap axis.
          const overlapX = Math.min(
            this.ballX + rx - bx,
            bx + brickW - (this.ballX - rx),
          )
          const overlapY = Math.min(
            this.ballY + ry - by,
            by + this.brickH - (this.ballY - ry),
          )
          reflectX = overlapX < overlapY
        }

        // Reflect away from the nearer face and snap the ball just outside it
        // (into the gap) so it can't re-enter and nibble the next brick.
        if (reflectX) {
          if (this.ballX < bx + brickW / 2) {
            this.ballVX = -Math.abs(this.ballVX)
            this.ballX = bx - rx
          } else {
            this.ballVX = Math.abs(this.ballVX)
            this.ballX = bx + brickW + rx
          }
        } else {
          if (this.ballY < by + this.brickH / 2) {
            this.ballVY = -Math.abs(this.ballVY)
            this.ballY = by - ry
          } else {
            this.ballVY = Math.abs(this.ballVY)
            this.ballY = by + this.brickH + ry
          }
        }
        return // one brick per frame keeps the bounce clean
      }
    }
  }

  /**
   * Throw off a tiny radial burst of fading shards at a broken brick, mirroring
   * `<spinner-bubbles>`'s pop burst: a handful of shards fly out a fraction of a
   * brick and fade in under half a second. `cx`/`cy` are the brick centre in
   * normalized coords (width-/height-fractions). The per-shard velocity is
   * pre-scaled by `minDim / viewW|H` so the ring stays circular on screen even
   * though x and y use different metrics. Uses the LCG `rand()` (Math.random is
   * banned).
   */
  private spawnBurst(cx: number, cy: number) {
    const count = 6
    const minDim = Math.min(this.viewW, this.viewH) || 1
    const base = this.rand() * Math.PI * 2 // rotate the whole ring randomly
    for (let i = 0; i < count; i++) {
      const angle = base + (i / count) * Math.PI * 2
      const speed = 0.15 + this.rand() * 0.2 // minDim-fractions/s
      this.particles.push({
        x: cx,
        y: cy,
        vx: (Math.cos(angle) * speed * minDim) / (this.viewW || 1),
        vy: (Math.sin(angle) * speed * minDim) / (this.viewH || 1),
        life: 0.35,
        maxLife: 0.35,
      })
    }
  }

  /** Advance and retire brick-break shards. Runs every frame, even on game over. */
  private updateParticles(dt: number) {
    if (!this.particles.length) return
    for (const p of this.particles) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.life -= dt
    }
    this.particles = this.particles.filter((p) => p.life > 0)
  }

  /** Shards fade out every frame, even on game over — so advance them in tick. */
  protected override tick(dt: number) {
    this.updateParticles(dt)
  }

  protected override draw() {
    const ctx = this.ctx
    const w = this.viewW
    const h = this.viewH
    if (!w || !h) return

    const color = readColor(this)

    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = color

    // Bricks — outline only (border, no fill).
    const brickW = (1 - this.brickGapX * (this.cols + 1)) / this.cols
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    for (let row = 0; row < this.rows; row++) {
      const by = this.brickTop + row * (this.brickH + this.brickGapY)
      for (let col = 0; col < this.cols; col++) {
        if (!this.bricks[row * this.cols + col]) continue
        const bx = this.brickGapX + col * (brickW + this.brickGapX)
        // Inset by half the line width so the stroke stays inside the cell.
        ctx.strokeRect(
          bx * w + 0.5,
          by * h + 0.5,
          brickW * w - 1,
          this.brickH * h - 1,
        )
      }
    }

    // Brick-break shards — small squares fading and shrinking where bricks
    // broke. Kept square to match the game's all-rectangle look (the circular
    // sibling, bubbles, draws round shards instead).
    if (this.particles.length) {
      const minDim = Math.min(w, h)
      ctx.fillStyle = color
      for (const p of this.particles) {
        const a = p.life / p.maxLife
        const s = minDim * 0.018 * a
        ctx.save()
        ctx.globalAlpha = a
        ctx.fillRect(p.x * w - s / 2, p.y * h - s / 2, s, s)
        ctx.restore()
      }
    }

    // Paddle.
    const pw = this.paddleW * w
    const ph = this.paddleH * h
    ctx.fillRect(
      (this.paddleCenter - this.paddleW / 2) * w,
      (1 - this.paddleBottom - this.paddleH) * h,
      pw,
      ph,
    )

    // Ball.
    const bs = this.ballSize * Math.min(w, h)
    ctx.fillRect(this.ballX * w - bs / 2, this.ballY * h - bs / 2, bs, bs)
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'spinner-breakout': SpinnerBreakout
  }
}
