import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import { Ann, InkAnn, StampAnn, TextAnn } from '../types'
import { IcDup, IcTrash } from './icons'
import { tryCapture } from './PageView'

const COLORS = ['#211E19', '#A32035', '#1A2F9E']

interface Props {
  ann: Ann
  zoom: number
}

export default function AnnItem({ ann, zoom }: Props) {
  const selected = useStore((s) => s.selected === ann.id)
  const tool = useStore((s) => s.tool)
  const store = useStore
  const moveRef = useRef<{
    mode: 'move' | 'tl' | 'tr' | 'bl' | 'br'
    startX: number
    startY: number
    orig: { x: number; y: number; w: number; h: number }
    committed: boolean
  } | null>(null)

  const interactive = tool === 'select'

  const beginDrag = (e: React.PointerEvent, mode: 'move' | 'tl' | 'tr' | 'bl' | 'br') => {
    if (!interactive || e.button !== 0) return
    e.stopPropagation()
    store.getState().select(ann.id)
    moveRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      orig: { x: ann.x, y: ann.y, w: ann.w, h: ann.h },
      committed: false,
    }
    tryCapture(e.currentTarget as HTMLElement, e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = moveRef.current
    if (!d) return
    const dx = (e.clientX - d.startX) / zoom
    const dy = (e.clientY - d.startY) / zoom
    if (!d.committed && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
      store.getState().commit()
      d.committed = true
    }
    if (!d.committed) return
    const o = d.orig
    const keepRatio = ann.type === 'sig' || ann.type === 'image' || ann.type === 'stamp'
    let patch: { x: number; y: number; w: number; h: number }
    switch (d.mode) {
      case 'move':
        patch = { ...o, x: o.x + dx, y: o.y + dy }
        break
      case 'br': {
        let w = Math.max(12, o.w + dx)
        let h = Math.max(10, o.h + dy)
        if (keepRatio) h = (w * o.h) / o.w
        patch = { x: o.x, y: o.y, w, h }
        break
      }
      case 'tr': {
        let w = Math.max(12, o.w + dx)
        let h = Math.max(10, o.h - dy)
        if (keepRatio) h = (w * o.h) / o.w
        patch = { x: o.x, y: o.y + o.h - h, w, h }
        break
      }
      case 'bl': {
        let w = Math.max(12, o.w - dx)
        let h = Math.max(10, o.h + dy)
        if (keepRatio) h = (w * o.h) / o.w
        patch = { x: o.x + o.w - w, y: o.y, w, h }
        break
      }
      case 'tl': {
        let w = Math.max(12, o.w - dx)
        let h = Math.max(10, o.h - dy)
        if (keepRatio) h = (w * o.h) / o.w
        patch = { x: o.x + o.w - w, y: o.y + o.h - h, w, h }
        break
      }
    }
    store.getState().updateAnn(ann.id, patch)
  }

  const onPointerUp = () => {
    moveRef.current = null
  }

  const px = ann.x * zoom
  const py = ann.y * zoom
  const pw = ann.w * zoom
  const ph = ann.h * zoom

  return (
    <div
      className={`ann${interactive ? ' selectable' : ''}`}
      style={{ left: px, top: py, width: pw, height: ph, zIndex: selected ? 20 : 10 }}
      onPointerDown={(e) => beginDrag(e, 'move')}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <Body ann={ann} zoom={zoom} selected={selected} />
      {selected && (
        <>
          <div className="sel-box" />
          {(['tl', 'tr', 'bl', 'br'] as const).map((hd) => (
            <div
              key={hd}
              className={`handle ${hd}`}
              onPointerDown={(e) => beginDrag(e, hd)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            />
          ))}
          <CtxBar ann={ann} />
        </>
      )}
    </div>
  )
}

function CtxBar({ ann }: { ann: Ann }) {
  const store = useStore
  const isText = ann.type === 'text'
  return (
    <div className="ctx-bar" onPointerDown={(e) => e.stopPropagation()}>
      {isText && (
        <>
          <button
            title="Smaller"
            onClick={() =>
              store.getState().updateAnn(ann.id, { size: Math.max(8, (ann as TextAnn).size - 1) })
            }
          >
            −
          </button>
          <span className="size">{(ann as TextAnn).size}</span>
          <button
            title="Bigger"
            onClick={() =>
              store.getState().updateAnn(ann.id, { size: Math.min(48, (ann as TextAnn).size + 1) })
            }
          >
            +
          </button>
          <span className="vr" />
          {COLORS.map((c) => (
            <button
              key={c}
              className={`dotc${(ann as TextAnn).color === c ? ' on' : ''}`}
              style={{ background: c }}
              title="Ink color"
              onClick={() => store.getState().updateAnn(ann.id, { color: c })}
            />
          ))}
          <span className="vr" />
        </>
      )}
      <button title="Duplicate" onClick={() => store.getState().duplicateAnn(ann.id)}>
        <IcDup />
      </button>
      <button title="Delete" onClick={() => store.getState().removeAnn(ann.id)}>
        <IcTrash />
      </button>
    </div>
  )
}

function Body({ ann, zoom, selected }: { ann: Ann; zoom: number; selected: boolean }) {
  switch (ann.type) {
    case 'highlight':
      return <div className="body ann-highlight" />
    case 'whiteout':
      return <div className={`body ann-whiteout${selected ? ' sel-ring' : ''}`} />
    case 'text':
      return <TextBody ann={ann} zoom={zoom} />
    case 'ink':
    case 'sig':
      return <InkBody ann={ann} />
    case 'stamp':
      return <StampBody ann={ann} />
    case 'image':
      return (
        <div className="body">
          <img src={ann.dataUrl} draggable={false} alt="" />
        </div>
      )
  }
}

function TextBody({ ann, zoom }: { ann: TextAnn; zoom: number }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const store = useStore

  // autofocus newly created empty text boxes
  useEffect(() => {
    if (ann.text === '') ref.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const grow = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const needed = el.scrollHeight / zoom + 2
    if (Math.abs(needed - ann.h) > 2) store.getState().updateAnn(ann.id, { h: needed })
    el.style.height = ''
  }

  return (
    <div className="body">
      <textarea
        ref={ref}
        value={ann.text}
        placeholder="Type…"
        spellCheck={false}
        style={{ fontSize: ann.size * zoom, color: ann.color }}
        onPointerDown={(e) => {
          // typing shouldn't start a drag; still select the annotation
          e.stopPropagation()
          store.getState().select(ann.id)
        }}
        onFocus={() => store.getState().commit()}
        onChange={(e) => {
          store.getState().updateAnn(ann.id, { text: e.target.value })
          grow()
        }}
        onBlur={() => {
          if (ann.text.trim() === '') store.getState().removeAnn(ann.id)
        }}
      />
    </div>
  )
}

function InkBody({ ann }: { ann: InkAnn }) {
  return (
    <svg className="ink" viewBox={`0 0 ${ann.w} ${ann.h}`} preserveAspectRatio="none">
      {ann.strokes.map((st, i) => (
        <path
          key={i}
          d={
            'M' +
            st.map(([nx, ny]) => `${(nx * ann.w).toFixed(2)} ${(ny * ann.h).toFixed(2)}`).join(' L')
          }
          fill="none"
          stroke={ann.color}
          strokeWidth={ann.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}

function StampBody({ ann }: { ann: StampAnn }) {
  return (
    <svg className="ink" viewBox="0 0 24 24" preserveAspectRatio="none">
      {ann.kind === 'check' ? (
        <path
          d="M4 13.5 10 19.5 20 5"
          fill="none"
          stroke="#211E19"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <>
          <path d="M5 5 19 19" fill="none" stroke="#211E19" strokeWidth={2.4} strokeLinecap="round" />
          <path d="M19 5 5 19" fill="none" stroke="#211E19" strokeWidth={2.4} strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}
