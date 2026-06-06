<template>
  <div class="canvas-wrap">
    <div class="toolbar" @pointerdown.stop>
      <slot name="lead" />
      <span v-if="$slots.lead" class="divider"></span>
      <div class="seg" title="What new boxes become when you draw">
        <UiButton icon :active="newType === 'obj'" title="New boxes are objects" @click="newType = 'obj'"><i class="mdi mdi-shape-outline"></i></UiButton>
        <UiButton icon :active="newType === 'text'" title="New boxes are text" @click="newType = 'text'"><i class="mdi mdi-format-text"></i></UiButton>
      </div>

      <span class="divider"></span>

      <UiPopover align="left">
        <template #trigger><UiButton icon :active="!!backdropUrl || syncRef" title="Reference / trace image"><i class="mdi mdi-image-outline"></i></UiButton></template>
        <div class="cmenu">
          <button class="citem" @click="pickImage"><i class="mdi mdi-folder-image"></i> load image…</button>
          <button class="citem" :class="{ on: syncRef }" title="Update from an Ideogram Studio Ref Sync node" @click="toggleSync"><i class="mdi" :class="syncRef ? 'mdi-sync' : 'mdi-sync-off'"></i> live sync</button>
          <label class="crow">opacity <input type="range" min="0" max="1" step="0.05" v-model.number="backdropOpacity" /></label>
          <button v-if="backdropUrl" class="citem" @click="backdropUrl = null"><i class="mdi mdi-close"></i> remove reference</button>
        </div>
      </UiPopover>

      <span class="divider"></span>

      <UiPopover align="left">
        <template #trigger><UiButton icon title="View &amp; overlay settings"><i class="mdi mdi-tune-variant"></i></UiButton></template>
        <div class="cmenu">
          <label class="crow"><input type="checkbox" v-model="showLabels" /> show box labels</label>
          <div class="crow">mirror scene
            <button class="cic" title="Mirror horizontally" @click="store.flipAll('h')"><i class="mdi mdi-flip-horizontal"></i></button>
            <button class="cic" title="Mirror vertically" @click="store.flipAll('v')"><i class="mdi mdi-flip-vertical"></i></button>
          </div>
          <div class="cdiv"></div>
          <div class="cgroup">overlay output</div>
          <label class="crow">line <input type="number" min="1" max="40" v-model.number="store.state.overlay.lineWidth" /></label>
          <label class="crow">fill <input type="range" min="0" max="1" step="0.02" v-model.number="store.state.overlay.fillAlpha" /></label>
          <label class="crow">label size <input type="number" min="6" max="96" v-model.number="store.state.overlay.labelSize" /></label>
          <div class="crow ckrow">
            <label><input type="checkbox" v-model="store.state.overlay.showIndex" /> index</label>
            <label><input type="checkbox" v-model="store.state.overlay.showText" /> text</label>
          </div>
          <p class="chint">styles the overlay output (Extras node), not the reference</p>
        </div>
      </UiPopover>

      <span class="spacer"></span>
      <slot name="trail" />
      <input ref="fileInput" type="file" accept="image/*" hidden @change="onFile" />
    </div>

    <div
      ref="stage"
      class="stage"
      tabindex="0"
      :class="{ dragging: !!drag }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @lostpointercapture="onPointerUp"
      @keydown="onKeyDown"
      @dragover.prevent
      @drop="onDrop"
      :style="stageStyle"
    >
      <img v-if="backdropUrl" class="backdrop" :src="backdropUrl" :style="{ opacity: backdropOpacity }" draggable="false" alt="reference" />
      <div class="grid"></div>

      <div
        v-for="(el, i) in boxed"
        :key="el.id"
        class="box"
        :class="{ sel: store.isSelected(el.id), primary: el.id === store.selectedId, muted: el.enabled === false }"
        :style="boxStyle(el)"
        :data-box="el.id"
      >
        <span v-if="showLabels" class="tag" :style="tagStyle(el)">
          <i class="mdi" :class="el.linkId ? 'mdi-link-variant' : (el.type === 'text' ? 'mdi-format-text' : 'mdi-vector-square')"></i>
          {{ i + 1 }} · {{ el.type === 'text' ? (el.text || 'text') : (el.desc || 'obj') }}
        </span>
        <template v-if="el.id === store.selectedId">
          <i v-for="hdl in HANDLES" :key="hdl" :class="['h', 'h-' + hdl]" :data-handle="hdl"></i>
        </template>
      </div>

      <div v-if="draft" class="box draft" :style="boxStyle({ bbox: draft, boxColor: '#9ca3af' })"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useStudioStore } from '@/lib/store'
