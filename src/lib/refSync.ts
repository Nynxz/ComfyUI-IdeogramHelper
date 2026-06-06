// Shared bridge for the "Ideogram Studio Ref Sync" node. The node broadcasts a
// websocket event with a temp-image descriptor; we turn it into a /view URL and
// expose it as a reactive ref. Studios with "sync" on watch it and swap their
// trace backdrop.

import { api } from '@comfy/api'
import { ref } from 'vue'

export const refSyncImage = ref<string | null>(null)
// Incoming caption JSON from an "Ideogram Studio JSON Sync" node. Bumped each
// broadcast (counter forces watchers even if the text is identical).
export const jsonSyncCaption = ref<{ json: string; n: number }>({ json: '', n: 0 })

let inited = false
export function initRefSync() {
  if (inited) return
  inited = true
  try {
    ;(api as any).addEventListener('ideogram-studio.ref-sync', (e: any) => {
      const d = (e && e.detail) || {}
      if (!d.filename) return
      const p = new URLSearchParams({
        filename: d.filename,
        subfolder: d.subfolder || '',
        type: d.type || 'temp',
      })
      // cache-bust so the same filename still triggers watchers + reloads
      refSyncImage.value = `/view?${p.toString()}&r=${Date.now()}`
    })
    ;(api as any).addEventListener('ideogram-studio.json-sync', (e: any) => {
      const d = (e && e.detail) || {}
      if (typeof d.json !== 'string') return
      jsonSyncCaption.value = { json: d.json, n: jsonSyncCaption.value.n + 1 }
    })
  } catch (err) {
    console.warn('[IdeogramStudio] sync listener failed to register', err)
  }
}
