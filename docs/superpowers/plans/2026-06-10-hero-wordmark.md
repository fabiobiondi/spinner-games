# Hero wordmark animato "SPINNER GAMES" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trasformare la prima riga dell'hero della homepage in un wordmark "SPINNER GAMES" grande e animato, dove la I è una barra solida con un puntino accent che orbita e insegue il mouse.

**Architecture:** Modifica al solo `spinner-games/index.html` (sito statico Vite). Si tocca: (1) il markup dell'hero, (2) gli stili inline nel `<style>`, (3) un piccolo `<script>` inline in fondo al body per il pointer-tracking. Nessun framework, nessuna dipendenza nuova.

**Tech Stack:** HTML + CSS inline (variabili tema `--page-fg` / `--hero-accent`) + vanilla JS (`requestAnimationFrame`, `matchMedia`). Build/preview via Vite (`npm run dev`, `npm run build:site`).

**Nota sul testing:** la homepage è un sito statico senza harness di unit-test. La verifica di ogni task è **visiva** sul dev server (`npm run dev`) più un **build check** finale (`npm run build:site`). Ogni commit lascia la pagina in uno stato funzionante.

**Riferimento spec:** `docs/superpowers/specs/2026-06-10-hero-wordmark-design.md`

---

### Task 1: Restructure markup dell'hero + stili statici del wordmark

Sostituisce l'eyebrow `spinner-games` con il wordmark "SPINNER GAMES" (I come barra) e declassa il vecchio titolo a tagline. Senza JS il puntino è nascosto (`visibility:hidden`), quindi la I si legge come una barra: la pagina resta corretta.

**Files:**
- Modify markup: `spinner-games/index.html:836-839`
- Modify CSS: `spinner-games/index.html:136-150` (regole `.hero-eyebrow` e `.hero-title`)

- [ ] **Step 1: Sostituire il markup dell'hero**

In `spinner-games/index.html`, sostituire queste righe (836–839):

```html
        <p class="hero-eyebrow">spinner-games</p>
        <h1 class="hero-title">
          Still stuck with boring <span class="hero-strike">spinners</span>?
        </h1>
```

con:

```html
        <h1 class="hero-wordmark">
          <span class="visually-hidden">Spinner Games</span>
          <span class="wm" aria-hidden="true">SP<span class="wm-islot"><span class="wm-bar"></span></span>NNER<span class="wm-gap"></span><span class="wm-games">GAMES</span><span class="wm-dot" id="hero-wm-dot"></span></span>
        </h1>
        <p class="hero-tagline">
          Still stuck with boring <span class="hero-strike">spinners</span>?
        </p>
```

- [ ] **Step 2: Sostituire la regola CSS `.hero-eyebrow` con gli stili del wordmark**

Sostituire questo blocco (righe 136–143):

```css
      .hero-eyebrow {
        margin: 0 0 1.25rem;
        font-size: 0.72rem;
        letter-spacing: 0.32em;
        text-transform: uppercase;
        opacity: 0.55;
        font-weight: 600;
      }
```

con:

```css
      .hero-wordmark {
        margin: 0 0 1.25rem;
        font-weight: 800;
        line-height: 1;
      }
      /* Accessible text for the wordmark; the animated glyphs are aria-hidden. */
      .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        margin: -1px;
        padding: 0;
        border: 0;
        clip: rect(0 0 0 0);
        clip-path: inset(50%);
        overflow: hidden;
        white-space: nowrap;
      }
      /* The big "SPINNER GAMES" lockup. position:relative anchors the orbiting
         dot (.wm-dot), which is absolutely positioned and moved by JS. */
      .wm {
        position: relative;
        display: inline-flex;
        align-items: center;
        font-size: clamp(2.2rem, 8vw, 4rem);
        letter-spacing: -0.01em;
        line-height: 1;
        white-space: nowrap;
      }
      .wm-gap {
        width: 0.38em;
      }
      .wm-games {
        color: color-mix(in srgb, var(--page-fg) 80%, transparent);
      }
      /* Optical slot for the capital I; holds the solid bar. */
      .wm-islot {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 0.5em;
        height: 1em;
      }
      .wm-bar {
        width: 0.16em;
        height: 1em;
        background: currentColor;
        border-radius: 0.08em;
      }
      /* Hidden until JS positions it over the I (avoids a flash at top-left and
         degrades gracefully with no JS — the I reads fine as a bare bar). */
      .wm-dot {
        position: absolute;
        top: 0;
        left: 0;
        width: 0.24em;
        height: 0.24em;
        margin: -0.12em 0 0 -0.12em;
        border-radius: 50%;
        background: var(--hero-accent);
        box-shadow: 0 0 0.6em var(--hero-accent), 0 0 0.15em var(--hero-accent);
        pointer-events: none;
        will-change: transform;
        visibility: hidden;
      }
```

- [ ] **Step 3: Convertire la regola `.hero-title` in `.hero-tagline`**

Sostituire questo blocco (righe ex 144–150):

```css
      .hero-title {
        margin: 0;
        font-size: clamp(2.2rem, 6.5vw, 4rem);
        line-height: 1.05;
        font-weight: 800;
        letter-spacing: -0.02em;
      }
```

con:

```css
      .hero-tagline {
        margin: 1.25rem 0 0;
        font-size: clamp(1.05rem, 2.6vw, 1.35rem);
        line-height: 1.3;
        font-weight: 600;
        opacity: 0.85;
      }
```

(Le regole `.hero-strike` subito sotto restano invariate: lo strike accent su "spinners" continua a funzionare dentro la tagline.)

- [ ] **Step 4: Verifica visiva (dev server)**