import { refSyncImage, initRefSync } from '@/lib/refSync'
import UiButton from './ui/UiButton.vue'
import UiPopover from './ui/UiPopover.vue'
import type { CaptionElement } from '@/lib/caption'

const store = useStudioStore()

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const
type Handle = (typeof HANDLES)[number]
type Bbox = [number, number, number, number]

// These UI toggles live in the persisted studio state (store.state.ui) so they
// survive a reload — proxied via computed so the template/usage is unchanged.
const newType = computed({ get: () => store.state.ui.newType, set: (v) => (store.state.ui.newType = v) })
const showLabels = computed({ get: () => store.state.ui.showLabels, set: (v) => (store.state.ui.showLabels = v) })
const backdropOpacity = computed({ get: () => store.state.ui.backdropOpacity, set: (v) => (store.state.ui.backdropOpacity = v) })
const syncRef = computed({ get: () => store.state.ui.sync, set: (v) => (store.state.ui.sync = v) })
// The backdrop image itself is client-side only (not saved — temp URLs go stale).
const backdropUrl = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
onMounted(initRefSync)
watch(refSyncImage, (url) => {
  if (syncRef.value && url) backdropUrl.value = url
})
function toggleSync() {
  syncRef.value = !syncRef.value
  if (syncRef.value && refSyncImage.value) backdropUrl.value = refSyncImage.value
}
function pickImage() {
  fileInput.value?.click()
}
function readImage(f: File) {
  const r = new FileReader()
  r.onload = () => (backdropUrl.value = r.result as string)
  r.readAsDataURL(f)
}
function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) readImage(f)
}
function onDrop(e: DragEvent) {
  e.preventDefault()
  const f = e.dataTransfer?.files?.[0]
  if (f && f.type.startsWith('image/')) readImage(f)
}
const stage = ref<HTMLElement | null>(null)
const draft = ref<Bbox | null>(null)
const hint = ref('') // populated with the live bbox readout only during a drag

const boxed = computed(() => store.state.elements.filter((e) => e.bbox))

const stageStyle = computed(() => ({ aspectRatio: `${store.state.width} / ${store.state.height}` }))

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) || 0
  const g = parseInt(h.slice(2, 4), 16) || 0
  const b = parseInt(h.slice(4, 6), 16) || 0
  return `rgba(${r},${g},${b},${a})`
}

// bbox = [y0, x0, y1, x1] in 0..1000
function boxStyle(el: { bbox: Bbox; boxColor?: string }) {
  const [y0, x0, y1, x1] = el.bbox
  const color = el.boxColor || '#3b82f6'
  return {
    left: `${x0 / 10}%`,
    top: `${y0 / 10}%`,
    width: `${(x1 - x0) / 10}%`,
    height: `${(y1 - y0) / 10}%`,
    borderColor: color,
    // outline-first: no fill by default so overlapping boxes stay readable;
    // a faint tint appears on hover/selection (see CSS using --c).
    '--c': color,
    '--fill': hexToRgba(color, 0.16),
  }
}
function tagStyle(el: { boxColor?: string }) {
  return { background: hexToRgba(el.boxColor || '#3b82f6', 0.88), color: '#fff' }
}

