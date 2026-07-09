import {
  BlendMode,
  LineCapStyle,
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  degrees,
  rgb,
} from 'pdf-lib'
import { Ann, FormFieldMeta, InkAnn, PageMeta, TextAnn, totalRot } from '../types'
import { boxToPdf, toPdf } from './coords'

const HIGHLIGHT = rgb(1, 0.894, 0.369)
const INK_COLORS: Record<string, [number, number, number]> = {
  '#211E19': [0.129, 0.118, 0.098],
  '#A32035': [0.639, 0.125, 0.208],
  '#1A2F9E': [0.102, 0.184, 0.62],
}
const colorOf = (hex: string) => {
  const c = INK_COLORS[hex.toUpperCase()]
  if (c) return rgb(c[0], c[1], c[2])
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return rgb(0.13, 0.12, 0.1)
  const n = parseInt(m[1], 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

export interface ExportOptions {
  flattenForm: boolean
}

export async function exportPdf(
  srcBytes: ArrayBuffer,
  pages: PageMeta[],
  anns: Ann[],
  fields: FormFieldMeta[],
  formValues: Record<string, string | boolean>,
  opts: ExportOptions,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(srcBytes, { ignoreEncryption: true })
  const font = await doc.embedFont(StandardFonts.Helvetica)

  // 1) form values
  fillForm(doc, fields, formValues)

  // 2) page structure changes require flattening the form (copied pages lose AcroForm)
  const structureChanged =
    pages.some((p) => p.deleted || p.extraRot !== 0) ||
    pages.some((p, i) => p.src !== i)
  const mustFlatten = opts.flattenForm || structureChanged

  if (mustFlatten) {
    try {
      doc.getForm().flatten()
    } catch {
      // some PDFs have appearance streams pdf-lib can't regenerate; keep fields as-is
    }
  }

  // 3) draw annotations on their source pages (before reorder)
  for (const ann of anns) {
    const meta = pages.find((p) => p.src === ann.page)
    if (!meta || meta.deleted) continue
    const page = doc.getPage(ann.page)
    await drawAnn(page, meta, ann, font, doc)
  }

  // 4) apply rotation
  for (const p of pages) {
    if (p.extraRot !== 0 && !p.deleted) {
      doc.getPage(p.src).setRotation(degrees(totalRot(p)))
    }
  }

  // 5) delete + reorder via copy into a fresh doc when needed
  if (structureChanged) {
    const out = await PDFDocument.create()
    const order = pages.filter((p) => !p.deleted).map((p) => p.src)
    const copied = await out.copyPages(doc, order)
    copied.forEach((pg) => out.addPage(pg))
    return out.save()
  }
  return doc.save()
}

function fillForm(
  doc: PDFDocument,
  fields: FormFieldMeta[],
  values: Record<string, string | boolean>,
) {
  let form
  try {
    form = doc.getForm()
  } catch {
    return
  }
  const byName = new Map(fields.map((f) => [f.name, f]))
  for (const [name, value] of Object.entries(values)) {
    const meta = byName.get(name)
    if (!meta) continue
    try {
      if (meta.kind === 'check') {
        const cb = form.getCheckBox(name)
        if (value) cb.check()
        else cb.uncheck()
      } else {
        form.getTextField(name).setText(String(value))
      }
    } catch {
      // field type mismatch or unsupported — skip rather than fail the export
    }
  }
  try {
    form.updateFieldAppearances()
  } catch {
    /* non-fatal */
  }
}

async function drawAnn(
  page: PDFPage,
  meta: PageMeta,
  ann: Ann,
  font: PDFFont,
  doc: PDFDocument,
) {
  switch (ann.type) {
    case 'highlight': {
      const b = boxToPdf(meta, ann.x, ann.y, ann.w, ann.h)
      page.drawRectangle({
        ...b,
        width: b.w,
        height: b.h,
        color: HIGHLIGHT,
        opacity: 0.45,
        blendMode: BlendMode.Multiply,
      })
      break
    }
    case 'whiteout': {
      const b = boxToPdf(meta, ann.x, ann.y, ann.w, ann.h)
      page.drawRectangle({ ...b, width: b.w, height: b.h, color: rgb(1, 1, 1) })
      break
    }
    case 'text':
      drawTextAnn(page, meta, ann, font)
      break
    case 'ink':
    case 'sig':
      drawInkAnn(page, meta, ann)
      break
    case 'stamp': {
      const pts: [number, number][][] =
        ann.kind === 'check'
          ? [
              [
                [0.15, 0.55],
                [0.42, 0.82],
                [0.88, 0.18],
              ],
            ]
          : [
              [
                [0.18, 0.18],
                [0.82, 0.82],
              ],
              [
                [0.82, 0.18],
                [0.18, 0.82],
              ],
            ]
      const lineWidth = Math.max(1.4, ann.w * 0.09)
      for (const seg of pts) {
        for (let i = 0; i < seg.length - 1; i++) {
          const [x1, y1] = toPdf(meta, ann.x + seg[i][0] * ann.w, ann.y + seg[i][1] * ann.h)
          const [x2, y2] = toPdf(
            meta,
            ann.x + seg[i + 1][0] * ann.w,
            ann.y + seg[i + 1][1] * ann.h,
          )
          page.drawLine({
            start: { x: x1, y: y1 },
            end: { x: x2, y: y2 },
            thickness: lineWidth,
            color: colorOf('#211E19'),
            lineCap: LineCapStyle.Round,
          })
        }
      }
      break
    }
    case 'image': {
      const base64 = ann.dataUrl.split(',')[1]
      const bin = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      const img = ann.dataUrl.startsWith('data:image/png')
        ? await doc.embedPng(bin)
        : await doc.embedJpg(bin)
      const b = boxToPdf(meta, ann.x, ann.y, ann.w, ann.h)
      const rot = totalRot(meta)
      if (rot === 0) {
        page.drawImage(img, { x: b.x, y: b.y, width: b.w, height: b.h })
      } else {
        // rotate so the image reads upright on rotated pages;
        // pdf-lib rotates CCW around the (x, y) anchor
        const swap = rot === 90 || rot === 270
        const anchor =
          rot === 90
            ? { x: b.x + b.w, y: b.y }
            : rot === 180
              ? { x: b.x + b.w, y: b.y + b.h }
              : { x: b.x, y: b.y + b.h }
        page.drawImage(img, {
          ...anchor,
          width: swap ? b.h : b.w,
          height: swap ? b.w : b.h,
          rotate: degrees(rot),
        })
      }
      break
    }
  }
}

function drawTextAnn(page: PDFPage, meta: PageMeta, ann: TextAnn, font: PDFFont) {
  const size = ann.size
  const lineHeight = size * 1.25
  const color = colorOf(ann.color)
  const rot = totalRot(meta)
  const lines = wrapText(ann.text, font, size, ann.w - 8)

  if (ann.bg) {
    // edit-text replacement: white out the original run under the box
    const b = boxToPdf(meta, ann.x, ann.y, ann.w, ann.h)
    page.drawRectangle({ ...b, width: b.w, height: b.h, color: rgb(1, 1, 1) })
  }

  lines.forEach((line, i) => {
    // position of this line's baseline-ish top-left in display space
    const lx = ann.x + 4
    const ly = ann.y + 4 + i * lineHeight + size * 0.85
    const [px, py] = toPdf(meta, lx, ly)
    page.drawText(line, {
      x: px,
      y: py,
      size,
      font,
      color,
      rotate: degrees(rot),
    })
  })
}

function wrapText(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = []
  for (const hard of text.split('\n')) {
    if (!hard) {
      out.push('')
      continue
    }
    let line = ''
    for (const word of hard.split(' ')) {
      const cand = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(cand, size) <= maxW || !line) line = cand
      else {
        out.push(line)
        line = word
      }
    }
    out.push(line)
  }
  return out
}

function drawInkAnn(page: PDFPage, meta: PageMeta, ann: InkAnn) {
  const color = colorOf(ann.color)
  for (const stroke of ann.strokes) {
    if (stroke.length < 2) {
      if (stroke.length === 1) {
        const [nx, ny] = stroke[0]
        const [px, py] = toPdf(meta, ann.x + nx * ann.w, ann.y + ny * ann.h)
        page.drawCircle({ x: px, y: py, size: ann.strokeWidth / 2, color })
      }
      continue
    }
    for (let i = 0; i < stroke.length - 1; i++) {
      const [ax, ay] = toPdf(meta, ann.x + stroke[i][0] * ann.w, ann.y + stroke[i][1] * ann.h)
      const [bx, by] = toPdf(
        meta,
        ann.x + stroke[i + 1][0] * ann.w,
        ann.y + stroke[i + 1][1] * ann.h,
      )
      page.drawLine({
        start: { x: ax, y: ay },
        end: { x: bx, y: by },
        thickness: ann.strokeWidth,
        color,
        lineCap: LineCapStyle.Round,
      })
    }
  }
}
