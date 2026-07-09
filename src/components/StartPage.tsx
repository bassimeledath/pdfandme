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
      <div className={`dropzone${over ? ' over' : ''}`}>
        <svg className="watermark" viewBox="0 0 24 24" fill="none">
          <path d="M6 2h8.5L20 7.5V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" fill="#211E19" />
        </svg>
        <div className="logo-row">
          <Logo s={28} />
          <span className="wordmark">
            pdf<em>and</em>me
          </span>
        </div>
        <h1>
          {over ? (
            <>
              Let go.<br />
              <em>We've got it.</em>
            </>
          ) : (
            <>
              Edit a PDF.<br />
              <em>That's it.</em>
            </>
          )}
        </h1>
        <p className="tagline">Better than Adobe — and actually free.</p>
        <p className="sub">
          Drop your file anywhere on this page. <b>It never leaves your browser</b> — there's no
          server to send it to.
        </p>
        {loadError && <p className="error">{loadError}</p>}
        <button className="btn-primary" onClick={() => inputRef.current?.click()}>
          <IcUpload />
          Choose a file
        </button>
        <div className="fineprint mono">PDF · Free · No account · No upload</div>
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
          Private by architecture — files are processed on your device
        </span>
        <span className="mono">Open source ↗</span>
      </div>
    </div>
  )
}
