// Interactive API explorer for the playground (index.html).
//
// Playground-only: this file lives outside `src/`, so it never reaches the
// published library, the TypeScript build, or the type-check. It depends on the
// custom elements already being registered by `/src/index.ts` (loaded just
// before this script).
//
// What it does: lets you pick a game (Pong / Breakout / Bubbles / Flappy) and a
// framework (HTML / React / Vue / Angular), toggle each game's real props, and
// see both a live preview and the matching, copy-ready snippet — syntax
// highlighted with Shiki. The prop list IS the API reference: each row is named
// after the actual reactive property and shows its default.
//
// Shiki is pulled from a CDN (esm.sh) rather than added as a dependency, the
// same module-from-CDN approach the project documents for the components
// themselves. If it can't load (e.g. offline) the snippets fall back to plain,
// still-copyable text.

const SHIKI_URL = 'https://esm.sh/shiki@3.23.0'

// --- Prop model -------------------------------------------------------------
// Each prop carries its reactive-property name, kind, and the element's own
// default. `def` is the *component* default and drives code generation: a prop
// is only emitted into the snippet when its value differs from `def`, keeping
// the "simplified instructions" actually simple.

/** Shared props from the `SpinnerGame` base element, in a sensible reading order. */
const SHARED_PROPS = [
  { key: 'autoplay', kind: 'bool', def: false, hint: 'Demo mode — the game plays itself' },
  { key: 'showBackground', kind: 'bool', def: true, attr: 'show-background', hint: 'Paint the panel background' },
  { key: 'allowOutsideControls', kind: 'bool', def: false, hint: 'Controls work past the canvas edge' },
]

/** `track-outside` exists on every pointer-steered game (i.e. all but Flappy). */
const TRACK_OUTSIDE = {
  key: 'trackOutside',
  kind: 'bool',
  def: false,
  attr: 'track-outside',
  hint: 'Keep following the mouse off-canvas',
}

const GAMES = {
  pong: {
    label: 'Pong',
    tag: 'spinner-pong',
    element: 'SpinnerPong', // element class / Angular directive
    component: 'Pong', // React / Vue component
    props: [
      { key: 'difficulty', kind: 'number', def: 0.6, min: 0, max: 1, step: 0.05, hint: 'CPU skill, 0 (easy) … 1 (hard)' },
      { key: 'winScore', kind: 'number', def: 11, min: 1, max: 21, step: 1, hint: 'Score needed to win' },
      TRACK_OUTSIDE,
    ],
  },
  breakout: {
    label: 'Breakout',
    tag: 'spinner-breakout',
    element: 'SpinnerBreakout',
    component: 'Breakout',
    props: [TRACK_OUTSIDE],
  },
  bubbles: {
    label: 'Bubbles',
    tag: 'spinner-bubbles',
    element: 'SpinnerBubbles',
    component: 'Bubbles',
    props: [
      TRACK_OUTSIDE,
      { key: 'showNewLine', kind: 'number', def: 0, min: 0, max: 60, step: 5, hint: 'Seconds between new rows (0 = off)' },
    ],
  },
  flappy: {
    label: 'Flappy',
    tag: 'spinner-flappy',
    element: 'SpinnerFlappy',
    component: 'Flappy',
    // Flappy flaps — it has no off-canvas steering, so no `trackOutside`.
    props: [{ key: 'obstacles', kind: 'enum', def: 'walls', options: ['walls', 'cave'], hint: 'What to thread through' }],
  },
}

const FRAMEWORKS = {
  html: { label: 'HTML', lang: 'html' },
  react: { label: 'React', lang: 'tsx' },
  vue: { label: 'Vue', lang: 'vue' },
  angular: { label: 'Angular', lang: 'typescript' },
}

/** All props for a game, base shared ones first. */
function propsFor(gameKey) {
  return [...SHARED_PROPS, ...GAMES[gameKey].props]
}

// --- State ------------------------------------------------------------------
// Prop values are kept per game so switching frameworks (or away and back to a
// game) preserves what you set. `autoplay` starts ON so the preview animates
// itself as a loader out of the box — the most common use — which also surfaces
// `autoplay` in the generated code.

const state = {
  game: 'pong',
  framework: 'html',
  values: {}, // values[gameKey][propKey]
}

function initialValue(prop) {
  return prop.key === 'autoplay' ? true : prop.def
}

for (const gameKey of Object.keys(GAMES)) {
  state.values[gameKey] = {}
  for (const prop of propsFor(gameKey)) {
    state.values[gameKey][prop.key] = initialValue(prop)
  }
}

/** Props whose current value differs from the element default — the ones we emit. */
function activeProps(gameKey) {
  const values = state.values[gameKey]
  return propsFor(gameKey).filter((p) => values[p.key] !== p.def)
}

// --- Code generation --------------------------------------------------------
// One generator per framework. Each is given the game and its active props and
// returns the install (bash) + usage snippet as plain strings; Shiki handles
// the colours afterwards.

function numStr(value) {
  // 0.6 not "0.6000000000001"; integers stay integers.
  return String(Number(value))
}

