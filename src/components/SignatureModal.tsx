import { useRef, useState } from 'react'
import { newId, useStore } from '../store'
import { Pt } from '../types'
import { tryCapture } from './PageView'

const SIG_INK = '#1A2F9E'
const PAD_W = 394
const PAD_H = 160

export default function SignatureModal() {
  const store = useStore
  const [strokes, setStrokes] = useState<Pt[][]>([])
  const [remember, setRemember] = useState(true)
  const drawing = useRef<Pt[] | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const toLocal = (e: React.PointerEvent): Pt => {
    const r = svgRef.current!.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }

  const down = (e: React.PointerEvent) => {
    e.preventDefault()
    drawing.current = [toLocal(e)]
    setStrokes((s) => [...s, drawing.current!])
    tryCapture(e.currentTarget as Element, e.pointerId)
  }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    drawing.current.push(toLocal(e))
    setStrokes((s) => [...s])
  }
  const up = () => {
    drawing.current = null
  }

  const use = () => {
    const all = strokes.flat()
    if (all.length < 2) return
    const xs = all.map((p) => p[0])
    const ys = all.map((p) => p[1])
    const pad = 4
    const x0 = Math.min(...xs) - pad
    const y0 = Math.min(...ys) - pad
    const w = Math.max(10, Math.max(...xs) - Math.min(...xs) + pad * 2)
    const h = Math.max(10, Math.max(...ys) - Math.min(...ys) + pad * 2)
    const norm = strokes
      .filter((st) => st.length > 0)
      .map((st) => st.map(([x, y]) => [(x - x0) / w, (y - y0) / h] as Pt))
    const sig = { strokes: norm, aspect: h / w }

    const s = store.getState()
    if (remember) s.setSavedSig(sig)
    const pos = s.pendingSigPos
    if (pos) {
      const w0 = 180
      const h0 = w0 * sig.aspect
      s.addAnn({
        id: newId(),
        type: 'sig',
        page: pos.page,
        x: pos.x - w0 / 2,
        y: pos.y - h0 / 2,
        w: w0,
        h: h0,
        strokes: sig.strokes,
        color: SIG_INK,
        strokeWidth: 2.2,
      })
    }
    s.setSigModal(false)
    s.setTool('select')
  }

  return (
    <div className="modal-scrim" onClick={() => store.getState().setSigModal(false)}>
      <div className="sig-modal" onClick={(e) => e.stopPropagation()}>
        <h4>Draw your signature</h4>
        <div className="sig-pad">
          <span className="x-mark">✕</span>
          <div className="base" />
          <svg
            ref={svgRef}
            viewBox={`0 0 ${PAD_W} ${PAD_H}`}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
          >
            {strokes.map((st, i) =>
              st.length > 1 ? (
                <path
                  key={i}
                  d={'M' + st.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')}
                  fill="none"
                  stroke={SIG_INK}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null,
            )}
          </svg>
        </div>
        <div className="sig-actions">
          <button className="clear" onClick={() => setStrokes([])}>
            Clear
          </button>
          <button className="use" disabled={strokes.flat().length < 2} onClick={use}>
            Use signature
          </button>
        </div>
        <label className="sig-remember">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Remember on this device — never uploaded anywhere.
        </label>
      </div>
    </div>
  )
}
