<template>
  <div class="studio" ref="rootEl" :class="{ 'panel-open': panelOpen }" @contextmenu.prevent.stop>
    <div class="main">
      <div class="left" ref="leftEl">
        <BBoxCanvas>
          <template #lead>
            <UiButton icon :disabled="!store.canUndo" title="Undo (Ctrl+Z)" @click="store.undo()"><i class="mdi mdi-undo"></i></UiButton>
            <UiButton icon :disabled="!store.canRedo" title="Redo (Ctrl+Shift+Z)" @click="store.redo()"><i class="mdi mdi-redo"></i></UiButton>
            <span class="divider"></span>
            <UiPopover align="left">
              <template #trigger><UiButton title="Resolution — aspect ratio × megapixels">{{ store.state.width }}×{{ store.state.height }} ▾</UiButton></template>
              <div class="resmenu">
                <div class="rsec">aspect ratio</div>
                <div class="aspects">
                  <button v-for="a in CORE_ASPECTS" :key="a.label" class="achip" :class="{ on: aspect === a.label }" :title="a.label + ' · ' + a.name" @click="setAspect(a.label)">
                    <span class="arect" :style="aspectRectStyle(a)"></span>
                    <span class="albl">{{ a.label }}</span>
                  </button>
                </div>
                <div class="rdiv"></div>
                <div class="mprow"><span>megapixels</span>
                  <div class="mppresets">
                    <button v-for="p in MP_PRESETS" :key="p" class="mpp" :class="{ on: mp === p }" @click="setMp(p)">{{ p }}</button>
                  </div>
                  <input type="number" min="0.1" max="16" step="0.1" v-model.number="mp" @input="applyRes" />
                </div>
                <div class="whrow">
                  <label><span>W</span><input type="number" min="16" max="8192" step="16" v-model.number="store.state.width" @change="onWH" /></label>
                  <button class="swap" title="Swap width &amp; height (flip orientation)" @click="swapWH"><i class="mdi mdi-swap-horizontal"></i></button>
                  <label><span>H</span><input type="number" min="16" max="8192" step="16" v-model.number="store.state.height" @change="onWH" /></label>
                </div>
                <div class="rfoot">
                  <span class="rmp">≈ {{ mpActual }} MP</span>
                  <span class="grow"></span>
                  <span class="snaplbl" title="Round width &amp; height to a multiple of this (your model/VAE's requirement); lower = closer to the exact MP">snap ÷</span>
                  <button v-for="d in SNAP_OPTIONS" :key="d" class="snapchip" :class="{ on: snapDiv === d }" @click="snapDiv = d">{{ d }}</button>
                </div>
              </div>
            </UiPopover>
          </template>

          <template #trail>
            <UiButton icon title="Library — save / load bbox templates" @click="libraryOpen = true"><i class="mdi mdi-bookshelf"></i></UiButton>
            <UiPopover align="right">
              <template #trigger><UiButton icon title="Help"><i class="mdi mdi-help-circle-outline"></i></UiButton></template>
              <div class="help">
                <p class="h">Canvas</p>
                <dl>
                  <dt>drag empty space</dt><dd>box-select (marquee); hold shift to add</dd>
                  <dt>ctrl / ⌘ + drag</dt><dd>draw a new box</dd>
                  <dt>drag a box</dt><dd>move it</dd>
                  <dt>drag a handle</dt><dd>resize</dd>
                  <dt>click</dt><dd>select; ctrl / shift click to multi-select</dd>
                  <dt>click again</dt><dd>cycle through stacked / overlapping boxes</dd>
                </dl>
                <p class="h">Keyboard</p>
                <dl>
                  <dt>ctrl / ⌘ + C / V</dt><dd>copy / paste the selection (pastes at the cursor)</dd>
                  <dt>ctrl / ⌘ + G</dt><dd>group the selected boxes · + shift to ungroup</dd>
                  <dt>ctrl / ⌘ + Z</dt><dd>undo · + shift to redo</dd>
                  <dt>Delete / Backspace</dt><dd>remove the selected box(es)</dd>
                </dl>
                <p class="h">Boxes</p>
                <dl>
                  <dt><i class="mdi mdi-eye-outline"></i> mute</dt><dd>keep a box but exclude it from the output</dd>
                  <dt><i class="mdi mdi-link-variant-plus"></i> linked copy</dt><dd>shares the prompt across copies; each keeps its own position</dd>
                  <dt><i class="mdi mdi-group"></i> grouped</dt><dd>members select, move &amp; resize together</dd>
                </dl>
                <p class="h">Reference</p>
                <dl>
                  <dt><i class="mdi mdi-image-outline"></i> image</dt><dd>load an image to trace over (or drop one on the canvas)</dd>
                  <dt><i class="mdi mdi-sync"></i> sync</dt><dd>auto-update the reference from an <b>Ideogram Studio Ref Sync</b> node</dd>
                  <dt><i class="mdi mdi-television-play"></i> live preview</dt><dd>show the in-progress preview of the sampler feeding your <b>Ref Sync</b> node, until the final image syncs in</dd>
                </dl>
                <p class="h">Outputs</p>
                <dl>
                  <dt>caption</dt><dd>JSON prompt → your Ideogram sampler</dd>
                  <dt>extras</dt><dd>→ <b>Studio Extras</b> node for overlay / alpha / width / height</dd>
                </dl>
                <p class="tip">Tip: open the JSON card and paste a caption to import it.</p>
                <p class="credit">
                  made by <b>nynxz</b> · ideas &amp; inspiration from the community<br />
                  <a href="https://github.com/nynxz/ComfyUI-IdeogramHelper/issues" target="_blank" rel="noopener noreferrer">report a bug / suggest a feature ↗</a>
                </p>
              </div>
            </UiPopover>
            <UiPopover align="right">
              <template #trigger><UiButton icon title="Clear everything"><i class="mdi mdi-broom"></i></UiButton></template>
              <template #default="{ close }">
                <div class="resetc">
                  <p class="rq"><i class="mdi mdi-alert-outline"></i> Clear the whole studio?</p>
                  <p class="rh">Removes every element and resets the prompt — can't be undone past here.</p>
                  <div class="rbtns">
                    <button class="rno" @click="close()">Cancel</button>
                    <button class="ryes" @click="resetAll(); close()"><i class="mdi mdi-broom"></i> Clear all</button>
                  </div>
                </div>
              </template>
            </UiPopover>
            <span class="slim-controls"><UiButton icon :title="panelOpen ? 'Hide controls' : 'Show controls'" @click="panelOpen = !panelOpen"><i class="mdi mdi-dock-right"></i></UiButton></span>
          </template>
        </BBoxCanvas>
      </div>
      <div class="right" ref="rightEl">
        <PromptFields />
        <StylePanel />
        <ElementList />
        <JsonControls />
      </div>
      <!-- slim mode (container query): tap-outside backdrop to close the drawer;
           scoped to .main so it doesn't cover the JSON/editor below -->
      <div class="drawer-backdrop" @click="panelOpen = false"></div>
    </div>

    <!-- mutually exclusive with the JSON view so the two don't stack and inflate height -->
    <ElementEditor v-if="!store.state.ui.jsonOpen" />

    <JsonPreview />
    <ElementContextMenu />
    <StudioLibrary v-model:open="libraryOpen" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { createStudioStore, provideStudioStore } from '@/lib/store'
