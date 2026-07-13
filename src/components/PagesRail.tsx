import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { PageMeta } from '../types'
import { renderPage } from '../pdf/pdfjs'
import { exportPdf } from '../pdf/export'
import { IcCheck, IcChevL, IcRotate, IcTrash } from './icons'

export default function PagesRail() {
  const pages = useStore((s) => s.pages)
  const store = useStore
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const [merging, setMerging] = useState(false)
  const [mergeErr, setMergeErr] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [extracting, setExtracting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // the "Merge another PDF" entry in the More drawer opens the rail and
  // fires this event to pop the picker right away
  useEffect(() => {
    const pick = () => fileRef.current?.click()
    window.addEventListener('pdfandme:pick-merge', pick)
    return () => window.removeEventListener('pdfandme:pick-merge', pick)
  }, [])

  const onPick = async (file: File | null) => {
    if (!file || merging) return
    setMergeErr(null)
    setMerging(true)
    const err = await store.getState().appendPdf(file)
    setMerging(false)
    if (err) {
      setMergeErr(err)
      setTimeout(() => setMergeErr(null), 6000)
    }
  }

  const toggleSel = (src: number) =>
    setSel((prev) => {
      const next = new Set(prev)
      if (next.has(src)) next.delete(src)
      else next.add(src)
      return next
    })

  const doExtract = async () => {
    const s = store.getState()
    if (!s.bytes || sel.size === 0) return
    setExtracting(true)
    try {
      // extraction is just an export with every non-selected page deleted
      const subset = s.pages.map((p) => (sel.has(p.src) ? p : { ...p, deleted: true }))
      const out = await exportPdf(s.bytes, subset, s.anns, s.fields, s.formValues, {
        flattenForm: true,
      })
      const blob = new Blob([out as BlobPart], { type: 'application/pdf' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = s.fileName.replace(/\.pdf$/i, '') + '-pages.pdf'
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
      setSelectMode(false)
      setSel(new Set())
    } catch (e) {
      console.error('extract failed', e)
      window.alert("Couldn't prepare those pages. Please try again.")
    } finally {
      setExtracting(false)
    }
  }

  const live = pages
    .map((p, idx) => ({ p, idx }))
    .filter(({ p }) => !p.deleted)

  return (
    <div className="rail">
      <div className="rail-head">
        <span className="mono">Pages</span>
        <div className="rail-head-acts">
          <button
            className="rail-select-btn"
            title="Pick pages to download as a new PDF"
            onClick={() => {
              setSelectMode((v) => !v)
              setSel(new Set())
            }}
          >
            {selectMode ? 'Done' : 'Select'}
          </button>
          <button className="ghost-btn" onClick={() => store.getState().setRailOpen(false)} title="Close">
            <IcChevL />
          </button>
        </div>
      </div>
      <div className="rail-scroll">
        {live.map(({ p, idx }, ord) => (
          <Thumb
            key={`${p.src}-${p.extraRot}`}
            meta={p}
            ord={ord + 1}
            dragging={dragIdx === idx}
            dropTarget={overIdx === idx && dragIdx !== idx}
            canDelete={live.length > 1}
            selectMode={selectMode}
            selected={sel.has(p.src)}
            onToggle={() => toggleSel(p.src)}
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
        {!selectMode && (
          <>
            <button
              className="add-pdf"
              disabled={merging}
              onClick={() => fileRef.current?.click()}
              title="Append another PDF's pages to this document"
            >
              {merging ? 'Merging…' : '+ Add PDF'}
            </button>
            {mergeErr && <p className="merge-err">{mergeErr}</p>}
          </>
        )}
      </div>
      {selectMode && (
        <div className="extract-bar">
          <button className="extract-dl" disabled={sel.size === 0 || extracting} onClick={() => void doExtract()}>
            {extracting
              ? 'Preparing…'
              : sel.size === 0
                ? 'Pick pages'
                : `Download ${sel.size} page${sel.size === 1 ? '' : 's'}`}
          </button>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null
          e.target.value = ''
          void onPick(f)
        }}
      />
    </div>
  )
}

interface ThumbProps {
  meta: PageMeta
  ord: number
  dragging: boolean
  dropTarget: boolean
  canDelete: boolean
  selectMode: boolean
  selected: boolean
  onToggle: () => void
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
  selectMode,
  selected,
  onToggle,
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
    return renderPage(pdf, meta, canvasRef.current, 0.18)
  }, [pdf, meta.src, meta.extraRot]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className={`thumb${dragging ? ' dragging' : ''}${dropTarget ? ' dropTarget' : ''}${selected ? ' selected' : ''}`}
      draggable={!selectMode}
      onClick={selectMode ? onToggle : undefined}
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
      {selectMode ? (
        <span className="sel-check">{selected && <IcCheck />}</span>
      ) : (
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
      )}
    </div>
  )
}