const clamp = (v: number) => Math.max(0, Math.min(1000, Math.round(v)))
function pointToCoords(ev: PointerEvent): { x: number; y: number } {
  const r = stage.value!.getBoundingClientRect()
  return {
    x: clamp(((ev.clientX - r.left) / r.width) * 1000),
    y: clamp(((ev.clientY - r.top) / r.height) * 1000),
  }
}

// ---- one unified pointer session (mirrors ETK's capture pattern) -------
interface DragSession {
  kind: 'draw' | 'move' | 'resize'
  el?: CaptionElement
  handle?: Handle
  start: { x: number; y: number }
  moved: boolean
  moveTargets?: { el: CaptionElement; start: Bbox }[] // for move (1 = single, >1 = group)
  clickedId?: string
  wasPrimary?: boolean // the clicked box was already the sole selection (→ cycle on click)
}
let drag: DragSession | null = null

// ids of every enabled box whose bbox contains the point, in paint order — used
// to cycle through stacked boxes on repeated clicks.
function boxesUnder(p: { x: number; y: number }) {
  return store.state.elements
    .filter((el) => el.bbox && el.enabled !== false && p.x >= el.bbox[1] && p.x <= el.bbox[3] && p.y >= el.bbox[0] && p.y <= el.bbox[2])
    .map((el) => el.id)
}

function onPointerDown(ev: PointerEvent) {
  // Keep LiteGraph from also dragging the node / panning the canvas.
  ev.preventDefault()
  ev.stopPropagation()
  try {
    stage.value!.setPointerCapture(ev.pointerId)
  } catch {
    /* best effort */
  }
  stage.value?.focus({ preventScroll: true }) // so keyboard (Delete) works after a click

  const target = ev.target as HTMLElement
  const handle = target.dataset.handle as Handle | undefined
  const boxId = target.closest('[data-box]')?.getAttribute('data-box') ?? undefined
  const start = pointToCoords(ev)

  if (handle && store.selectedId) {
    const el = store.getElement(store.selectedId)
    if (el?.bbox) {
      drag = { kind: 'resize', el, handle, start, moved: false }
      return
    }
  }
  if (boxId) {
    const additive = ev.shiftKey || ev.ctrlKey || ev.metaKey
    if (additive) {
      store.select(boxId, true) // toggle in/out of the selection — no drag
      return
    }
    const wasPrimary = store.selectedIds.length === 1 && store.selectedId === boxId
    if (!store.isSelected(boxId)) store.select(boxId) // fresh single-select
    // move every selected box together (a single box if only one is selected)
    const moveTargets = store.selectedIds
      .map((id) => store.getElement(id))
      .filter((e): e is CaptionElement => !!e?.bbox)
      .map((e) => ({ el: e, start: [...e.bbox!] as Bbox }))
    drag = { kind: 'move', start, moved: false, moveTargets, clickedId: boxId, wasPrimary }
    return
  }
  // empty space → start drawing a new box
  draft.value = [start.y, start.x, start.y, start.x]
  drag = { kind: 'draw', start, moved: false }
}