import { buildCaption, emptyState, type CaptionState } from '@/lib/caption'
import { jsonSyncCaption } from '@/lib/refSync'
import UiButton from '../ui/UiButton.vue'
import UiPopover from '../ui/UiPopover.vue'
import BBoxCanvas from '../editor/BBoxCanvas.vue'
import StudioLibrary from './StudioLibrary.vue'
import PromptFields from '../editor/PromptFields.vue'
import StylePanel from '../editor/StylePanel.vue'
import ElementList from '../editor/ElementList.vue'
import JsonControls from './JsonControls.vue'
import ElementEditor from '../editor/ElementEditor.vue'
import JsonPreview from './JsonPreview.vue'
import ElementContextMenu from '../editor/ElementContextMenu.vue'

const props = defineProps<{ widget: any; node?: any }>()

const store = createStudioStore()
provideStudioStore(store)

const rootEl = ref<HTMLElement | null>(null)
const libraryOpen = ref(false)
const panelOpen = ref(false) // slim-mode sidebar drawer open/closed
const leftEl = ref<HTMLElement | null>(null)
const rightEl = ref<HTMLElement | null>(null)

// No JS height-sync: sidebar height left to CSS/content so the node can shrink.
// Capture undo/redo keys before the graph; capture phase + stopImmediatePropagation
// so the graph's own undo doesn't also fire. Text fields keep native undo.
function onUndoKey(e: KeyboardEvent) {
  if (!(e.ctrlKey || e.metaKey)) return
  const k = e.key.toLowerCase()
  if (k !== 'z' && k !== 'y') return
  const root = rootEl.value
  const ae = document.activeElement
  if (!root || !ae || !root.contains(ae)) return
  const tag = (ae as HTMLElement).tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || (ae as HTMLElement).isContentEditable) return
  const redo = k === 'y' || (k === 'z' && e.shiftKey)
  if (redo) store.redo()
  else store.undo()
  e.preventDefault()
  e.stopImmediatePropagation()
}
onMounted(() => document.addEventListener('keydown', onUndoKey, true))
onBeforeUnmount(() => document.removeEventListener('keydown', onUndoKey, true))

