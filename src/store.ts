import { create } from 'zustand'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { Ann, FormFieldMeta, PageMeta, SavedSignature, Tool, displaySize } from './types'
import { rotateBox90 } from './pdf/coords'
import { loadPdf } from './pdf/pdfjs'
import { SavedSession, clearSession, saveSession } from './persist'

export type Phase = 'start' | 'loading' | 'edit'

interface Snapshot {
  pages: PageMeta[]
  anns: Ann[]
  formValues: Record<string, string | boolean>
}

let idCounter = 0
export const newId = () => `a${++idCounter}_${Math.random().toString(36).slice(2, 7)}`

const SIG_KEY = 'pdfandme.signature.v1'

export function loadSavedSignature(): SavedSignature | null {
  try {
    const raw = localStorage.getItem(SIG_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown> | null
    if (!parsed || typeof parsed !== 'object') return null
    // v1 signatures predate `kind` and were always drawn
    if (!parsed.kind && parsed.strokes) return { ...parsed, kind: 'ink' } as SavedSignature
    if (parsed.kind === 'ink' || parsed.kind === 'image') return parsed as unknown as SavedSignature
    return null
  } catch {
    return null
  }
}
export function saveSignature(sig: SavedSignature | null) {
  try {
    if (sig) localStorage.setItem(SIG_KEY, JSON.stringify(sig))
    else localStorage.removeItem(SIG_KEY)
  } catch {
    /* private mode etc. — signature just won't persist */
  }
}

interface State {
  phase: Phase
  fileName: string
  bytes: ArrayBuffer | null
  pdf: PDFDocumentProxy | null
  loadError: string | null

  pages: PageMeta[]
  fields: FormFieldMeta[]
  formValues: Record<string, string | boolean>
  anns: Ann[]

  tool: Tool
  zoom: number
  selected: string | null
  /** Text annotation currently in typing mode (double-click to enter). */
  editing: string | null
  railOpen: boolean
  toastDismissed: boolean
  sigModalOpen: boolean
  /** Where to place a signature once drawn (page src index + display coords). */
  pendingSigPos: { page: number; x: number; y: number } | null
  savedSig: SavedSignature | null

  past: Snapshot[]
  future: Snapshot[]

  openFile: (file: File) => Promise<void>
  resumeSession: (saved: SavedSession) => Promise<void>
  reset: () => void
  setPhase: (p: Phase) => void
  setTool: (t: Tool) => void
  setZoom: (z: number) => void
  select: (id: string | null) => void
  setEditing: (id: string | null) => void
  setRailOpen: (v: boolean) => void
  dismissToast: () => void
  setSigModal: (open: boolean, pos?: { page: number; x: number; y: number } | null) => void
  setSavedSig: (s: SavedSignature | null) => void

  commit: () => void
  undo: () => void
  redo: () => void

  addAnn: (a: Ann, opts?: { select?: boolean }) => void
  updateAnn: (id: string, patch: Partial<Ann>) => void
  removeAnn: (id: string) => void
  duplicateAnn: (id: string) => void
  setFormValue: (name: string, v: string | boolean) => void
  /** Update a form value without pushing an undo snapshot (used while typing). */
  setFormValueLive: (name: string, v: string | boolean) => void

  rotatePage: (src: number) => void
  deletePage: (src: number) => void
  movePage: (from: number, to: number) => void
}

const snapshot = (s: State): Snapshot => ({
  pages: s.pages.map((p) => ({ ...p })),
  anns: s.anns.map((a) => ({ ...a })),
  formValues: { ...s.formValues },
})

export const useStore = create<State>((set, get) => ({
  phase: 'start',
  fileName: '',
  bytes: null,
  pdf: null,
  loadError: null,
  pages: [],
  fields: [],
  formValues: {},
  anns: [],
  tool: 'select',
  zoom: 1,
  selected: null,
  editing: null,
  railOpen: false,
  toastDismissed: false,
  sigModalOpen: false,
  pendingSigPos: null,
  savedSig: loadSavedSignature(),
  past: [],
  future: [],

  openFile: async (file: File) => {
    set({ phase: 'loading', fileName: file.name, loadError: null })
    const started = Date.now()
    try {
      const bytes = await file.arrayBuffer()
      const { doc, pages, fields } = await loadPdf(bytes)
      // let the interlude breathe — it's charming, not fake: parsing really happened
      const remaining = Math.max(0, 1800 - (Date.now() - started))
      await new Promise((r) => setTimeout(r, remaining))
      set({
        bytes,
        pdf: doc,
        pages,
        fields,
        formValues: {},
        anns: [],
        past: [],
        future: [],
        selected: null,
        tool: 'select',
        toastDismissed: false,
        phase: 'edit',
      })
    } catch (e) {
      const msg =
        e instanceof Error && /password/i.test(e.message)
          ? 'This PDF is password-protected. Remove the password and try again.'
          : "That file couldn't be opened as a PDF."
      set({ phase: 'start', loadError: msg })
    }
  },

  resumeSession: async (saved: SavedSession) => {
    set({ phase: 'loading', fileName: saved.fileName, loadError: null })
    const started = Date.now()
    try {
      const { doc, fields } = await loadPdf(saved.bytes)
      const remaining = Math.max(0, 1200 - (Date.now() - started))
      await new Promise((r) => setTimeout(r, remaining))
      set({
        bytes: saved.bytes,
        pdf: doc,
        pages: saved.pages,
        fields,
        formValues: saved.formValues,
        anns: saved.anns,
        past: [],
        future: [],
        selected: null,
        editing: null,
        tool: 'select',
        toastDismissed: true,
        phase: 'edit',
      })
    } catch {
      void clearSession()
      set({ phase: 'start', loadError: "Couldn't restore your last session." })
    }
  },

  reset: () => {
    void clearSession()
    set({
      phase: 'start',
      fileName: '',
      bytes: null,
      pdf: null,
      pages: [],
      fields: [],
      formValues: {},
      anns: [],
      past: [],
      future: [],
      selected: null,
      editing: null,
      loadError: null,
    })
  },

  setPhase: (phase) => set({ phase }),
  setTool: (tool) => set({ tool, selected: null, editing: null }),
  setZoom: (zoom) => set({ zoom: Math.min(2.4, Math.max(0.4, zoom)) }),
  select: (selected) =>
    set((s) => ({ selected, editing: s.editing === selected ? s.editing : null })),
  setEditing: (editing) => set({ editing }),
  setRailOpen: (railOpen) => set({ railOpen }),
  dismissToast: () => set({ toastDismissed: true }),
  setSigModal: (open, pos = null) => set({ sigModalOpen: open, pendingSigPos: pos }),
  setSavedSig: (savedSig) => {
    saveSignature(savedSig)
    set({ savedSig })
  },

  commit: () => set((s) => ({ past: [...s.past.slice(-79), snapshot(s)], future: [] })),
  undo: () =>
    set((s) => {
      const prev = s.past[s.past.length - 1]
      if (!prev) return {}
      return {
        past: s.past.slice(0, -1),
        future: [...s.future, snapshot(s)],
        ...prev,
        selected: null,
        editing: null,
      }
    }),
  redo: () =>
    set((s) => {
      const next = s.future[s.future.length - 1]
      if (!next) return {}
      return {
        future: s.future.slice(0, -1),
        past: [...s.past, snapshot(s)],
        ...next,
        selected: null,
        editing: null,
      }
    }),

  addAnn: (a, opts) => {
    get().commit()
    set((s) => ({
      anns: [...s.anns, a],
      selected: opts?.select === false ? s.selected : a.id,
    }))
  },
  updateAnn: (id, patch) =>
    set((s) => ({
      anns: s.anns.map((a) => (a.id === id ? ({ ...a, ...patch } as Ann) : a)),
    })),
  removeAnn: (id) => {
    get().commit()
    set((s) => ({
      anns: s.anns.filter((a) => a.id !== id),
      selected: s.selected === id ? null : s.selected,
      editing: s.editing === id ? null : s.editing,
    }))
  },
  duplicateAnn: (id) => {
    const src = get().anns.find((a) => a.id === id)
    if (!src) return
    get().commit()
    const copy = { ...src, id: newId(), x: src.x + 16, y: src.y + 16 }
    set((s) => ({ anns: [...s.anns, copy], selected: copy.id }))
  },
  setFormValue: (name, v) => {
    get().commit()
    set((s) => ({ formValues: { ...s.formValues, [name]: v } }))
  },
  setFormValueLive: (name, v) =>
    set((s) => ({ formValues: { ...s.formValues, [name]: v } })),

  rotatePage: (src) => {
    get().commit()
    set((s) => {
      const page = s.pages.find((p) => p.src === src)
      if (!page) return {}
      const { h: oldH } = displaySize(page)
      return {
        pages: s.pages.map((p) =>
          p.src === src ? { ...p, extraRot: (p.extraRot + 90) % 360 } : p,
        ),
        anns: s.anns.map((a) => {
          if (a.page !== src) return a
          const b = rotateBox90(a, oldH)
          if (a.type === 'ink' || a.type === 'sig') {
            return {
              ...a,
              ...b,
              strokes: a.strokes.map((st) => st.map(([nx, ny]) => [1 - ny, nx] as [number, number])),
            }
          }
          return { ...a, ...b }
        }),
      }
    })
  },
  deletePage: (src) => {
    const live = get().pages.filter((p) => !p.deleted)
    if (live.length <= 1) return
    get().commit()
    set((s) => ({
      pages: s.pages.map((p) => (p.src === src ? { ...p, deleted: true } : p)),
    }))
  },
  movePage: (from, to) => {
    get().commit()
    set((s) => {
      const pages = [...s.pages]
      const [moved] = pages.splice(from, 1)
      pages.splice(to, 0, moved)
      return { pages }
    })
  },
}))

// auto-save edits for crash/refresh recovery (debounced; only when dirty)
let saveTimer: ReturnType<typeof setTimeout> | undefined
useStore.subscribe((s) => {
  if (s.phase !== 'edit' || !s.bytes) return
  const dirty =
    s.anns.length > 0 ||
    Object.keys(s.formValues).length > 0 ||
    s.pages.some((p, i) => p.deleted || p.extraRot !== 0 || p.src !== i)
  if (!dirty) return
  clearTimeout(saveTimer)
  const snap = {
    fileName: s.fileName,
    bytes: s.bytes,
    pages: s.pages,
    anns: s.anns,
    formValues: s.formValues,
    savedAt: Date.now(),
  }
  saveTimer = setTimeout(() => void saveSession(snap), 800)
})

// dev-only handle for driving the app in automated tests
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).__store = useStore
}