function onPointerMove(ev: PointerEvent) {
  if (!drag) return
  ev.preventDefault()
  const p = pointToCoords(ev)
  if (Math.abs(p.x - drag.start.x) > 2 || Math.abs(p.y - drag.start.y) > 2) drag.moved = true

  if (drag.kind === 'draw') {
    draft.value = [Math.min(drag.start.y, p.y), Math.min(drag.start.x, p.x), Math.max(drag.start.y, p.y), Math.max(drag.start.x, p.x)]
    hint.value = bboxLabel(draft.value)
  } else if (drag.kind === 'move' && drag.moveTargets) {
    const targets = drag.moveTargets
    // clamp the delta uniformly so the group moves rigidly and stays in bounds
    let dx = p.x - drag.start.x
    let dy = p.y - drag.start.y
    let loX = -Infinity, hiX = Infinity, loY = -Infinity, hiY = Infinity
    for (const t of targets) {
      const [y0, x0, y1, x1] = t.start
      loX = Math.max(loX, -x0); hiX = Math.min(hiX, 1000 - x1)
      loY = Math.max(loY, -y0); hiY = Math.min(hiY, 1000 - y1)
    }
    dx = Math.max(loX, Math.min(hiX, dx))
    dy = Math.max(loY, Math.min(hiY, dy))
    for (const t of targets) {
      const [y0, x0, y1, x1] = t.start
      t.el.bbox = [Math.round(y0 + dy), Math.round(x0 + dx), Math.round(y1 + dy), Math.round(x1 + dx)]
    }
    if (targets.length === 1) hint.value = bboxLabel(targets[0].el.bbox!)
  } else if (drag.kind === 'resize' && drag.el?.bbox && drag.handle) {
    let [y0, x0, y1, x1] = drag.el.bbox
    if (drag.handle.includes('n')) y0 = Math.min(p.y, y1 - 2)
    if (drag.handle.includes('s')) y1 = Math.max(p.y, y0 + 2)
    if (drag.handle.includes('w')) x0 = Math.min(p.x, x1 - 2)
    if (drag.handle.includes('e')) x1 = Math.max(p.x, x0 + 2)
    drag.el.bbox = [y0, x0, y1, x1]
    hint.value = bboxLabel(drag.el.bbox)
  }
}

function onPointerUp(ev: PointerEvent) {
  if (!drag) return
  try {
    stage.value!.releasePointerCapture(ev.pointerId)
  } catch {
    /* fine */
  }
  if (drag.kind === 'draw') {
    const b = draft.value
    draft.value = null
    if (b && b[2] - b[0] >= 8 && b[3] - b[1] >= 8) {
      store.addElement(newType.value, b)
    } else if (!drag.moved) {
      store.select(null) // a plain click on empty canvas deselects
    }
  } else if (drag.kind === 'move' && !drag.moved && drag.clickedId) {
    if (store.selectedIds.length > 1) {
      store.select(drag.clickedId) // plain click on a box in a group → collapse to it
    } else if (drag.wasPrimary) {
      // clicking the already-selected box steps to the next box under the cursor,
      // so stacked/overlapping boxes are reachable (cycles, wrapping around).
      const ids = boxesUnder(drag.start)
      if (ids.length > 1) {
        const ci = ids.indexOf(drag.clickedId)
        store.select(ids[ci === -1 ? 0 : (ci + 1) % ids.length])
      }
    }
  }
  drag = null
  hint.value = '' // clear the live readout once the drag ends
}

// Delete/Backspace removes the selected box(es). Scoped to the focused canvas
// and stopped from bubbling so LiteGraph doesn't delete the whole node.
function onKeyDown(ev: KeyboardEvent) {
  if (ev.key !== 'Delete' && ev.key !== 'Backspace') return
  if (!store.selectedIds.length) return
  ev.preventDefault()
  ev.stopPropagation()
  for (const id of [...store.selectedIds]) store.removeElement(id)
  store.snapshot()
}

function bboxLabel(b: Bbox) {
  return `bbox [y${b[0]} x${b[1]} y${b[2]} x${b[3]}]  ·  ${b[3] - b[1]}×${b[2] - b[0]}`
}
</script>