watch(
  () => jsonSyncCaption.value.n,
  () => {
    if (!store.state.ui.jsonSync) return
    const { json, width, height } = jsonSyncCaption.value
    if (json && json.trim()) {
      const res = store.importCaptionJson(json, false) // keep resolution (handled below)
      store.json.syncError = res.ok ? '' : `JSON sync: ${res.error || 'invalid JSON'}`
    }
    // force-pushed resolution (0 = leave as-is)
    if (width > 0) store.state.width = Math.max(16, Math.min(8192, Math.round(width)))
    if (height > 0) store.state.height = Math.max(16, Math.min(8192, Math.round(height)))
  },
)

// total = MP × 1024², exact-ratio scale, /16 round
const CORE_ASPECTS = [
  { label: '1:1', name: 'square', w: 1, h: 1 },
  { label: '3:2', name: 'photo', w: 3, h: 2 },
  { label: '4:3', name: 'standard', w: 4, h: 3 },
  { label: '16:9', name: 'widescreen', w: 16, h: 9 },
  { label: '21:9', name: 'ultrawide', w: 21, h: 9 },
  { label: '2:3', name: 'portrait', w: 2, h: 3 },
  { label: '3:4', name: 'portrait', w: 3, h: 4 },
  { label: '9:16', name: 'portrait', w: 9, h: 16 },
]
const aspect = ref('1:1')
const mp = ref(1)
const MP_PRESETS = [0.5, 1, 2, 4]
const mpActual = computed(() => ((store.state.width * store.state.height) / (1024 * 1024)).toFixed(2))
function aspectRectStyle(a: { w: number; h: number }) {
  const s = 15 / Math.max(a.w, a.h)
  return { width: Math.round(a.w * s) + 'px', height: Math.round(a.h * s) + 'px' }
}
function setAspect(label: string) {
  aspect.value = label
  applyRes()
}
function setMp(p: number) {
  mp.value = p
  applyRes()
}
function swapWH() {
  const w = store.state.width
  store.state.width = store.state.height
  store.state.height = w
  seedRes()
}
function onWH() {
  store.state.width = snapRes(store.state.width)
  store.state.height = snapRes(store.state.height)
  seedRes()
}
// Round width/height to a chosen multiple so the canvas matches generation output
// (VAEs/models round to 8/16/32/64). Lower divisor → closer to the exact MP.
const SNAP_OPTIONS = [8, 16, 32, 64]
const snapDiv = ref<number>(((store.state.ui as any).snapDiv as number) || 16)
watch(snapDiv, (v) => {
  ;(store.state.ui as any).snapDiv = v
  applyRes()
})
const snapRes = (v: number) => {
  const d = snapDiv.value || 1
  return Math.max(d, Math.round(v / d) * d)
}
function applyRes() {
  const a = CORE_ASPECTS.find((x) => x.label === aspect.value) || CORE_ASPECTS[0]
  const total = Math.max(0.1, mp.value || 1) * 1024 * 1024
  const scale = Math.sqrt(total / (a.w * a.h))
  store.state.width = snapRes(a.w * scale)
  store.state.height = snapRes(a.h * scale)
}
function seedRes() {
  // reflect current dims in the aspect/MP controls without resizing
  const w = store.state.width
  const h = store.state.height
  mp.value = Math.max(0.1, Number((((w * h) / (1024 * 1024))).toFixed(2)))
  const r = w / h
  aspect.value = CORE_ASPECTS.reduce(
    (best, x) => (Math.abs(x.w / x.h - r) < Math.abs(best.w / best.h - r) ? x : best),
    CORE_ASPECTS[0],
  ).label
}

