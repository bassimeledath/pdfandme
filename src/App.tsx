import { useEffect } from 'react'
import { useStore } from './store'
import StartPage from './components/StartPage'
import Loading from './components/Loading'
import Editor from './components/Editor'

export default function App() {
  const phase = useStore((s) => s.phase)
  const dirty = useStore((s) => s.anns.length > 0 || Object.keys(s.formValues).length > 0)

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  if (phase === 'start') return <StartPage />
  if (phase === 'loading') return <Loading />
  return <Editor />
}
