export type Tool =
  | 'select'
  | 'text'
  | 'sign'
  | 'highlight'
  | 'draw'
  | 'whiteout'
  | 'check'
  | 'cross'
  | 'date'
  | 'image'

/** A point [x, y] in scale-1 display coordinates (top-left origin). */
export type Pt = [number, number]

interface AnnBase {
  id: string
  /** Source page index in the original PDF (stable across reorder/delete). */
  page: number
  x: number
  y: number
  w: number
  h: number
}

export interface TextAnn extends AnnBase {
  type: 'text'
  text: string
  size: number
  color: string
  /** Opaque white background — used by click-to-edit to cover the original run. */
  bg?: boolean
  /** The original run's text (click-to-edit) — unchanged boxes revert on deselect. */
  orig?: string
}
export interface RectAnn extends AnnBase {
  type: 'highlight' | 'whiteout'
}
export interface InkAnn extends AnnBase {
  type: 'ink' | 'sig'
  /** Strokes with points normalized to the annotation box (0..1). */
  strokes: Pt[][]
  color: string
  /** Stroke width in scale-1 px, relative to a box height of `baseH`. */
  strokeWidth: number
}
export interface StampAnn extends AnnBase {
  type: 'stamp'
  kind: 'check' | 'cross'
}
export interface ImageAnn extends AnnBase {
  type: 'image'
  dataUrl: string
}

export type Ann = TextAnn | RectAnn | InkAnn | StampAnn | ImageAnn

export interface PageMeta {
  /** Source page index in the original PDF. */
  src: number
  /** Rotation baked into the PDF page (degrees). */
  srcRot: number
  /** Extra user rotation (0/90/180/270). */
  extraRot: number
  /** Unrotated page size in PDF points (mediabox width/height). */
  wPt: number
  hPt: number
  /** Mediabox [x1, y1, x2, y2] offsets for coordinate conversion. */
  view: [number, number, number, number]
  deleted: boolean
}

export interface FormFieldMeta {
  id: string
  name: string
  kind: 'text' | 'check'
  /** Source page index. */
  page: number
  /** Widget rect in PDF user-space coords [x1, y1, x2, y2]. */
  rect: [number, number, number, number]
  multiline: boolean
}

export const totalRot = (p: PageMeta) => (((p.srcRot + p.extraRot) % 360) + 360) % 360

/** Display size (scale 1) of a page given its current rotation. */
export function displaySize(p: PageMeta): { w: number; h: number } {
  const r = totalRot(p)
  return r === 90 || r === 270 ? { w: p.hPt, h: p.wPt } : { w: p.wPt, h: p.hPt }
}

export interface SavedSignature {
  strokes: Pt[][]
  /** aspect = h / w of the drawn bounding box */
  aspect: number
  color?: string
  strokeWidth?: number
}