/** Wrap attributes onto the tag, breaking to one-per-line when the line is long. */
function joinAttrs(tag, attrs, indent) {
  if (attrs.length === 0) return ''
  const inline = ' ' + attrs.join(' ')
  if (tag.length + inline.length <= 70) return inline
  const pad = '\n' + indent
  return pad + attrs.join(pad) + '\n' + indent.slice(2)
}

function genHtml(game, props, values) {
  const attrs = []
  const offBooleans = [] // booleans whose default is ON, set OFF via a property
  for (const p of props) {
    const v = values[p.key]
    if (p.kind === 'bool') {
      if (v) attrs.push(p.attr ?? p.key)
      else offBooleans.push(p) // e.g. showBackground turned off — needs JS
    } else if (p.kind === 'number') {
      attrs.push(`${p.key}="${numStr(v)}"`)
    } else {
      attrs.push(`${p.key}="${v}"`)
    }
  }
  const tag = `<${game.tag}${attrs.length ? ' ' + attrs.join(' ') : ''}></${game.tag}>`

  let code = `<!-- register the custom elements once (e.g. in your entry) -->\n`
  code += `<script type="module">\n  import 'spinner-games'\n<\/script>\n\n`
  code += tag
  if (offBooleans.length) {
    // Boolean attributes can't express "off" for a prop that defaults on, so set
    // those as DOM properties after the element is in the DOM.
    const sets = offBooleans.map((p) => `  el.${p.key} = false`).join('\n')
    code += `\n\n<script type="module">\n  const el = document.querySelector('${game.tag}')\n${sets}\n<\/script>`
  }
  return code
}

function genReact(game, props, values) {
  const attrs = []
  for (const p of props) {
    const v = values[p.key]
    if (p.kind === 'bool') attrs.push(v ? p.key : `${p.key}={false}`)
    else if (p.kind === 'number') attrs.push(`${p.key}={${numStr(v)}}`)
    else attrs.push(`${p.key}="${v}"`)
  }
  const tag = `<${game.component}`
  const jsx = `${tag}${joinAttrs(tag, attrs, '      ')} />`
  return (
    `import { ${game.component} } from 'spinner-games/react'\n\n` +
    `export function Loader() {\n  return ${jsx}\n}`
  )
}

function genVue(game, props, values) {
  const attrs = []
  for (const p of props) {
    const v = values[p.key]
    const name = kebab(p.key)
    if (p.kind === 'bool') attrs.push(v ? name : `:${name}="false"`)
    else if (p.kind === 'number') attrs.push(`:${name}="${numStr(v)}"`)
    else attrs.push(`${name}="${v}"`) // strings bind fine as plain attributes
  }
  const tag = `<${game.component}`
  const el = `${tag}${joinAttrs(tag, attrs, '    ')} />`
  return (
    `<script setup lang="ts">\n` +
    `import { ${game.component} } from 'spinner-games/vue'\n` +
    `<\/script>\n\n` +
    `<template>\n  ${el}\n<\/template>`
  )
}

function genAngular(game, props, values) {
  const attrs = []
  for (const p of props) {
    const v = values[p.key]
    if (p.kind === 'bool') attrs.push(v ? p.key : `[${p.key}]="false"`)
    else if (p.kind === 'number') attrs.push(`[${p.key}]="${numStr(v)}"`)
    else attrs.push(`${p.key}="${v}"`)
  }
  const tag = `<${game.tag}`
  const el = `${tag}${joinAttrs(tag, attrs, '    ')}></${game.tag}>`
  return (
    `import { Component } from '@angular/core'\n` +
    `import { ${game.element} } from 'spinner-games/angular'\n\n` +
    `@Component({\n` +
    `  standalone: true,\n` +
    `  imports: [${game.element}],\n` +
    `  template: \`${el}\`,\n` +
    `})\n` +
    `export class LoaderComponent {}`
  )
}

function kebab(s) {
  return s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())
}

const GENERATORS = { html: genHtml, react: genReact, vue: genVue, angular: genAngular }

/** Build the two snippets (install + usage) for the current selection. */
function buildSnippets() {
  const game = GAMES[state.game]
  const props = activeProps(state.game)
  const values = state.values[state.game]
  const use = GENERATORS[state.framework](game, props, values)
  return { install: 'npm install spinner-games', use }
}

// --- Shiki ------------------------------------------------------------------

let highlighterPromise = null
function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = import(/* @vite-ignore */ SHIKI_URL).then(({ createHighlighter }) =>
      createHighlighter({
        themes: ['github-dark', 'github-light'],
        langs: ['html', 'tsx', 'vue', 'typescript', 'bash'],
      }),
    )
  }
  return highlighterPromise
}

function escapeHtml(s) {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
}

async function highlight(code, lang) {
  try {
    const hl = await getHighlighter()
    const theme = document.body.dataset.theme === 'light' ? 'github-light' : 'github-dark'
    return hl.codeToHtml(code, { lang, theme })
  } catch {
    // Offline / CDN blocked: still show (and let the user copy) the raw code.
    return `<pre class="api-fallback">${escapeHtml(code)}</pre>`
  }
}

// --- Rendering --------------------------------------------------------------

