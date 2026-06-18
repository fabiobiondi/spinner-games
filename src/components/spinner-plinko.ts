import { html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { SpinnerGame, baseStyles, clamp, readColor } from './internal/spinner-game.js'

/** One confetto particle of the win celebration (positions in board units). */
interface Confetto {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vrot: number
  life: number
  size: number
  alpha: number
}

/**
 * `<spinner-plinko>` — a minimal Plinko / Galton board.
 *
 * A ball drops from the top, bounces down through a staggered grid of round
 * pegs and settles into one of the scoring slots at the bottom. The bounces are
 * real circle-vs-circle reflections (fully deterministic — no `Math.random`),
 * so where a ball lands depends only on where it was dropped. Aim the drop point
 * with the mouse/touch and click (or press Space) to release each ball.
 *
 * Each slot subtracts by distance from the center — `1 · 10 · 50 · 100 · 50 ·
 * 10 · 1` on the default 7-slot board. You start at `startScore` (default 500)
 * and burn it down: reach 0 within your `balls` (default 10) to win, which
 * fires a confetti burst; run out of balls first and the run is over. In
 * `autoplay` there is no ball budget, so the demo always reaches 0 and
 * celebrates, then restarts.
 *
 * Portrait by default: the component fills the width of its parent and derives
 * height from `--spinner-plinko-aspect` (default 5/7). To make it fill a
 * fixed-size parent instead, give the element an explicit height in CSS.
 *
 * @example
 * ```html
 * <div style="width: 280px"><spinner-plinko></spinner-plinko></div>
 * ```
 *
 * Set the `autoplay` attribute for a self-playing Demo mode: the drop point
 * sweeps on its own, input is disabled and the run restarts forever — handy as
 * a loader/spinner. Set `track-outside` (or the broader `allowOutsideControls`)
 * to keep aiming with the mouse even after the pointer leaves the canvas.
 *
 * Tune the board with `rows` (peg rows), `slots` (scoring bins / peg columns),
 * `balls` (drops you get) and `startScore` (where the countdown begins):
 * ```html
 * <spinner-plinko rows="10" slots="9" balls="12" start-score="800"></spinner-plinko>
 * ```
 *
 * @cssprop --spinner-color          - peg/ball/score color (default: #2caac3)
 * @cssprop --spinner-bg             - panel background when showBackground is on (default: faint --spinner-color tint)
 * @cssprop --spinner-plinko-aspect  - width/height ratio when height is auto (default: 5/7)
 */
@customElement('spinner-plinko')
export class SpinnerPlinko extends SpinnerGame {
  static override styles = [
    baseStyles,
    css`
      :host {
        aspect-ratio: var(--spinner-plinko-aspect, 5 / 7);
      }
      .scores {
        position: absolute;
        top: 5%;
        left: 0;
        right: 0;
        display: flex;
        justify-content: center;
        gap: 14%;
        font-family: ui-monospace, "SF Mono", Menlo, monospace;
        font-size: clamp(12px, 6cqi, 26px);
        font-variant-numeric: tabular-nums;
        pointer-events: none;
        user-select: none;
      }
      /* Game over: dim the final scoreboard with the rest of the frozen game. */
      :host([game-over]) .scores {
        opacity: 0.5;
      }
      .scores span {
        position: relative;
        display: inline-block;
      }
      .scores .label {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        font-size: 0.5em;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        opacity: 0.7;
        white-space: nowrap;
      }
      .scores span:first-child .label {
        right: 100%;
        margin-right: 0.5em;
      }
      .scores span:last-child .label {
        left: 100%;
        margin-left: 0.5em;
      }
    `,
  ]

  /** Number of peg rows (clamped 4..14; default 8). */
  @property({ type: Number })
  rows = 8

  /** Number of scoring slots / peg columns (clamped 4..12; default 7). */
  @property({ type: Number })
  slots = 7

  /** Balls you get per run to reach zero (default 10). */
  @property({ type: Number })
  balls = 10

  /** Score you start from and burn down — reaching 0 wins & fires the confetti (default 500). */
  @property({ type: Number })
  startScore = 500

  /** Keep aiming the drop point with the mouse outside the canvas. */
  @property({ type: Boolean, attribute: 'track-outside' })
  trackOutside = false

  @state() private score = 0
  @state() private dropped = 0
  @state() private won = false

  // Portrait: tall board. Used only before the element has a measured height.
  protected override aspectFallback = 1.4

  // ---- Geometry, in "board units": height = 1, width = boardW (= aspect). ---
  // Working in units of height keeps pegs and the ball perfectly circular on
  // screen for any aspect ratio (unlike per-axis 0..1 normalization).
  private get boardW(): number {
    return this.viewH ? this.viewW / this.viewH : 0.7
  }

  private readonly pegR = 0.013
  private readonly ballR = 0.016
  private readonly topY = 0.2 // first peg row
  private readonly botY = 0.78 // last peg row
  private readonly settleY = 0.86 // ball lands here → scored into a slot

  // Layout cache, rebuilt when size or row/slot counts change.
  private pegs: { x: number; y: number }[] = []
  private cols = 7
  private px = 0.1 // slot width in board units
  private slotValues: number[] = []
  private layoutW = 0
  private layoutH = 0
  private layoutRows = 0
  private layoutSlots = 0

  // ---- Ball state (board units / per-second). -------------------------------
  private bx = 0
  private by = 0
  private bvx = 0
  private bvy = 0
  private ballActive = false
  private cooldown = 0
  private total = 0 // lifetime drops, drives demo aim & launch variation
  private lastSlot = -1
  private dropX = -1 // board-units aim point; <0 means "center"

  // Confetti burst played when the target score is reached.
  private confetti: Confetto[] = []
  private celebrateT = 0 // seconds left in the win celebration (drives the demo restart)

  // Tuning.
  private readonly gravity = 1.7
  private readonly restitution = 0.5
  private readonly wallDamp = 0.5
  private readonly maxV = 1.6

  override render() {
    const message = this.over ? (this.won ? 'You win!' : `Score ${this.score}`) : ''
    const left = Math.max(0, this.balls - this.dropped)
    return html`
      <canvas></canvas>
      ${this.renderBadge()}
      <div class="scores">
        <span><span class="label">Score</span>${this.score}</span>
        <span>${left}<span class="label">Balls</span></span>
      </div>
      ${this.renderOverlay(message, 'Click to drop · reach 0')}
    `
  }

  protected override bindPointer() {
    if (this.trackOutside || this.allowOutsideControls) {
      window.addEventListener('pointermove', this.onPointerMove)
    } else {
      this.canvas.addEventListener('pointermove', this.onPointerMove)
    }
    // Drop on click/tap; allowOutsideControls lets a click off the canvas drop too.
    if (this.allowOutsideControls) {
      window.addEventListener('pointerdown', this.onPointerDown)
    } else {
      this.canvas.addEventListener('pointerdown', this.onPointerDown)
    }
  }

  protected override unbindPointer() {
    window.removeEventListener('pointermove', this.onPointerMove)
    this.canvas?.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas?.removeEventListener('pointerdown', this.onPointerDown)
  }

  protected override resetRound() {
    this.score = this.startScore
    this.dropped = 0
    this.ballActive = false
    this.cooldown = 0
    this.lastSlot = -1
    this.dropX = -1
    this.won = false
    this.celebrateT = 0
    this.confetti = []
  }

  protected override onKeyDown(e: KeyboardEvent) {
    if (e.key === ' ' || e.key === 'Enter') {
      // Space/Enter starts the run, then drops the next ball.
      if (this.gameState !== 'playing') this.start()
      else this.tryDrop()
      e.preventDefault()
    }
  }

  private onPointerMove = (e: PointerEvent) => {
    if (this.autoplay) return // demo mode: input is disabled
    const rect = this.canvas.getBoundingClientRect()
    const fx = clamp((e.clientX - rect.left) / rect.width, 0, 1)
    this.dropX = fx * this.boardW
  }

  private onPointerDown = (e: PointerEvent) => {
    if (this.autoplay) return // demo mode: input is disabled
    if (this.gameState !== 'playing') return // start via the Play button
    // Aim at the click position, then drop a ball from there.
    const rect = this.canvas.getBoundingClientRect()
    const fx = clamp((e.clientX - rect.left) / rect.width, 0, 1)
    this.dropX = fx * this.boardW
    this.tryDrop()
  }

  /** Drop a ball from the current aim point, if one isn't already in flight. */
  private tryDrop() {
    if (this.ballActive || this.cooldown > 0) return
    if (this.dropped >= this.balls) return
    this.spawnBall(this.boardW)
  }

  /** (Re)build the peg grid and slot table when the size or counts change. */
  private ensureLayout() {
    if (
      this.pegs.length &&
      this.viewW === this.layoutW &&
      this.viewH === this.layoutH &&
      this.rows === this.layoutRows &&
      this.slots === this.layoutSlots
    )
      return

    this.layoutW = this.viewW
    this.layoutH = this.viewH
    this.layoutRows = this.rows
    this.layoutSlots = this.slots

    const bw = this.boardW
    const rows = clamp(Math.round(this.rows), 4, 14)
    this.cols = clamp(Math.round(this.slots), 4, 12)
    this.px = bw / this.cols

    const pegs: { x: number; y: number }[] = []
    for (let r = 0; r < rows; r++) {
      const y =
        rows > 1
          ? this.topY + (r / (rows - 1)) * (this.botY - this.topY)
          : (this.topY + this.botY) / 2
      const odd = r % 2 === 1
      // Even rows: a peg centered in every slot. Odd rows: pegs on the slot
      // boundaries (staggered by half a column), skipping the two walls.
      const count = odd ? this.cols - 1 : this.cols
      for (let i = 0; i < count; i++) {
        const x = odd ? this.px * (i + 1) : this.px * (i + 0.5)
        pegs.push({ x, y })
      }
    }
    this.pegs = pegs

    // Symmetric payouts by distance from the center: a fixed ladder that yields
    // exactly [1, 10, 50, 100, 50, 10, 1] for the default 7-slot board, and a
    // sensible equivalent for other slot counts.
    const tiers = [100, 50, 10, 1]
    const vals: number[] = []
    const c = (this.cols - 1) / 2
    for (let i = 0; i < this.cols; i++) {
      const d = Math.floor(Math.abs(i - c))
      vals.push(tiers[Math.min(d, tiers.length - 1)])
    }
    this.slotValues = vals
  }

  protected override step(dt: number) {
    this.ensureLayout()
    const bw = this.boardW

    // Demo mode sweeps the aim point on its own (deterministic, no input).
    if (this.autoplay) {
      this.dropX = bw * (0.5 + 0.4 * Math.sin(this.total * 1.3))
      // Let a win celebration play out, then start a fresh run. The demo has no
      // ball budget, so it always reaches the target and shows the confetti.
      if (this.celebrateT > 0) return
      if (this.won) {
        this.won = false
        this.score = this.startScore
        this.dropped = 0
        this.lastSlot = -1
      }
    }

    if (!this.ballActive) {
      if (this.cooldown > 0) {
        this.cooldown -= dt
        return
      }
      if (this.autoplay) {
        this.spawnBall(bw) // demo drops on its own
        return
      }
      // Real game: out of balls → you lose; otherwise wait for the player to
      // drop the next ball with a click/tap (or Space) — see onPointerDown.
      if (this.dropped >= this.balls) this.gameState = 'over'
      return
    }

    // Sub-step the integration so the fast-moving ball can't tunnel a peg.
    const sub = 4
    const h = dt / sub
    for (let s = 0; s < sub; s++) {
      this.integrate(h, bw)
      if (!this.ballActive) break
    }
  }

  private spawnBall(bw: number) {
    const aim = this.dropX < 0 ? bw / 2 : this.dropX
    this.bx = clamp(aim, this.ballR * 2, bw - this.ballR * 2)
    this.by = 0.05
    // Tiny alternating launch nudge so a dead-straight aim still spreads out.
    this.bvx = (this.total % 2 === 0 ? 1 : -1) * 0.04
    this.bvy = 0
    this.ballActive = true
    this.dropped++
    this.total++
  }

  private integrate(h: number, bw: number) {
    this.bvy = clamp(this.bvy + this.gravity * h, -this.maxV, this.maxV)
    this.bvx = clamp(this.bvx, -this.maxV, this.maxV)
    this.bx += this.bvx * h
    this.by += this.bvy * h

    // Side walls.
    if (this.bx < this.ballR) {
      this.bx = this.ballR
      this.bvx = Math.abs(this.bvx) * this.wallDamp
    } else if (this.bx > bw - this.ballR) {
      this.bx = bw - this.ballR
      this.bvx = -Math.abs(this.bvx) * this.wallDamp
    }

    // Pegs: circle-vs-circle, push out and reflect the inbound velocity.
    const minD = this.ballR + this.pegR
    for (const p of this.pegs) {
      const dx = this.bx - p.x
      const dy = this.by - p.y
      const d2 = dx * dx + dy * dy
      if (d2 < minD * minD) {
        const d = Math.sqrt(d2) || 1e-4
        const nx = dx / d
        const ny = dy / d
        this.bx = p.x + nx * minD
        this.by = p.y + ny * minD
        const vn = this.bvx * nx + this.bvy * ny
        if (vn < 0) {
          const j = (1 + this.restitution) * vn
          this.bvx -= j * nx
          this.bvy -= j * ny
        }
      }
    }

    // Reached the slots: score it and queue the next ball.
    if (this.by >= this.settleY) {
      const idx = clamp(Math.floor(this.bx / this.px), 0, this.cols - 1)
      this.lastSlot = idx
      this.score -= this.slotValues[idx] ?? 0
      this.ballActive = false
      this.cooldown = 0.25
      if (this.score <= 0) {
        this.score = 0
        this.win()
      }
    }
  }

  /** Target reached: fire the confetti and end the run (a win). */
  private win() {
    this.won = true
    this.celebrateT = 2
    this.ballActive = false
    this.spawnConfetti()
    // In demo mode we stay "playing" so the overlay stays hidden; step() handles
    // the restart once the celebration finishes.
    if (!this.autoplay) this.gameState = 'over'
  }

  private spawnConfetti() {
    const cx = this.boardW / 2
    const cy = 0.45
    const parts: Confetto[] = []
    for (let i = 0; i < 90; i++) {
      const a = i * 2.39996 // golden angle → an even angular spread
      const sp = 0.5 + (i % 7) * 0.12
      parts.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 0.55, // bias the burst upward
        rot: a,
        vrot: (i % 2 ? 1 : -1) * (4 + (i % 5)),
        life: 1.4 + (i % 5) * 0.14,
        size: 0.012 + (i % 4) * 0.004,
        alpha: 1,
      })
    }
    this.confetti = parts
  }

  /** Runs every frame (even when not playing): advance & fade the confetti. */
  protected override tick(dt: number) {
    if (this.celebrateT > 0) this.celebrateT -= dt
    if (!this.confetti.length) return
    const g = 1.3
    for (const p of this.confetti) {
      p.vy += g * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rot += p.vrot * dt
      p.life -= dt
      p.alpha = clamp(p.life, 0, 1)
    }
    this.confetti = this.confetti.filter((p) => p.life > 0)
  }

  protected override draw() {
    const ctx = this.ctx
    const w = this.viewW
    const h = this.viewH
    if (!w || !h) return
    this.ensureLayout()

    const color = readColor(this)
    const u = h // board units → pixels (x in [0, boardW] ⇒ x*u in [0, w])

    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = color
    ctx.strokeStyle = color

    // Pegs.
    for (const p of this.pegs) {
      ctx.beginPath()
      ctx.arc(p.x * u, p.y * u, this.pegR * u, 0, Math.PI * 2)
      ctx.fill()
    }

    // Slot dividers + payout numbers.
    const slotTop = this.settleY * h
    const slotBot = 0.98 * h
    ctx.save()
    ctx.globalAlpha = 0.5
    ctx.lineWidth = Math.max(1, h * 0.003)
    for (let i = 0; i <= this.cols; i++) {
      const x = i * this.px * u
      ctx.beginPath()
      ctx.moveTo(x, slotTop)
      ctx.lineTo(x, slotBot)
      ctx.stroke()
    }
    ctx.restore()

    ctx.save()
    ctx.font = `${Math.max(8, h * 0.03)}px ui-monospace, "SF Mono", Menlo, monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let i = 0; i < this.cols; i++) {
      const cx = (i + 0.5) * this.px * u
      ctx.globalAlpha = i === this.lastSlot ? 1 : 0.55
      ctx.fillText(String(this.slotValues[i] ?? ''), cx, (slotTop + slotBot) / 2)
    }
    ctx.restore()

    // Drop-point arrow, shown while waiting to release the next ball.
    if (this.gameState === 'playing' && !this.ballActive) {
      const dx = (this.dropX < 0 ? this.boardW / 2 : this.dropX) * u
      const tip = 0.075 * h
      const top = 0.03 * h
      const halfW = Math.max(4, h * 0.012)
      ctx.save()
      ctx.globalAlpha = 0.5
      ctx.beginPath()
      ctx.moveTo(dx - halfW, top)
      ctx.lineTo(dx + halfW, top)
      ctx.lineTo(dx, tip)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }

    // The ball.
    if (this.ballActive) {
      ctx.beginPath()
      ctx.arc(this.bx * u, this.by * u, this.ballR * u, 0, Math.PI * 2)
      ctx.fill()
    }

    // Confetti burst (on top of everything). Themed: the spinner color with
    // varied alpha, size and rotation so it reads as a celebratory shower
    // without breaking the library's single-color convention.
    for (const p of this.confetti) {
      ctx.save()
      ctx.globalAlpha = clamp(p.alpha, 0, 1)
      ctx.translate(p.x * u, p.y * u)
      ctx.rotate(p.rot)
      const s = p.size * u
      ctx.fillRect(-s / 2, -s * 0.3, s, s * 0.6)
      ctx.restore()
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'spinner-plinko': SpinnerPlinko
  }
}
