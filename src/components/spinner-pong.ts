import { html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { SpinnerGame, baseStyles, clamp, readColor } from './internal/spinner-game.js'

/**
 * `<spinner-pong>` — minimal old-style Pong, you vs the computer.
 *
 * Plain lines on a canvas: two paddles, a square ball, a dashed net and the
 * score up top. Responsive (fills its parent), starts on a Play button, plays
 * to a configurable winning score, and is controllable with mouse/touch or the
 * keyboard (↑/↓ or W/S; Space/Enter to start).
 *
 * The component fills the width of its parent and derives height from
 * `--spinner-pong-aspect` (default 16/10). To make it fill a fixed-size parent
 * instead, give the element an explicit height in CSS.
 *
 * @example
 * ```html
 * <div style="width: 480px"><spinner-pong></spinner-pong></div>
 * ```
 *
 * Set the `autoplay` attribute for a self-playing Demo mode: both paddles are
 * driven by the computer, user input is disabled and the match restarts
 * forever — handy as a loader/spinner. Set `track-outside` (or the broader
 * `allowOutsideControls`) to keep steering with the mouse even after the
 * pointer leaves the canvas area. Both are opt-in and off by default.
 *
 * Tune how good the computer is with `difficulty` (0 = easy … 1 = very hard,
 * default 0.6):
 * ```html
 * <spinner-pong difficulty="0.3"></spinner-pong>
 * ```
 *
 * @cssprop --spinner-color        - line/ball/score color (default: #2caac3)
 * @cssprop --spinner-bg           - panel background when showBackground is on (default: faint --spinner-color tint)
 * @cssprop --spinner-pong-aspect  - width/height ratio when height is auto (default: 16/10)
 */
@customElement('spinner-pong')
export class SpinnerPong extends SpinnerGame {
  static override styles = [
    baseStyles,
    css`
      :host {
        aspect-ratio: var(--spinner-pong-aspect, 16 / 10);
      }
      .scores {
        position: absolute;
        top: 6%;
        left: 0;
        right: 0;
        display: flex;
        justify-content: center;
        gap: 12%;
        font-family: ui-monospace, "SF Mono", Menlo, monospace;
        font-size: clamp(14px, 7cqi, 32px);
        font-variant-numeric: tabular-nums;
        pointer-events: none;
        user-select: none;
      }
      /* Game over: dim the final scoreboard with the rest of the frozen game,
         leaving the Play-again button and the instructions at full opacity. */
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

  /** Score needed to win the match. */
  @property({ type: Number })
  winScore = 11

  /**
   * Computer skill, from 0 (easy, very beatable) to 1 (near-unbeatable).
   * Controls how fast the computer paddle moves and how precisely it tracks
   * the ball. Values outside 0..1 are clamped.
   */
  @property({ type: Number })
  difficulty = 0.6

  /** Keep following the mouse even after the pointer leaves the canvas area. */
  @property({ type: Boolean, attribute: 'track-outside' })
  trackOutside = false

  @state() private playerScore = 0
  @state() private computerScore = 0

  // State in normalized coordinates (0..1 across each axis) so it survives
  // resizing untouched. Velocities are in fraction-of-axis per second.
  private ballX = 0.5
  private ballY = 0.5
  private ballVX = 0
  private ballVY = 0
  private playerCenter = 0.5 // right paddle (user)
  private computerCenter = 0.5 // left paddle (computer)
  private pointerY: number | null = null
  private keyUp = false
  private keyDown = false

  // Proportions (fractions of the relevant axis).
  private readonly paddleH = 0.18
  private readonly paddleW = 0.012
  private readonly margin = 0.035
  private readonly ballSize = 0.022
  private readonly ballSpeed = 0.62 // ball horizontal speed (width-fraction/s)
  private readonly computerSpeed = 0.85 // paddle speed (height-fraction/s)
  private readonly keyboardSpeed = 1.4 // player paddle speed (height-fraction/s)
  private readonly demoSkill = 0.55 // player-paddle skill while in demo mode

  override render() {
    const playerWon = this.playerScore > this.computerScore
    const message = this.over
      ? playerWon
        ? 'You win!'
        : 'PC wins'
      : ''
    return html`
      <canvas></canvas>
      ${this.renderBadge()}
      <div class="scores">
        <span><span class="label">PC</span>${this.computerScore}</span>
        <span>${this.playerScore}<span class="label">YOU</span></span>
      </div>
      ${this.renderOverlay(message, 'Use arrows up/right or mouse')}
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

  private centerPaddles() {
    this.playerCenter = this.computerCenter = 0.5
  }

  /** Reset to a fresh match: 0–0, paddles centered, ball served to the user. */
  protected override resetRound() {
    this.playerScore = 0
    this.computerScore = 0
    this.centerPaddles()
    this.serve(1)
  }

  /** Send the ball from center toward `dir` (1 = right/user, -1 = left). */
  private serve(dir: number) {
    this.ballX = 0.5
    this.ballY = 0.5
    this.ballVX = this.ballSpeed * dir
    // Gentle, deterministic vertical angle (no Math.random in this env).
    this.ballVY = this.ballSpeed * 0.35 * (this.computerScore % 2 === 0 ? 1 : -1)
  }

  private onPointerMove = (e: PointerEvent) => {
    if (this.autoplay) return // demo mode: input is disabled
    const rect = this.canvas.getBoundingClientRect()
    this.pointerY = (e.clientY - rect.top) / rect.height
    this.keyUp = this.keyDown = false // pointer takes over from keyboard
  }

  private onPointerLeave = () => {
    this.pointerY = null
  }

  protected override onKeyDown(e: KeyboardEvent) {
    if (this.autoplay) return // demo mode: input is disabled
    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        this.keyUp = true
        this.pointerY = null
        e.preventDefault()
        break
      case 'ArrowDown':
      case 's':
      case 'S':
        this.keyDown = true
        this.pointerY = null
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
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') this.keyUp = false
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S')
      this.keyDown = false
  }

  protected override step(dt: number) {
    const half = this.paddleH / 2

    // User paddle. In demo (autoplay) the computer drives it too and input is
    // ignored; otherwise: keyboard if pressed, else pointer, else hold.
    if (this.autoplay) {
      this.playerCenter = this.driveAI(
        this.playerCenter,
        this.ballVX > 0, // chase only while the ball heads our way (right)
        this.demoSkill,
        dt,
      )
    } else if (this.keyUp || this.keyDown) {
      const d = (this.keyDown ? 1 : 0) - (this.keyUp ? 1 : 0)
      this.playerCenter += d * this.keyboardSpeed * dt
    } else if (this.pointerY !== null) {
      this.playerCenter = this.pointerY
    }
    this.playerCenter = clamp(this.playerCenter, half, 1 - half)

    // Computer paddle: chase the ball when it's heading left toward us, capped
    // by `difficulty` (see driveAI).
    this.computerCenter = this.driveAI(
      this.computerCenter,
      this.ballVX < 0,
      this.difficulty,
      dt,
    )

    // Move ball.
    this.ballX += this.ballVX * dt
    this.ballY += this.ballVY * dt

    // Top/bottom walls.
    if (this.ballY < 0) {
      this.ballY = 0
      this.ballVY = Math.abs(this.ballVY)
    } else if (this.ballY > 1) {
      this.ballY = 1
      this.ballVY = -Math.abs(this.ballVY)
    }

    // Left paddle (computer).
    const leftX = this.margin + this.paddleW
    if (
      this.ballVX < 0 &&
      this.ballX <= leftX &&
      this.ballX >= this.margin &&
      Math.abs(this.ballY - this.computerCenter) <= half
    ) {
      this.ballX = leftX
      this.bounce(this.computerCenter, 1)
    }

    // Right paddle (user).
    const rightX = 1 - this.margin - this.paddleW
    if (
      this.ballVX > 0 &&
      this.ballX >= rightX &&
      this.ballX <= 1 - this.margin &&
      Math.abs(this.ballY - this.playerCenter) <= half
    ) {
      this.ballX = rightX
      this.bounce(this.playerCenter, -1)
    }

    // Point scored.
    if (this.ballX < -this.ballSize) {
      this.playerScore++
      this.afterPoint(1)
    } else if (this.ballX > 1 + this.ballSize) {
      this.computerScore++
      this.afterPoint(-1)
    }
  }

  private afterPoint(serveDir: number) {
    const matchOver =
      this.playerScore >= this.winScore ||
      this.computerScore >= this.winScore
    if (matchOver && this.autoplay) {
      // Demo never stops — kick off a fresh match.
      this.playerScore = 0
      this.computerScore = 0
      this.serve(serveDir)
    } else if (matchOver) {
      this.gameState = 'over'
      this.serve(0) // park the ball in the center
      this.ballVX = this.ballVY = 0
    } else {
      this.serve(serveDir)
    }
  }

  /**
   * Move a computer-driven paddle for one frame. It chases the ball's height
   * while `chasing` is true, otherwise eases back toward center. Speed and aim
   * are capped by `skill` (0..1): low skill moves slowly and aims sloppily
   * (beatable), high skill tracks fast and tight. Returns the new center.
   */
  private driveAI(
    center: number,
    chasing: boolean,
    skill: number,
    dt: number,
  ): number {
    const half = this.paddleH / 2
    const s = clamp(skill, 0, 1)
    const aiSpeed = this.computerSpeed * (0.4 + 0.7 * s) // 0.4x … 1.1x
    const deadzone = (1 - s) * half // sloppier aim when easy
    const target = chasing ? this.ballY : 0.5
    const diff = target - center
    if (Math.abs(diff) <= deadzone) return center
    const step = clamp(diff, -aiSpeed * dt, aiSpeed * dt)
    return clamp(center + step, half, 1 - half)
  }

  /** Reflect the ball off a paddle, angling by where it hit. */
  private bounce(paddleCenter: number, dir: number) {
    const hit = clamp((this.ballY - paddleCenter) / (this.paddleH / 2), -1, 1)
    this.ballVX = this.ballSpeed * dir
    this.ballVY = this.ballSpeed * hit
  }

  protected override draw() {
    const ctx = this.ctx
    const w = this.viewW
    const h = this.viewH
    if (!w || !h) return

    const color = readColor(this)

    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = color
    ctx.strokeStyle = color

    // Center net.
    ctx.save()
    ctx.setLineDash([Math.max(3, h * 0.02), Math.max(4, h * 0.03)])
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(w / 2, 0)
    ctx.lineTo(w / 2, h)
    ctx.stroke()
    ctx.restore()

    const pw = this.paddleW * w
    const ph = this.paddleH * h
    const mx = this.margin * w
    const bs = this.ballSize * Math.min(w, h)

    // Paddles.
    ctx.fillRect(mx, this.computerCenter * h - ph / 2, pw, ph)
    ctx.fillRect(w - mx - pw, this.playerCenter * h - ph / 2, pw, ph)

    // Ball.
    ctx.fillRect(this.ballX * w - bs / 2, this.ballY * h - bs / 2, bs, bs)
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'spinner-pong': SpinnerPong
  }
}
