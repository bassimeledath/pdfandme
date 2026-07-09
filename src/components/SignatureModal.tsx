import { useRef, useState } from 'react'
import { newId, useStore } from '../store'
import { Pt } from '../types'
import { tryCapture } from '../utils'

const PAD_W = 394
const PAD_H = 160

const INKS = [
  { hex: '#211E19', name: 'Black ink' },
  { hex: '#1A2F9E', name: 'Blue ink' },
  { hex: '#A32035', name: 'Maroon ink' },
]
const WIDTHS = [
  { w: 1.4, name: 'Thin' },
  { w: 2.2, name: 'Regular' },
  { w: 3.4, name: 'Thick' },
]

export default function SignatureModal() {
  const store = useStore
  const saved = useStore((s) => s.savedSig)
  const [strokes, setStrokes] = useState<Pt[][]>([])
  const [remember, setRemember] = useState(true)
  const [color, setColor] = useState(saved?.color ?? '#211E19')
  const [width, setWidth] = useState(saved?.strokeWidth ?? 2.2)
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
    const sig = { strokes: norm, aspect: h / w, color, strokeWidth: width }

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
        color,
        strokeWidth: width,
      })
      s.setSigModal(false)
      s.setTool('select')
    } else {
      // drawn from the "New signature" entry — arm the Sign tool so the
      // next click places it
      s.setSigModal(false)
      s.setTool('sign')
    }
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
                  stroke={color}
                  strokeWidth={width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null,
            )}
          </svg>
        </div>
        <div className="sig-opts">
          <div className="opt-group">
            {INKS.map((ink) => (
              <button
                key={ink.hex}
                className={`ink-dot${color === ink.hex ? ' on' : ''}`}
                style={{ background: ink.hex }}
                title={ink.name}
                onClick={() => setColor(ink.hex)}
              />
            ))}
          </div>
          <div className="opt-group">
            {WIDTHS.map((opt) => (
              <button
                key={opt.w}
                className={`width-btn${width === opt.w ? ' on' : ''}`}
                title={opt.name}
                onClick={() => setWidth(opt.w)}
              >
                <span style={{ height: opt.w, background: color }} />
              </button>
            ))}
          </div>
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
