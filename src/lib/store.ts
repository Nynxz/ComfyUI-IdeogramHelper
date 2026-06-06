import { reactive, inject, provide, type InjectionKey } from 'vue'
import { emptyState, emptyUi, newElement, newId, serialize, captionToState, type CaptionElement, type CaptionState, type ElementType } from './caption'

// Fields that linked elements share. `bbox` is deliberately excluded so each
// linked copy keeps its own position.
export const SHARED_KEYS = ['type', 'desc', 'text', 'color_palette', 'boxColor'] as const

// A link group of one isn't a group — clear the lone member's linkId so it's
// not left "linked" to nothing after an unlink/delete.
function _pruneLink(elements: CaptionElement[], groupId: string | null) {
  if (!groupId) return
  const members = elements.filter((e) => e.linkId === groupId)
  if (members.length === 1) members[0].linkId = null
}

// Mirror an element's bbox across the canvas center on the given axis.
function _flipBbox(el: CaptionElement, axis: 'h' | 'v') {
  if (!el.bbox) return
  const [y0, x0, y1, x1] = el.bbox
  el.bbox = axis === 'h' ? [y0, 1000 - x1, y1, 1000 - x0] : [1000 - y1, x0, 1000 - y0, x1]
}

export interface StudioStore {
  state: CaptionState
  selectedIds: string[]
  selectedId: string | null // primary (last-selected) — what the editor edits
  isSelected(id: string): boolean
  select(id: string | null, additive?: boolean): void
  addElement(type: ElementType, bbox?: CaptionElement['bbox']): CaptionElement
  removeElement(id: string): void
  duplicateElement(id: string): void
  toggleEnabled(id: string): void
  flipAll(axis: 'h' | 'v'): void
  duplicateLinked(id: string): void
  unlink(id: string): void
  linkGroupSize(id: string): number
  setShared(id: string, key: (typeof SHARED_KEYS)[number], value: unknown): void
  moveElement(id: string, dir: -1 | 1): void
  getElement(id: string | null): CaptionElement | undefined
  load(s: Partial<CaptionState>): void
  // JSON editor scratch (transient); open/collapsed state lives in state.ui.jsonOpen
  json: { editing: boolean; draft: string; syncError: string }
  jsonStartEdit(): void
  jsonCancel(): void
  jsonTidy(): void
  jsonApply(): void
  importCaptionJson(text: string): { ok: boolean; error?: string }
  // history
  _hist: string[]
  _hi: number
  restoring: boolean
  canUndo: boolean
  canRedo: boolean
  snapshot(): void
  _restore(snap: string): void
  undo(): void
  redo(): void
  resetHistory(): void
}

const KEY: InjectionKey<StudioStore> = Symbol('ideogram-studio')

