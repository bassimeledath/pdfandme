import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { FormFieldMeta, PageMeta } from '../types'

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

export async function renderPage(
  doc: PDFDocumentProxy,
  meta: PageMeta,
  canvas: HTMLCanvasElement,
  zoom: number,
): Promise<void> {
  const page = await doc.getPage(meta.src + 1)
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
  await page.render({ canvasContext: ctx, viewport }).promise
}
