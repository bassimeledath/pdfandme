import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { SavedSession, clearSession, loadSession } from '../persist'
import { IcClose, IcLock, IcUpload, Logo } from './icons'

function timeAgo(ts: number): string {
  const m = Math.round((Date.now() - ts) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  return `${Math.round(h / 24)} day${h < 48 ? '' : 's'} ago`
}

export default function StartPage() {
  const openFile = useStore((s) => s.openFile)
  const resumeSession = useStore((s) => s.resumeSession)
  const loadError = useStore((s) => s.loadError)
  const [over, setOver] = useState(false)
  const [saved, setSaved] = useState<SavedSession | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void loadSession().then(setSaved)
  }, [])

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0]
      if (file) void openFile(file)
    },
    [openFile],
  )

  return (
    <div
      className="start"
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return
        setOver(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        handleFiles(e.dataTransfer.files)
      }}
    >
      <svg className="watermark" viewBox="0 0 24 24" fill="none">
        <path d="M6 2h8.5L20 7.5V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" fill="#211E19" />
      </svg>
      <div className={`dropcard${over ? ' over' : ''}`}>
        <div className="logo-row">
          <Logo s={28} />
          <span className="wordmark">
            pdf<em>and</em>me
          </span>
        </div>
        <h1>{over ? 'Let go.' : 'Edit your PDF.'}</h1>
        <p className="tagline">Better than Adobe. And actually free.</p>
        {loadError && <p className="error">{loadError}</p>}
        <div className="cta-row">
          <button className="btn-primary" onClick={() => inputRef.current?.click()}>
            <IcUpload />
            Choose a file
          </button>
          <span className="or-drop">or drag and drop</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      {saved && (
        <div className="resume-card">
          <Logo s={18} />
          <button className="resume-main" onClick={() => void resumeSession(saved)}>
            <b>Resume {saved.fileName}</b>
            <span>
              {saved.anns.length > 0 && `${saved.anns.length} edit${saved.anns.length === 1 ? '' : 's'} · `}
              saved {timeAgo(saved.savedAt)}
            </span>
          </button>
          <button
            className="resume-x"
            title="Discard saved session"
            onClick={() => {
              void clearSession()
              setSaved(null)
            }}
          >
            <IcClose />
          </button>
        </div>
      )}
      <div className="foot">
        <span className="lock">
          <IcLock />
          Your file stays on your device. Nothing is ever uploaded.
        </span>
        <a
          className="mono gh-link"
          href="https://github.com/bassimeledath/pdfandme"
          target="_blank"
          rel="noreferrer"
        >
          Open source ↗
        </a>
      </div>
    </div>
  )
}
