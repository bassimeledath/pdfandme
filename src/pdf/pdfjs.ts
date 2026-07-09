import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { FormFieldMeta, PageMeta, totalRot } from '../types'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export interface LoadedPdf {
  doc: PDFDocumentProxy
  pages: PageMeta[]
  fields: FormFieldMeta[]
}

export async function loadPdf(bytes: ArrayBuffer): Promise<LoadedPdf> {
  // pdf.js transfers the buffer to its worker, so hand it a copy
  const doc = await pdfjs.getDocument({ data: bytes.slice(0) }).promise
  const pages: PageMeta[] = []
  const fields: FormFieldMeta[] = []
  const seen = new Set<string>()

  for (let i = 0; i < doc.numPages; i++) {
    const page = await doc.getPage(i + 1)
    const [x1, y1, x2, y2] = page.view
    pages.push({
      src: i,
      srcRot: ((page.rotate % 360) + 360) % 360,
      extraRot: 0,
      wPt: x2 - x1,
      hPt: y2 - y1,
      view: [x1, y1, x2, y2],
      deleted: false,
    })

    const annots = await page.getAnnotations()
    for (const a of annots) {
      if (a.subtype !== 'Widget' || !a.fieldName || a.readOnly) continue
      const isText = a.fieldType === 'Tx'
      const isCheck = a.fieldType === 'Btn' && a.checkBox
      if (!isText && !isCheck) continue
      const id = `${a.fieldName}::${a.id}`
      if (seen.has(id)) continue
      seen.add(id)
      fields.push({
        id,
        name: a.fieldName,
        kind: isText ? 'text' : 'check',
        page: i,
        rect: a.rect as [number, number, number, number],
        multiline: !!a.multiLine,
      })
    }
  }
  return { doc, pages, fields }
}

export interface TextRun {
  /** Bounding box in scale-1 display coords (rotation-inclusive, top-left origin). */
  x: number
  y: number
  w: number
  h: number
  str: string
  /** Rendered font height in display units — a good size for a replacement text box. */
  size: number
}

/**
 * Extract positioned text runs for the "edit text" tool.
 * Boxes are computed in the page's current display space (incl. user rotation).
 */
export async function getTextRuns(doc: PDFDocumentProxy, meta: PageMeta): Promise<TextRun[]> {
  const page = await doc.getPage(meta.src + 1)
  const viewport = page.getViewport({ scale: 1, rotation: totalRot(meta) })
  const content = await page.getTextContent()
  const runs: TextRun[] = []

  for (const item of content.items) {
    if (!('str' in item) || !item.str.trim() || !item.transform) continue
    const tx = pdfjs.Util.transform(viewport.transform, item.transform)
    const fontH = Math.hypot(tx[2], tx[3])
    if (fontH < 1 || item.width <= 0) continue
    const angle = Math.atan2(tx[1], tx[0])
    // baseline start, baseline end, and the ascent direction
    const bx = tx[4]
    const by = tx[5]
    const dx = Math.cos(angle) * item.width * viewport.scale
    const dy = Math.sin(angle) * item.width * viewport.scale
    const ux = Math.sin(angle) * fontH
    const uy = -Math.cos(angle) * fontH
    const xs = [bx, bx + dx, bx + ux, bx + dx + ux]
    const ys = [by, by + dy, by + uy, by + dy + uy]
    runs.push({
      x: Math.min(...xs),
      y: Math.min(...ys),
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys),
      str: item.str,
      size: fontH,
    })
  }
  return runs
}

/**
 * Kick off a page render. Returns a cancel function — call it before starting
 * another render into the same canvas (pdf.js forbids overlapping renders).
 */
export function renderPage(
  doc: PDFDocumentProxy,
  meta: PageMeta,
  canvas: HTMLCanvasElement,
  zoom: number,
): () => void {
  let cancelled = false
  let task: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | null = null
  ;(async () => {
    const page = await doc.getPage(meta.src + 1)
    if (cancelled) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const viewport = page.getViewport({
      scale: zoom * dpr,
      rotation: meta.srcRot + meta.extraRot,
    })
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    canvas.style.width = `${Math.floor(viewport.width / dpr)}px`
    canvas.style.height = `${Math.floor(viewport.height / dpr)}px`
    const ctx = canvas.getContext('2d')!
    task = page.render({ canvasContext: ctx, viewport })
    await task.promise
  })().catch((e: unknown) => {
    if ((e as Error)?.name !== 'RenderingCancelledException') console.error('render failed', e)
  })
  return () => {
    cancelled = true
    task?.cancel()
  }
}
