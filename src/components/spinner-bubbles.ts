import { html, css, type PropertyValues } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { SpinnerGame, baseStyles, clamp, readColor } from './internal/spinner-game.js'

interface Flying {
  x: number
  y: number
  vx: number
  vy: number
  color: number
}

// A single shard of a pop "explosion". Same width-unit metric as everything
// else (x/y/velocity are width-fractions), so it stays round at any aspect.
interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number // remaining seconds, counts down to 0
  maxLife: number
  color: number
}

// A candidate auto-shot the demo's planner considers: the aim that produces it,
// the cell the bubble would settle in, and a heuristic score (higher = better).
interface ShotPlan {
  aim: number
  row: number
  col: number
  score: number
}

// Layout constants, in "width units" (1 unit = the canvas width). Working in a
// single isotropic metric — x AND y both measured as a fraction of the width —
// keeps the bubbles perfectly round and the hex spacing uniform regardless of
// the element's aspect ratio. Pixels = unit * viewW.
const COLS = 8
const D = 1 / COLS // bubble diameter
const R = D / 2 // bubble radius
const ROWH = (D * Math.sqrt(3)) / 2 // hex row vertical pitch
const INITIAL_ROWS = 3
const MAX_ANGLE = 1.3 // aim clamp from vertical (~74°)
const SHOT_SPEED = 1.25 // width-fraction/s
const DROP_DURATION = 0.2 // seconds for a freshly-dropped row to slide into place

// Autoplay "skill" knobs. The demo searches aim angles for the best shot, then
// fires with a little error so it plays well without being unbeatable.
const AUTO_AIM_STEP = 0.03 // angular resolution of the shot search (radians)
const AUTO_AIM_JITTER = 0.05 // random aim error added to every auto shot (radians)
const AUTO_BLUNDER_CHANCE = 0.18 // chance the demo ignores the best shot for a random one

// Flat bubble palette. The game's identity is matching by colour, so unlike the
// strictly-monochrome siblings the bubbles carry their own hues; all the
// chrome (launcher, aim guide, death line, score) still uses --spinner-color.
const PALETTE = ['#6ee7ff', '#f8729b', '#ffd166', '#9b8cff', '#7ee787']

/**
 * `<spinner-bubbles>` — minimal Puzzle Bobble / bubble shooter.
 *
 * A hex grid of coloured bubbles hangs from the top; a launcher at the bottom
 * aims and fires bubbles up. Land three or more of the same colour together and
 * the cluster pops; any bubbles left dangling (no longer connected to the top)
 * drop too. Clear the board to win; let the stack reach the death line and it's
 * over. Responsive (fills its parent), starts on a Play button, and is steered
 * with mouse/touch (aim) or the keyboard (←/→ to aim, Space/Enter to shoot).
 *
 * Set the `autoplay` attribute to turn it into a self-playing loader/spinner:
 * the launcher aims at matching bubbles on its own and the board rebuilds
 * forever. Set `track-outside` to keep aiming with the mouse even after the
 * pointer leaves the canvas, or the broader `allowOutsideControls` to also let
 * a click anywhere fire a shot. All are opt-in and off by default.
 *
 * Set `showNewLine` to a number of seconds to ramp up the difficulty: every
 * that-many seconds a fresh row of random bubbles drops in from the top and the
 * whole stack slides down one row, closer to the death line. `0` (the default)
 * disables it. A pending drop waits until any in-flight bubble has landed.
 *
 * The component fills the width of its parent and derives height from
 * `--spinner-bubbles-aspect` (default 4/5, portrait). To make it fill a
 * fixed-size parent instead, give the element an explicit height in CSS.
 *
 * @example
 * ```html
 * <div style="width: 320px"><spinner-bubbles></spinner-bubbles></div>
 * <spinner-bubbles autoplay></spinner-bubbles>
 * <spinner-bubbles showNewLine="30"></spinner-bubbles>
 * ```
 *
 * @cssprop --spinner-color           - launcher/aim/death-line colour (default: #2caac3)
 * @cssprop --spinner-bg              - panel background when showBackground is on (default: faint --spinner-color tint)
 * @cssprop --spinner-bubbles-aspect  - width/height ratio when height is auto (default: 4/5)
 */
