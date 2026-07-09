import { PageMeta, totalRot } from '../types'

/**
 * Coordinate systems:
 * - "display" space: what the user sees at zoom 1 — top-left origin, y down,
 *   includes the page's total rotation (srcRot + extraRot).
 * - "pdf" space: PDF user space — bottom-left origin, y up, unrotated,
 *   offset by the mediabox origin.
 */

/** display point -> pdf point */
export function toPdf(p: PageMeta, dx: number, dy: number): [number, number] {
  const { wPt: W, hPt: H, view } = p
  let px: number, py: number
  switch (totalRot(p)) {
    case 90:
      px = dy
      py = dx
      break
    case 180:
      px = W - dx
      py = dy
      break
    case 270:
      px = W - dy
      py = H - dx
      break
    default:
      px = dx
      py = H - dy
  }
  return [px + view[0], py + view[1]]
}

/** pdf point -> display point */
export function toDisplay(p: PageMeta, pxRaw: number, pyRaw: number): [number, number] {
  const { wPt: W, hPt: H, view } = p
  const px = pxRaw - view[0]
  const py = pyRaw - view[1]
  switch (totalRot(p)) {
    case 90:
      return [py, px]
    case 180:
      return [W - px, py]
    case 270:
      return [H - py, W - px]
    default:
      return [px, H - py]
  }
}

/** display box -> pdf box {x, y, w, h} (pdf coords, origin bottom-left) */
export function boxToPdf(p: PageMeta, x: number, y: number, w: number, h: number) {
  const [ax, ay] = toPdf(p, x, y)
  const [bx, by] = toPdf(p, x + w, y + h)
  return {
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    w: Math.abs(bx - ax),
    h: Math.abs(by - ay),
  }
}

/** pdf rect [x1,y1,x2,y2] -> display box {x, y, w, h} at scale 1 */
export function rectToDisplay(p: PageMeta, rect: [number, number, number, number]) {
  const [ax, ay] = toDisplay(p, rect[0], rect[1])
  const [bx, by] = toDisplay(p, rect[2], rect[3])
  return {
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    w: Math.abs(bx - ax),
    h: Math.abs(by - ay),
  }
}

/**
 * Transform an annotation box when the user rotates a page +90° clockwise.
 * oldDisplayH is the page's display height BEFORE this rotation step.
 */
export function rotateBox90(
  box: { x: number; y: number; w: number; h: number },
  oldDisplayH: number,
) {
  return { x: oldDisplayH - box.y - box.h, y: box.x, w: box.h, h: box.w }
}
