<template>
  <div class="palnode">
    <PaletteEditor :modelValue="colors" :max="16" label="palette colours" @update:modelValue="colors = $event" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import PaletteEditor from './PaletteEditor.vue'

const props = defineProps<{ widget: any; node?: any }>()
const colors = ref<string[]>([])

onMounted(() => {
  const v = props.widget?.value
  if (Array.isArray(v)) colors.value = v.map(String)
  props.widget.serializeValue = async () => colors.value.slice()
  watch(
    colors,
    () => {
      props.widget.value = colors.value.slice()
    },
    { deep: true, immediate: true },
  )
})
</script>

<style scoped>
/* standalone node (not inside .studio) — define the theme tokens locally so the
   shared PaletteEditor styles resolve and stay light/dark aware. */
.palnode {
  --st-bg: var(--comfy-menu-bg, #1a1a1f);
  --st-panel: var(--comfy-menu-secondary-bg, #202026);
  --st-input: var(--comfy-input-bg, #15151a);
  --st-btn: var(--comfy-input-bg, #2a2a30);
  --st-text: var(--input-text, #e5e5ea);
  --st-muted: var(--descrip-text, #9aa0aa);
  --st-border: var(--border-color, #3a3a44);
  --st-accent: var(--p-primary-color, #3b82f6);
  --st-on-accent: #fff;
  /* extra top room so the swatch remove (×), which overhangs by 6px, isn't clipped */
  padding: 11px 8px 6px; box-sizing: border-box; width: 100%;
  font-family: var(--p-font-family, -apple-system, system-ui, sans-serif); color: var(--st-text);
}
</style>