Run: `npm run dev` e aprire l'URL stampato (es. `http://localhost:5173`).

Expected:
- La prima riga dell'hero mostra **"SPINNER GAMES"** grande e in grassetto; la I di SP**I**NNER è una barra verticale; "GAMES" è leggermente più tenue.
- Sotto compare **"Still stuck with boring ~~spinners~~?"** come sottotitolo, con lo strike accent intatto.
- Il puntino accent **non** è ancora visibile (corretto: lo aggiunge il JS nel Task 2).
- Provare il toggle tema in alto a destra: in dark e light la barra-I e "GAMES" restano leggibili (seguono `--page-fg`).

- [ ] **Step 5: Commit**

```bash
git add spinner-games/index.html
git commit -m "feat(site): SPINNER GAMES hero wordmark (static markup + styles)"
```

---

### Task 2: Animazione del puntino (orbita + inseguimento mouse + reduced-motion)

Aggiunge il pointer-tracking: a riposo il puntino orbita attorno alla I; all'hover insegue il cursore con smoothing; all'uscita rientra fluido in orbita. Rispetta `prefers-reduced-motion`.

**Files:**
- Modify: `spinner-games/index.html` — inserire un `<script>` inline subito prima di `</body>` (dopo gli script esistenti alle ~righe 1041–1043).

- [ ] **Step 1: Inserire lo script di animazione prima di `</body>`**

Aggiungere, immediatamente prima del tag `</body>` di `spinner-games/index.html`:

```html
    <!-- Hero wordmark: the accent dot orbits the "I", follows the cursor while
         hovering the wordmark, and eases back into orbit on leave. Smoothing via
         a per-frame lerp. Respects prefers-reduced-motion (static dot, no loop). -->
    <script>
      (function () {
        var wm = document.querySelector('.hero-wordmark .wm');
        var dot = document.getElementById('hero-wm-dot');
        var slot = wm && wm.querySelector('.wm-islot');
        if (!wm || !dot || !slot) return;

        function metrics() {
          var w = wm.getBoundingClientRect();
          var s = slot.getBoundingClientRect();
          return {
            cx: s.left - w.left + s.width / 2,
            cy: s.top - w.top + s.height / 2,
            fs: parseFloat(getComputedStyle(wm).fontSize) || 32
          };
        }

        function place(x, y) {
          dot.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
        }

        // Reduced motion: place the dot statically above the bar (like an i-dot).
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          var m0 = metrics();
          place(m0.cx, m0.cy - m0.fs * 0.55);
          dot.style.visibility = 'visible';
          return;
        }

        var hovering = false, mx = 0, my = 0, px = 0, py = 0, started = false;

        wm.addEventListener('pointerenter', function () { hovering = true; });
        wm.addEventListener('pointerleave', function () { hovering = false; });
        wm.addEventListener('pointermove', function (e) {
          var w = wm.getBoundingClientRect();
          mx = e.clientX - w.left;
          my = e.clientY - w.top;
        });

        function frame(now) {
          var m = metrics();
          var tx, ty;
          if (hovering) {
            tx = mx;
            ty = my;
          } else {
            var a = now / 1000 * 2.0;     // orbit speed (rad/s)
            var r = m.fs * 0.58;          // orbit radius
            tx = m.cx + Math.cos(a) * r;
            ty = m.cy + Math.sin(a) * r;
          }
          if (!started) {
            px = tx;
            py = ty;
            started = true;
            dot.style.visibility = 'visible';
          }
          px += (tx - px) * 0.16;          // smoothing (lerp)
          py += (ty - py) * 0.16;
          place(px, py);
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      })();
    </script>
```

- [ ] **Step 2: Verifica visiva dell'animazione (dev server)**

Run: `npm run dev` (se non già attivo) e aprire l'URL.

Expected:
- A riposo il puntino accent **orbita** attorno alla I in modo continuo e fluido.
- Passando il mouse sul wordmark e muovendolo, il puntino **insegue il cursore** in modo morbido (nessuno scatto).
- Uscendo dal wordmark, il puntino **rientra fluido** in orbita.
- Funziona in dark e light (il puntino usa l'accent `#2caac3`).

- [ ] **Step 3: Verifica reduced-motion**

Attivare "Riduci movimento" a livello OS (macOS: Impostazioni → Accessibilità → Schermo → Riduci movimento) e ricaricare la pagina — oppure usare l'emulazione DevTools: Rendering → "Emulate CSS prefers-reduced-motion: reduce".

Expected:
- Il puntino è **fermo** sopra la barra (legge come una "I" col pallino); nessuna orbita né inseguimento.

- [ ] **Step 4: Build check del sito statico**

Run: `npm run build:site`
Expected: build completata senza errori; output in `dist-site/`.

- [ ] **Step 5: Commit**

```bash
git add spinner-games/index.html
git commit -m "feat(site): orbit + cursor-follow animation for hero wordmark dot"
```

---

## Verifica finale rispetto ai criteri di accettazione (spec)

Dopo i due task, confermare visivamente:

- [ ] Prima riga dell'hero: "SPINNER GAMES" grande, I come barra + puntino accent.
- [ ] A riposo il puntino orbita fluido attorno alla I.
- [ ] Hover → insegue il cursore; uscita → rientro fluido in orbita.
- [ ] Slogan "Still stuck with boring ~~spinners~~?" come sottotitolo, strike intatto.
- [ ] Funziona in tema dark e light.
- [ ] `prefers-reduced-motion: reduce` → puntino statico.
- [ ] Heading accessibile legge "Spinner Games"; puntino decorativo (`aria-hidden`).
- [ ] Nessuna regressione sul resto dell'hero/pagina; `npm run build:site` ok.