<style scoped>
.canvas-wrap { display: flex; flex-direction: column; gap: 6px; }
.toolbar { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
.mdi { font-size: 15px; line-height: 1; }
.tag .mdi { font-size: 1em; }
.seg { display: flex; gap: 2px; }
/* uniform square-ish icon buttons */
.ic {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 26px; height: 24px; padding: 0 6px; box-sizing: border-box;
  background: var(--st-btn); color: var(--st-text); border: 1px solid var(--st-border);
  border-radius: 5px; font-size: 12px; line-height: 1; cursor: pointer;
}
.ic:hover { border-color: var(--st-accent); }
.ic.on { background: var(--st-accent); border-color: var(--st-accent); color: var(--st-on-accent, #fff); }
.divider { width: 1px; height: 18px; background: var(--st-border); margin: 0 2px; }
.spacer { flex: 1 1 auto; }
/* compact ref / view dropdown menus */
.cmenu { display: flex; flex-direction: column; gap: 5px; min-width: 170px; }
.citem { display: flex; align-items: center; gap: 6px; text-align: left; background: var(--st-btn); border: 1px solid var(--st-border); color: var(--st-text); border-radius: 5px; padding: 5px 8px; font-size: 11px; cursor: pointer; }
.citem:hover { border-color: var(--st-accent); }
.citem.on { background: var(--st-accent); border-color: var(--st-accent); color: var(--st-on-accent, #fff); }
.crow { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--st-muted); }
.crow input[type='range'] { flex: 1; accent-color: var(--st-accent); }
.crow input[type='number'] { width: 54px; background: var(--st-input); border: 1px solid var(--st-border); color: var(--st-text); border-radius: 4px; padding: 3px; font-size: 11px; }
.ckrow { gap: 12px; }
.cdiv { border-top: 1px solid var(--st-border); margin: 3px 0; }
.cgroup { font-size: 9px; text-transform: uppercase; letter-spacing: .5px; color: var(--st-muted); }
.chint { margin: 2px 0 0; font-size: 10px; line-height: 1.4; color: var(--st-muted); }
.cic { display: inline-flex; align-items: center; justify-content: center; background: var(--st-btn); border: 1px solid var(--st-border); color: var(--st-text); border-radius: 4px; width: 26px; height: 24px; cursor: pointer; }
.cic:hover { border-color: var(--st-accent); }

.stage {
  position: relative; width: 100%; background: var(--st-input);
  border: 1px solid var(--st-border); border-radius: 6px; overflow: hidden;
  touch-action: none; user-select: none; cursor: crosshair;
}
.stage.dragging { cursor: grabbing; }
.stage:focus { outline: none; }
.backdrop { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
.grid {
  position: absolute; inset: 0; pointer-events: none;
  background-image: linear-gradient(to right, rgba(128,128,128,.18) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(128,128,128,.18) 1px, transparent 1px);
  background-size: 10% 10%;
}
.box { position: absolute; border: 2px solid; box-sizing: border-box; cursor: move; background: transparent; transition: background .1s; }
.box:hover { background: var(--fill); }
.box.sel { background: var(--fill); box-shadow: 0 0 0 1.5px var(--st-accent, #3b82f6); z-index: 4; }
.box.primary { box-shadow: 0 0 0 1px #fff, 0 0 0 2px var(--st-accent, #3b82f6), 0 0 10px rgba(0,0,0,.6); z-index: 5; }
.box.muted { opacity: 0.32; border-style: dashed; background: transparent !important; }
.box.muted .tag { opacity: 0.6; }
.box.draft { border-style: dashed; opacity: 0.8; pointer-events: none; background: rgba(156,163,175,.12); }
.tag {
  position: absolute; top: 0; left: 0; transform: translateY(-100%);
  font-size: 10px; line-height: 1.4; padding: 1px 5px; white-space: nowrap;
  max-width: 220px; overflow: hidden; text-overflow: ellipsis;
  border-radius: 3px 3px 0 0; pointer-events: none;
}
.h { position: absolute; width: 11px; height: 11px; background: #fff; border: 1px solid #333; border-radius: 2px; }
.h-nw { top: -6px; left: -6px; cursor: nwse-resize; }
.h-n  { top: -6px; left: 50%; margin-left: -5px; cursor: ns-resize; }
.h-ne { top: -6px; right: -6px; cursor: nesw-resize; }
.h-e  { top: 50%; right: -6px; margin-top: -5px; cursor: ew-resize; }
.h-se { bottom: -6px; right: -6px; cursor: nwse-resize; }
.h-s  { bottom: -6px; left: 50%; margin-left: -5px; cursor: ns-resize; }
.h-sw { bottom: -6px; left: -6px; cursor: nesw-resize; }
.h-w  { top: 50%; left: -6px; margin-top: -5px; cursor: ew-resize; }
</style>
