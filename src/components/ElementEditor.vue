<template>
  <UiCard v-if="el">
    <template #header>
      <div class="ehead">
        <label class="color" :title="'Box color' + (linked ? ' (shared with link group)' : '')">
          <span class="chip" :style="{ background: el.boxColor }"></span>
          <input type="color" :value="el.boxColor" @input="setShared('boxColor', ($event.target as HTMLInputElement).value)" />
        </label>
        <span class="lbl">{{ index + 1 }}</span>
        <div class="seg">
          <UiButton icon :active="el.type === 'obj'" title="Object" @click="setShared('type', 'obj')"><i class="mdi mdi-shape-outline"></i></UiButton>
          <UiButton icon :active="el.type === 'text'" title="Text" @click="setShared('type', 'text')"><i class="mdi mdi-format-text"></i></UiButton>
        </div>
        <span class="grow"></span>
        <UiButton icon title="Linked copy — shares prompt, keeps its own position" @click="store.duplicateLinked(el.id)"><i class="mdi mdi-link-variant-plus"></i></UiButton>
        <UiButton v-if="linked" title="Unlink from group" @click="store.unlink(el.id)"><i class="mdi mdi-link-variant-off"></i> ×{{ groupSize }}</UiButton>
        <button class="mute" :class="{ off: el.enabled === false }" :title="el.enabled === false ? 'Muted — excluded from output. Click to enable.' : 'Mute (keep but exclude from output)'" @click="store.toggleEnabled(el.id)">
          <i class="mdi" :class="el.enabled === false ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"></i>
        </button>
      </div>
    </template>

    <div class="erow">
      <label class="bbtoggle" :title="el.bbox ? 'Remove bbox (let the model auto-place)' : 'Add a default bbox'">
        <input type="checkbox" :checked="!!el.bbox" @change="toggleBbox" /> bbox
      </label>
      <span v-if="el.bbox" class="coords">
        <input v-for="(k, i) in ['y₀', 'x₀', 'y₁', 'x₁']" :key="i" type="number" min="0" max="1000" :title="k" :value="el.bbox[i]" @input="setBbox(i, ($event.target as HTMLInputElement).value)" />
      </span>
      <span v-else class="autohint">model auto-places it</span>
    </div>

    <label v-if="el.type === 'text'" class="filine">
      <span>text</span>
      <input :value="el.text" type="text" placeholder="literal text the model should draw"
        @input="setShared('text', ($event.target as HTMLInputElement).value)" />
    </label>
    <label class="filine">
      <span>desc</span>
      <textarea :value="el.desc" rows="2" :placeholder="el.type === 'text' ? 'how the text looks (font, colour, placement)' : 'detailed description of this object'"
        @input="setShared('desc', ($event.target as HTMLTextAreaElement).value)"></textarea>
    </label>
    <!-- div, not label: a label would hijack clicks (incl. the swatch ×) to the first colour input -->
    <div class="filine">
      <span>colours</span>
      <PaletteEditor :modelValue="el.color_palette" :max="5" label="element colours"
        @update:modelValue="setShared('color_palette', $event)" />
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useStudioStore, SHARED_KEYS } from '@/lib/store'
import UiCard from './ui/UiCard.vue'
import UiButton from './ui/UiButton.vue'
import PaletteEditor from './PaletteEditor.vue'

const store = useStudioStore()
const el = computed(() => store.getElement(store.selectedId))
const index = computed(() => store.state.elements.findIndex((e) => e.id === store.selectedId))
const linked = computed(() => !!el.value?.linkId)
const groupSize = computed(() => (el.value ? store.linkGroupSize(el.value.id) : 1))

function setShared(key: (typeof SHARED_KEYS)[number], value: unknown) {
  if (el.value) store.setShared(el.value.id, key, value)
}
function toggleBbox(e: Event) {
  if (!el.value) return
  el.value.bbox = (e.target as HTMLInputElement).checked ? [300, 300, 700, 700] : null
}
function setBbox(i: number, raw: string) {
  if (!el.value?.bbox) return
  el.value.bbox[i] = Math.max(0, Math.min(1000, Math.round(Number(raw) || 0)))
}
</script>

<style scoped>
.ehead { display: flex; align-items: center; gap: 8px; width: 100%; }
.grow { flex: 1 1 auto; }
.color { position: relative; width: 22px; height: 22px; cursor: pointer; flex: none; }
.color .chip { display: block; width: 22px; height: 22px; border-radius: 5px; border: 1px solid var(--st-border); }
.color input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.lbl { font-size: 12px; color: var(--st-text); font-weight: 600; }
.seg { display: flex; gap: 2px; }
/* icon-sized to match UiButton.icon, with green/red state the shared button can't express */
.mute {
  display: inline-flex; align-items: center; justify-content: center; flex: none;
  min-width: 26px; height: 24px; padding: 0 6px; box-sizing: border-box;
  background: var(--st-btn); color: #34d399; border: 1px solid var(--st-border);
  border-radius: 5px; font-size: 12px; cursor: pointer;
}
.mute:hover { border-color: var(--st-accent); }
.mute.off { color: #f87171; }
.mute .mdi { font-size: 15px; line-height: 1; }

.erow { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.bbtoggle { font-size: 11px; color: var(--st-muted); display: flex; gap: 4px; align-items: center; }
.coords { display: inline-flex; gap: 4px; }
.coords input { width: 46px; background: var(--st-input); border: 1px solid var(--st-border); color: var(--st-text); border-radius: 4px; padding: 3px; font-size: 11px; }
.autohint { font-size: 10px; color: var(--st-muted); font-style: italic; }

/* label left, control fills right — keeps each field to one tidy line */
.filine { display: flex; gap: 8px; align-items: flex-start; font-size: 11px; color: var(--st-muted); }
.filine > span { width: 54px; flex: none; padding-top: 5px; text-align: right; }
.filine input[type='text'], .filine textarea {
  flex: 1; background: var(--st-input); border: 1px solid var(--st-border); color: var(--st-text);
  border-radius: 5px; padding: 6px; font-size: 12px; resize: vertical; font-family: inherit;
}
.filine :deep(.palette) { flex: 1; }
</style>