@customElement('spinner-bubbles')
export class SpinnerBubbles extends SpinnerGame {
  static override styles = [
    baseStyles,
    css`
      :host {
        aspect-ratio: var(--spinner-bubbles-aspect, 4 / 5);
      }
      /* Nudge the hint up a little so it clears the launcher/aim guide that
         sits near the bottom of the canvas. */
      .overlay p.hint {
        transform: translateY(-2.5em);
      }
    `,
  ]

  /** Keep following the mouse even after the pointer leaves the canvas area. */
  @property({ type: Boolean, attribute: 'track-outside' })
  trackOutside = false

  /**
   * Seconds between automatic "new row" drops that push the stack toward the
   * death line. `0` disables the mechanic. Lit lowercases the attribute, so
   * `showNewLine="30"` and `shownewline="30"` are equivalent in HTML.
   */
  @property({ type: Number })
  showNewLine = 0

  @state() private won = false

  // Portrait by default, so fall back to a taller ratio when unmeasured.
  protected override aspectFallback = 1.25

  // Grid: row-major, -1 = empty cell, otherwise a PALETTE index. A row's "visual
  // parity" — not its raw index — decides its shape: even rows hold COLS bubbles
  // flush left, odd rows are shifted right by a radius and hold COLS-1. Inserting
  // a row at the top flips the parity of every existing row, so we track a
  // `topParity` offset and derive visual parity from `(index + topParity)`; that
  // keeps each existing row's layout intact across a drop.
  private grid: number[][] = []
  private topParity = 0

  private flying: Flying | null = null
  // Short-lived pop shards; purely cosmetic, never touched by game logic.
  private particles: Particle[] = []
  private current = 0 // colour loaded in the launcher
  private next = 0 // colour on deck
  private aim = 0 // radians from vertical, + = right
  private autoCooldown = 0

  // New-row mechanic: countdown to the next drop, and the remaining slide-in
  // offset (in width-units, negative → eases up to 0) for the just-dropped grid.
  private newLineTimer = 0
  private dropAnim = 0

  // Deterministic PRNG — this environment forbids Math.random.
  private seed = 1234567

  override render() {
    const message = this.over && this.won ? 'Cleared!' : ''
    return html`
      <canvas></canvas>
      ${this.renderBadge()}
      ${this.renderOverlay(
        message,
        'Use Mouse or arrows + space',
      )}
    `
  }

  override updated(changed: PropertyValues) {
    // Base handles the `track-outside` / `allowOutsideControls` re-bind.
    super.updated(changed)
    // Arm the countdown when the interval is set/changed mid-game, so flipping
    // it on doesn't drop a row on the very next frame.
    if (changed.has('showNewLine')) {
      this.newLineTimer = this.showNewLine
    }
  }

  /**
   * Wire the pointer listeners. Aim (`pointermove`) leaves the canvas for the
   * window with `track-outside` or `allowOutsideControls`; firing
   * (`pointerdown`) only leaves the canvas with `allowOutsideControls`, so a
   * click anywhere can shoot.
   */
  protected override bindPointer() {
    if (this.allowOutsideControls) {
      window.addEventListener('pointerdown', this.onPointerDown)
    } else {
      this.canvas.addEventListener('pointerdown', this.onPointerDown)
    }
    if (this.trackOutside || this.allowOutsideControls) {
      window.addEventListener('pointermove', this.onPointerMove)
    } else {
      this.canvas.addEventListener('pointermove', this.onPointerMove)
    }
  }

  protected override unbindPointer() {
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas?.removeEventListener('pointermove', this.onPointerMove)
    this.canvas?.removeEventListener('pointerdown', this.onPointerDown)
  }

  /** Playfield height in width-units (the isotropic metric). */
  private playH(): number {
    return this.viewW ? this.viewH / this.viewW : 1.25
  }

  private launchY(): number {
    return this.playH() - 0.09
  }

  private deathY(): number {
    return this.playH() - 0.18
  }

  // ---- PRNG --------------------------------------------------------------

