// Small shared helpers for the canvas-based spinner games. Kept dependency-free
// so each game can pull in just what it needs.

/** Clamp `v` into the inclusive range [min, max]. */
export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

/**
 * Read the resolved `--spinner-color` for an element, falling back to `#2caac3`
 * when it is unset. Used by every game's `draw()` to theme its canvas.
 */
export function readColor(el: Element): string {
  return (
    getComputedStyle(el).getPropertyValue('--spinner-color').trim() || '#2caac3'
  )
}
