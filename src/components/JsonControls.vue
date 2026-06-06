<template>
  <div class="jctrl">
    <span class="jlabel">json</span>
    <span v-if="!j.editing" class="warns" :class="{ ok: !warnings.length }" :title="warnings.join('\n')">
      {{ warnings.length ? `⚠ ${warnings.length}` : '✓ valid' }}
    </span>
    <span v-else class="warns" :class="{ ok: !parseError }">{{ parseError ? '✗ invalid' : '✓ parses' }}</span>
    <span v-if="j.syncError" class="syncerr" :title="j.syncError">⚠ sync failed</span>
    <span class="grow"></span>
    <template v-if="!j.editing">
      <UiButton icon :active="store.state.ui.jsonSync" title="Live-import captions from an Ideogram Studio JSON Sync node" @click="toggleSync"><i class="mdi mdi-sync"></i></UiButton>
      <UiButton icon :title="copied ? 'Copied' : 'Copy JSON'" @click="copy"><i class="mdi" :class="copied ? 'mdi-check' : 'mdi-content-copy'"></i></UiButton>
      <UiButton @click="store.jsonStartEdit()">edit / paste</UiButton>
      <UiButton icon :title="store.state.ui.jsonOpen ? 'Hide JSON' : 'Show JSON'" @click="store.state.ui.jsonOpen = !store.state.ui.jsonOpen"><i class="mdi" :class="store.state.ui.jsonOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'"></i></UiButton>
    </template>
    <template v-else>
      <UiButton title="Re-indent the JSON" @click="store.jsonTidy()">tidy</UiButton>
      <UiButton variant="primary" :disabled="!!parseError" @click="store.jsonApply()">apply →</UiButton>
      <UiButton @click="store.jsonCancel()">cancel</UiButton>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStudioStore } from '@/lib/store'
import { serialize } from '@/lib/caption'
import UiButton from './ui/UiButton.vue'

const store = useStudioStore()
const j = store.json
const copied = ref(false)
const warnings = computed(() => serialize(store.state).warnings)
const parseError = computed(() => {
  if (!j.editing || !j.draft.trim()) return ''
  try {
    JSON.parse(j.draft)
    return ''
  } catch (e: any) {
    return String(e?.message || e)
  }
})
function toggleSync() {
  store.state.ui.jsonSync = !store.state.ui.jsonSync
  if (!store.state.ui.jsonSync) j.syncError = '' // clear stale error when turning off
}
async function copy() {
  try {
    await navigator.clipboard.writeText(serialize(store.state).pretty)
    copied.value = true
    setTimeout(() => (copied.value = false), 1200)
  } catch {
    /* clipboard unavailable */
  }
}
</script>

<style scoped>
.jctrl { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.jlabel { font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: var(--st-muted); }
.grow { flex: 1 1 auto; }
.warns { font-size: 11px; color: #f59e0b; cursor: help; }
.warns.ok { color: #34d399; }
.syncerr { font-size: 11px; color: #f87171; cursor: help; }
</style>