  private rand(): number {
    // Linear congruential generator — deterministic, no Math.random.
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff
    return this.seed / 0x7fffffff
  }

  // ---- Grid geometry -----------------------------------------------------

  /** Layout parity of a stored row (0 = full/flush, 1 = shifted/short). */
  private visualParity(row: number): number {
    return (row + this.topParity) & 1
  }

  private colsInRow(row: number): number {
    return this.visualParity(row) === 0 ? COLS : COLS - 1
  }

  private cellX(row: number, col: number): number {
    return R + (this.visualParity(row) === 1 ? D / 2 : 0) + col * D
  }

  private cellY(row: number): number {
    return R + row * ROWH
  }

  private makeRow(row: number): number[] {
    return new Array(this.colsInRow(row)).fill(-1)
  }

  /** Valid in-bounds neighbours of a hex cell (parity-aware). */
  private neighbors(row: number, col: number): [number, number][] {
    const odd = this.visualParity(row) === 1
    const cand: [number, number][] = odd
      ? [
          [row, col - 1],
          [row, col + 1],
          [row - 1, col],
          [row - 1, col + 1],
          [row + 1, col],
          [row + 1, col + 1],
        ]
      : [
          [row, col - 1],
          [row, col + 1],
          [row - 1, col - 1],
          [row - 1, col],
          [row + 1, col - 1],
          [row + 1, col],
        ]
    return cand.filter(
      ([r, c]) =>
        r >= 0 && r < this.grid.length && c >= 0 && c < this.grid[r].length,
    )
  }

  // ---- Setup / lifecycle of a round -------------------------------------

  /** Reset to a fresh board (called on init and from the base `start`). */
  protected override resetRound() {
    this.resetGrid()
    this.won = false
  }

  private resetGrid() {
    this.grid = []
    this.topParity = 0
    this.dropAnim = 0
    this.newLineTimer = this.showNewLine
    for (let row = 0; row < INITIAL_ROWS; row++) {
      const cells = this.makeRow(row)
      for (let c = 0; c < cells.length; c++) {
        cells[c] = Math.floor(this.rand() * PALETTE.length)
      }
      this.grid.push(cells)
    }
    this.flying = null
    this.particles = []
    this.aim = 0
    this.autoCooldown = 0.3
    this.current = this.pickColor()
    this.next = this.pickColor()
  }

  /**
   * Push a fresh row of random bubbles onto the top, sliding everything down a
   * row. Unshifting flips the parity of every existing row, so we flip
   * `topParity` in lockstep to preserve their layout; the new row then takes
   * row 0's parity. Returns true if the drop pushed the stack past the death
   * line (handled by the caller).
   */
  private addTopRow(): boolean {
    this.topParity ^= 1
    const cells = this.makeRow(0)
    for (let c = 0; c < cells.length; c++) {
      cells[c] = Math.floor(this.rand() * PALETTE.length)
    }
    this.grid.unshift(cells)
    // Start the grid one row higher than its new home and ease it down.
    this.dropAnim = -ROWH
    return this.reachedDeath()
  }

  /** Distinct colours still on the board — keeps the launcher solvable. */
  private distinctColors(): number[] {
    const set = new Set<number>()
    for (const row of this.grid)
      for (const c of row) if (c >= 0) set.add(c)
    return [...set]
  }

  /** Load a colour that actually exists on the board (when possible). */
  private pickColor(): number {
    const present = this.distinctColors()
    if (present.length === 0)
      return Math.floor(this.rand() * PALETTE.length)
    return present[Math.floor(this.rand() * present.length)]
  }

  /**
   * Re-sync the launcher to the live board: drop any loaded/on-deck colour that
   * is no longer present and replace it with one that is.
   *
   * `pickColor` only guarantees a valid colour *at the instant it runs*, but
   * `current`/`next` are loaded ahead of time. When a shot pops the last bubble
   * of a colour, the bubble already sitting in the launcher can be of that now
   * absent colour — and a bubble whose colour isn't on the board can never form
   * a 3+ cluster, so it only piles up and the board becomes unclearable. Calling
   * this after every board change keeps the queue solvable. No-op on an empty
   * board (the round is already won).
   */
  private syncLauncherColors() {
    const present = this.distinctColors()
    if (present.length === 0) return
    if (!present.includes(this.current)) this.current = this.pickColor()
    if (!present.includes(this.next)) this.next = this.pickColor()
  }