function plainState(): CaptionState {
  return JSON.parse(JSON.stringify(store.state))
}
function resetAll() {
  store.load(emptyState())
  store.select(null)
  store.resetHistory()
}

let snapTimer: ReturnType<typeof setTimeout> | undefined
function scheduleSnapshot() {
  clearTimeout(snapTimer)
  snapTimer = setTimeout(() => store.snapshot(), 350)
}

onMounted(() => {
  const v = props.widget?.value
  if (v && typeof v === 'object' && v.studio) {
    store.load(v.studio)
  }
  seedRes()
  store.resetHistory()

  props.widget.serializeValue = async () => {
    const { caption } = buildCaption(store.state)
    return { caption, studio: plainState() }
  }

  watch(
    () => store.state,
    () => {
      const { caption } = buildCaption(store.state)
      props.widget.value = { caption, studio: plainState() }
      if (!store.restoring) scheduleSnapshot()
    },
    { deep: true, immediate: true },
  )
})
</script>

<style scoped>
/* Map ComfyUI theme vars to semantic names (dark fallbacks); inherited by children. */
.studio {
  --st-bg: var(--comfy-menu-bg, #1a1a1f);
  --st-panel: var(--comfy-menu-secondary-bg, #202026);
  --st-input: var(--comfy-input-bg, #15151a);
  --st-btn: var(--comfy-input-bg, #2a2a30);
  --st-text: var(--input-text, #e5e5ea);
  --st-muted: var(--descrip-text, #9aa0aa);
  --st-border: var(--border-color, #3a3a44);
  --st-accent: var(--p-primary-color, #3b82f6);
  --st-radius: var(--radius-md, 6px);
  --st-on-accent: #fff;

  display: flex; flex-direction: column; gap: 9px; padding: 10px;
  font-family: var(--p-font-family, -apple-system, system-ui, sans-serif); color: var(--st-text);
  /* transparent so the node body shows through the gaps between cards */
  background: transparent; box-sizing: border-box;
  /* definite height so inner flex areas scroll; overflow-y is the small-node safety net */
  width: 100%; height: 100%; overflow-y: auto; overflow-x: hidden; position: relative;
  container-type: inline-size; /* width queries respond to the NODE, not the viewport */
  cursor: default;
}
.studio :deep(textarea),
.studio :deep(input[type='text']),
.studio :deep(input[type='number']) { cursor: text; }
.studio :deep(select),
.studio :deep(input[type='checkbox']),
.studio :deep(input[type='range']),
.studio :deep(input[type='color']) { cursor: pointer; }
.divider { width: 1px; height: 18px; background: var(--st-border); margin: 0 2px; }
.help .h { margin: 8px 0 3px; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: var(--st-accent); font-weight: 700; }
.help .h:first-child { margin-top: 0; }
.help dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 2px 8px; }
.help dt { color: var(--st-text); font-weight: 600; white-space: nowrap; }
.help dt .mdi { font-size: 13px; color: var(--st-muted); }
.help dd { margin: 0; color: var(--st-muted); }
.help .tip { margin: 9px 0 0; color: var(--st-muted); border-top: 1px solid var(--st-border); padding-top: 7px; }
.help .credit { margin: 9px 0 0; font-size: 10px; color: var(--st-muted); line-height: 1.6; }
.help .credit a { color: var(--st-accent); text-decoration: none; }
.help .credit a:hover { text-decoration: underline; }
/* resolution picker */
.resmenu { display: flex; flex-direction: column; gap: 8px; width: 244px; }
.resmenu .rsec { font-size: 10px; text-transform: uppercase; letter-spacing: .4px; color: var(--st-muted); font-weight: 700; }
.resmenu .rdiv { border-top: 1px solid var(--st-border); margin: 1px 0; }
.aspects { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; }
.achip {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  height: 44px; background: var(--st-input); border: 1px solid var(--st-border); border-radius: 6px;
  color: var(--st-muted); font-size: 10px; font-weight: 600; cursor: pointer; font-family: inherit;
  transition: border-color .1s, color .1s, background .1s;
}
.achip:hover { border-color: var(--st-accent); color: var(--st-text); }
.achip.on { border-color: var(--st-accent); color: var(--st-text); background: color-mix(in srgb, var(--st-accent) 16%, var(--st-input)); }
.achip .arect { display: block; background: currentColor; border-radius: 1px; opacity: .65; }
.achip.on .arect { opacity: 1; }
.albl { font-variant-numeric: tabular-nums; }
.mprow { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--st-muted); }
.mppresets { display: flex; gap: 3px; margin-left: auto; }
.mpp { background: var(--st-input); border: 1px solid var(--st-border); color: var(--st-muted); border-radius: 5px; padding: 3px 7px; font-size: 10px; cursor: pointer; font-family: inherit; }
.mpp:hover { border-color: var(--st-accent); color: var(--st-text); }
.mpp.on { border-color: var(--st-accent); color: var(--st-text); background: color-mix(in srgb, var(--st-accent) 16%, var(--st-input)); }
.mprow > input { width: 54px; background: var(--st-input); border: 1px solid var(--st-border); color: var(--st-text); border-radius: 5px; padding: 4px; font-size: 11px; }
.whrow { display: flex; align-items: center; gap: 6px; }
.whrow label { display: flex; align-items: center; gap: 5px; flex: 1; font-size: 11px; color: var(--st-muted); }
.whrow label span { width: 11px; text-align: center; }
.whrow label input { width: 100%; min-width: 0; background: var(--st-input); border: 1px solid var(--st-border); color: var(--st-text); border-radius: 5px; padding: 5px; font-size: 11px; }
.whrow .swap { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; flex: none; background: var(--st-input); border: 1px solid var(--st-border); color: var(--st-muted); border-radius: 5px; cursor: pointer; }
.whrow .swap:hover { border-color: var(--st-accent); color: var(--st-accent); }
.whrow .swap .mdi { font-size: 15px; }
/* footer: computed MP readout (left) + compact snap-divisor chips (right) */
.rfoot { display: flex; align-items: center; gap: 4px; font-size: 10px; color: var(--st-muted); }
.rfoot .rmp { font-variant-numeric: tabular-nums; }
.rfoot .snaplbl { letter-spacing: .2px; }
.snapchip { background: var(--st-input); border: 1px solid var(--st-border); color: var(--st-muted); border-radius: 4px; padding: 1px 5px; font-size: 10px; cursor: pointer; font-family: inherit; font-variant-numeric: tabular-nums; }
.snapchip:hover { border-color: var(--st-accent); color: var(--st-text); }
.snapchip.on { border-color: var(--st-accent); color: var(--st-text); background: color-mix(in srgb, var(--st-accent) 16%, var(--st-input)); }
.resetc { width: 212px; display: flex; flex-direction: column; gap: 6px; }
.resetc .rq { margin: 0; display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: var(--st-text); }
.resetc .rq .mdi { color: #f59e0b; font-size: 15px; }
.resetc .rh { margin: 0; font-size: 10px; line-height: 1.45; color: var(--st-muted); }
.resetc .rbtns { display: flex; gap: 6px; margin-top: 2px; }
.resetc .rbtns button { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 4px; border-radius: 6px; padding: 6px 8px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit; border: 1px solid var(--st-border); }
.resetc .rno { background: var(--st-btn); color: var(--st-text); }
.resetc .rno:hover { border-color: var(--st-accent); }
.resetc .ryes { background: #dc2626; color: #fff; border-color: #dc2626; }
.resetc .ryes:hover { background: #ef4444; }
.resetc .ryes .mdi { font-size: 13px; }
/* overlay settings */
.adv { display: flex; flex-direction: column; gap: 7px; font-size: 11px; color: var(--st-muted); width: 220px; }
.adv .ahint { margin: 0; font-size: 10px; line-height: 1.45; color: var(--st-muted); }
.adv .gh { font-size: 10px; text-transform: uppercase; letter-spacing: .4px; color: var(--st-muted); }
.adv .orow { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.adv .ochecks { display: flex; gap: 12px; }
.adv input[type='number'] { width: 60px; background: var(--st-input); border: 1px solid var(--st-border); color: var(--st-text); border-radius: 4px; padding: 3px; font-size: 11px; }
.adv input[type='range'] { width: 100px; accent-color: var(--st-accent); }
.adv .ck { display: flex; align-items: center; gap: 4px; }
.acc { display: flex; align-items: center; gap: 4px; background: none; border: none; cursor: pointer; color: var(--st-muted); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; padding: 0; }
.acc:hover { color: var(--st-text); }
.acc .mdi { font-size: 16px; line-height: 1; margin-left: -3px; }
/* align-items:stretch makes the sidebar fill the row height; the elements list (flex:1)
   absorbs slack and JSON sits at the bottom. Floor is the widget minHeight, not this. */
.main { display: grid; grid-template-columns: minmax(0, 1fr) minmax(220px, 300px); gap: 12px; align-items: stretch; }
.left { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.right { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.rspacer { flex: 1 1 auto; } /* pins JSON to the bottom when elements is collapsed */
/* drawer affordances hidden in normal (wide) mode */
.slim-controls, .drawer-backdrop { display: none; }

/* slim node (container query → responds to the NODE width): canvas goes full-width,
   the sidebar becomes a drawer that slides over the canvas from a thin edge tab */
@container (max-width: 520px) {
  /* position:relative → the drawer/tab/backdrop anchor to the canvas area, not the
     whole studio, so they don't cover (or grow with) the JSON/editor sections below */
  .main { grid-template-columns: 1fr; position: relative; }
  .slim-controls { display: contents; }   /* toolbar opener appears */
  .right {
    position: absolute; top: 0; bottom: 0; right: -10px;  /* flush to the node edge (escape the 10px studio padding) */
    width: min(290px, 88cqw); z-index: 45;
    box-sizing: border-box; overflow-y: auto; padding: 8px;
    background: var(--st-panel); border-radius: 10px 0 0 10px;
    transform: translateX(110%); transition: transform .2s ease;
  }
  .studio.panel-open .right { transform: translateX(0); }
  .studio.panel-open .drawer-backdrop {
    display: block; position: absolute; inset: 0; z-index: 44;
    background: color-mix(in srgb, var(--st-bg, #1a1a1f) 35%, transparent);
  }
}
</style>

<!-- non-scoped: themed scrollbars for every scroll area inside the studio -->
<style>
.studio ::-webkit-scrollbar { width: 9px; height: 9px; }
.studio ::-webkit-scrollbar-track { background: transparent; }
.studio ::-webkit-scrollbar-thumb {
  background: var(--st-border, #3a3a44); border-radius: 6px;
  border: 2px solid transparent; background-clip: padding-box;
}
.studio ::-webkit-scrollbar-thumb:hover { background: var(--st-muted, #9aa0aa); background-clip: padding-box; }
.studio ::-webkit-scrollbar-corner { background: transparent; }
.studio * { scrollbar-width: thin; scrollbar-color: var(--st-border, #3a3a44) transparent; }
</style>
