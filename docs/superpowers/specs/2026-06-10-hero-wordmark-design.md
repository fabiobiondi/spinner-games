# Hero wordmark animato "SPINNER GAMES" — Design

**Data:** 2026-06-10
**File toccato:** `spinner-games/index.html` (solo l'hero, righe ~834–846 + nuovi stili e un piccolo script)
**Stato:** approvato in brainstorming, pronto per il piano di implementazione

## Obiettivo

Trasformare la prima riga dell'hero in un wordmark "strafigo" e animato dove la **I** di SP**I**NNER richiama uno spinner. Validato visivamente in 4 step (stile della I → prominenza → comportamento animazione → inseguimento del cursore).

## Decisioni prese

1. **Stile della I (opzione C):** la I è una barra solida (`currentColor`) affiancata da un puntino accent con glow che le orbita intorno. La lettera resta perfettamente leggibile.
2. **Prominenza (Variante 2):** "SPINNER GAMES" diventa il titolo protagonista dell'hero; lo slogan attuale "Still stuck with boring spinners?" scende a sottotitolo/tagline.
3. **Animazione (C + inseguimento smooth):**
   - a riposo il puntino **orbita** attorno alla I;
   - all'hover sul wordmark il puntino **insegue il cursore** in modo morbido (smoothing/lerp);
   - all'uscita del mouse ritorna **fluido** all'orbita, senza scatti.

## Stato attuale (riferimento)

Hero in `index.html`:

```html
<header class="hero">
  <div class="hero-inner">
    <p class="hero-eyebrow">spinner-games</p>
    <h1 class="hero-title">
      Still stuck with boring <span class="hero-strike">spinners</span>?
    </h1>
    <p class="hero-pitch">…</p>
  </div>
</header>
```

La pagina è theme-aware: dark/light pilotati da variabili (`--page-bg`, `--page-fg`, `--page-border*`); accent hero `--hero-accent: #2caac3`. Esiste già una gestione `@media (prefers-reduced-motion: reduce)` (righe 14, 371). In fondo al body ci sono `<script type="module">` (righe 1041–1043).

## Design di dettaglio

### Markup nuovo

Sostituire `.hero-eyebrow` con il wordmark e declassare il vecchio `.hero-title` a tagline:

```html
<header class="hero">
  <div class="hero-inner">
    <h1 class="hero-wordmark" id="hero-wordmark">
      <span class="visually-hidden">Spinner Games</span>
      <span class="wm" aria-hidden="true">SP<span class="wm-islot"><span class="wm-bar"></span></span>NNER<span class="wm-gap"></span><span class="wm-games">GAMES</span><span class="wm-dot" id="hero-wm-dot"></span></span>
    </h1>
    <p class="hero-tagline">
      Still stuck with boring <span class="hero-strike">spinners</span>?
    </p>
    <p class="hero-pitch">…invariato…</p>
  </div>
</header>
```

Note di semantica/accessibilità:
- `<h1>` resta l'heading principale; il testo reale "Spinner Games" è esposto agli screen reader tramite `.visually-hidden`, mentre il wordmark decorativo è `aria-hidden="true"`.
- Il puntino (`.wm-dot`) è puramente decorativo.

### Stile (dentro il `<style>` inline esistente)

- `.hero-wordmark` / `.wm`: `display:inline-flex; align-items:center; font-weight:800; letter-spacing:-.01em; line-height:1; white-space:nowrap; font-size:clamp(2.2rem,8vw,4rem);` posizione `relative` (ancora il puntino in `position:absolute`).
- `.wm-games`: `color: color-mix(in srgb, var(--page-fg) 80%, transparent)` per gerarchia.
- `.wm-gap`: spazio tra "SPINNER" e "GAMES" (`width:.38em`).
- `.wm-islot`: slot a larghezza di una I maiuscola (`width:.5em; height:1em`) che centra la barra.
- `.wm-bar`: `width:.16em; height:1em; background: currentColor; border-radius:.08em;` (segue il tema).
- `.wm-dot`: `position:absolute; top:0; left:0; width:.24em; height:.24em; margin:-.12em 0 0 -.12em; border-radius:50%; background: var(--hero-accent); box-shadow: 0 0 .6em var(--hero-accent), 0 0 .15em var(--hero-accent); pointer-events:none; will-change:transform;`
- `.hero-tagline`: eredita il vecchio look del titolo ridimensionato a sottotitolo (`font-size:clamp(1rem,2.6vw,1.3rem); font-weight:600; opacity:.82;`). Mantiene `.hero-strike` invariato.
- `.visually-hidden`: utility standard (clip 1px) se non già presente nel file.
- `@media (prefers-reduced-motion: reduce)`: il puntino resta **statico** appena sopra la barra (es. `transform: translate(<centro-I>, -0.55em)` via classe statica, oppure il JS non parte e una posizione di default CSS lo colloca), così legge come una "I" col pallino senza movimento.

### Comportamento (script in fondo al body)

Loop `requestAnimationFrame` che muove `.wm-dot` con transform:

- Calcolo del centro della I dal bounding box di `.wm-islot` relativo a `.wm`, e `fs = font-size` corrente del wordmark (per scalare il raggio).
- Stato `hovering` aggiornato da `pointerenter` / `pointerleave` sul wordmark; `pointermove` aggiorna le coordinate del mouse relative al wordmark.
- Target:
  - se `hovering`: target = posizione mouse;
  - altrimenti: target = punto sull'orbita (`raggio ≈ fs*0.58`, velocità ≈ `2.0 rad/s`).
- Smoothing: `px += (tx-px)*0.16; py += (ty-py)*0.16;` → applicato come `dot.style.transform = translate(px,py)`. Lo stesso lerp garantisce il rientro fluido in orbita all'uscita del mouse.
- **Guard reduced-motion:** se `matchMedia('(prefers-reduced-motion: reduce)').matches`, non avviare il loop; lasciare il puntino nella posizione statica di default.
- Lo script può essere aggiunto come piccolo blocco inline vicino agli altri script in fondo al body.

## Parametri di riferimento (validati nel prototipo)

| Parametro | Valore |
|---|---|
| Velocità orbita | ~2.0 rad/s |
| Raggio orbita | ~0.58 × font-size |
| Smoothing (lerp) | 0.16 |
| Dimensione puntino | 0.24em |
| Font-size wordmark | clamp(2.2rem, 8vw, 4rem) |

## Fuori scope (YAGNI)

- Nessuna modifica ai wrapper (angular/react/vue), agli esempi `*-usage`, ad altri componenti o al resto della pagina.
- Niente scia/trail luminosa del puntino (estensione possibile in futuro).
- Nessun cambiamento ai testi dello slogan o della pitch.

## Criteri di accettazione

- [ ] La prima riga dell'hero mostra "SPINNER GAMES" grande, con la I come barra + puntino accent.
- [ ] A riposo il puntino orbita attorno alla I in modo continuo e fluido.
- [ ] Su hover del wordmark il puntino segue il cursore in modo morbido; all'uscita rientra fluido in orbita.
- [ ] Lo slogan "Still stuck with boring ~~spinners~~?" appare come sottotitolo con lo strike accent intatto.
- [ ] Funziona in tema dark e light (barra/"GAMES" seguono `--page-fg`, puntino usa l'accent).
- [ ] Con `prefers-reduced-motion: reduce` il puntino è statico (nessun movimento).
- [ ] Screen reader / SEO leggono "Spinner Games" come heading; il puntino è decorativo.
- [ ] Nessuna regressione visiva sul resto dell'hero e della pagina.
