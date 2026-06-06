// Shared Ideogram 4 caption model + client-side serializer.
//
// Mirrors nodes/caption.py so the studio's live JSON preview matches exactly
// what the Python node emits at runtime (key order, hex normalization,
// minified separators). Python remains authoritative at execution time.

export type ElementType = 'obj' | 'text'

export interface CaptionElement {
  id: string
  type: ElementType
  bbox: [number, number, number, number] | null // [y_min, x_min, y_max, x_max] 0..1000
  desc: string
  text: string
  color_palette: string[]
  // Editor-only metadata (NOT serialized into the caption):
  boxColor: string // display color for the box in canvas + overlay
  linkId: string | null // elements sharing a linkId share content, keep own bbox
  enabled: boolean // muted (false) elements are kept but excluded from output
}

// Distinct, readable-on-dark colors auto-assigned to new boxes.
export const BOX_PALETTE = [
  '#3B82F6', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#84CC16', '#06B6D4',
]
let _colorSeq = 0
export function nextBoxColor(): string {
  const c = BOX_PALETTE[_colorSeq % BOX_PALETTE.length]
  _colorSeq += 1
  return c
}

export interface StyleDescription {
  enabled: boolean
  mode: 'photo' | 'art'
  aesthetics: string
  lighting: string
  medium: string
  photo: string
  art_style: string
  color_palette: string[]
}

export interface OverlaySettings {
  lineWidth: number
  fillAlpha: number
  labelSize: number
  showIndex: boolean
  showText: boolean
}

// Editor UI preferences — persisted with the studio state so they survive a
// reload (NOT part of the caption; buildCaption ignores them).
export interface UiPrefs {
  sync: boolean
  showLabels: boolean
  backdropOpacity: number
  newType: ElementType
  jsonOpen: boolean
  promptOpen: boolean
  showPresets: boolean
  jsonSync: boolean
}

export interface CaptionState {
  high_level_description: string
  width: number
  height: number
  style: StyleDescription
  background: string
  elements: CaptionElement[]
  overlay: OverlaySettings
  ui: UiPrefs
}

export function emptyUi(): UiPrefs {
  return { sync: true, showLabels: true, backdropOpacity: 0.5, newType: 'obj', jsonOpen: false, promptOpen: true, showPresets: false, jsonSync: false }
}

// Common Ideogram output formats (aspect · pixels).
export const FORMATS: { label: string; w: number; h: number }[] = [
  { label: '1:1 · 1024×1024', w: 1024, h: 1024 },
  { label: '3:2 · 1248×832', w: 1248, h: 832 },
  { label: '2:3 · 832×1248', w: 832, h: 1248 },
  { label: '16:9 · 1344×768', w: 1344, h: 768 },
  { label: '9:16 · 768×1344', w: 768, h: 1344 },
  { label: '4:3 · 1152×896', w: 1152, h: 896 },
  { label: '3:4 · 896×1152', w: 896, h: 1152 },
  { label: '16:10 · 1280×800', w: 1280, h: 800 },
]

export function emptyOverlay(): OverlaySettings {
  return { lineWidth: 3, fillAlpha: 0.18, labelSize: 16, showIndex: true, showText: true }
}

export function emptyStyle(): StyleDescription {
  return {
    enabled: true,
    mode: 'photo',
    aesthetics: '',
    lighting: '',
    medium: 'photograph',
    photo: '',
    art_style: '',
    color_palette: [],
  }
}

let _seq = 0
export function newId(): string {
  _seq += 1
  return `el_${_seq}_${(_seq * 2654435761) % 100000}`
}

export function newElement(type: ElementType, bbox: CaptionElement['bbox'] = null): CaptionElement {
  return { id: newId(), type, bbox, desc: '', text: '', color_palette: [], boxColor: nextBoxColor(), linkId: null, enabled: true }
}

export function emptyState(): CaptionState {
  return {
    high_level_description: '',
    width: 1024,
    height: 1024,
    style: emptyStyle(),
    background: '',
    elements: [],
    overlay: emptyOverlay(),
    ui: emptyUi(),
  }
}

const HEX_RE = /^#[0-9A-F]{6}$/

export function normalizeHex(raw: string): string | null {
  let h = (raw || '').trim().toUpperCase()
  if (!h.startsWith('#')) h = '#' + h
  if (h.length === 4) h = '#' + h.slice(1).split('').map((c) => c + c).join('') // #RGB -> #RRGGBB
  return HEX_RE.test(h) ? h : null
}

function cleanHexList(values: string[], limit: number, where: string, warnings: string[]): string[] | null {
  const out: string[] = []
  for (const raw of values || []) {
    const h = normalizeHex(raw)
    if (!h) {
      if (raw && raw.trim()) warnings.push(`${where}: dropped invalid hex ${raw}`)
      continue
    }
    out.push(h)
  }
  if (out.length > limit) {
    warnings.push(`${where}: ${out.length} colors exceeds max ${limit}; truncated`)
    out.length = limit
  }
  return out.length ? out : null
}

function clampBbox(b: [number, number, number, number]): [number, number, number, number] {
  const c = (v: number) => Math.max(0, Math.min(1000, Math.round(v)))
  let [y0, x0, y1, x1] = b.map(c) as [number, number, number, number]
  if (y0 > y1) [y0, y1] = [y1, y0]
  if (x0 > x1) [x0, x1] = [x1, x0]
  return [y0, x0, y1, x1]
}

