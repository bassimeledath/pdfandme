import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { PageMeta } from '../types'
import { renderPage } from '../pdf/pdfjs'
import { IcChevL, IcRotate, IcTrash } from './icons'

export default function PagesRail() {
  const pages = useStore((s) => s.pages)
  const store = useStore
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  const live = pages
    .map((p, idx) => ({ p, idx }))
    .filter(({ p }) => !p.deleted)

  return (
    <div className="rail">
      <div className="rail-head">
        <span className="mono">Pages</span>
        <button className="ghost-btn" onClick={() => store.getState().setRailOpen(false)} title="Close">
          <IcChevL />
        </button>
      </div>
      {live.map(({ p, idx }, ord) => (
        <Thumb
          key={`${p.src}-${p.extraRot}`}
          meta={p}
          ord={ord + 1}
          dragging={dragIdx === idx}
          dropTarget={overIdx === idx && dragIdx !== idx}
          canDelete={live.length > 1}
          onDragStart={() => setDragIdx(idx)}
          onDragOver={() => setOverIdx(idx)}
          onDrop={() => {
            if (dragIdx !== null && dragIdx !== idx) store.getState().movePage(dragIdx, idx)
            setDragIdx(null)
            setOverIdx(null)
          }}
          onDragEnd={() => {
            setDragIdx(null)
            setOverIdx(null)
          }}
        />
      ))}
    </div>
  )
}

interface ThumbProps {
  meta: PageMeta
  ord: number
  dragging: boolean
  dropTarget: boolean
  canDelete: boolean
  onDragStart: () => void
  onDragOver: () => void
  onDrop: () => void
  onDragEnd: () => void
}

function Thumb({
  meta,
  ord,
  dragging,
  dropTarget,
  canDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: ThumbProps) {
  const pdf = useStore((s) => s.pdf)
  const store = useStore
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!pdf || !canvasRef.current) return
    renderPage(pdf, meta, canvasRef.current, 0.18).catch(() => undefined)
  }, [pdf, meta.src, meta.extraRot]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className={`thumb${dragging ? ' dragging' : ''}${dropTarget ? ' dropTarget' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver()
      }}
      onDrop={(e) => {
        e.preventDefault()
        onDrop()
      }}
      onDragEnd={onDragEnd}
    >
      <canvas ref={canvasRef} />
      <span className="num">{ord}</span>
      <div className="acts">
        <button title="Rotate 90°" onClick={() => store.getState().rotatePage(meta.src)}>
          <IcRotate />
        </button>
        {canDelete && (
          <button title="Delete page" onClick={() => store.getState().deletePage(meta.src)}>
            <IcTrash />
          </button>
        )}
      </div>
    </div>
  )
}
