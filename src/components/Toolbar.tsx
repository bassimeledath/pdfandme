import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { Tool } from '../types'
import {
  IcCheck,
  IcCross,
  IcDate,
  IcDraw,
  IcHighlight,
  IcImage,
  IcMore,
  IcPages,
  IcSelect,
  IcSign,
  IcText,
  IcWhiteout,
} from './icons'

const MAIN: { tool: Tool; label: string; icon: () => JSX.Element }[] = [
  { tool: 'select', label: 'Select', icon: IcSelect },
  { tool: 'text', label: 'Text', icon: IcText },
  { tool: 'sign', label: 'Sign', icon: IcSign },
  { tool: 'highlight', label: 'Highlight', icon: IcHighlight },
  { tool: 'draw', label: 'Draw', icon: IcDraw },
]

const MORE: { tool: Tool; label: string; icon: () => JSX.Element }[] = [
  { tool: 'whiteout', label: 'Whiteout', icon: IcWhiteout },
  { tool: 'check', label: 'Check', icon: IcCheck },
  { tool: 'cross', label: 'Cross', icon: IcCross },
  { tool: 'date', label: 'Date', icon: IcDate },
  { tool: 'image', label: 'Image', icon: IcImage },
]

export default function Toolbar() {
  const tool = useStore((s) => s.tool)
  const setTool = useStore((s) => s.setTool)
  const setRailOpen = useStore((s) => s.setRailOpen)
  const railOpen = useStore((s) => s.railOpen)
  const [moreOpen, setMoreOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!moreOpen) return
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setMoreOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [moreOpen])

  const moreActive = MORE.some((m) => m.tool === tool)

  return (
    <div className="toolbar" ref={ref}>
      {MAIN.map(({ tool: t, label, icon: Icon }) => (
        <button
          key={t}
          className={`tool${tool === t ? ' active' : ''}`}
          onClick={() => setTool(t)}
        >
          <Icon />
          <span className="tip">{label}</span>
        </button>
      ))}
      <span className="sep" />
      <div style={{ position: 'relative' }}>
        <button
          className={`tool${moreActive ? ' active' : ''}`}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <IcMore />
          <span className="tip">More tools</span>
        </button>
        {moreOpen && (
          <div className="more-pop">
            {MORE.map(({ tool: t, label, icon: Icon }) => (
              <button
                key={t}
                className={`pop-item${tool === t ? ' active' : ''}`}
                onClick={() => {
                  setTool(t)
                  setMoreOpen(false)
                }}
              >
                <Icon />
                {label}
              </button>
            ))}
            <button
              className="pop-item"
              onClick={() => {
                setRailOpen(!railOpen)
                setMoreOpen(false)
              }}
            >
              <IcPages />
              Pages
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
