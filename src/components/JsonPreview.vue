<template>
  <UiCard v-if="store.state.ui.jsonOpen" class="jcard">
    <textarea
      v-if="j.editing"
      ref="taEl"
      v-model="j.draft"
      class="json edit"
      :class="{ bad: !!parseError }"
      spellcheck="false"
      placeholder="Paste an Ideogram JSON caption here, then Apply to load it into the studio."
    ></textarea>
    <pre v-else class="json">{{ pretty }}</pre>

    <div v-if="j.editing && parseError" class="parseerr">
      <div class="errhead">
        <span class="msg">⚠ {{ parseMsg }}</span>
        <button v-if="parseInfo.line" class="ebtn" title="Jump to this line in the editor" @click="jumpToError">go to →</button>
        <button class="ebtn" title="Copy the error" @click="copyError">{{ copiedErr ? 'copied ✓' : 'copy' }}</button>
      </div>
      <pre v-if="parseFrame" class="errframe" title="Jump to this line" @click="jumpToError">{{ parseFrame }}</pre>
    </div>
    <ul v-if="!j.editing && warnings.length" class="warnlist">
      <li v-for="(w, i) in warnings" :key="i">{{ w }}</li>
    </ul>
  </UiCard>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStudioStore } from '@/lib/store'
import { serialize } from '@/lib/caption'
import UiCard from './ui/UiCard.vue'

const store = useStudioStore()
const j = store.json
const taEl = ref<HTMLTextAreaElement | null>(null)
const copiedErr = ref(false)

const result = computed(() => serialize(store.state))
const pretty = computed(() => result.value.pretty)
const warnings = computed(() => result.value.warnings)

// Parse the draft and, on failure, pin down the line/column (V8 reports a
// character "position"; Firefox reports "line/column").
const parseInfo = computed<{ error: string; line: number | null; col: number | null }>(() => {
  if (!j.editing || !j.draft.trim()) return { error: '', line: null, col: null }
  try {
    JSON.parse(j.draft)
    return { error: '', line: null, col: null }
  } catch (e: any) {
    const msg = String(e?.message || e)
    let line: number | null = null
    let col: number | null = null
    const pos = msg.match(/position (\d+)/)
    if (pos) {
      const i = Number(pos[1])
      const upto = j.draft.slice(0, i)
      line = upto.split('\n').length
      col = i - upto.lastIndexOf('\n')
    } else {
      const lc = msg.match(/line (\d+) column (\d+)/)
      if (lc) {
        line = Number(lc[1])
        col = Number(lc[2])
      }
    }
    return { error: msg, line, col }
  }
})
const parseError = computed(() => parseInfo.value.error)
const parseMsg = computed(() => {
  const { error, line, col } = parseInfo.value
  if (!error) return ''
  const short = error
    .replace(/^JSON\.parse: /, '')
    .replace(/ in JSON at position \d+.*/i, '')
    .replace(/ at line \d+ column \d+.*/i, '')
  return line ? `Line ${line}, column ${col}: ${short}` : short
})
// compiler-style code frame: offending line (+ the one before) with a caret
const parseFrame = computed(() => {
  const { line, col } = parseInfo.value
  if (!line) return ''
  const lines = j.draft.split('\n')
  const w = String(line).length
  const rows: string[] = []
  if (line - 2 >= 0) rows.push(`${String(line - 1).padStart(w)} | ${lines[line - 2]}`)
  rows.push(`${String(line).padStart(w)} | ${lines[line - 1] ?? ''}`)
  rows.push(`${' '.repeat(w)} | ${' '.repeat(Math.max(0, (col ?? 1) - 1))}^`)
  return rows.join('\n')
})

function jumpToError() {
  const ta = taEl.value
  const { line } = parseInfo.value
  if (!ta || !line) return
  const lines = j.draft.split('\n')
  let start = 0
  for (let i = 0; i < line - 1; i++) start += lines[i].length + 1
  const end = start + (lines[line - 1]?.length ?? 0)
  ta.focus()
  ta.setSelectionRange(start, end)
  const lh = parseFloat(getComputedStyle(ta).lineHeight) || 16
  ta.scrollTop = Math.max(0, (line - 1) * lh - ta.clientHeight / 2)
}
async function copyError() {
  const text = parseFrame.value ? `${parseMsg.value}\n${parseFrame.value}` : parseMsg.value
  try {
    await navigator.clipboard.writeText(text)
    copiedErr.value = true
    setTimeout(() => (copiedErr.value = false), 1200)
  } catch {
    /* clipboard unavailable */
  }
}
</script>

<style scoped>
.json {
  margin: 0; background: var(--st-input); border: 1px solid var(--st-border); border-radius: 6px; padding: 8px;
  font-size: 11px; line-height: 1.4; max-height: 320px; overflow: auto; color: var(--st-text);
  white-space: pre; font-family: ui-monospace, monospace;
}
.json.edit { width: 100%; box-sizing: border-box; min-height: 160px; max-height: 360px; resize: vertical; white-space: pre; }
.json.edit.bad { border-color: #f87171; }
.errhead { display: flex; align-items: center; gap: 8px; font-size: 10px; color: #f87171; font-family: ui-monospace, monospace; }
.errhead .msg { flex: 1; }
.ebtn { flex: none; background: var(--st-btn); border: 1px solid var(--st-border); color: var(--st-muted); border-radius: 3px; font-size: 10px; padding: 1px 6px; cursor: pointer; }
.ebtn:hover { color: var(--st-text); border-color: var(--st-accent); }
.errframe { margin: 4px 0 0; padding: 6px 8px; background: var(--st-input); border: 1px solid var(--st-border); border-radius: 4px; font: 11px/1.5 ui-monospace, monospace; color: var(--st-text); white-space: pre; overflow-x: auto; cursor: pointer; }
.errframe:hover { border-color: var(--st-accent); }
.warnlist { margin: 0; padding-left: 16px; font-size: 10px; color: #f59e0b; max-height: 90px; overflow: auto; }
</style>
