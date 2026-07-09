import { useEffect, useState } from 'react'

const QUIPS = [
  'Telling Adobe absolutely nothing…',
  'Warming up the ink…',
  'Counting your pages…',
  'Sharpening the highlighter…',
  'Un-crumpling the corners…',
]

export default function Loading() {
  const [i, setI] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setI((n) => (n + 1) % QUIPS.length)
        setVisible(true)
      }, 350)
    }, 2200)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="loading">
      <svg className="scribble" viewBox="0 0 280 110">
        <path d="M14 78 C 30 20, 52 20, 60 60 C 66 90, 84 92, 96 62 C 106 36, 122 30, 132 56 C 140 78, 158 82, 170 52 C 180 28, 198 26, 208 54 C 216 76, 236 80, 250 48 C 258 30, 268 34, 266 50" />
      </svg>
      <div className="quip" style={{ opacity: visible ? 1 : 0 }}>
        {QUIPS[i]}
      </div>
      <div className="meta mono">Reading your document</div>
      <div className="bar">
        <i />
      </div>
    </div>
  )
}