// Build the canonical, key-ordered caption object (the structured payload).
export function buildCaption(state: CaptionState): { caption: any; warnings: string[] } {
  const warnings: string[] = []
  const out: any = {}

  const hld = state.high_level_description.trim()
  if (hld) out.high_level_description = hld
  else warnings.push('high_level_description is empty (strongly recommended)')

  if (state.style.enabled) {
    const st = state.style
    const isPhoto = st.mode === 'photo'
    const s: any = {}
    for (const k of ['aesthetics', 'lighting', 'medium'] as const) {
      const v = st[k].trim()
      if (v) s[k] = v
      else warnings.push(`style_description.${k} is required`)
    }
    if (isPhoto) {
      const v = st.photo.trim()
      if (v) s.photo = v
      else warnings.push('style_description.photo is required in photo mode')
    } else {
      const v = st.art_style.trim()
      if (v) s.art_style = v
      else warnings.push('style_description.art_style is required in art mode')
    }
    const palette = cleanHexList(st.color_palette, 16, 'style_description.color_palette', warnings)
    // Re-emit in strict key order.
    const ordered: any = {}
    const order = isPhoto
      ? ['aesthetics', 'lighting', 'photo', 'medium', 'color_palette']
      : ['aesthetics', 'lighting', 'medium', 'art_style', 'color_palette']
    for (const k of order) if (s[k] !== undefined) ordered[k] = s[k]
    if (palette) ordered.color_palette = palette
    out.style_description = ordered
  }

  const background = state.background.trim()
  if (!background) warnings.push('compositional_deconstruction.background is required')

  const elements: any[] = []
  state.elements.forEach((el, i) => {
    if (el.enabled === false) return // muted — kept in the editor, omitted from output
    const e: any = { type: el.type }
    if (el.bbox) e.bbox = clampBbox(el.bbox)
    if (el.type === 'text') {
      const t = el.text.trim()
      if (!t) warnings.push(`elements[${i}]: text element has no text to render`)
      e.text = t
    }
    const desc = el.desc.trim()
    if (!desc) warnings.push(`elements[${i}]: desc is empty`)
    e.desc = desc
    const palette = cleanHexList(el.color_palette, 5, `elements[${i}].color_palette`, warnings)
    if (palette) e.color_palette = palette

    // strict key order per type
    const order = el.type === 'text'
      ? ['type', 'bbox', 'text', 'desc', 'color_palette']
      : ['type', 'bbox', 'desc', 'color_palette']
    const ordered: any = {}
    for (const k of order) if (e[k] !== undefined) ordered[k] = e[k]
    elements.push(ordered)
  })

  out.compositional_deconstruction = { background, elements }
  return { caption: out, warnings }
}

export function serialize(state: CaptionState): { json: string; pretty: string; warnings: string[] } {
  const { caption, warnings } = buildCaption(state)
  return {
    json: JSON.stringify(caption), // minified, matches separators=(",",":")
    pretty: JSON.stringify(caption, null, 2),
    warnings,
  }
}

// Parse an Ideogram caption object back into editor-shaped pieces. Editor-only
// metadata that the caption doesn't carry (ids, box colors, enabled, links) is
// regenerated. Returns just the content fields — width/height/overlay are left
// to the caller so importing a caption doesn't clobber the chosen format.
export function captionToState(
  obj: any,
): Pick<CaptionState, 'high_level_description' | 'style' | 'background' | 'elements'> {
  const hld = typeof obj?.high_level_description === 'string' ? obj.high_level_description : ''

  const style = emptyStyle()
  const sd = obj?.style_description
  if (sd && typeof sd === 'object') {
    style.enabled = true
    style.aesthetics = typeof sd.aesthetics === 'string' ? sd.aesthetics : ''
    style.lighting = typeof sd.lighting === 'string' ? sd.lighting : ''
    style.medium = typeof sd.medium === 'string' ? sd.medium : ''
    if (typeof sd.photo === 'string' && sd.photo.trim()) {
      style.mode = 'photo'
      style.photo = sd.photo
    } else if (typeof sd.art_style === 'string' && sd.art_style.trim()) {
      style.mode = 'art'
      style.art_style = sd.art_style
    }
    if (Array.isArray(sd.color_palette)) style.color_palette = sd.color_palette.map(String)
  } else {
    style.enabled = false
  }

  const comp = obj?.compositional_deconstruction ?? {}
  const background = typeof comp.background === 'string' ? comp.background : ''
  const clamp = (v: number) => Math.max(0, Math.min(1000, Math.round(Number(v) || 0)))
  const rawElements = Array.isArray(comp.elements) ? comp.elements : []
  const elements: CaptionElement[] = rawElements.map((el: any) => {
    const type: ElementType = el?.type === 'text' ? 'text' : 'obj'
    const bbox =
      Array.isArray(el?.bbox) && el.bbox.length === 4
        ? (el.bbox.map(clamp) as [number, number, number, number])
        : null
    const e = newElement(type, bbox)
    e.desc = typeof el?.desc === 'string' ? el.desc : ''
    e.text = typeof el?.text === 'string' ? el.text : ''
    if (Array.isArray(el?.color_palette)) e.color_palette = el.color_palette.map(String)
    return e
  })

  return { high_level_description: hld, style, background, elements }
}
