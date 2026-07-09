import { memo, useEffect, useRef, useState } from 'react'
import { newId, useStore } from '../store'
import { PageMeta, Pt, displaySize } from '../types'
import { rectToDisplay } from '../pdf/coords'
import { renderPage } from '../pdf/pdfjs'
import AnnItem from './AnnItem'
import { IcCheck } from './icons'

interface Props {
  meta: PageMeta
  ord: number
  onRequestImage: (page: number, x: number, y: number) => void
}

const INK = '#211E19'
const SIG_INK = '#1A2F9E'

/** setPointerCapture throws for synthetic events (tests) and exotic devices — capture is a nice-to-have. */
export function tryCapture(el: Element, pointerId: number) {
  try {
    el.setPointerCapture(pointerId)
  } catch {
    /* fine without capture */
  }
}

function PageView({ meta, ord, onRequestImage }: Props) {
  const pdf = useStore((s) => s.pdf)
  const zoom = useStore((s) => s.zoom)
  const tool = useStore((s) => s.tool)
  const anns = useStore((s) => s.anns)
  const fields = useStore((s) => s.fields)
  const formValues = useStore((s) => s.formValues)
  const store = useStore

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ kind: 'rect' | 'ink'; sx: number; sy: number; pts: Pt[] } | null>(null)
  const [rectPrev, setRectPrev] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [inkPrev, setInkPrev] = useState<Pt[] | null>(null)

  const { w, h } = displaySize(meta)
  const cssW = Math.floor(w * zoom)
  const cssH = Math.floor(h * zoom)

  useEffect(() => {
    if (!pdf || !canvasRef.current) return
    let cancelled = false
    const canvas = canvasRef.current
    renderPage(pdf, meta, canvas, zoom).catch((e) => {
      if (!cancelled) console.error('render failed', e)
    })
    return () => {
      cancelled = true
    }
  }, [pdf, meta.src, meta.extraRot, zoom]) // eslint-disable-line react-hooks/exhaustive-deps

  const toLocal = (e: React.PointerEvent): Pt => {
    const r = overlayRef.current!.getBoundingClientRect()
    return [(e.clientX - r.left) / zoom, (e.clientY - r.top) / zoom]
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const s = store.getState()
    const [x, y] = toLocal(e)

    switch (tool) {
      case 'select':
        if (e.target === overlayRef.current) s.select(null)
        return
      case 'text': {
        const size = 14
        s.addAnn({
          id: newId(),
          type: 'text',
          page: meta.src,
          x,
          y: y - size,
          w: 220,
          h: size * 1.6 + 8,
          text: '',
          size,
          color: INK,
        })
        s.setTool('select')
        return
      }
      case 'date': {
        const size = 13
        const d = new Date()
        const text = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`
        s.addAnn({
          id: newId(),
          type: 'text',
          page: meta.src,
          x,
          y: y - size,
          w: 110,
          h: size * 1.6 + 8,
          text,
          size,
          color: INK,
        })
        s.setTool('select')
        return
      }
      case 'check':
      case 'cross': {
        const sz = 22
        s.addAnn(
          {
            id: newId(),
            type: 'stamp',
            page: meta.src,
            x: x - sz / 2,
            y: y - sz / 2,
            w: sz,
            h: sz,
            kind: tool,
          },
          { select: false },
        )
        return // stay in stamp mode — forms need many checkmarks
      }
      case 'sign': {
        const sig = s.savedSig
        if (!sig) {
          s.setSigModal(true, { page: meta.src, x, y })
          return
        }
        const w0 = 180
        const h0 = w0 * sig.aspect
        s.addAnn({
          id: newId(),
          type: 'sig',
          page: meta.src,
          x: x - w0 / 2,
          y: y - h0 / 2,
          w: w0,
          h: h0,
          strokes: sig.strokes,
          color: SIG_INK,
          strokeWidth: 2.2,
        })
        s.setTool('select')
        return
      }
      case 'image':
        onRequestImage(meta.src, x, y)
        return
      case 'highlight':
      case 'whiteout': {
        dragRef.current = { kind: 'rect', sx: x, sy: y, pts: [] }
        tryCapture(overlayRef.current!, e.pointerId)
        setRectPrev({ x, y, w: 0, h: 0 })
        return
      }
      case 'draw': {
        dragRef.current = { kind: 'ink', sx: x, sy: y, pts: [[x, y]] }
        tryCapture(overlayRef.current!, e.pointerId)
        setInkPrev([[x, y]])
        return
      }
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const [x, y] = toLocal(e)
    if (drag.kind === 'rect') {
      setRectPrev({
        x: Math.min(drag.sx, x),
        y: Math.min(drag.sy, y),
        w: Math.abs(x - drag.sx),
        h: Math.abs(y - drag.sy),
      })
    } else {
      drag.pts.push([x, y])
      setInkPrev([...drag.pts])
    }
  }

  const onPointerUp = () => {
    const drag = dragRef.current
    dragRef.current = null
    const s = store.getState()
    if (!drag) return
    if (drag.kind === 'rect' && rectPrev) {
      setRectPrev(null)
      if (rectPrev.w > 4 && rectPrev.h > 3) {
        s.addAnn(
          {
            id: newId(),
            type: tool === 'highlight' ? 'highlight' : 'whiteout',
            page: meta.src,
            ...rectPrev,
          },
          { select: false },
        )
      }
    } else if (drag.kind === 'ink' && drag.pts.length > 1) {
      setInkPrev(null)
      const xs = drag.pts.map((p) => p[0])
      const ys = drag.pts.map((p) => p[1])
      const pad = 3
      const x0 = Math.min(...xs) - pad
      const y0 = Math.min(...ys) - pad
      const bw = Math.max(6, Math.max(...xs) - Math.min(...xs) + pad * 2)
      const bh = Math.max(6, Math.max(...ys) - Math.min(...ys) + pad * 2)
      s.addAnn(
        {
          id: newId(),
          type: 'ink',
          page: meta.src,
          x: x0,
          y: y0,
          w: bw,
          h: bh,
          strokes: [drag.pts.map(([px, py]) => [(px - x0) / bw, (py - y0) / bh] as Pt)],
          color: INK,
          strokeWidth: 2,
        },
        { select: false },
      )
    } else {
      setInkPrev(null)
      setRectPrev(null)
    }
  }

  const pageAnns = anns.filter((a) => a.page === meta.src)
  const pageFields = fields.filter((f) => f.page === meta.src)

  return (
    <div className="page-wrap" data-pageord={ord} style={{ width: cssW, height: cssH }}>
      <canvas className="pdf" ref={canvasRef} />
      <div
        ref={overlayRef}
        className={`overlay tool-${tool}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* detected form fields */}
        {pageFields.map((f) => {
          const b = rectToDisplay(meta, f.rect)
          const style = {
            left: b.x * zoom,
            top: b.y * zoom,
            width: b.w * zoom,
            height: b.h * zoom,
          }
          if (f.kind === 'check') {
            const on = !!formValues[f.name]
            return (
              <div
                key={f.id}
                className="ffield check"
                style={style}
                title={f.name}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => store.getState().setFormValue(f.name, !on)}
              >
                {on && <IcCheck />}
              </div>
            )
          }
          const val = (formValues[f.name] as string) ?? ''
          const fontSize = Math.max(8, Math.min(b.h * 0.62, 16)) * zoom
          return (
            <div key={f.id} className="ffield" style={style} onPointerDown={(e) => e.stopPropagation()}>
              {f.multiline ? (
                <textarea
                  value={val}
                  style={{ fontSize, lineHeight: 1.25 }}
                  onFocus={() => store.getState().commit()}
                  onChange={(e) => store.getState().setFormValueLive(f.name, e.target.value)}
                />
              ) : (
                <input
                  type="text"
                  value={val}
                  style={{ fontSize }}
                  onFocus={() => store.getState().commit()}
                  onChange={(e) => store.getState().setFormValueLive(f.name, e.target.value)}
                />
              )}
            </div>
          )
        })}

        {/* annotations */}
        {pageAnns.map((a) => (
          <AnnItem key={a.id} ann={a} zoom={zoom} />
        ))}

        {/* live previews */}
        {rectPrev && (
          <div
            className={`drag-rect ${tool === 'highlight' ? 'hl' : 'wo'}`}
            style={{
              left: rectPrev.x * zoom,
              top: rectPrev.y * zoom,
              width: rectPrev.w * zoom,
              height: rectPrev.h * zoom,
            }}
          />
        )}
        {inkPrev && inkPrev.length > 1 && (
          <svg
            className="ink"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="none"
          >
            <path
              d={'M' + inkPrev.map(([px, py]) => `${px.toFixed(1)} ${py.toFixed(1)}`).join(' L')}
              fill="none"
              stroke={INK}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    </div>
  )
}

export default memo(PageView)
