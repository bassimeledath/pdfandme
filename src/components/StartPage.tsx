import { useCallback, useRef, useState } from 'react'
import { useStore } from '../store'
import { IcLock, IcUpload, Logo } from './icons'

export default function StartPage() {
  const openFile = useStore((s) => s.openFile)
  const loadError = useStore((s) => s.loadError)
  const [over, setOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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
