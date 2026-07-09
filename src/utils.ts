/** setPointerCapture throws for synthetic events (tests) and exotic devices — capture is a nice-to-have. */
export function tryCapture(el: Element, pointerId: number) {
  try {
    el.setPointerCapture(pointerId)
  } catch {
    /* fine without capture */
  }
}