  private shoot() {
    if (this.flying || this.gameState !== 'playing') return
    this.flying = {
      x: 0.5,
      y: this.launchY(),
      vx: Math.sin(this.aim) * SHOT_SPEED,
      vy: -Math.cos(this.aim) * SHOT_SPEED,
      color: this.current,
    }
    this.current = this.next
    this.next = this.pickColor()
  }

  // ---- Input -------------------------------------------------------------

  private onPointerMove = (e: PointerEvent) => {
    if (this.autoplay) return // demo mode: input is disabled
    const rect = this.canvas.getBoundingClientRect()
    const ux = (e.clientX - rect.left) / rect.width
    const uy = ((e.clientY - rect.top) / rect.height) * this.playH()
    const dx = ux - 0.5
    const dy = this.launchY() - uy // upward is positive
    this.aim = clamp(Math.atan2(dx, dy), -MAX_ANGLE, MAX_ANGLE)
  }

  private onPointerDown = (e: PointerEvent) => {
    if (this.autoplay) return // demo mode: input is disabled
    if (this.gameState !== 'playing') return
    this.onPointerMove(e) // aim where the user tapped, then fire
    this.shoot()
    e.preventDefault()
  }

  protected override onKeyDown(e: KeyboardEvent) {
    if (this.autoplay) return // demo mode: input is disabled
    switch (e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.aim = clamp(this.aim - 0.12, -MAX_ANGLE, MAX_ANGLE)
        e.preventDefault()
        break
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.aim = clamp(this.aim + 0.12, -MAX_ANGLE, MAX_ANGLE)
        e.preventDefault()
        break
      case ' ':
      case 'Enter':
        if (this.gameState !== 'playing') this.start()
        else this.shoot()
        e.preventDefault()
        break
    }
  }

  // ---- Main loop ---------------------------------------------------------

  /** Pop shards advance every frame, even on game over — so run them in tick. */
  protected override tick(dt: number) {
    this.updateParticles(dt)
  }

  protected override step(dt: number) {
    // Ease a freshly-dropped grid down into its new home.
    if (this.dropAnim < 0) {
      this.dropAnim = Math.min(0, this.dropAnim + (ROWH / DROP_DURATION) * dt)
    }

    // Difficulty ramp: drop a new top row every `showNewLine` seconds. Hold a
    // due drop until any in-flight bubble has landed, so it can't overlap one.
    if (this.showNewLine > 0) {
      this.newLineTimer -= dt
      if (this.newLineTimer <= 0 && !this.flying) {
        this.newLineTimer = this.showNewLine
        if (this.addTopRow()) {
          if (this.autoplay) this.resetGrid()
          else {
            this.won = false
            this.gameState = 'over'
            return
          }
        }
      }
    }

    // Autoplay: aim at a matching bubble and fire on a gentle cadence.
    if (this.autoplay && !this.flying) {
      if (this.autoCooldown > 0) {
        this.autoCooldown -= dt
      } else {
        this.autoAim()
        this.shoot()
        this.autoCooldown = 0.9
      }
    }

    if (!this.flying) return
    const f = this.flying
    f.x += f.vx * dt
    f.y += f.vy * dt

    // Side walls.
    if (f.x < R) {
      f.x = R
      f.vx = Math.abs(f.vx)
    } else if (f.x > 1 - R) {
      f.x = 1 - R
      f.vx = -Math.abs(f.vx)
    }

    // Reached the ceiling — stick into the top row.
    if (f.y <= R) {
      this.land(f)
      return
    }

    // Hit an existing bubble.
    for (let row = 0; row < this.grid.length; row++) {
      for (let col = 0; col < this.grid[row].length; col++) {
        if (this.grid[row][col] < 0) continue
        const dx = f.x - this.cellX(row, col)
        const dy = f.y - this.cellY(row)
        if (dx * dx + dy * dy < D * D) {
          this.land(f)
          return
        }
      }
    }
  }

