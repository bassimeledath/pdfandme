import { useEffect, useRef, useState } from 'react'
import { newId, useStore } from '../store'
import { ImageSignature, Pt, SavedSignature } from '../types'
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
const FONTS = [
  { family: 'Caveat', size: 30 },
  { family: 'Dancing Script', size: 27 },
  { family: 'Homemade Apple', size: 21 },
]

type Tab = 'draw' | 'type' | 'upload'
const TITLES: Record<Tab, string> = {
  draw: 'Draw your signature',
  type: 'Type your signature',
  upload: 'Upload your signature',
}

export default function SignatureModal() {
  const store = useStore
  const saved = useStore((s) => s.savedSig)
  const [tab, setTab] = useState<Tab>('draw')
  const [remember, setRemember] = useState(true)
  const [color, setColor] = useState((saved?.kind === 'ink' && saved.color) || '#211E19')

  // draw tab
  const [strokes, setStrokes] = useState<Pt[][]>([])
  const [width, setWidth] = useState((saved?.kind === 'ink' && saved.strokeWidth) || 2.2)
  const drawing = useRef<Pt[] | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // type tab
  const [name, setName] = useState('')
  const [fontIdx, setFontIdx] = useState(0)

  // upload tab
  const [rawUpload, setRawUpload] = useState<string | null>(null)
  const [transparent, setTransparent] = useState(true)
  const [processed, setProcessed] = useState<ImageSignature | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!rawUpload) return
    let stale = false
    void processUpload(rawUpload, transparent).then((sig) => {
      if (!stale) setProcessed(sig)
    })
    return () => {
      stale = true
    }
  }, [rawUpload, transparent])

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

  /** Place (or arm) the finished signature and close the modal. */
  const finish = (sig: SavedSignature) => {
    const s = store.getState()
    if (remember) s.setSavedSig(sig)
    const pos = s.pendingSigPos
    if (!pos) {
      // from the "New signature" entry — arm the Sign tool so the next click places it
      s.setSigModal(false)
      s.setTool('sign')
      return
    }
    const w0 = 180
    const h0 = w0 * sig.aspect
    const base = {
      id: newId(),
      page: pos.page,
      x: pos.x - w0 / 2,
      y: pos.y - h0 / 2,
      w: w0,
      h: h0,
    }
    if (sig.kind === 'image') {
      s.addAnn({ ...base, type: 'image', dataUrl: sig.dataUrl })
    } else {
      s.addAnn({
        ...base,
        type: 'sig',
        strokes: sig.strokes,
        color: sig.color ?? color,
        strokeWidth: sig.strokeWidth ?? width,
      })
    }
    s.setSigModal(false)
    s.setTool('select')
  }

  const useDrawn = () => {
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
    finish({ kind: 'ink', strokes: norm, aspect: h / w, color, strokeWidth: width })
  }

  const useTyped = async () => {
    const text = name.trim()
    if (!text) return
    finish(await typedSignature(text, FONTS[fontIdx].family, color))
  }

  const canUse =
    tab === 'draw' ? strokes.flat().length >= 2 : tab === 'type' ? name.trim() !== '' : !!processed

  return (
    <div className="modal-scrim" onClick={() => store.getState().setSigModal(false)}>
      <div className="sig-modal" onClick={(e) => e.stopPropagation()}>
        <h4>{TITLES[tab]}</h4>
        <div className="sig-tabs">
          {(['draw', 'type', 'upload'] as const).map((t) => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'draw' && (
          <>
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
              <InkDots color={color} setColor={setColor} />
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
          </>
        )}

        {tab === 'type' && (
          <>
            <input
              className="sig-name"
              type="text"
              value={name}
              placeholder="Your name"
              autoFocus
              spellCheck={false}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="font-opts">
              {FONTS.map((f, i) => (
                <button
                  key={f.family}
                  className={`font-opt${fontIdx === i ? ' on' : ''}`}
                  style={{ fontFamily: `'${f.family}', cursive`, fontSize: f.size, color }}
                  onClick={() => setFontIdx(i)}
                >
                  {name.trim() || 'Your name'}
                </button>
              ))}
            </div>
            <div className="sig-opts">
              <InkDots color={color} setColor={setColor} />
            </div>
          </>
        )}

        {tab === 'upload' && (
          <>
            <div
              className="sig-upload"
              role="button"
              onClick={() => fileRef.current?.click()}
              title="Choose an image of your signature"
            >
              {processed ? (
                <img src={processed.dataUrl} alt="Signature preview" />
              ) : (
                <span>Choose a PNG or JPEG of your signature</span>
              )}
            </div>
            <label className="sig-remember" style={{ marginTop: 10 }}>
              <input
                type="checkbox"
                checked={transparent}
                onChange={(e) => setTransparent(e.target.checked)}
              />
              Make the background transparent
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (f) setRawUpload(await readAsDataURL(f))
                e.target.value = ''
              }}
            />
          </>
        )}

        <div className="sig-actions">
          {tab === 'draw' ? (
            <button className="clear" onClick={() => setStrokes([])}>
              Clear
            </button>
          ) : (
            <span />
          )}
          <button
            className="use"
            disabled={!canUse}
            onClick={() => {
              if (tab === 'draw') useDrawn()
              else if (tab === 'type') void useTyped()
              else if (processed) finish(processed)
            }}
          >
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

function InkDots({ color, setColor }: { color: string; setColor: (c: string) => void }) {
  return (
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
  )
}

/** Render a typed name to a tight transparent PNG. */
async function typedSignature(
  text: string,
  family: string,
  color: string,
): Promise<ImageSignature> {
  const font = `110px "${family}"`
  try {
    await document.fonts.load(font, text)
  } catch {
    /* falls back to the default font — still usable */
  }
  const canvas = document.createElement('canvas')
  let ctx = canvas.getContext('2d')!
  ctx.font = font
  const m = ctx.measureText(text)
  const ascent = m.actualBoundingBoxAscent || 88
  const descent = m.actualBoundingBoxDescent || 28
  const pad = 12
  canvas.width = Math.ceil(m.width + pad * 2)
  canvas.height = Math.ceil(ascent + descent + pad * 2)
  ctx = canvas.getContext('2d')! // resizing resets canvas state
  ctx.font = font
  ctx.fillStyle = color
  ctx.fillText(text, pad, pad + ascent)
  return { kind: 'image', dataUrl: canvas.toDataURL('image/png'), aspect: canvas.height / canvas.width }
}

/** Downscale an uploaded signature image and optionally knock out the paper. */
async function processUpload(dataUrl: string, transparent: boolean): Promise<ImageSignature> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const el = new Image()
    el.onload = () => res(el)
    el.onerror = rej
    el.src = dataUrl
  })
  const scale = Math.min(1, 1200 / img.naturalWidth)
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  if (transparent) {
    const data = ctx.getImageData(0, 0, w, h)
    const px = data.data
    for (let i = 0; i < px.length; i += 4) {
      const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
      if (lum > 240) px[i + 3] = 0
      else if (lum > 200) px[i + 3] = Math.round(px[i + 3] * ((240 - lum) / 40))
    }
    ctx.putImageData(data, 0, 0)
  }
  return { kind: 'image', dataUrl: canvas.toDataURL('image/png'), aspect: h / w }
}

function readAsDataURL(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(f)
  })
}
