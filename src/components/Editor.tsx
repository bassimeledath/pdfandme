import { useCallback, useEffect, useRef, useState } from 'react'
import { newId, useStore } from '../store'
import { displaySize } from '../types'
import Toolbar from './Toolbar'
import PageView from './PageView'
import PagesRail from './PagesRail'
import SignatureModal from './SignatureModal'
import {
  IcChevR,
  IcClose,
  IcDownload,
  IcForm,
  IcRedo,
  IcUndo,
  Logo,
} from './icons'

export default function Editor() {
  const s = useStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const imgInputRef = useRef<HTMLInputElement>(null)
  const imgPosRef = useRef<{ page: number; x: number; y: number } | null>(null)
  const [dlOpen, setDlOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const fittedRef = useRef(false)

  const livePages = s.pages.filter((p) => !p.deleted)

  // fit-width zoom once on load
  useEffect(() => {
    if (fittedRef.current || !scrollRef.current || s.pages.length === 0) return
    fittedRef.current = true
    const maxW = Math.max(...s.pages.map((p) => displaySize(p).w))
    const avail = scrollRef.current.clientWidth - 180
    s.setZoom(Math.min(1.5, Math.max(0.4, avail / maxW)))
  }, [s.pages]) // eslint-disable-line react-hooks/exhaustive-deps

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      const typing =
        el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (typing) return
        e.preventDefault()
        if (e.shiftKey) s.redo()
        else s.undo()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !typing && s.selected) {
        e.preventDefault()
        s.removeAnn(s.selected)
      } else if (e.key === 'Escape') {
        s.select(null)
        setDlOpen(false)
        if (s.tool !== 'select') s.setTool('select')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [s]) // store identity is stable; handlers read fresh state

  const onScroll = useCallback(() => {
    const sc = scrollRef.current
    if (!sc) return
    const mid = sc.scrollTop + sc.clientHeight / 2
    const wraps = Array.from(sc.querySelectorAll<HTMLElement>('[data-pageord]'))
    let best = 1
    for (const w of wraps) {
      if (w.offsetTop <= mid) best = Number(w.dataset.pageord)
    }
    setCurrentPage(best)
  }, [])

  const requestImage = useCallback((page: number, x: number, y: number) => {
    imgPosRef.current = { page, x, y }
    imgInputRef.current?.click()
  }, [])

  const onImagePicked = async (file: File | null) => {
    const pos = imgPosRef.current
    if (!file || !pos) return
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader()
      r.onload = () => res(r.result as string)
      r.onerror = rej
      r.readAsDataURL(file)
    })
    const dims = await new Promise<{ w: number; h: number }>((res) => {
      const img = new Image()
      img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight })
      img.src = dataUrl
    })
    const meta = s.pages.find((p) => p.src === pos.page)
    if (!meta) return
    const pageW = displaySize(meta).w
    const w = Math.min(220, pageW * 0.4)
    const h = (w * dims.h) / dims.w
    s.addAnn({
      id: newId(),
      type: 'image',
      page: pos.page,
      x: pos.x - w / 2,
      y: pos.y - h / 2,
      w,
      h,
      dataUrl,
    })
    s.setTool('select')
    if (imgInputRef.current) imgInputRef.current.value = ''
  }

  const doExport = async (flattenForm: boolean) => {
    if (!s.bytes) return
    setDlOpen(false)
    setExporting(true)
    try {
      // pdf-lib is only needed here — keep it out of the initial bundle
      const { exportPdf } = await import('../pdf/export')
      const out = await exportPdf(s.bytes, s.pages, s.anns, s.fields, s.formValues, {
        flattenForm,
      })
      const blob = new Blob([out as BlobPart], { type: 'application/pdf' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = s.fileName.replace(/\.pdf$/i, '') + '-edited.pdf'
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
    } finally {
      setExporting(false)
    }
  }

  const showToast =
    s.fields.length > 0 && !s.toastDismissed && Object.keys(s.formValues).length === 0

  return (
    <div className="editor">
      <div className="topbar">
        <button className="brand" title="Start over" onClick={() => confirmLeave() && s.reset()}>
          <Logo s={22} />
        </button>
        <span className="fname">
          {s.fileName.replace(/\.pdf$/i, '')}
          <span className="ext">.pdf</span>
        </span>
        <div className="spacer" />
        <span className="privacy">Everything happens in this tab — nothing is uploaded.</span>
        <button className="ghost-btn" title="Undo (⌘Z)" disabled={s.past.length === 0} onClick={s.undo}>
          <IcUndo />
        </button>
        <button className="ghost-btn" title="Redo (⇧⌘Z)" disabled={s.future.length === 0} onClick={s.redo}>
          <IcRedo />
        </button>
        <button
          className="btn-dl"
          disabled={exporting}
          onClick={() => (s.fields.length > 0 ? setDlOpen((v) => !v) : void doExport(true))}
        >
          <IcDownload />
          {exporting ? 'Preparing…' : 'Download'}
        </button>
        {dlOpen && (
          <div className="dl-pop">
            <button onClick={() => void doExport(true)}>
              <b>Flattened (recommended)</b>
              <span>Everything baked in — opens identically everywhere.</span>
            </button>
            <button onClick={() => void doExport(false)}>
              <b>Keep form fields editable</b>
              <span>Others can still type into the form fields.</span>
            </button>
          </div>
        )}
      </div>

      <Toolbar />

      {s.railOpen ? (
        <PagesRail />
      ) : (
        <button className="rail-tab" onClick={() => s.setRailOpen(true)} title="Pages">
          <IcChevR />
          <span>Pages · {livePages.length}</span>
        </button>
      )}

      {showToast && (
        <div className="toast">
          <div className="ic">
            <IcForm />
          </div>
          <p>
            <b>This looks like a form</b>
            {s.fields.length} fillable field{s.fields.length === 1 ? '' : 's'} found — click any
            field to type.
          </p>
          <button className="x" onClick={s.dismissToast} title="Dismiss">
            <IcClose />
          </button>
        </div>
      )}

      <div className="doc-scroll" ref={scrollRef} onScroll={onScroll}>
        <div className="doc-col">
          {livePages.map((p, ord) => (
            <PageView key={p.src} meta={p} ord={ord + 1} onRequestImage={requestImage} />
          ))}
        </div>
      </div>

      <div className="zoom">
        <button onClick={() => s.setZoom(s.zoom - 0.1)} title="Zoom out">
          −
        </button>
        <span className="pct">{Math.round(s.zoom * 100)}%</span>
        <button onClick={() => s.setZoom(s.zoom + 0.1)} title="Zoom in">
          +
        </button>
      </div>
      <div className="pager">
        {currentPage} / {livePages.length}
      </div>

      {s.sigModalOpen && <SignatureModal />}

      <input
        ref={imgInputRef}
        type="file"
        accept="image/png,image/jpeg"
        style={{ display: 'none' }}
        onChange={(e) => void onImagePicked(e.target.files?.[0] ?? null)}
      />
    </div>
  )

  function confirmLeave() {
    if (s.anns.length === 0 && Object.keys(s.formValues).length === 0) return true
    return window.confirm('Start over? Your edits to this document will be lost.')
  }
}