  /** Snap the flying bubble to the nearest free cell, then resolve matches. */
  private land(f: Flying) {
    const { row, col } = this.nearestEmptyCell(f.x, f.y)
    while (this.grid.length <= row) this.grid.push(this.makeRow(this.grid.length))
    this.grid[row][col] = f.color
    this.flying = null

    this.resolve(row, col)

    // The pop may have eliminated a colour the launcher is still holding; refresh
    // it so the loaded/next bubbles only ever use colours that remain in play.
    this.syncLauncherColors()

    if (this.boardEmpty()) {
      if (this.autoplay) this.resetGrid()
      else {
        this.won = true
        this.gameState = 'over'
      }
      return
    }
    if (this.reachedDeath()) {
      if (this.autoplay) this.resetGrid()
      else {
        this.won = false
        this.gameState = 'over'
      }
    }
  }

  /** Closest empty grid cell to a point, biased to stay adjacent to bubbles. */
  private nearestEmptyCell(x: number, y: number): { row: number; col: number } {
    let estRow = Math.max(0, Math.round((y - R) / ROWH))
    const off = this.visualParity(estRow) === 1 ? D / 2 : 0
    let estCol = Math.round((x - R - off) / D)
    estCol = clamp(estCol, 0, this.colsInRow(estRow) - 1)

    // Gather the estimate plus its neighbours, keep the empty ones, choose the
    // closest to the impact point.
    const candidates: [number, number][] = [
      [estRow, estCol],
      ...this.neighbors(estRow, estCol),
    ]
    let best: { row: number; col: number } | null = null
    let bestD = Infinity
    for (const [r, c] of candidates) {
      if (r < this.grid.length && this.grid[r][c] >= 0) continue
      if (c < 0 || c >= this.colsInRow(r)) continue
      const dx = x - this.cellX(r, c)
      const dy = y - this.cellY(r)
      const dist = dx * dx + dy * dy
      if (dist < bestD) {
        bestD = dist
        best = { row: r, col: c }
      }
    }
    return best ?? { row: estRow, col: estCol }
  }

  /** Pop a colour cluster of 3+, then drop anything left unsupported. */
  private resolve(row: number, col: number) {
    const color = this.grid[row][col]
    const cluster = this.sameColorCluster(row, col, color)
    if (cluster.length >= 3) {
      for (const [r, c] of cluster) {
        // Burst from where the bubble visually sits (dropAnim included).
        this.spawnBurst(this.cellX(r, c), this.cellY(r) + this.dropAnim, color)
        this.grid[r][c] = -1
      }
      this.dropFloating()
    }
  }