export function createStudioStore(): StudioStore {
  const store = reactive({
    state: emptyState(),
    selectedIds: [] as string[],
    get selectedId(): string | null {
      return store.selectedIds.length ? store.selectedIds[store.selectedIds.length - 1] : null
    },
    isSelected(id: string) {
      return store.selectedIds.includes(id)
    },

    // history (snapshots of JSON state)
    _hist: [] as string[],
    _hi: -1,
    restoring: false,
    get canUndo() {
      return store._hi > 0
    },
    get canRedo() {
      return store._hi >= 0 && store._hi < store._hist.length - 1
    },
    snapshot() {
      if (store.restoring) return
      const snap = JSON.stringify(store.state)
      if (store._hist[store._hi] === snap) return
      store._hist = store._hist.slice(0, store._hi + 1)
      store._hist.push(snap)
      if (store._hist.length > 80) store._hist.shift()
      store._hi = store._hist.length - 1
    },
    _restore(snap: string) {
      store.restoring = true
      const parsed = JSON.parse(snap) as CaptionState
      Object.assign(store.state, emptyState(), parsed)
      store.selectedIds = store.selectedIds.filter((id) => store.getElement(id))
      // allow the deep watcher to flush before re-arming snapshots
      setTimeout(() => {
        store.restoring = false
      }, 0)
    },
    undo() {
      if (!store.canUndo) return
      store._hi -= 1
      store._restore(store._hist[store._hi])
    },
    redo() {
      if (!store.canRedo) return
      store._hi += 1
      store._restore(store._hist[store._hi])
    },
    resetHistory() {
      store._hist = [JSON.stringify(store.state)]
      store._hi = 0
    },

    select(id: string | null, additive = false) {
      if (id == null) {
        store.selectedIds = []
        return
      }
      if (additive) {
        const i = store.selectedIds.indexOf(id)
        if (i >= 0) store.selectedIds.splice(i, 1) // toggle out
        else store.selectedIds.push(id) // toggle in (becomes primary)
      } else {
        store.selectedIds = [id]
      }
    },
    addElement(type: ElementType, bbox: CaptionElement['bbox'] = null) {
      // Default to a visible, centered box (staggered so repeats don't stack)
      // so a new element actually appears on the canvas — the bbox can be
      // toggled off in the editor if you want the model to auto-place it.
      if (!bbox) {
        const o = (store.state.elements.length % 6) * 30
        bbox = [220 + o, 220 + o, 520 + o, 520 + o]
      }
      const el = newElement(type, bbox)
      store.state.elements.push(el)
      store.select(el.id)
      return el
    },
    removeElement(id: string) {
      const gid = store.getElement(id)?.linkId ?? null
      const i = store.state.elements.findIndex((e) => e.id === id)
      if (i >= 0) store.state.elements.splice(i, 1)
      store.selectedIds = store.selectedIds.filter((x) => x !== id)
      _pruneLink(store.state.elements, gid)
    },
    duplicateElement(id: string) {
      const src = store.getElement(id)
      if (!src) return
      const copy = newElement(src.type, src.bbox ? ([...src.bbox] as any) : null)
      copy.desc = src.desc
      copy.text = src.text
      copy.color_palette = [...src.color_palette]
      if (copy.bbox) {
        // nudge so the duplicate is visible
        copy.bbox = copy.bbox.map((v, idx) => Math.max(0, Math.min(1000, v + (idx < 2 ? 20 : 20)))) as any
      }
      store.state.elements.push(copy)
      store.select(copy.id)
    },
    toggleEnabled(id: string) {
      const el = store.getElement(id)
      if (el) el.enabled = el.enabled === false
    },
    flipAll(axis: 'h' | 'v') {
      for (const el of store.state.elements) if (el.bbox) _flipBbox(el, axis)
    },
    duplicateLinked(id: string) {
      const src = store.getElement(id)
      if (!src) return
      // Ensure the source belongs to a link group.
      if (!src.linkId) src.linkId = newId()
      const copy = newElement(src.type, src.bbox ? ([...src.bbox] as any) : null)
      copy.desc = src.desc
      copy.text = src.text
      copy.color_palette = [...src.color_palette]
      copy.boxColor = src.boxColor // linked copies share color
      copy.linkId = src.linkId
      if (copy.bbox) {
        copy.bbox = copy.bbox.map((v, idx) => Math.max(0, Math.min(1000, v + (idx < 2 ? 30 : 30)))) as any
      }
      store.state.elements.push(copy)
      store.select(copy.id)
    },
    unlink(id: string) {
      const el = store.getElement(id)
      if (!el?.linkId) return
      const gid = el.linkId
      el.linkId = null
      _pruneLink(store.state.elements, gid) // dissolve a now-lone group
    },
    linkGroupSize(id: string) {
      const el = store.getElement(id)
      if (!el?.linkId) return 1
      return store.state.elements.filter((e) => e.linkId === el.linkId).length
    },
    setShared(id: string, key: (typeof SHARED_KEYS)[number], value: unknown) {
      const el = store.getElement(id)
      if (!el) return
      const members = el.linkId
        ? store.state.elements.filter((e) => e.linkId === el.linkId)
        : [el]
      for (const m of members) (m as any)[key] = value
    },
    moveElement(id: string, dir: -1 | 1) {
      const i = store.state.elements.findIndex((e) => e.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= store.state.elements.length) return
      const arr = store.state.elements
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    },
    getElement(id: string | null) {
      return store.state.elements.find((e) => e.id === id)
    },
    load(s: Partial<CaptionState>) {
      Object.assign(store.state, emptyState(), s)
      // deep-merge ui so older saves (missing newer keys) get sane defaults
      store.state.ui = { ...emptyUi(), ...(s.ui || {}) }
    },

    json: { editing: false, draft: '', syncError: '' },
    jsonStartEdit() {
      store.json.draft = serialize(store.state).pretty
      store.json.editing = true
      store.state.ui.jsonOpen = true
    },
    jsonCancel() {
      store.json.editing = false
    },
    jsonTidy() {
      try {
        store.json.draft = JSON.stringify(JSON.parse(store.json.draft), null, 2)
      } catch {
        /* leave as-is if it doesn't parse */
      }
    },
    jsonApply() {
      if (store.importCaptionJson(store.json.draft).ok) store.json.editing = false
    },
    importCaptionJson(text: string) {
      let obj: any
      try {
        obj = JSON.parse(text)
      } catch (e: any) {
        return { ok: false, error: String(e?.message || e) }
      }
      const parts = captionToState(obj)
      store.state.high_level_description = parts.high_level_description
      store.state.style = parts.style
      store.state.background = parts.background
      store.state.elements = parts.elements
      store.select(null)
      store.snapshot()
      return { ok: true }
    },
  }) as StudioStore
  return store
}

export function provideStudioStore(store: StudioStore) {
  provide(KEY, store)
}

export function useStudioStore(): StudioStore {
  const s = inject(KEY)
  if (!s) throw new Error('StudioStore not provided')
  return s
}
