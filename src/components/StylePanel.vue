<template>
  <UiCard>
    <template #header>
      <label class="en"><input type="checkbox" v-model="st.enabled" /> style</label>
      <div v-if="st.enabled" class="hgroup">
        <div class="seg">
          <UiButton :active="st.mode === 'photo'" @click="st.mode = 'photo'">photo</UiButton>
          <UiButton :active="st.mode === 'art'" @click="st.mode = 'art'">art</UiButton>
        </div>
        <UiButton icon :active="showPresets" title="Show preset pickers" @click="ui.showPresets = !ui.showPresets"><i class="mdi mdi-lightbulb-on-outline"></i></UiButton>
      </div>
    </template>

    <template v-if="st.enabled">
      <div class="field"><span>aesthetics</span>
        <ComboInput v-model="st.aesthetics" :options="opts(PRESETS.aesthetics)" placeholder="moody, cinematic, desaturated" />
      </div>
      <div class="field"><span>lighting</span>
        <ComboInput v-model="st.lighting" :options="opts(PRESETS.lighting)" placeholder="golden hour, rim light, soft shadows" />
      </div>
      <div v-if="st.mode === 'photo'" class="field"><span>photo (camera / lens)</span>
        <ComboInput v-model="st.photo" :options="opts(PRESETS.camera)" placeholder="35mm, f/1.4, shallow depth of field" />
      </div>
      <div class="field"><span>medium</span>
        <ComboInput v-model="st.medium" :options="opts(PRESETS.medium)" :placeholder="st.mode === 'photo' ? 'photograph' : 'illustration / 3d_render / painting…'" />
      </div>
      <div v-if="st.mode === 'art'" class="field"><span>art_style</span>
        <ComboInput v-model="st.art_style" :options="opts(PRESETS.artStyle)" placeholder="flat vector illustration, bold outlines" />
      </div>
      <div class="field"><span>color palette (max 16)</span>
        <PaletteEditor v-model="st.color_palette" :max="16" label="image colors" />
      </div>
    </template>
  </UiCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useStudioStore } from '@/lib/store'
import UiCard from './ui/UiCard.vue'
import UiButton from './ui/UiButton.vue'
import PaletteEditor from './PaletteEditor.vue'
import ComboInput from './ComboInput.vue'
import { PRESETS } from '@/lib/presets'

const store = useStudioStore()
// computed (template auto-unwraps) so it survives store.load() replacing style
const st = computed(() => store.state.style)
const ui = computed(() => store.state.ui)
const showPresets = computed(() => store.state.ui.showPresets)
// presets are opt-in (toggle in the header); empty options hides the picker
const opts = (list: string[]) => (showPresets.value ? list : [])
</script>

<style scoped>
.en { font-size: 12px; color: var(--st-text); display: flex; gap: 5px; align-items: center; font-weight: 600; }
.hgroup { display: flex; gap: 6px; align-items: center; }
.seg { display: flex; gap: 2px; }
.field { display: flex; flex-direction: column; gap: 3px; font-size: 11px; color: var(--st-muted); }
.field input { background: var(--st-input); border: 1px solid var(--st-border); color: var(--st-text); border-radius: 5px; padding: 6px; font-size: 12px; }
</style>