  /**
   * Spawn a tiny radial burst of fading shards at a popped bubble. Deliberately
   * minimal — a handful of particles that fly out a fraction of a bubble and
   * fade in under half a second. Uses the LCG `rand()` (Math.random is banned).
   */
  private spawnBurst(cx: number, cy: number, color: number) {
    const count = 6
    const base = this.rand() * Math.PI * 2 // rotate the whole ring randomly
    for (let i = 0; i < count; i++) {
      const angle = base + (i / count) * Math.PI * 2
      const speed = 0.15 + this.rand() * 0.2 // width-units/s
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.sin(angle) * speed,
        vy: Math.cos(angle) * speed,
        life: 0.35,
        maxLife: 0.35,
        color,
      })
    }
  }

  /** Advance and retire pop shards. Runs every frame, even on game over. */
  private updateParticles(dt: number) {
    if (!this.particles.length) return
    for (const p of this.particles) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.life -= dt
    }
    this.particles = this.particles.filter((p) => p.life > 0)
  }

  private sameColorCluster(
    row: number,
    col: number,
    color: number,
  ): [number, number][] {
    const seen = new Set<string>([`${row},${col}`])
    const out: [number, number][] = [[row, col]]
    const stack: [number, number][] = [[row, col]]
    while (stack.length) {
      const [r, c] = stack.pop()!
      for (const [nr, nc] of this.neighbors(r, c)) {
        const key = `${nr},${nc}`
        if (seen.has(key)) continue
        if (this.grid[nr][nc] !== color) continue
        seen.add(key)
        out.push([nr, nc])
        stack.push([nr, nc])
      }
    }
    return out
  }

  /** Remove every bubble no longer connected to the top row. */
  private dropFloating() {
    const anchored = new Set<string>()
    const stack: [number, number][] = []
    if (this.grid[0]) {
      for (let c = 0; c < this.grid[0].length; c++) {
        if (this.grid[0][c] >= 0) {
          anchored.add(`0,${c}`)
          stack.push([0, c])
        }
      }
    }
    while (stack.length) {
      const [r, c] = stack.pop()!
      for (const [nr, nc] of this.neighbors(r, c)) {
        const key = `${nr},${nc}`
        if (anchored.has(key) || this.grid[nr][nc] < 0) continue
        anchored.add(key)
        stack.push([nr, nc])
      }
    }
    for (let r = 0; r < this.grid.length; r++)
      for (let c = 0; c < this.grid[r].length; c++)
        if (this.grid[r][c] >= 0 && !anchored.has(`${r},${c}`))
          this.grid[r][c] = -1
  }

  private boardEmpty(): boolean {
    return this.grid.every((row) => row.every((c) => c < 0))
  }

  private reachedDeath(): boolean {
    const death = this.deathY()
    for (let r = this.grid.length - 1; r >= 0; r--) {
      if (this.grid[r].some((c) => c >= 0))
        return this.cellY(r) + R >= death
    }
    return false
  }

  /**
   * Pick an aim for the loader/demo mode. Rather than blindly pointing at the
   * nearest same-coloured bubble, it *plans*: it sweeps a fan of aim angles,
   * simulates where each shot would actually settle (walls, ceiling and the
   * first bubble it touches — the same physics the real shot uses), and scores
   * the outcome, favouring shots that pop a 3+ cluster.
   *
   * To stay "smart but not invincible" it then fires imperfectly: most of the
   * time it takes the top-scoring shot, but now and then it blunders to a
   * random one, and every shot carries a touch of aim error — so it misses
   * occasionally and never plays a flawless game.
   */
  private autoAim() {
    const plans = this.planShots()
    if (plans.length === 0) {
      // Nothing landed (e.g. a momentarily empty board): sweep so it stays alive.
      this.aim = clamp(this.aim + 0.25, -MAX_ANGLE, MAX_ANGLE)
      return
    }

    // Usually take the best shot; sometimes deliberately fumble to a random one.
    const chosen =
      this.rand() < AUTO_BLUNDER_CHANCE
        ? plans[Math.floor(this.rand() * plans.length)]
        : plans.reduce((best, p) => (p.score > best.score ? p : best))

    // A small random error — enough to clip a neighbouring cell and miss a tight
    // match every so often, keeping the play human rather than robotic.
    const jitter = (this.rand() * 2 - 1) * AUTO_AIM_JITTER
    this.aim = clamp(chosen.aim + jitter, -MAX_ANGLE, MAX_ANGLE)
  }

  /**
   * Enumerate candidate auto-shots: for each aim angle across the launcher's
   * range, simulate the landing cell and score the result. A shot that pops a
   * cluster (3+ same colour, counting the bubble we'd add) scores far above any
   * mere placement; among placements, sitting next to same-colour bubbles (a
   * future match) and keeping the stack shallow are mild tie-breakers.
   */
  private planShots(): ShotPlan[] {
    const plans: ShotPlan[] = []
    for (let a = -MAX_ANGLE; a <= MAX_ANGLE; a += AUTO_AIM_STEP) {
      const { row, col } = this.simulateLanding(a)
      const cluster = this.clusterSizeIfPlaced(row, col, this.current)
      // Pops dominate; deeper pops relieve a touch more pressure. Placements
      // prefer more same-colour neighbours and a shallower stack.
      const score =
        cluster >= 3 ? 1000 + cluster * 10 + row : cluster * 5 - row
      plans.push({ aim: a, row, col, score })
    }
    return plans
  }

  /**
   * Trace a shot fired at `aim` and return the cell it would settle in — a
   * headless replay of `step()`'s flight: march in small steps, reflect off the
   * side walls, stop at the ceiling or the first bubble touched, then snap to
   * the nearest empty cell exactly as `land()` does.
   */
  private simulateLanding(aim: number): { row: number; col: number } {
    let x = 0.5
    let y = this.launchY()
    let dx = Math.sin(aim)
    let dy = -Math.cos(aim)
    const stepLen = R * 0.4
    const maxSteps = Math.ceil(6 / stepLen) // matches aimPath's traced length

    for (let i = 0; i < maxSteps; i++) {
      x += dx * stepLen
      y += dy * stepLen
      if (x < R) {
        x = R
        dx = Math.abs(dx)
      } else if (x > 1 - R) {
        x = 1 - R
        dx = -Math.abs(dx)
      }
      if (y <= R) return this.nearestEmptyCell(x, R)
      if (this.hitsBubble(x, y)) return this.nearestEmptyCell(x, y)
    }
    return this.nearestEmptyCell(x, y)
  }

  /**
   * Size of the same-colour cluster that would form if a `color` bubble were
   * placed at (row, col) — i.e. 1 (the new bubble) plus every connected
   * same-colour bubble. Mirrors `sameColorCluster` without mutating the grid;
   * `>= 3` means the shot pops.
   */
  private clusterSizeIfPlaced(row: number, col: number, color: number): number {
    if (row < 0) return 1 // landed below the grid; nothing above it to match yet
    const seen = new Set<string>([`${row},${col}`])
    const stack: [number, number][] = [[row, col]]
    let count = 1
    while (stack.length) {
      const [r, c] = stack.pop()!
      for (const [nr, nc] of this.neighbors(r, c)) {
        const key = `${nr},${nc}`
        if (seen.has(key)) continue
        if (this.grid[nr][nc] !== color) continue
        seen.add(key)
        count++
        stack.push([nr, nc])
      }
    }
    return count
  }

  /**
   * Trace where a bubble fired at the current `aim` would travel: a polyline
   * that starts at the launcher, reflects off the side walls (showing each
   * bounce as a vertex) and stops just shy of the first bubble it would touch,
   * or at the ceiling. Mirrors the live flight physics in `step()` so the guide
   * matches the real shot. All coordinates are in width-units.
   */
  private aimPath(): { pts: { x: number; y: number }[]; bounces: { x: number; y: number }[] } {
    const pts: { x: number; y: number }[] = []
    const bounces: { x: number; y: number }[] = []
    let x = 0.5
    let y = this.launchY()
    let dx = Math.sin(this.aim)
    let dy = -Math.cos(this.aim)
    pts.push({ x, y })

    const stepLen = R * 0.4 // march resolution (width-units)
    const maxDist = 6 // cap total traced length so a flat shot can't loop forever
    const maxSteps = Math.ceil(maxDist / stepLen)

    for (let i = 0; i < maxSteps; i++) {
      x += dx * stepLen
      y += dy * stepLen

      // Side walls — clamp to the wall and reflect, recording the bounce so the
      // renderer can mark it. Matches `step()`'s wall handling.
      if (x < R) {
        x = R
        dx = Math.abs(dx)
        bounces.push({ x, y })
        pts.push({ x, y })
      } else if (x > 1 - R) {
        x = 1 - R
        dx = -Math.abs(dx)
        bounces.push({ x, y })
        pts.push({ x, y })
      }

      // Ceiling — the shot would stick to the top row.
      if (y <= R) {
        y = R
        pts.push({ x, y })
        return { pts, bounces }
      }

      // First bubble in the way — stop right at contact ("almost the bubbles").
      if (this.hitsBubble(x, y)) {
        pts.push({ x, y })
        return { pts, bounces }
      }
    }

    pts.push({ x, y })
    return { pts, bounces }
  }

  /**
   * Would a flying bubble centred at (x, y) be touching any board bubble? Uses
   * the same center-distance < D test as `step()`, but only scans the few rows
   * around the point, and tracks `dropAnim` so the guide lines up with the
   * bubbles as drawn.
   */
  private hitsBubble(x: number, y: number): boolean {
    const approxRow = Math.round((y - R - this.dropAnim) / ROWH)
    const lo = Math.max(0, approxRow - 1)
    const hi = Math.min(this.grid.length - 1, approxRow + 1)
    for (let row = lo; row <= hi; row++) {
      const cells = this.grid[row]
      for (let col = 0; col < cells.length; col++) {
        if (cells[col] < 0) continue
        const ddx = x - this.cellX(row, col)
        const ddy = y - (this.cellY(row) + this.dropAnim)
        if (ddx * ddx + ddy * ddy < D * D) return true
      }
    }
    return false
  }

  // ---- Drawing -----------------------------------------------------------

  protected override draw() {
    const ctx = this.ctx
    const w = this.viewW
    const h = this.viewH
    if (!w || !h) return

    const color = readColor(this)
    const rPx = R * w

    ctx.clearRect(0, 0, w, h)

    // Grid bubbles. `dropAnim` (<=0) slides the whole grid in from above when a
    // new row has just been added, then eases to 0.
    for (let row = 0; row < this.grid.length; row++) {
      for (let col = 0; col < this.grid[row].length; col++) {
        const ci = this.grid[row][col]
        if (ci < 0) continue
        this.drawBubble(
          this.cellX(row, col) * w,
          (this.cellY(row) + this.dropAnim) * w,
          rPx,
          PALETTE[ci],
        )
      }
    }

    // Pop shards — small dots fading and shrinking where clusters cleared.
    for (const p of this.particles) {
      const a = p.life / p.maxLife
      ctx.save()
      ctx.globalAlpha = a
      ctx.beginPath()
      ctx.arc(p.x * w, p.y * w, rPx * 0.3 * a, 0, Math.PI * 2)
      ctx.fillStyle = PALETTE[p.color]
      ctx.fill()
      ctx.restore()
    }

    // Death line — faint dashed, in the theme colour.
    ctx.save()
    ctx.strokeStyle = color
    ctx.globalAlpha = 0.3
    ctx.setLineDash([Math.max(3, w * 0.02), Math.max(3, w * 0.02)])
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, this.deathY() * w)
    ctx.lineTo(w, this.deathY() * w)
    ctx.stroke()
    ctx.restore()

    // Flying bubble.
    if (this.flying)
      this.drawBubble(this.flying.x * w, this.flying.y * w, rPx, PALETTE[this.flying.color])

    // Launcher + aim guide (theme colour).
    const lx = 0.5 * w
    const ly = this.launchY() * w

    // Trace the full shot path: a dashed polyline that bounces off the walls
    // and runs almost up to the first bubble (or the ceiling). Each wall bounce
    // is marked with a small dot so the rebound reads clearly.
    const { pts, bounces } = this.aimPath()
    ctx.save()
    ctx.strokeStyle = color
    ctx.globalAlpha = 0.5
    ctx.setLineDash([Math.max(3, w * 0.015), Math.max(4, w * 0.02)])
    ctx.lineWidth = 1.5
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(pts[0].x * w, pts[0].y * w)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * w, pts[i].y * w)
    ctx.stroke()

    // Bounce markers — solid dots (override the dash) at each wall rebound.
    ctx.setLineDash([])
    ctx.fillStyle = color
    for (const b of bounces) {
      ctx.beginPath()
      ctx.arc(b.x * w, b.y * w, Math.max(2, w * 0.008), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    // Loaded bubble sits on the launcher; next bubble peeks below-left.
    this.drawBubble(lx, ly, rPx, PALETTE[this.current])
    this.drawBubble(0.14 * w, ly + rPx * 0.6, rPx * 0.6, PALETTE[this.next])
  }

  private drawBubble(cx: number, cy: number, r: number, color: string) {
    const ctx = this.ctx
    // Outline only — a coloured ring, no fill. Scale the stroke with the radius
    // so it reads at any size, and inset by half its width to keep it crisp.
    const lineWidth = Math.max(1.5, r * 0.12)
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.94 - lineWidth / 2, 0, Math.PI * 2)
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
    ctx.stroke()
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'spinner-bubbles': SpinnerBubbles
  }
}