const els = {
  gameTabs: document.getElementById('api-game'),
  frameworkTabs: document.getElementById('api-framework'),
  preview: document.getElementById('api-preview'),
  controls: document.getElementById('api-controls'),
  install: document.getElementById('api-install'),
  use: document.getElementById('api-use'),
  useLabel: document.getElementById('api-use-label'),
}

// The plain-text snippets backing the two Copy buttons (set on every render).
let currentSnippets = { install: '', use: '' }

function buildSeg(container, entries, current, onPick) {
  container.replaceChildren()
  for (const [key, meta] of entries) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = meta.label
    btn.dataset.value = key
    btn.setAttribute('aria-pressed', String(key === current))
    btn.addEventListener('click', () => onPick(key))
    container.append(btn)
  }
}

function syncSegPressed(container, current) {
  for (const btn of container.querySelectorAll('button')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.value === current))
  }
}

/** (Re)create the live preview element for the current game and apply props. */
function renderPreview() {
  const game = GAMES[state.game]
  let el = els.preview.firstElementChild
  if (!el || el.tagName.toLowerCase() !== game.tag) {
    el = document.createElement(game.tag)
    els.preview.replaceChildren(el)
  }
  const values = state.values[state.game]
  for (const prop of propsFor(state.game)) {
    el[prop.key] = values[prop.key]
  }
}

/** Build the prop controls for the current game (these double as the API list). */
function renderControls() {
  const values = state.values[state.game]
  els.controls.replaceChildren()
  for (const prop of propsFor(state.game)) {
    const row = document.createElement('div')
    row.className = 'api-row'

    const name = document.createElement('span')
    name.className = 'api-name'
    name.textContent = prop.key
    name.title = prop.hint
    row.append(name)

    row.append(buildControl(prop, values))
    els.controls.append(row)
  }
}

function buildControl(prop, values) {
  if (prop.kind === 'bool') {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = Boolean(values[prop.key])
    input.title = prop.hint
    input.addEventListener('change', () => setValue(prop.key, input.checked))
    return input
  }

  if (prop.kind === 'enum') {
    const seg = document.createElement('span')
    seg.className = 'seg'
    for (const opt of prop.options) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.textContent = opt
      btn.setAttribute('aria-pressed', String(values[prop.key] === opt))
      btn.addEventListener('click', () => {
        setValue(prop.key, opt)
        for (const b of seg.querySelectorAll('button')) {
          b.setAttribute('aria-pressed', String(b.textContent === opt))
        }
      })
      seg.append(btn)
    }
    return seg
  }

  // number → range slider + live readout
  const wrap = document.createElement('span')
  wrap.className = 'api-num'
  const input = document.createElement('input')
  input.type = 'range'
  input.min = prop.min
  input.max = prop.max
  input.step = prop.step
  input.value = values[prop.key]
  const out = document.createElement('span')
  const fmt = (v) => (prop.step < 1 ? Number(v).toFixed(2) : String(Number(v)))
  out.textContent = fmt(values[prop.key])
  input.addEventListener('input', () => {
    const v = Number(input.value)
    out.textContent = fmt(v)
    setValue(prop.key, v)
  })
  wrap.append(input, out)
  return wrap
}

/** Update a prop, then refresh the preview + code (but not the whole control list). */
function setValue(propKey, value) {
  state.values[state.game][propKey] = value
  renderPreview()
  renderCode()
}

async function renderCode() {
  const fw = FRAMEWORKS[state.framework]
  els.useLabel.textContent = `Use · ${fw.label}`
  const snippets = buildSnippets()
  currentSnippets = snippets
  // Highlight both blocks; whichever resolves first paints first.
  els.install.innerHTML = await highlight(snippets.install, 'bash')
  els.use.innerHTML = await highlight(snippets.use, fw.lang)
}

/** Full rebuild after a game/framework switch (preview + controls + code). */
function renderAll() {
  syncSegPressed(els.gameTabs, state.game)
  syncSegPressed(els.frameworkTabs, state.framework)
  renderPreview()
  renderControls()
  renderCode()
}

// --- Copy buttons -----------------------------------------------------------

for (const btn of document.querySelectorAll('.api-copy')) {
  btn.addEventListener('click', async () => {
    const text = currentSnippets[btn.dataset.copy] ?? ''
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      return
    }
    const original = btn.textContent
    btn.textContent = 'Copied!'
    setTimeout(() => {
      btn.textContent = original
    }, 1200)
  })
}

// --- Wire up ----------------------------------------------------------------

buildSeg(
  els.gameTabs,
  Object.entries(GAMES),
  state.game,
  (key) => {
    state.game = key
    renderAll()
  },
)
buildSeg(
  els.frameworkTabs,
  Object.entries(FRAMEWORKS),
  state.framework,
  (key) => {
    state.framework = key
    syncSegPressed(els.frameworkTabs, key)
    renderCode() // framework switch only changes the code, not the preview/controls
  },
)

// Re-highlight when the page theme toggles (dark <-> light) so the code panel's
// theme follows the page.
new MutationObserver(() => renderCode()).observe(document.body, {
  attributes: true,
  attributeFilter: ['data-theme'],
})

renderAll()
